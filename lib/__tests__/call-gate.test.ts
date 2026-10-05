import { describe, expect, it } from "vitest";
import { LIMITS, createCallGate, type CounterStore } from "@/lib/call-gate";

// An in-memory CounterStore. Expiry is recorded, not enforced: the gate's
// day and month keys change by name, so the tests never need it.
function fakeStore({ failing = false } = {}) {
  const counts = new Map<string, number>();
  const ttls = new Map<string, number>();
  const store: CounterStore = {
    async increment(counters) {
      if (failing) throw new Error("Redis is down");
      return counters.map(({ key, ttlSeconds }) => {
        counts.set(key, (counts.get(key) ?? 0) + 1);
        ttls.set(key, ttlSeconds);
        return counts.get(key)!;
      });
    },
    async decrement(keys) {
      for (const key of keys) counts.set(key, (counts.get(key) ?? 0) - 1);
    },
  };
  return { store, counts, ttls };
}

// Noon in Miami on Monday 2026-10-05.
const NOON = new Date("2026-10-05T16:00:00Z");
const NEXT_DAY = new Date("2026-10-06T16:00:00Z");

function gateWith(store: CounterStore) {
  return createCallGate({ store, limits: LIMITS, prefix: "avr:" });
}

describe("the Call Gate", () => {
  it("allows a Visitor's first Test Call of the day and refuses the second", async () => {
    const gate = gateWith(fakeStore().store);
    expect((await gate.check({ visitorId: "v1", ipKey: "ip1", now: NOON })).allowed).toBe(true);
    expect(await gate.check({ visitorId: "v1", ipKey: "ip1", now: NOON })).toEqual({ allowed: false, reason: "visitor-limit" });
  });

  it("refuses a third Test Call from one IP address in a day, even from a new Visitor", async () => {
    const gate = gateWith(fakeStore().store);
    await gate.check({ visitorId: "v1", ipKey: "ip1", now: NOON });
    await gate.check({ visitorId: "v2", ipKey: "ip1", now: NOON });
    expect(await gate.check({ visitorId: "v3", ipKey: "ip1", now: NOON })).toEqual({ allowed: false, reason: "ip-limit" });
  });

  it("refuses the 6th Test Call on the site in a day", async () => {
    const gate = gateWith(fakeStore().store);
    for (let i = 1; i <= 5; i++) {
      expect((await gate.check({ visitorId: `v${i}`, ipKey: `ip${i}`, now: NOON })).allowed).toBe(true);
    }
    expect(await gate.check({ visitorId: "v6", ipKey: "ip6", now: NOON })).toEqual({ allowed: false, reason: "site-day-limit" });
  });

  it("refuses the 31st Test Call on the site in a month", async () => {
    const gate = gateWith(fakeStore().store);
    let n = 0;
    for (let day = 1; day <= 6; day++) {
      const now = new Date(Date.UTC(2026, 9, day, 16));
      for (let i = 0; i < 5; i++, n++) {
        expect((await gate.check({ visitorId: `v${n}`, ipKey: `ip${n}`, now })).allowed).toBe(true);
      }
    }
    const day7 = new Date(Date.UTC(2026, 9, 7, 16));
    expect(await gate.check({ visitorId: "late", ipKey: "late", now: day7 })).toEqual({ allowed: false, reason: "site-month-limit" });
  });

  it("gives each Visitor a new Test Call after midnight in Miami", async () => {
    const gate = gateWith(fakeStore().store);
    await gate.check({ visitorId: "v1", ipKey: "ip1", now: NOON });
    expect((await gate.check({ visitorId: "v1", ipKey: "ip1", now: NEXT_DAY })).allowed).toBe(true);
  });

  it("does not let two Visitors share a count", async () => {
    const gate = gateWith(fakeStore().store);
    await gate.check({ visitorId: "v1", ipKey: "ip1", now: NOON });
    expect((await gate.check({ visitorId: "v2", ipKey: "ip2", now: NOON })).allowed).toBe(true);
  });

  it("does not use up a count when it refuses", async () => {
    const { store, counts } = fakeStore();
    const gate = gateWith(store);
    await gate.check({ visitorId: "v1", ipKey: "ip1", now: NOON });
    await gate.check({ visitorId: "v1", ipKey: "ip1", now: NOON });
    expect(counts.get("avr:gate:site:day:2026-10-05")).toBe(1);
  });

  it("gives the count back on release, for a call that never connected", async () => {
    const { store } = fakeStore();
    const gate = gateWith(store);
    const answer = await gate.check({ visitorId: "v1", ipKey: "ip1", now: NOON });
    if (!answer.allowed) throw new Error("expected allowed");
    await answer.release();
    expect((await gate.check({ visitorId: "v1", ipKey: "ip1", now: NOON })).allowed).toBe(true);
  });

  it("refuses when the store is down", async () => {
    const gate = gateWith(fakeStore({ failing: true }).store);
    expect(await gate.check({ visitorId: "v1", ipKey: "ip1", now: NOON })).toEqual({ allowed: false, reason: "unavailable" });
  });

  it("touches only keys under its prefix, and every key expires", async () => {
    const { store, counts, ttls } = fakeStore();
    await gateWith(store).check({ visitorId: "v1", ipKey: "ip1", now: NOON });
    for (const key of counts.keys()) expect(key.startsWith("avr:")).toBe(true);
    for (const ttl of ttls.values()) expect(ttl).toBeGreaterThan(0);
  });
});
