// Days and months as the Sample Business sees them: South Florida time.
// Call limits reset at midnight here, and open times are dates here.

export const TIME_ZONE = "America/New_York";

const parts = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, year: "numeric", month: "numeric", day: "numeric" });

export function localDate(now: Date): { year: number; month: number; day: number } {
  const get = (type: string) => Number(parts.formatToParts(now).find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function dayKey(now: Date): string {
  const { year, month, day } = localDate(now);
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function monthKey(now: Date): string {
  const { year, month } = localDate(now);
  return `${year}-${pad(month)}`;
}
