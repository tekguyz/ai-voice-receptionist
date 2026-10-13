// Dev only: creates one web call for the Caller actor. Same signed token as
// a Test Call (lib/vapi-web-call.ts), locked to the Actor. No webhook: the
// Actor has no tools. 404 on every deploy.
import { isLaptopDev } from "@/lib/laptop-dev";
import { signWebCallToken } from "@/lib/vapi-web-call";
import { actorCallOverrides, type ActorLanguage } from "@/vapi/actor";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isLaptopDev(process.env)) return new Response("Not found", { status: 404 });
  const { VAPI_PRIVATE_KEY: privateKey, VAPI_ORG_ID: orgId, VAPI_ACTOR_ID: actorId } = process.env;
  if (!privateKey || !orgId || !actorId) return Response.json({ reason: "VAPI_PRIVATE_KEY, VAPI_ORG_ID or VAPI_ACTOR_ID is missing." }, { status: 503 });
  const lang: ActorLanguage = new URL(request.url).searchParams.get("lang") === "es" ? "es" : "en";
  const response = await fetch("https://api.vapi.ai/call/web", {
    method: "POST",
    headers: { Authorization: `Bearer ${signWebCallToken({ privateKey, orgId, assistantId: actorId, nowMs: Date.now() })}`, "Content-Type": "application/json" },
    body: JSON.stringify({ assistantId: actorId, assistantOverrides: actorCallOverrides(lang) }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return Response.json({ reason: `Vapi refused the actor call: ${response.status} ${await response.text()}` }, { status: 502 });
  const call = (await response.json()) as { id?: string; webCallUrl?: string; transport?: { callUrl?: string } };
  return Response.json({ callId: call.id, webCallUrl: call.webCallUrl ?? call.transport?.callUrl });
}
