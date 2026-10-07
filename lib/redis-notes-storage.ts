import "server-only";
import { Redis } from "@upstash/redis";
import type { NotesStorage, SavedCallNotes } from "@/lib/call-notes-store";

// The Call Notes store's storage on Upstash Redis. This Redis is shared with
// the TEKGUYZ website: the store only ever names keys under its own prefix.
// Upstash turns objects to JSON and back by itself, so values go in as objects.
export function redisNotesStorage(redis: Redis = Redis.fromEnv({ signal: () => AbortSignal.timeout(3000) })): NotesStorage {
  return {
    async setIfNew(key, value, ttlSeconds) {
      return (await redis.set(key, value, { nx: true, ex: ttlSeconds })) === "OK";
    },
    async getMany(keys) {
      if (keys.length === 0) return [];
      const found = await redis.mget<(SavedCallNotes | null)[]>(...keys);
      return found.map((entry) => entry ?? null);
    },
    async indexAdd(indexKey, member, score, ttlSeconds) {
      const pipeline = redis.pipeline();
      pipeline.zadd(indexKey, { score, member });
      pipeline.expire(indexKey, ttlSeconds);
      await pipeline.exec();
    },
    async indexTrim(indexKey, keep) {
      await redis.zremrangebyrank(indexKey, 0, -(keep + 1));
    },
    async indexNewest(indexKey, count) {
      return redis.zrange<string[]>(indexKey, 0, count - 1, { rev: true });
    },
  };
}
