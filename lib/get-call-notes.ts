// The Visitor reads their own saved Call Notes. The Visitor ID comes from the
// cookie, never from the request's address, so no one can ask for another
// Visitor's call: an ID that is not theirs is simply "pending".

import type { CallNotesStore } from "@/lib/call-notes-store";
import { visitorIdFrom } from "@/lib/visitor";

const CALL_ID = /^[A-Za-z0-9-]{1,64}$/;

const answer = (status: number, body: object) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function getCallNotes(request: Request, deps: { store: CallNotesStore }): Promise<Response> {
  const visitorId = visitorIdFrom(request.headers.get("cookie"));
  if (!visitorId) return answer(401, { reason: "no-visitor" });

  const callId = new URL(request.url).searchParams.get("callId") ?? "";
  if (!CALL_ID.test(callId)) return answer(400, { reason: "bad-call-id" });

  try {
    const saved = await deps.store.get({ visitorId, callId });
    return answer(200, saved ? { status: "ready", notes: saved.notes } : { status: "pending" });
  } catch (error) {
    console.error("Call Notes: could not read.", error instanceof Error ? error.message : error);
    return answer(503, { reason: "unavailable" });
  }
}
