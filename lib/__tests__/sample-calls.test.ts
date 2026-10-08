import { describe, expect, it } from "vitest";
import { openTimes } from "@/lib/open-times";
import { sampleCalls } from "@/lib/sample-calls";

// Tuesday, October 6, 12:00 PM in Miami.
const NOW = new Date("2026-10-06T16:00:00Z");
const MINUTE = 60_000;

describe("the Dashboard's sample calls", () => {
  it("are dated a fixed time before the start of the hour, so they never look stale", () => {
    const aMonthLater = new Date("2026-11-06T17:00:00Z");
    const ages = (now: Date) => sampleCalls(now).map((call) => (now.getTime() - call.at.getTime()) / MINUTE);
    expect(ages(aMonthLater)).toEqual(ages(NOW));
    expect(ages(NOW)[0]).toBe(38);
  });

  it("keep the same times on every page load within an hour", () => {
    const times = (now: Date) => sampleCalls(now).map((call) => call.at.toISOString());
    const sameHour = new Date("2026-10-06T16:59:59Z");
    expect(times(sameHour)).toEqual(times(NOW));
    expect(times(new Date("2026-10-06T17:00:00Z"))).not.toEqual(times(NOW));
    // Never in the future, and the newest is under two hours old.
    for (const call of sampleCalls(sameHour)) expect(call.at.getTime()).toBeLessThan(sameHour.getTime());
    expect(sameHour.getTime() - sampleCalls(sameHour)[0].at.getTime()).toBeLessThan(120 * MINUTE);
  });

  it("all happened in the last 3 days, newest first", () => {
    const calls = sampleCalls(NOW);
    for (const call of calls) {
      expect(call.at.getTime()).toBeLessThan(NOW.getTime());
      expect(call.at.getTime()).toBeGreaterThan(NOW.getTime() - 3 * 24 * 60 * MINUTE);
    }
    const times = calls.map((call) => call.at.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("are seven calls: two spam, four booked", () => {
    const calls = sampleCalls(NOW);
    expect(calls).toHaveLength(7);
    expect(calls.filter((call) => call.spam)).toHaveLength(2);
    expect(calls.filter((call) => call.notes.booked)).toHaveLength(4);
  });

  it("each have full Call Notes", () => {
    for (const call of sampleCalls(NOW)) {
      expect(call.notes.summary).not.toBe("");
      expect(call.notes.lines.length).toBeGreaterThan(1);
      expect(call.notes.durationMs).toBeGreaterThan(0);
    }
  });

  it("book one of the two times offered on the call's own date", () => {
    for (const call of sampleCalls(NOW).filter((c) => c.notes.booked)) {
      expect(openTimes(call.at)).toContain(call.notes.booked);
      expect(call.notes.summary).toContain(call.notes.booked!);
      expect(call.notes.confirmationText).toContain(call.notes.booked!);
    }
    // 22 hours 10 minutes before Tuesday noon is Monday afternoon in Miami: Luna offered Tuesday.
    const tuneUp = sampleCalls(NOW).find((call) => call.id === "sample-tune-up")!;
    expect(tuneUp.notes.booked).toBe("Tuesday, October 6 at 2 PM");
  });

  it("capture nothing and book nothing when they are spam", () => {
    for (const call of sampleCalls(NOW).filter((c) => c.spam)) {
      expect(call.notes.details).toEqual({});
      expect(call.notes.booked).toBeNull();
    }
  });

  it("have their own IDs and ticket numbers", () => {
    const calls = sampleCalls(NOW);
    expect(new Set(calls.map((call) => call.id)).size).toBe(calls.length);
    expect(new Set(calls.map((call) => call.number)).size).toBe(calls.length);
    for (const call of calls) {
      expect(call.id).toMatch(/^sample-[a-z-]+$/);
      expect(call.number).not.toBe("04127");
    }
  });
});
