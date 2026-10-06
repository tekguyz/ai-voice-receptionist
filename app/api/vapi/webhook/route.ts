import { createCallNotesStore } from "@/lib/call-notes-store";
import { redisNotesStorage } from "@/lib/redis-notes-storage";
import { keyPrefix } from "@/lib/server-env";
import { handleVapiWebhook } from "@/lib/vapi-webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (!secret || !process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error("Vapi webhook: VAPI_WEBHOOK_SECRET, UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing.");
    return Response.json({ reason: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return handleVapiWebhook(request, {
    secret,
    store: createCallNotesStore({ storage: redisNotesStorage(), prefix: keyPrefix() }),
    now: () => new Date(),
  });
}
