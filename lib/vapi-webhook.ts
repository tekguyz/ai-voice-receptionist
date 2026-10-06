// The Vapi webhook: the one door Vapi uses to reach this app during a Test
// Call. It checks Vapi's secret first and reads nothing else until that
// passes. Then it answers Luna's tool calls (a booking must be one of the two
// open times offered) and, when the call ends, saves the Call Notes for the
// Visitor named in the call's metadata. Deps are injected so the tests need
// no Redis and no Vapi.
import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { callNotesFromReport, offeredTimesOf } from "@/lib/call-notes-from-report";
import type { CallNotesStore } from "@/lib/call-notes-store";
import { asRecord, asText } from "@/lib/loose-json";
import { TOOL } from "@/lib/luna-tools";
import { matchOfferedTime } from "@/lib/open-times";
import { argumentsOf } from "@/lib/tool-events";

export const WEBHOOK_SECRET_HEADER = "x-vapi-secret";

export type VapiWebhookDeps = { secret: string; store: CallNotesStore; now(): Date };

const answer = (status: number, body: object) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Compares digests, so the comparison takes the same time whatever is wrong. */
function secretMatches(given: string | null, secret: string): boolean {
  if (!given || !secret) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(secret));
}

export async function handleVapiWebhook(request: Request, deps: VapiWebhookDeps): Promise<Response> {
  if (!secretMatches(request.headers.get(WEBHOOK_SECRET_HEADER), deps.secret)) return answer(401, { reason: "unauthorized" });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return answer(400, { reason: "bad-request" });
  }

  const message = asRecord(asRecord(body).message);
  switch (message.type) {
    case "tool-calls":
      return answer(200, { results: answerToolCalls(message) });
    case "end-of-call-report":
      return saveReport(message, deps);
    default:
      return answer(200, {});
  }
}

function answerToolCalls(message: Record<string, unknown>) {
  const offered = offeredTimesOf(message.call);
  const list = Array.isArray(message.toolCallList) ? message.toolCallList : [];
  return list.map((raw) => {
    const item = asRecord(raw);
    const fn = asRecord(item.function);
    const name = asText(item.name) || asText(fn.name);
    const args = argumentsOf(item.arguments ?? fn.arguments);
    return { name, toolCallId: asText(item.id), result: resultFor(name, args, offered) };
  });
}

function resultFor(name: string, args: Record<string, unknown>, offered: readonly string[]): string {
  if (name === TOOL.recordDetail) return "Noted.";
  if (name === TOOL.bookTime) {
    const time = matchOfferedTime(asText(args.time), offered);
    if (time) return `Booked for ${time}.`;
    return offered.length > 0
      ? `That time was not offered. Offer only these two: ${offered.join(" or ")}.`
      : "That time was not offered. A dispatcher will call back to find a time.";
  }
  return "Unknown tool.";
}

async function saveReport(message: Record<string, unknown>, deps: VapiWebhookDeps): Promise<Response> {
  const report = callNotesFromReport(message);
  // A call with no Visitor in its metadata is not a Test Call from this app. Say OK so Vapi does not retry it.
  if (!report) return answer(200, { ignored: "not-a-test-call" });
  try {
    const { saved } = await deps.store.save({ ...report, now: deps.now() });
    return answer(200, { saved });
  } catch (error) {
    console.error("Vapi webhook: could not save Call Notes.", error instanceof Error ? error.message : error);
    return answer(503, { reason: "unavailable" });
  }
}
