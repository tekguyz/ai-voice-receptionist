import { createCallNotesStore } from "@/lib/call-notes-store";
import { getCallNotes } from "@/lib/get-call-notes";
import { redisNotesStorage } from "@/lib/redis-notes-storage";
import { keyPrefix } from "@/lib/server-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error("Call Notes: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing.");
    return Response.json({ reason: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return getCallNotes(request, { store: createCallNotesStore({ storage: redisNotesStorage(), prefix: keyPrefix() }) });
}
