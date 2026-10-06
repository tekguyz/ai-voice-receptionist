// Vapi's `endedReason`, as one of the Call Story's end reasons. The browser
// (lib/vapi-source.ts) and the webhook (lib/call-notes-from-report.ts) share it.

import type { EndReason } from "@/lib/call-story";

/** `sawError`: the browser saw a fatal error on the call. */
export function endReasonFrom(endedReason: string | undefined, sawError = false): EndReason {
  if (endedReason === "exceeded-max-duration") return "time-limit";
  // A Visitor who only listens is not a failed call.
  if (endedReason === "customer-ended-call" || endedReason === "silence-timed-out") return "caller-hung-up";
  if (endedReason?.startsWith("assistant-")) return "receptionist-finished";
  if (sawError || endedReason) return "error";
  return "receptionist-finished";
}
