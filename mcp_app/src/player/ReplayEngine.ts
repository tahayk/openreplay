import Screen from '@openreplay/player/web/Screen/Screen';
import PagesManager from '@openreplay/player/web/managers/PagesManager';
import ListWalker from '@openreplay/player/common/ListWalker';
import rewriteMessage from '@openreplay/player/web/messages/rewriter/rewriteMessage';
import type {
  Message,
  MouseMove,
  MouseClick,
  SetViewportScroll,
  SetViewportSize,
  TabChange,
} from '@openreplay/player/web/messages';
import { MType } from '@openreplay/player/web/messages';

export interface SkipInterval {
  start: number;
  end: number;
}

export interface PlaybackState {
  time: number;
  playing: boolean;
  completed: boolean;
  endTime: number;
  ready: boolean;
  speed: number;
  skipInactivity: boolean;
  skipIntervals: SkipInterval[];
  /** True while proxied stylesheets are still resolving — playback is held. */
  stalled: boolean;
}

const DOM_MESSAGE_TYPES = new Set([
  MType.CreateDocument,
  MType.CreateElementNode,
  MType.CreateTextNode,
  MType.MoveNode,
  MType.RemoveNode,
  MType.SetNodeAttribute,
  MType.RemoveNodeAttribute,
  MType.SetNodeData,
  MType.SetCssData,
  MType.SetNodeScroll,
  MType.SetInputValue,
  MType.SetInputChecked,
  MType.SetNodeFocus,
  MType.SelectionChange,
  MType.CreateIFrameDocument,
  MType.AdoptedSsReplace,
  MType.AdoptedSsInsertRule,
  MType.AdoptedSsDeleteRule,
  MType.AdoptedSsAddOwner,
  MType.AdoptedSsRemoveOwner,
  MType.LoadFontFace,
  MType.SetNodeSlot,
  MType.NodeAnimationResult,
  MType.StringDict,
  MType.StringDictGlobal,
  MType.StringDictDeprecated,
  MType.SetNodeAttributeDict,
  MType.SetNodeAttributeDictGlobal,
  MType.SetNodeAttributeDictDeprecated,
  // URLBased variants get rewritten to their non-URL counterparts
  MType.SetNodeAttributeURLBased,
  MType.SetCssDataURLBased,
  MType.AdoptedSsInsertRuleURLBased,
  MType.AdoptedSsReplaceURLBased,
]);

const ACTIVITY_MESSAGE_TYPES = new Set([
  MType.MouseMove,
  MType.MouseClick,
  MType.MouseClickDeprecated,
]);

export type CssProxyFn = (url: string) => Promise<string | null>;

/** How long playback waits on a single proxied stylesheet before giving up. */
const CSS_HOLD_TIMEOUT = 5000;

/** Single-tab DOM state. Mirrors the per-tab slice of TabSessionManager. */
interface TabState {
  pagesManager: PagesManager;
  firstMessageTime: number;
  cssLoading: boolean;
}

export default class ReplayEngine {
  private screen: Screen;
  private mouseWalker = new ListWalker<MouseMove>();
  private clickWalker = new ListWalker<MouseClick>();
  private scrollWalker = new ListWalker<SetViewportScroll>();
  private resizeWalker = new ListWalker<SetViewportSize>();

  // One PagesManager per recorded tab, all painting into the shared Screen.
  // Merging tabs into a single manager interleaves two documents' node ids.
  private tabs = new Map<string, TabState>();
  private activeTabWalker = new ListWalker<TabChange>();
  private activeTabId = '';
  private lastMoveTime = 0;

  private time = 0;
  private playing = false;
  private completed = false;
  private endTime = 0;
  private speed = 1;
  private skipInactivity = false;
  private skipIntervals: SkipInterval[] = [];
  private animFrameId = 0;
  private ready = false;

  // CSS proxy for sandbox — fetches external stylesheets via server
  private cssProxyFn: CssProxyFn | null = null;
  private proxiedCss = new Map<string, string>(); // href -> CSS content
  private lastProxiedDoc: Document | null = null;
  private cssProxyPending = 0;

  private onStateChange: (state: PlaybackState) => void;

  constructor(opts: { onStateChange: (s: PlaybackState) => void }) {
    this.onStateChange = opts.onStateChange;
    this.screen = new Screen(false);
  }

  setCssProxy(fn: CssProxyFn) {
    this.cssProxyFn = fn;
  }

  private getTab(tabId: string): TabState {
    let tab = this.tabs.get(tabId);
    if (!tab) {
      tab = {
        pagesManager: new PagesManager(
          this.screen,
          false,
          (flag: boolean) => {
            tab!.cssLoading = flag;
          },
          () => {},
        ),
        firstMessageTime: Infinity,
        cssLoading: false,
      };
      this.tabs.set(tabId, tab);
      if (!this.activeTabId) this.activeTabId = tabId;
    }
    return tab;
  }

  loadMessages(messages: Message[], duration: number) {
    let lastMessageTime = 0;

    for (const rawMsg of messages) {
      const msg = rewriteMessage(rawMsg) as Message;
      const time = (msg as any).time ?? 0;
      if (time > lastMessageTime) lastMessageTime = time;

      if (msg.tp === MType.MouseMove) {
        this.mouseWalker.append(msg as MouseMove);
      } else if (msg.tp === MType.MouseClick || msg.tp === MType.MouseClickDeprecated) {
        this.clickWalker.append(msg as MouseClick);
      } else if (msg.tp === MType.SetViewportScroll) {
        this.scrollWalker.append(msg as SetViewportScroll);
      } else if (msg.tp === MType.SetViewportSize) {
        this.resizeWalker.append(msg as SetViewportSize);
      } else if (msg.tp === MType.TabChange) {
        this.activeTabWalker.append(msg as TabChange);
      }

      // DOM messages go to their own tab's pagesManager
      if (DOM_MESSAGE_TYPES.has(msg.tp)) {
        const tab = this.getTab((msg as any).tabId ?? '');
        if (time < tab.firstMessageTime) tab.firstMessageTime = time;
        tab.pagesManager.appendMessage(msg);
      }
    }

    this.sortDomRemoveMessages(messages);

    // The API-reported duration can fall short of the last recorded message;
    // the player raises endTime to lastMessageTime for the same reason.
    this.endTime = Math.max(duration, lastMessageTime);
    this.skipIntervals = this.computeSkipIntervals(messages, this.endTime);
    this.ready = true;
    this.emitState();
  }

  /**
   * Same-timestamp RemoveNode messages targeting <head> children must apply
   * before the non-removes in that group, otherwise a single tracker mutation
   * that removes and re-adds a stylesheet drops it. Mirrors
   * TabSessionManager.sortDomRemoveMessages.
   */
  private sortDomRemoveMessages(messages: Message[]) {
    const headChildrenIds = new Set<number>(
      messages
        .filter((m) => (m as any).parentID === 1 && typeof (m as any).id === 'number')
        .map((m) => (m as any).id as number),
    );
    if (headChildrenIds.size === 0) return;

    const comparator = (m1: Message, m2: Message) => {
      if (m1.time !== m2.time) return 0;
      const r1 = m1.tp === MType.RemoveNode;
      const r2 = m2.tp === MType.RemoveNode;
      const h1 = r1 && headChildrenIds.has((m1 as any).id);
      const h2 = r2 && headChildrenIds.has((m2 as any).id);
      if (r1 && !r2 && h1) return -1;
      if (r2 && !r1 && h2) return 1;
      if (r1 && r2) {
        if (h1 && !h2) return -1;
        if (h2 && !h1) return 1;
      }
      return 0;
    };

    for (const tab of this.tabs.values()) {
      tab.pagesManager.sortPages(comparator);
    }
  }

  attach(parent: HTMLElement) {
    this.screen.attach(parent);
  }

  play() {
    if (this.completed) {
      this.jump(0);
      this.completed = false;
    }

    if (!this.ready) return;
    cancelAnimationFrame(this.animFrameId);
    this.playing = true;
    this.emitState();
    this.startAnimation();
  }

  pause() {
    cancelAnimationFrame(this.animFrameId);
    this.playing = false;
    this.emitState();
  }

  togglePlay() {
    if (this.playing) {
      this.pause();
    } else {
      this.play();
    }
  }

  jump(time: number) {
    this.time = Math.max(0, Math.min(time, this.endTime));
    this.completed = false;
    this.move(this.time);
    this.emitState();

    if (this.playing) {
      cancelAnimationFrame(this.animFrameId);
      this.startAnimation();
    }
  }

  setSpeed(speed: number) {
    this.speed = speed;
    this.emitState();
  }

  toggleSkipInactivity() {
    this.skipInactivity = !this.skipInactivity;
    this.emitState();
  }

  clean() {
    cancelAnimationFrame(this.animFrameId);
    this.screen.clean();
  }

  getState(): PlaybackState {
    return {
      time: this.time,
      playing: this.playing,
      completed: this.completed,
      endTime: this.endTime,
      ready: this.ready,
      speed: this.speed,
      skipInactivity: this.skipInactivity,
      skipIntervals: this.skipIntervals,
      stalled: this.isStalled(),
    };
  }

  /**
   * Playback must not advance while a stylesheet is still resolving, or DOM
   * mutations land against an unstyled document. Same gate as the player's
   * `ready` flag in Animator.
   */
  private isStalled(): boolean {
    if (this.cssProxyPending > 0) return true;
    const tab = this.tabs.get(this.activeTabId);
    return tab ? tab.cssLoading : false;
  }

  private emitState() {
    this.onStateChange(this.getState());
  }

  private startAnimation() {
    let prevAnimTime = performance.now();

    const frameHandler = (animCurrentTime: number) => {
      // Hold the clock (but keep the frame loop alive) while CSS is loading.
      const diffTime = this.isStalled()
        ? 0
        : Math.max(animCurrentTime - prevAnimTime, 0) * this.speed;
      let newTime = this.time + diffTime;
      prevAnimTime = animCurrentTime;

      // Skip inactivity — jump past inactive intervals
      if (this.skipInactivity) {
        const interval = this.skipIntervals.find(
          (si) => newTime > si.start && newTime < si.end,
        );
        if (interval) newTime = interval.end;
      }

      if (newTime >= this.endTime) {
        newTime = this.endTime;
        this.time = newTime;
        this.move(newTime);
        this.playing = false;
        this.completed = true;
        this.emitState();
        return;
      }

      this.time = newTime;
      this.move(newTime);
      this.emitState();
      this.animFrameId = requestAnimationFrame(frameHandler);
    };

    this.animFrameId = requestAnimationFrame(frameHandler);
  }

  /**
   * Detect gaps in activity longer than 10% of session duration.
   * Mirrors ActivityManager from the main player.
   */
  private computeSkipIntervals(messages: Message[], duration: number): SkipInterval[] {
    const minGap = duration * 0.1;
    const intervals: SkipInterval[] = [];
    let lastActivity = 0;

    for (const msg of messages) {
      if (DOM_MESSAGE_TYPES.has(msg.tp) || ACTIVITY_MESSAGE_TYPES.has(msg.tp)) {
        const t = (msg as any).time ?? 0;
        if (t - lastActivity >= minGap) {
          intervals.push({ start: lastActivity, end: t });
        }
        lastActivity = t;
      }
    }
    if (duration - lastActivity >= minGap) {
      intervals.push({ start: lastActivity, end: duration });
    }
    return intervals;
  }

  private move(t: number) {
    // Rewinding past a tab's first message must rewind that tab's DOM too
    if (t < this.lastMoveTime) {
      this.activeTabWalker.reset();
      for (const tab of this.tabs.values()) {
        if (tab.firstMessageTime > t) tab.pagesManager.reset();
      }
    }
    this.lastMoveTime = t;

    // Resolve the active tab, resetting its DOM so CreateDocument re-applies
    const tabChange = this.activeTabWalker.moveGetLast(t);
    if (tabChange && tabChange.tabId !== this.activeTabId && this.tabs.has(tabChange.tabId)) {
      this.activeTabId = tabChange.tabId;
      this.tabs.get(this.activeTabId)!.pagesManager.reset();
    }

    // Apply DOM mutations for the active tab only
    const activeTab = this.tabs.get(this.activeTabId);
    if (activeTab) {
      void activeTab.pagesManager.moveReady(t);
    }

    // Move cursor
    const mouseMsg = this.mouseWalker.moveGetLast(t);
    if (mouseMsg) {
      this.screen.cursor.move({ x: mouseMsg.x, y: mouseMsg.y });
    }

    // Handle clicks
    const clickMsg = this.clickWalker.moveGetLast(t);
    if (clickMsg) {
      this.screen.cursor.click();
    }

    // Viewport scroll
    const scrollMsg = this.scrollWalker.moveGetLast(t);
    if (scrollMsg) {
      this.screen.window?.scrollTo(scrollMsg.x, scrollMsg.y);
    }

    // Viewport resize
    const resizeMsg = this.resizeWalker.moveGetLast(t);
    if (resizeMsg) {
      this.screen.scale({ width: resizeMsg.width, height: resizeMsg.height });
    }

    // Proxy external stylesheets (async, fire-and-forget)
    this.proxyNewStylesheets();
  }

  /**
   * Scan the iframe document for <link rel="stylesheet"> tags that haven't
   * been proxied yet. Uses adoptedStyleSheets to inject CSS WITHOUT modifying
   * the DOM tree (which would break VirtualDOM reconciliation).
   */
  private proxyNewStylesheets() {
    if (!this.cssProxyFn) return;
    const doc = this.screen.document;
    if (!doc) return;

    // When the document changes (page navigation), re-apply cached stylesheets
    if (doc !== this.lastProxiedDoc) {
      this.lastProxiedDoc = doc;
      this.reapplyAdoptedStylesheets(doc);
    }

    const links = doc.querySelectorAll('link[rel="stylesheet"]');
    if (links.length === 0) return;

    const fetcher = this.cssProxyFn;
    for (const link of links) {
      const href = link.getAttribute('href');
      if (!href || this.proxiedCss.has(href)) continue;
      // Mark as in-progress immediately to avoid double-fetching
      this.proxiedCss.set(href, '');
      this.cssProxyPending++;

      // The clock is held by isStalled() until this settles — but only for
      // CSS_HOLD_TIMEOUT, so one unreachable stylesheet host can't freeze the
      // replay. A late response is still applied, just not waited for.
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        this.cssProxyPending--;
      };
      const holdTimer = setTimeout(release, CSS_HOLD_TIMEOUT);

      (async () => {
        try {
          const css = await fetcher(href);
          if (css) {
            const processed = css
              .replace(/:hover/g, '.-openreplay-hover')
              .replace(/:focus/g, '.-openreplay-focus');
            this.proxiedCss.set(href, processed);
            this.applyAdoptedStylesheet(doc, processed);
          }
        } catch {
          // CSS proxy fetch failed — non-critical, skip
        } finally {
          clearTimeout(holdTimer);
          release();
        }
      })();
    }
  }

  /** Apply a single stylesheet via adoptedStyleSheets (no DOM modification) */
  private applyAdoptedStylesheet(doc: Document, css: string) {
    try {
      const win = doc.defaultView;
      if (!win) return;
      const sheet = new win.CSSStyleSheet();
      sheet.replaceSync(css);
      doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
    } catch {
      // adoptedStyleSheets not supported or doc detached
    }
  }

  /** Re-apply all cached stylesheets to a new document (after page change) */
  private reapplyAdoptedStylesheets(doc: Document) {
    for (const [, css] of this.proxiedCss) {
      if (css) {
        this.applyAdoptedStylesheet(doc, css);
      }
    }
  }
}
