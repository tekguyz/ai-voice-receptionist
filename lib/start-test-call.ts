// Start Test Call: the one door to a Test Call. Checks the Visitor, runs the
// Call Gate, then creates one Vapi web call. Deps are injected so the tests
// need no Redis and no Vapi.
import "server-only";

import { createHmac } from "node:crypto";
import type { CallGate } from "@/lib/call-gate";
import { openTimes } from "@/lib/open-times";
import type { CreateWebCall } from "@/lib/vapi-web-call";
import { visitorIdFrom } from "@/lib/visitor";

export type StartTestCallDeps = {
  gate: CallGate;
  createWebCall: CreateWebCall;
  now(): Date;
  /** A server secret that keys the IP hash. */
  ipSecret: string;
};

/**
 * The caller's IP address as a keyed hash (HMAC-SHA256 with a server secret),
 * so Redis holds no IP address and nobody can work one back from a key without
 * the secret. The first x-forwarded-for value is trusted because Vercel
 * overwrites that header with the client's address; behind another proxy this
 * would need changing.
 */
export function ipKeyFrom(request: Request, secret: string): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHmac("sha256", secret).update(ip).digest("hex").slice(0, 16);
}

const answer = (status: number, body: object) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function startTestCall(request: Request, deps: StartTestCallDeps): Promise<Response> {
  const visitorId = visitorIdFrom(request.headers.get("cookie"));
  if (!visitorId) return answer(401, { reason: "no-visitor" });

  const now = deps.now();
  const gate = await deps.gate.check({ visitorId, ipKey: ipKeyFrom(request, deps.ipSecret), now });
  if (!gate.allowed) return answer(gate.reason === "unavailable" ? 503 : 429, { reason: gate.reason });

  try {
    const times = openTimes(now);
    const { webCallUrl, callId } = await deps.createWebCall({ visitorId, openTimes: times });
    // The browser needs the two times only to show a booking that the server will accept.
    return answer(200, { webCallUrl, callId, openTimes: times });
  } catch (error) {
    console.error("Start Test Call: Vapi did not start the call.", error instanceof Error ? error.message : error);
    await gate.release().catch(() => {});
    return answer(502, { reason: "connect-failed" });
  }
}
