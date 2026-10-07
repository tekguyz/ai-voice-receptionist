import { afterEach, describe, expect, it, vi } from "vitest";
import { createCallNotesStore, type SavedCallNotes } from "@/lib/call-notes-store";
import { tellCallStory, type CallEvent } from "@/lib/call-story";
import { buildDashboard, callTimeLabel, findDashboardCall, savedCallsFor } from "@/lib/dashboard";
import { fakeNotesStorage } from "./fake-notes-storage";

// Tuesday, October 6, 12:00 PM in Miami (UTC-4 in October).
const NOW = new Date("2026-10-06T16:00:00Z");
const VISITOR_A = "11111111-1111-4111-8111-111111111111";
const VISITOR_B = "22222222-2222-4222-8222-222222222222";

function testCall(callId: string, minutesAgo: number, booked: string | null): SavedCallNotes {
  const events: CallEvent[] = [
    { type: "detail", field: "name", value: "Rosa Diaz", atMs: 1000 },
    ...(booked ? [{ type: "booked" as const, time: booked, atMs: 2000 }] : []),
    { type: "ended", reason: "receptionist-finished", atMs: 3000 },
  ];
  return { callId, savedAt: new Date(NOW.getTime() - minutesAgo * 60_000).toISOString(), notes: tellCallStory(events).notes! };
}

function storeWith(...entries: [visitorId: string, call: SavedCallNotes][]) {
  const store = createCallNotesStore({ storage: fakeNotesStorage().storage, prefix: "avr:test:" });
  return Promise.all(entries.map(([visitorId, call]) => store.save({ visitorId, callId: call.callId, notes: call.notes, now: new Date(call.savedAt) }))).then(() => store);
}

afterEach(() => vi.restoreAllMocks());

describe("the Dashboard's totals", () => {
  it("count the sample calls when the Visitor has made no Test Call", () => {
    const { totals, calls } = buildDashboard({ saved: [], now: NOW });
    expect(totals).toEqual({ answered: 5, booked: 4, spam: 2 });
    expect(calls).toHaveLength(7);
  });

  it("add the Visitor's own calls to calls answered and jobs booked, never to spam", () => {
    const saved = [testCall("call-1", 5, "Wednesday, October 7 at 9 AM"), testCall("call-2", 90, null)];
    expect(buildDashboard({ saved, now: NOW }).totals).toEqual({ answered: 7, booked: 5, spam: 2 });
  });
});

describe("the Dashboard's recent calls", () => {
  it("mix the Visitor's calls with the sample calls, newest first", () => {
    const saved = [testCall("call-1", 5, null), testCall("call-2", 400, null)];
    const { calls } = buildDashboard({ saved, now: NOW });
    expect(calls).toHaveLength(9);
    expect(calls[0]).toMatchObject({ id: "call-1", whose: "yours", spam: false, number: "04127" });
    expect(calls.find((call) => call.id === "call-2")?.whose).toBe("yours");
    const times = calls.map((call) => call.at.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("never look stale: the newest sample call is 38 minutes old on any day", () => {
    for (const now of [NOW, new Date("2027-03-15T09:30:00Z")]) {
      const newestSample = buildDashboard({ saved: [], now }).calls[0];
      expect(callTimeLabel(newestSample.at, now)).toMatch(/^(Today|Yesterday) · /);
      expect(now.getTime() - newestSample.at.getTime()).toBe(38 * 60_000);
    }
  });
});

describe("the time of a call", () => {
  it("says Today, Yesterday, the weekday, then the date", () => {
    expect(callTimeLabel(new Date("2026-10-06T15:22:00Z"), NOW)).toBe("Today · 11:22 AM");
    expect(callTimeLabel(new Date("2026-10-05T20:15:00Z"), NOW)).toBe("Yesterday · 4:15 PM");
    expect(callTimeLabel(new Date("2026-10-03T13:03:00Z"), NOW)).toBe("Sat · 9:03 AM");
    expect(callTimeLabel(new Date("2026-09-29T18:10:00Z"), NOW)).toBe("Sep 29 · 2:10 PM");
  });

  it("goes by the day in Miami, not in UTC", () => {
    // 11:30 PM Monday in Miami is already Tuesday in UTC; 10 AM Monday is still "Today".
    expect(callTimeLabel(new Date("2026-10-05T14:00:00Z"), new Date("2026-10-06T03:30:00Z"))).toBe("Today · 10:00 AM");
  });
});

describe("a Visitor's own calls", () => {
  it("are only theirs", async () => {
    const store = await storeWith([VISITOR_A, testCall("call-a", 5, null)], [VISITOR_B, testCall("call-b", 5, null)]);
    expect((await savedCallsFor({ visitorId: VISITOR_A, store })).map((call) => call.callId)).toEqual(["call-a"]);
  });

  it("are none when Redis is not set up or is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const down = createCallNotesStore({ storage: fakeNotesStorage({ failing: true }).storage, prefix: "avr:test:" });
    expect(await savedCallsFor({ visitorId: VISITOR_A, store: null })).toEqual([]);
    expect(await savedCallsFor({ visitorId: VISITOR_A, store: down })).toEqual([]);
  });
});

describe("opening one call", () => {
  it("finds any sample call, for any Visitor", async () => {
    const call = await findDashboardCall({ callId: "sample-leak", visitorId: VISITOR_B, now: NOW, store: null });
    expect(call).toMatchObject({ id: "sample-leak", whose: "sample", number: "04120" });
  });

  it("finds the Visitor's own call", async () => {
    const store = await storeWith([VISITOR_A, testCall("call-a", 5, null)]);
    const call = await findDashboardCall({ callId: "call-a", visitorId: VISITOR_A, now: NOW, store });
    expect(call).toMatchObject({ id: "call-a", whose: "yours", spam: false, number: "04127" });
    expect(call?.notes.details.name).toBe("Rosa Diaz");
  });

  it("does not find another Visitor's call", async () => {
    const store = await storeWith([VISITOR_A, testCall("call-a", 5, null)]);
    expect(await findDashboardCall({ callId: "call-a", visitorId: VISITOR_B, now: NOW, store })).toBeNull();
  });

  it("does not find a call ID with odd characters, or any call when Redis is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const store = await storeWith([VISITOR_A, testCall("call-a", 5, null)]);
    for (const callId of ["../x", "a:b", "", "a".repeat(65)]) {
      expect(await findDashboardCall({ callId, visitorId: VISITOR_A, now: NOW, store })).toBeNull();
    }
    const down = createCallNotesStore({ storage: fakeNotesStorage({ failing: true }).storage, prefix: "avr:test:" });
    expect(await findDashboardCall({ callId: "call-a", visitorId: VISITOR_A, now: NOW, store: down })).toBeNull();
  });
});
