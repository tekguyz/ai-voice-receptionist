import "server-only";
import { createCallNotesStore, type CallNotesStore } from "@/lib/call-notes-store";
import { redisNotesStorage } from "@/lib/redis-notes-storage";
import { keyPrefix } from "@/lib/server-env";

/** The Call Notes store on Redis, or null when Redis is not set up here. */
export function serverNotesStore(): CallNotesStore | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error("Dashboard: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing.");
    return null;
  }
  return createCallNotesStore({ storage: redisNotesStorage(), prefix: keyPrefix() });
}
