import { DEV_LIMITS, LIMITS, createCallGate } from "@/lib/call-gate";
import { redisCounterStore } from "@/lib/redis-counter-store";
import { isProduction, keyPrefix } from "@/lib/server-env";
import { startTestCall } from "@/lib/start-test-call";
import { vapiWebCallCreator } from "@/lib/vapi-web-call";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const privateKey = process.env.VAPI_PRIVATE_KEY;
  const orgId = process.env.VAPI_ORG_ID;
  const assistantId = process.env.VAPI_ASSISTANT_ID;
  if (!privateKey || !orgId || !assistantId || !process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error(
      "Start Test Call: VAPI_PRIVATE_KEY, VAPI_ORG_ID, VAPI_ASSISTANT_ID, UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing.",
    );
    return Response.json({ reason: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return startTestCall(request, {
    gate: createCallGate({
      store: redisCounterStore(),
      limits: isProduction() ? LIMITS : DEV_LIMITS,
      prefix: keyPrefix(),
    }),
    // Reuses a server secret so there is no new env var; a key change only resets the per-IP counts.
    ipSecret: privateKey,
    createWebCall: vapiWebCallCreator({ privateKey, orgId, assistantId }),
    now: () => new Date(),
  });
}
