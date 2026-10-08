import { DEV_LIMITS, LIMITS, createCallGate } from "@/lib/call-gate";
import { redisCounterStore } from "@/lib/redis-counter-store";
import { RECORDING_OPEN_TIMES, sampleCallRecording } from "@/lib/sample-call-recording";
import { isProduction, keyPrefix } from "@/lib/server-env";
import { startTestCall } from "@/lib/start-test-call";
import { vapiWebCallCreator } from "@/lib/vapi-web-call";
import { webhookTarget } from "@/lib/webhook-target";

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
  // Off for every Visitor. On only for the founder's Sample Call, on the laptop.
  const recording = sampleCallRecording(process.env);
  if (recording) console.warn("Start Test Call: SAMPLE_CALL_RECORDING is on. This call is recorded for the Sample Call.");
  else if (process.env.SAMPLE_CALL_RECORDING === "on") {
    console.error("Start Test Call: SAMPLE_CALL_RECORDING is on, but recording works only on `npm run dev` off Vercel, with an https SAMPLE_CALL_WEBHOOK_ORIGIN. This call is not recorded.");
  }
  const webhook = webhookTarget(recording?.webhookOrigin ?? new URL(request.url).origin, process.env);
  if (!process.env.VAPI_WEBHOOK_SECRET) console.error("Start Test Call: VAPI_WEBHOOK_SECRET is missing, so this call's Call Notes will not be saved.");
  return startTestCall(request, {
    gate: createCallGate({
      store: redisCounterStore(),
      limits: isProduction() ? LIMITS : DEV_LIMITS,
      prefix: keyPrefix(),
    }),
    // Reuses a server secret so there is no new env var; a key change only resets the per-IP counts.
    ipSecret: privateKey,
    createWebCall: vapiWebCallCreator({ privateKey, orgId, assistantId, webhook, record: recording !== null }),
    now: () => new Date(),
    ...(recording ? { offerTimes: () => RECORDING_OPEN_TIMES } : {}),
  });
}
