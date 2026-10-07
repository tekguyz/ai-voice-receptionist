// Luna's two tool calls as Call Story events. The browser (live tags) and the
// webhook (saved Call Notes) share this, so they can never disagree.

import { DETAIL_FIELDS, type CallEvent, type DetailField } from "@/lib/call-story";
import { asRecord } from "@/lib/loose-json";
import { TOOL } from "@/lib/luna-tools";
import { matchOfferedTime } from "@/lib/open-times";

/** Tool arguments arrive as an object or as a JSON string. */
export function argumentsOf(raw: unknown): Record<string, unknown> {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return asRecord(value);
}

/**
 * The event for one tool call, or null when it is not one we keep. A booking
 * counts only for one of the `offered` open times, and is written as offered.
 */
export function eventFromToolCall(name: string | undefined, rawArgs: unknown, atMs: number, offered: readonly string[]): CallEvent | null {
  const args = argumentsOf(rawArgs);
  if (name === TOOL.recordDetail) {
    const field = args.field as DetailField;
    const value = typeof args.value === "string" ? args.value.trim() : "";
    return DETAIL_FIELDS.includes(field) && value ? { type: "detail", field, value, atMs } : null;
  }
  if (name === TOOL.bookTime) {
    const time = matchOfferedTime(typeof args.time === "string" ? args.time : "", offered);
    return time ? { type: "booked", time, atMs } : null;
  }
  return null;
}
