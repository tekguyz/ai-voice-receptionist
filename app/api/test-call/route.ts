import { DEV_LIMITS, LIMITS, createCallGate } from "@/lib/call-gate";
import { redisCounterStore } from "@/lib/redis-counter-store";
import { startTestCall } from "@/lib/start-test-call";
import { vapiWebCallCreator } from "@/lib/vapi-web-call";

export const dynamic = "force-dynamic";

const production = process.env.NODE_ENV === "production";

export async function POST(request: Request) {
  const privateKey = process.env.VAPI_PRIVATE_KEY;
  const assistantId = process.env.VAPI_ASSISTANT_ID;
  if (!privateKey || !assistantId || !process.env.UPSTASH_REDIS_REST_URL) {
    console.error("Start Test Call: VAPI_PRIVATE_KEY, VAPI_ASSISTANT_ID or Upstash settings are missing.");
    return Response.json({ reason: "unavailable" }, { status: 503 });
  }
  return startTestCall(request, {
    gate: createCallGate({
      store: redisCounterStore(),
      limits: production ? LIMITS : DEV_LIMITS,
      prefix: production ? "avr:" : "avr:dev:",
    }),
    createWebCall: vapiWebCallCreator({ privateKey, assistantId }),
    now: () => new Date(),
  });
}
