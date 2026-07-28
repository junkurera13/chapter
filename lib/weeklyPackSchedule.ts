export const WEEKLY_PACK_RELEASE_HOUR = 9;
export const WEEKLY_PACK_VALIDITY_DAYS = 21;

type LocalDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function partsInTimezone(epoch: number, timezone: string): LocalDateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(epoch));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function isoDate(parts: Pick<LocalDateParts, "year" | "month" | "day">) {
  return `${parts.year}-${`${parts.month}`.padStart(2, "0")}-${`${parts.day}`.padStart(2, "0")}`;
}

function addCalendarDays(day: string, amount: number) {
  const [year, month, date] = day.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, date + amount));
  return isoDate({
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  });
}

/**
 * Convert an IANA-local wall-clock time into one UTC instant. Two corrections
 * handle ordinary offsets and the DST boundary without guessing a fixed zone
 * offset.
 */
export function zonedDateTimeToEpoch(args: {
  day: string;
  hour: number;
  minute?: number;
  timezone: string;
}) {
  const [year, month, day] = args.day.split("-").map(Number);
  const minute = args.minute ?? 0;
  const desiredAsUtc = Date.UTC(year, month - 1, day, args.hour, minute);
  let epoch = desiredAsUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = partsInTimezone(epoch, args.timezone);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    const correction = desiredAsUtc - actualAsUtc;
    epoch += correction;
    if (correction === 0) break;
  }
  return epoch;
}

export function localDayAt(epoch: number, timezone: string) {
  return isoDate(partsInTimezone(epoch, timezone));
}

export function weekdayOf(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date)).getUTCDay();
}

export function weeklyPackWindow(args: {
  timezone: string;
  now?: number;
}) {
  const now = args.now ?? Date.now();
  const localDay = localDayAt(now, args.timezone);
  const weekday = weekdayOf(localDay);
  const daysUntilSaturday = (6 - weekday + 7) % 7;
  let weekKey = addCalendarDays(localDay, daysUntilSaturday);
  let releaseAt = zonedDateTimeToEpoch({
    day: weekKey,
    hour: WEEKLY_PACK_RELEASE_HOUR,
    timezone: args.timezone,
  });
  if (releaseAt <= now) {
    weekKey = addCalendarDays(weekKey, 7);
    releaseAt = zonedDateTimeToEpoch({
      day: weekKey,
      hour: WEEKLY_PACK_RELEASE_HOUR,
      timezone: args.timezone,
    });
  }
  return {
    weekKey,
    releaseAt,
    expiresAt: zonedDateTimeToEpoch({
      day: addCalendarDays(weekKey, WEEKLY_PACK_VALIDITY_DAYS),
      hour: WEEKLY_PACK_RELEASE_HOUR,
      timezone: args.timezone,
    }),
  };
}

export function isWeeklyPackPreparationDay(args: {
  timezone: string;
  now?: number;
}) {
  const weekday = weekdayOf(localDayAt(args.now ?? Date.now(), args.timezone));
  return weekday === 3 || weekday === 4;
}

export function isWeeklyPackRetryDay(args: {
  timezone: string;
  now?: number;
}) {
  return weekdayOf(localDayAt(args.now ?? Date.now(), args.timezone)) === 5;
}
