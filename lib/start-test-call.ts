// Start Test Call: the one door to a Test Call. Checks the Visitor, runs the
// Call Gate, then creates one Vapi web call. Deps are injected so the tests
// need no Redis and no Vapi.
import "server-only";

import { createHash } from "node:crypto";
import type { CallGate } from "@/lib/call-gate";
import { openTimes } from "@/lib/open-times";
import type { CreateWebCall } from "@/lib/vapi-web-call";
import { visitorIdFrom } from "@/lib/visitor";

export type StartTestCallDeps = { gate: CallGate; createWebCall: CreateWebCall; now(): Date };

/** The caller's IP address (first in x-forwarded-for, as Vercel sets it), hashed so Redis never holds it. */
export function ipKeyFrom(request: Request): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

const answer = (status: number, body: object) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function startTestCall(request: Request, deps: StartTestCallDeps): Promise<Response> {
  const visitorId = visitorIdFrom(request.headers.get("cookie"));
  if (!visitorId) return answer(401, { reason: "no-visitor" });

  const now = deps.now();
  const gate = await deps.gate.check({ visitorId, ipKey: ipKeyFrom(request), now });
  if (!gate.allowed) return answer(gate.reason === "unavailable" ? 503 : 429, { reason: gate.reason });

  try {
    const { webCallUrl, callId } = await deps.createWebCall({ visitorId, openTimes: openTimes(now) });
    return answer(200, { webCallUrl, callId });
  } catch (error) {
    console.error("Start Test Call: Vapi did not start the call.", error instanceof Error ? error.message : error);
    await gate.release().catch(() => {});
    return answer(502, { reason: "connect-failed" });
  }
}
