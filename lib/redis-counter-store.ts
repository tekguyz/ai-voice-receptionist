import "server-only";
import { Redis } from "@upstash/redis";
import type { CounterStore } from "@/lib/call-gate";

// The Call Gate's counters on Upstash Redis. This Redis is shared with the
// TEKGUYZ website: the gate only ever names keys under its own prefix.
export function redisCounterStore(redis: Redis = Redis.fromEnv({ signal: () => AbortSignal.timeout(3000) })): CounterStore {
  return {
    async increment(counters) {
      const pipeline = redis.pipeline();
      for (const { key, ttlSeconds } of counters) {
        pipeline.incr(key);
        pipeline.expire(key, ttlSeconds);
      }
      const results = await pipeline.exec<number[]>();
      return counters.map((_, i) => results[i * 2]);
    },
    async decrement(keys) {
      const pipeline = redis.pipeline();
      for (const key of keys) pipeline.decr(key);
      await pipeline.exec();
    },
  };
}
