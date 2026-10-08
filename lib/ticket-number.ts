// The number printed on a Test Call's work order and Call Notes. It comes from
// the call's own ID, so a Visitor's calls do not all print the same number, and
// the live screen, the Call Notes and the Dashboard agree. Decoration on a
// made-up work order, not a real record. Sample calls print lower numbers
// (04120 to 04126), so none of these can match one.

import { TEST_CALL_TICKET } from "@/lib/sample-business";

const RANGE = 5000;

export function ticketNumberFor(callId: string): string {
  // FNV-1a: a small, stable hash. Same ID, same number, on any laptop.
  let hash = 0x811c9dc5;
  for (let i = 0; i < callId.length; i++) {
    hash ^= callId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return String(Number(TEST_CALL_TICKET) + (hash % RANGE)).padStart(5, "0");
}
