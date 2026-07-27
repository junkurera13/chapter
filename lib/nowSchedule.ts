import {
  NOW_SCHEDULE_HORIZON_DAYS,
  NOW_TIME_WINDOWS,
  type NowTimeWindow,
} from "./nowChapterSchema";

/**
 * Every day in Chapter is a calendar day where the person is standing, not an
 * instant on a timeline. A chapter set for Saturday is Saturday in Seoul even
 * when the browser is briefly in Lisbon, so the arithmetic here runs on
 * YYYY-MM-DD strings and touches Date only at local noon — far enough from
 * either edge that a daylight-saving hour cannot push a day across a border.
 */
const NOON = "T12:00:00";

export function isoDay(date: Date = new Date()) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function isIsoDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}${NOON}`);
  return !Number.isNaN(parsed.getTime()) && isoDay(parsed) === value;
}

export function addDays(iso: string, days: number) {
  const date = new Date(`${iso}${NOON}`);
  date.setDate(date.getDate() + days);
  return isoDay(date);
}

/** Whole days from one day to another; negative once `to` is in the past. */
export function daysBetween(from: string, to: string) {
  const start = new Date(`${from}${NOON}`).getTime();
  const end = new Date(`${to}${NOON}`).getTime();
  return Math.round((end - start) / 86_400_000);
}

/** A day already gone. Nothing can be written for it, and nothing should be. */
export function hasPassed(scheduledFor: string, today = isoDay()) {
  return scheduledFor < today;
}

export function canSchedule(scheduledFor: string, today = isoDay()) {
  if (!isIsoDay(scheduledFor)) return false;
  const away = daysBetween(today, scheduledFor);
  return away >= 0 && away <= NOW_SCHEDULE_HORIZON_DAYS;
}

/**
 * The rail of days the form offers. Starts today, because someone free this
 * evening should still be able to say so — the chapter simply arrives without
 * its three days of warning.
 */
export function upcomingDays(count: number, from = isoDay()) {
  return Array.from({ length: count }, (_unused, index) => {
    const iso = addDays(from, index);
    const date = new Date(`${iso}${NOON}`);
    return {
      iso,
      weekday: date.toLocaleDateString(undefined, { weekday: "short" }),
      dayOfMonth: date.getDate(),
      month: date.toLocaleDateString(undefined, { month: "short" }),
      /** First of its month in the rail, so the rail can mark the turn. */
      startsMonth: index === 0 || date.getDate() === 1,
    };
  });
}

/**
 * The next day worth offering to write for: today if today is already the
 * weekend, otherwise the coming Saturday.
 *
 * Nobody sets a day aside for a chapter they have not read yet, so the offer
 * has to name a day on the person's behalf. This is the day it names, and it
 * is a guess rather than a booking: nothing is claimed until they say yes.
 */
export function comingWeekend(today = isoDay()) {
  const weekday = new Date(`${today}${NOON}`).getDay();
  if (weekday === 0 || weekday === 6) return today;
  return addDays(today, 6 - weekday);
}

export function formatDay(iso: string, today = isoDay()) {
  if (!isIsoDay(iso)) return iso;
  const away = daysBetween(today, iso);
  if (away === 0) return "Today";
  if (away === 1) return "Tomorrow";
  const date = new Date(`${iso}${NOON}`);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatWeekday(iso: string) {
  if (!isIsoDay(iso)) return iso;
  return new Date(`${iso}${NOON}`).toLocaleDateString(undefined, {
    weekday: "long",
  });
}

/** Chosen windows back in the order a day runs, whatever order they were picked. */
export function sortWindows(windows: readonly string[]): NowTimeWindow[] {
  return NOW_TIME_WINDOWS.filter((window) => windows.includes(window));
}

/** "Evening", "Morning and evening", "Morning, evening and night". */
export function describeWindows(windows: readonly string[]) {
  const sorted = sortWindows(windows);
  if (sorted.length === 0) return "";
  if (sorted.length === NOW_TIME_WINDOWS.length) return "All day";
  const joined =
    sorted.length === 1
      ? sorted[0]
      : `${sorted.slice(0, -1).join(", ")} and ${sorted[sorted.length - 1]}`;
  return joined[0].toUpperCase() + joined.slice(1);
}

