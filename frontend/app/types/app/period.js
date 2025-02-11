import { DateTime, Interval, Settings } from "luxon";
import Record from "Types/Record";

export const LAST_30_MINUTES = "LAST_30_MINUTES";
export const TODAY = "TODAY";
export const LAST_24_HOURS = "LAST_24_HOURS";
export const YESTERDAY = "YESTERDAY";
export const LAST_7_DAYS = "LAST_7_DAYS";
export const LAST_30_DAYS = "LAST_30_DAYS";
export const THIS_MONTH = "THIS_MONTH";
export const LAST_MONTH = "LAST_MONTH";
export const THIS_YEAR = "THIS_YEAR";
export const CUSTOM_RANGE = "CUSTOM_RANGE";
export const PREV_24_HOURS = "PREV_24_HOURS";
export const PREV_7_DAYS = "PREV_7_DAYS";
export const PREV_30_DAYS = "PREV_30_DAYS";
export const PREV_QUARTER = "PREV_QUARTER";

function getRange(rangeName, offset) {
    const now = DateTime.now().setZone(offset);
    switch (rangeName) {
        case TODAY:
            return Interval.fromDateTimes(now.startOf("day"), now.endOf("day"));
        case YESTERDAY:
            const yesterday = now.minus({ days: 1 });
            return Interval.fromDateTimes(
              yesterday.startOf("day"),
              yesterday.endOf("day")
            );
        case LAST_24_HOURS:
            return Interval.fromDateTimes(now.minus({ hours: 24 }), now);
        case LAST_30_MINUTES:
            return Interval.fromDateTimes(
              now.minus({ minutes: 30 }).startOf("minute"),
              now.startOf("minute")
            );
        case LAST_7_DAYS:
            return Interval.fromDateTimes(
              now.minus({ days: 7 }).endOf("day"),
              now.endOf("day")
            );
        case LAST_30_DAYS:
            return Interval.fromDateTimes(
              now.minus({ days: 30 }).startOf("day"),
              now.endOf("day")
            );
        case THIS_MONTH:
            return Interval.fromDateTimes(now.startOf("month"), now.endOf("month"));
        case LAST_MONTH:
            const lastMonth = now.minus({ months: 1 });
            return Interval.fromDateTimes(lastMonth.startOf("month"), lastMonth.endOf("month"));
        case THIS_YEAR:
            return Interval.fromDateTimes(now.startOf("year"), now.endOf("year"));
        case PREV_24_HOURS:
            return Interval.fromDateTimes(now.minus({ hours: 48 }), now.minus({ hours: 24 }));
        case PREV_7_DAYS:
            return Interval.fromDateTimes(
              now.minus({ days: 14 }).startOf("day"),
              now.minus({ days: 7 }).endOf("day")
            );
        case PREV_30_DAYS:
            return Interval.fromDateTimes(
              now.minus({ days: 60 }).startOf("day"),
              now.minus({ days: 30 }).endOf("day")
            );
        default:
            return Interval.fromDateTimes(now, now);
    }
}

const substractValues = {
    [PREV_24_HOURS]: { hours: 24 },
    [PREV_7_DAYS]: { days: 7 },
    [PREV_30_DAYS]: { days: 30 },
    [PREV_QUARTER]: { months: 3 },
}

export default Record(
  {
      start: 0,
      end: 0,
      rangeName: CUSTOM_RANGE,
      range: Interval.fromDateTimes(DateTime.now(), DateTime.now()),
      substract: null,
  },
  {
      // type substractors = 'PREV_24_HOURS' | 'PREV_7_DAYS' | 'PREV_30_DAYS' | 'PREV_QUARTER';
      fromJS: (period) => {
          const offset = period.timezoneOffset || DateTime.now().offset;
          if (!period.rangeName || period.rangeName === CUSTOM_RANGE) {
              const isLuxon = DateTime.isDateTime(period.start);
              let start = isLuxon
                ? period.start : DateTime.fromMillis(period.start || 0, { zone: Settings.defaultZone });
              let end = isLuxon
                ? period.end : DateTime.fromMillis(period.end || 0, { zone: Settings.defaultZone });
              if (period.substract) {
                  const delta = substractValues[period.substract]
                  start = start.minus(delta);
                  end = end.minus(delta);
              }
              const range = Interval.fromDateTimes(start, end);
              return {
                  ...period,
                  range,
                  start: range.start.toMillis(),
                  end: range.end.toMillis(),
                  rangeName: period.substract ? period.substract : undefined
              };
          }
          const range = getRange(period.rangeName, offset);
          return {
              ...period,
              range,
              start: range.start.toMillis(),
              end: range.end.toMillis(),
          };
      },
      methods: {
          toJSON() {
              return {
                  startDate: this.start,
                  endDate: this.end,
                  rangeName: this.rangeName,
                  rangeValue: this.rangeName,
              };
          },
          toTimestamps() {
              return {
                  startTimestamp: this.start,
                  endTimestamp: this.end,
              };
          },
          getDuration() {
              return this.range.end.diff(this.range.start).as("milliseconds");
          },
          rangeFormatted(format = "MMM dd yyyy, HH:mm", tz) {
              const start = this.range.start.setZone(tz);
              const end = this.range.end.setZone(tz);
              return `${start.toFormat(format)} - ${end.toFormat(format)}`;
          },
      },
  }
);
