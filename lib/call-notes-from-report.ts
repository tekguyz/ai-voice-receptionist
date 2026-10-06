// Vapi's end-of-call report as Call Notes. This is the only file that knows
// the report's shape: the call's metadata, the transcript in `artifact.messages`
// and Vapi's summary. The Call Story does the rest, so the saved notes and the
// ones on the live screen come from the same code.

import { tellCallStory, type CallEvent, type CallNotes } from "@/lib/call-story";
import { endReasonFrom } from "@/lib/end-reason";
import { asRecord, asText } from "@/lib/loose-json";
import { eventFromToolCall } from "@/lib/tool-events";
import { isVisitorId } from "@/lib/visitor";

/** The two open times this call was told to offer: the values the server sent when it made the call. */
export function offeredTimesOf(call: unknown): string[] {
  const values = asRecord(asRecord(asRecord(call).assistantOverrides).variableValues);
  return [asText(values.openTime1), asText(values.openTime2)].filter(Boolean);
}

/** The Visitor who made this call, from the metadata the server sent. Null if it is missing or not a Visitor ID. */
export function visitorIdOf(call: unknown): string | null {
  const id = asRecord(asRecord(asRecord(call).assistantOverrides).metadata).visitorId;
  return isVisitorId(id) ? id : null;
}

export type ReportedCall = { callId: string; visitorId: string; notes: CallNotes };

/** Call Notes from an end-of-call report, or null when it is not one of our Test Calls. */
export function callNotesFromReport(message: unknown): ReportedCall | null {
  const report = asRecord(message);
  const call = asRecord(report.call);
  const callId = asText(call.id);
  const visitorId = visitorIdOf(call);
  if (!callId || !visitorId) return null;

  const offered = offeredTimesOf(call);
  const events: CallEvent[] = [];
  let atMs = 0;
  const messages = asRecord(report.artifact).messages;
  for (const entry of Array.isArray(messages) ? messages : []) {
    const item = asRecord(entry);
    if (typeof item.secondsFromStart === "number" && Number.isFinite(item.secondsFromStart)) {
      atMs = Math.max(atMs, Math.round(item.secondsFromStart * 1000));
    }
    const role = asText(item.role);
    if (role === "user" || role === "bot" || role === "assistant") {
      const text = asText(item.message);
      if (text) events.push({ type: "line", speaker: role === "user" ? "caller" : "receptionist", text, atMs });
    } else if (role === "tool_calls") {
      for (const toolCall of Array.isArray(item.toolCalls) ? item.toolCalls : []) {
        const fn = asRecord(asRecord(toolCall).function);
        const event = eventFromToolCall(asText(fn.name) || undefined, fn.arguments, atMs, offered);
        if (event) events.push(event);
      }
    }
  }

  const reportedMs = typeof report.durationSeconds === "number" ? Math.round(report.durationSeconds * 1000) : 0;
  events.push({ type: "ended", reason: endReasonFrom(asText(report.endedReason) || undefined), atMs: Math.max(atMs, reportedMs) });

  const summary = asText(asRecord(report.analysis).summary) || asText(report.summary) || undefined;
  const { notes } = tellCallStory(events, { summary });
  return notes ? { callId, visitorId, notes } : null;
}
