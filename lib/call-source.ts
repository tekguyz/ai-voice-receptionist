// A call source feeds Call Story events to the screens. The Sample Call
// player is one; the Vapi source is the other. Screens take a CallSource and
// never know which one they have.

import type { CallEvent } from "@/lib/call-story";

/** Why a call never started. Each one leads the screen to offer the Sample Call. */
export type StartFailure = "microphone-blocked" | "limit" | "unavailable" | "connect-failed";

export type CallHandlers = {
  onEvent(event: CallEvent): void;
  /** The call never started: no event came before this and none comes after. */
  onFailed(failure: StartFailure): void;
};

export type RunningCall = {
  /**
   * Ends the call. If it had started and not yet ended, the source emits one
   * `ended` with reason `caller-hung-up`; no second `ended` follows. A late
   * final transcript line may still arrive after it (the Call Story keeps it).
   * The Sample Call player emits nothing after it. Safe to call twice.
   */
  stop(): void;
};

export type CallSource = {
  start(handlers: CallHandlers): RunningCall;
};
