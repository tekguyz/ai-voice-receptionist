// The Call Gate: may this Visitor start a Test Call now? Every Test Call costs
// money, so the server asks this before every call, and the answer is "no"
// whenever it cannot be sure (fail closed).
//
// Counters: per Visitor a day, per IP address a day, the whole site a day and
// a month. Each is one Redis counter whose name holds the day or month, so a
// new day starts from zero. The gate adds 1 to all four at once; if any goes
// over its limit, it takes all four back and refuses. INCR is atomic, so two
// calls at once can never both get the last slot.

import { dayKey, monthKey } from "@/lib/calendar-day";

export type GateLimits = { perVisitorPerDay: number; perIpPerDay: number; sitePerDay: number; sitePerMonth: number };

/** Founder, 2026-10-04. Cost comes first. */
export const LIMITS: GateLimits = { perVisitorPerDay: 1, perIpPerDay: 2, sitePerDay: 5, sitePerMonth: 30 };
/** Local development: room to test, on separate counters. The $10 Vapi credit is the wall. */
export const DEV_LIMITS: GateLimits = { perVisitorPerDay: 10, perIpPerDay: 10, sitePerDay: 10, sitePerMonth: 60 };

export type GateRefusal = "visitor-limit" | "ip-limit" | "site-day-limit" | "site-month-limit" | "unavailable";
export type GateAnswer = { allowed: true; release(): Promise<void> } | { allowed: false; reason: GateRefusal };

/** The slice of Redis the gate needs. Tests use an in-memory one. */
export type CounterStore = {
  /** Adds 1 to each key, sets its expiry, and returns the new counts in order. */
  increment(counters: readonly { key: string; ttlSeconds: number }[]): Promise<number[]>;
  decrement(keys: readonly string[]): Promise<void>;
};

export type CallGate = { check(input: { visitorId: string; ipKey: string; now: Date }): Promise<GateAnswer> };

const DAY_TTL = 2 * 24 * 60 * 60;
const MONTH_TTL = 35 * 24 * 60 * 60;

export function createCallGate({ store, limits, prefix }: { store: CounterStore; limits: GateLimits; prefix: string }): CallGate {
  return {
    async check({ visitorId, ipKey, now }) {
      const day = dayKey(now);
      const month = monthKey(now);
      const counters = [
        { key: `${prefix}gate:visitor:${visitorId}:${day}`, ttlSeconds: DAY_TTL, limit: limits.perVisitorPerDay, reason: "visitor-limit" },
        { key: `${prefix}gate:ip:${ipKey}:${day}`, ttlSeconds: DAY_TTL, limit: limits.perIpPerDay, reason: "ip-limit" },
        { key: `${prefix}gate:site:day:${day}`, ttlSeconds: DAY_TTL, limit: limits.sitePerDay, reason: "site-day-limit" },
        { key: `${prefix}gate:site:month:${month}`, ttlSeconds: MONTH_TTL, limit: limits.sitePerMonth, reason: "site-month-limit" },
      ] as const;
      const keys = counters.map((c) => c.key);
      const giveBack = () => store.decrement(keys);

      try {
        const counts = await store.increment(counters);
        const over = counters.find((c, i) => counts[i] > c.limit);
        if (over) {
          await giveBack();
          return { allowed: false, reason: over.reason };
        }
        return { allowed: true, release: giveBack };
      } catch {
        return { allowed: false, reason: "unavailable" };
      }
    },
  };
}
