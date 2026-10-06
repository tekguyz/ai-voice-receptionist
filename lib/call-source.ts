// A call source feeds Call Story events to the screens. The Sample Call
// player is one; the Vapi source is the other. Screens take a CallSource and
// never know which one they have.

import type { CallEvent } from "@/lib/call-story";

/**
 * Why a call never started. Each one leads the screen to offer the Sample Call.
 * `connect-failed`: the server could not start the call, so the Visitor's call
 * for the day is not used and trying again can work. `join-failed`: the server
 * started the call but the browser could not join it, so the day's call is
 * used and trying again would hit the limit.
 */
export type StartFailure = "microphone-blocked" | "limit" | "unavailable" | "connect-failed" | "join-failed";

export type CallHandlers = {
  onEvent(event: CallEvent): void;
  /** The server made the call (a Test Call only). Called once, before the first event. */
  onCallId?(callId: string): void;
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
