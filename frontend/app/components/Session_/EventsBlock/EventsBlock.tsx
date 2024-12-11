import { mergeEventLists, sortEvents } from 'Types/session';
import { TYPES } from 'Types/session/event';
import cn from 'classnames';
import { observer } from 'mobx-react-lite';
import React from 'react';
import { VList, VListHandle } from 'virtua';

import { PlayerContext } from 'App/components/Session/playerContext';
import { useStore } from 'App/mstore';
import { Icon } from 'UI';

import EventGroupWrapper from './EventGroupWrapper';
import EventSearch from './EventSearch/EventSearch';
import styles from './eventsBlock.module.css';

interface IProps {
  setActiveTab: (tab?: string) => void;
}

function EventsBlock(props: IProps) {
  const { notesStore, uxtestingStore, uiPlayerStore, sessionStore } = useStore();
  const session = sessionStore.current;
  const notesWithEvents = session.notesWithEvents;
  const uxtVideo = session.uxtVideo;
  const filteredEvents = sessionStore.filteredEvents;
  const query = sessionStore.eventsQuery;
  const eventsIndex = sessionStore.eventsIndex;
  const setEventFilter = sessionStore.setEventQuery;
  const filterOutNote = sessionStore.filterOutNote;
  const [mouseOver, setMouseOver] = React.useState(false);
  const scroller = React.useRef<VListHandle>(null);
  const zoomEnabled = uiPlayerStore.timelineZoom.enabled;
  const zoomStartTs = uiPlayerStore.timelineZoom.startTs;
  const zoomEndTs = uiPlayerStore.timelineZoom.endTs;
  const { store, player } = React.useContext(PlayerContext);

  const {
    time,
    endTime,
    playing,
    tabStates,
    tabChangeEvents = [],
  } = store.get();

  const {
    setActiveTab,
  } = props;
  const notes = notesStore.sessionNotes;

  const filteredLength = filteredEvents?.length || 0;
  const notesWithEvtsLength = notesWithEvents?.length || 0;
  const notesLength = notes.length;
  const eventListNow: any[] = [];
  if (tabStates !== undefined) {
    eventListNow.concat(Object.values(tabStates)[0]?.eventListNow || []);
  } else {
    eventListNow.concat(store.get().eventListNow);
  }

  const usedEvents = React.useMemo(() => {
    if (tabStates !== undefined) {
      tabChangeEvents.forEach((ev) => {
        const urlsList = tabStates[ev.tabId]?.urlsList || [];
        let found = false;
        let i = urlsList.length - 1;
        while (!found && i >= 0) {
          const item = urlsList[i];
          if (item.url && item.time <= ev.time) {
            found = true;
            ev.activeUrl = item.url.replace(/.*\/\/[^\/]*/, '');
          }
          i--;
        }
      });
    }
    const eventsWithMobxNotes = [...notesWithEvents, ...notes].sort(sortEvents);
    return mergeEventLists(
      filteredLength > 0 ? filteredEvents : eventsWithMobxNotes,
      tabChangeEvents
    ).filter((e) =>
      zoomEnabled
        ? 'time' in e
          ? e.time >= zoomStartTs && e.time <= zoomEndTs
          : false
        : true
    );
  }, [
    filteredLength,
    notesWithEvtsLength,
    notesLength,
    zoomEnabled,
    zoomStartTs,
    zoomEndTs,
  ]);
  const findLastFitting = React.useCallback(
    (time: number) => {
      if (!usedEvents.length) return 0;
      let i = usedEvents.length - 1;
      if (time > endTime / 2) {
        while (i >= 0) {
          const event = usedEvents[i];
          if ('time' in event && event.time <= time) break;
          i--;
        }
        return i;
      } else {
        let l = 0;
        while (l < i) {
          const event = usedEvents[l];
          if ('time' in event && event.time >= time) break;
          l++;
        }
        return l;
      }
    },
    [usedEvents, time, endTime]
  );
  const currentTimeEventIndex = findLastFitting(time);

  const write = ({
    target: { value },
  }: React.ChangeEvent<HTMLInputElement>) => {
    setEventFilter({ query: value });

    setTimeout(() => {
      if (!scroller.current) return;

      scroller.current.scrollToIndex(0);
    }, 100);
  };

  const clearSearch = () => {
    setEventFilter({ query: '' });

    setTimeout(() => {
      if (!scroller.current) return;

      scroller.current.scrollToIndex(0);
    }, 100);
  };

  React.useEffect(() => {
    return () => {
      clearSearch();
    };
  }, []);
  React.useEffect(() => {
    if (scroller.current) {
      if (!mouseOver) {
        scroller.current.scrollToIndex(currentTimeEventIndex, { align: 'center' });
      }
    }
  }, [currentTimeEventIndex]);

  const onEventClick = (_: React.MouseEvent, event: { time: number }) => {
    player.jump(event.time);
    setEventFilter({ query: '' });
  };
  const onMouseOver = () => setMouseOver(true);
  const onMouseLeave = () => setMouseOver(false);

  const renderGroup = ({
    index,
  }: {
    index: number;
  }) => {
    const isLastEvent = index === usedEvents.length - 1;
    const isLastInGroup =
      isLastEvent || usedEvents[index + 1]?.type === TYPES.LOCATION;
    const event = usedEvents[index];
    const isNote = 'noteId' in event;
    const isTabChange = 'type' in event && event.type === 'TABCHANGE';
    const isCurrent = index === currentTimeEventIndex;
    const isPrev = index < currentTimeEventIndex;
    return (
      <EventGroupWrapper
        query={query}
        presentInSearch={eventsIndex.includes(index)}
        isFirst={index == 0}
        onEventClick={onEventClick}
        event={event}
        isLastEvent={isLastEvent}
        isLastInGroup={isLastInGroup}
        isCurrent={isCurrent}
        showSelection={!playing}
        isNote={isNote}
        isTabChange={isTabChange}
        isPrev={isPrev}
        filterOutNote={filterOutNote}
      />
    );
  };

  const isEmptySearch = query && (usedEvents.length === 0 || !usedEvents);
  const eventsText = `${query ? 'Filtered' : ''} ${usedEvents.length} Events`;

  return (
    <>
      <div className={cn(styles.header, 'py-4 px-2 bg-gradient-to-t from-transparent to-neutral-50 h-[57px]'  )}>
        {uxtestingStore.isUxt() ? (
          <div style={{ width: 240, height: 130 }} className={'relative'}>
            <video
              className={'z-20 fixed'}
              muted
              autoPlay
              controls
              src={uxtVideo}
              width={240}
            />
            <div
              style={{
                top: '40%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
              className={'absolute z-10'}
            >
              No video
            </div>
          </div>
        ) : null}
        <div className={cn(styles.hAndProgress, 'mt-0')}>
          <EventSearch
            onChange={write}
            setActiveTab={setActiveTab}
            value={query}
            eventsText={usedEvents.length ? `${usedEvents.length} Events` : '0 Events'}
          />
        </div>
      </div>
      <div
        className={cn('flex-1 pb-4', styles.eventsList)}
        id="eventList"
        data-openreplay-masked
        onMouseOver={onMouseOver}
        onMouseLeave={onMouseLeave}
      >
        {isEmptySearch && (
          <div className="flex items-center p-4">
            <Icon name="binoculars" size={18} />
            <span className="ml-2">No Matching Results</span>
          </div>
        )}
        <VList
          count={usedEvents.length}
          className={styles.eventsList}
          ref={scroller}
        >
          {usedEvents.map((_, i) => {
              return renderGroup({ index: i })
            }
          )}
        </VList>
      </div>
    </>
  );
}

export default observer(EventsBlock);
