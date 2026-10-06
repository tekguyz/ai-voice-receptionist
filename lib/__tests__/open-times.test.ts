import { describe, expect, it } from "vitest";
import { dayKey, monthKey } from "@/lib/calendar-day";
import { openTimes } from "@/lib/open-times";

// Times are written in UTC; South Florida is UTC-4 in October.
describe("the open times Luna offers", () => {
  it("are 9 AM and 2 PM the next day", () => {
    expect(openTimes(new Date("2026-10-06T15:00:00Z"))).toEqual([
      "Wednesday, October 7 at 9 AM",
      "Wednesday, October 7 at 2 PM",
    ]);
  });

  it("skip Sunday", () => {
    // Saturday afternoon in Miami.
    expect(openTimes(new Date("2026-10-10T18:00:00Z"))[0]).toBe("Monday, October 12 at 9 AM");
  });

  it("go by the date in Miami, not in UTC", () => {
    // Monday 11:30 PM in Miami is already Tuesday in UTC.
    expect(openTimes(new Date("2026-10-06T03:30:00Z"))[0]).toBe("Tuesday, October 6 at 9 AM");
  });

  it("roll over the end of the month", () => {
    expect(openTimes(new Date("2026-10-31T14:00:00Z"))[0]).toBe("Monday, November 2 at 9 AM");
  });
});

describe("the calendar day", () => {
  it("names the day and month in Miami", () => {
    const lateMondayInMiami = new Date("2026-10-06T03:30:00Z");
    expect(dayKey(lateMondayInMiami)).toBe("2026-10-05");
    expect(monthKey(new Date("2026-11-01T02:00:00Z"))).toBe("2026-10");
  });
});
