import { action, observable } from 'mobx';

/**
 * Mirror of `/account` -> `plan.features`, kept here instead of read straight
 * off userStore: `split-utils` is pulled in by routes/layout modules that load
 * before App/services, so importing the store there closes an import cycle
 * (api_client -> routes -> saasComponents -> split-utils -> userStore ->
 * services -> BaseService -> api_client). Account fills it on construction.
 *
 * Observable so `observer` components re-render when the account lands.
 */
const features = observable.box<string[]>([], { deep: false });

export const setPlanFeatures = action((next?: string[]) => {
  features.set(Array.isArray(next) ? next : []);
});

export const planFeatures = (): string[] => features.get();
