// The Sample Business's made-up calendar: Luna offers 9 AM and 2 PM on the
// next day that is not Sunday. Nothing is ever booked in a real calendar.

import { localDate } from "@/lib/calendar-day";

const label = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" });

export function openTimes(now: Date): [string, string] {
  const { year, month, day } = localDate(now);
  // Date-only arithmetic in UTC, so no clock change can shift the day.
  let next = new Date(Date.UTC(year, month - 1, day + 1));
  if (next.getUTCDay() === 0) next = new Date(Date.UTC(year, month - 1, day + 2));
  const date = label.format(next);
  return [`${date} at 9 AM`, `${date} at 2 PM`];
}

const normalize = (time: string) => time.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * The offered time the caller picked, written as offered, or null when the
 * caller's time is not one of them. Capital letters and spacing do not matter.
 */
export function matchOfferedTime(time: string, offered: readonly string[]): string | null {
  const wanted = normalize(time);
  return offered.find((candidate) => normalize(candidate) === wanted) ?? null;
}
