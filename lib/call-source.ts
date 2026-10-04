// A call source feeds Call Story events to the screens. The Sample Call
// player is one; the Vapi source (a later ticket) is the other. Screens take
// a CallSource and never know which one they have.

import type { CallEvent } from "@/lib/call-story";

export type RunningCall = {
  /** Stop the call. No more events arrive after this. */
  stop(): void;
};

export type CallSource = {
  start(onEvent: (event: CallEvent) => void): RunningCall;
};

/** Runs `run` after `delayMs` and returns a way to cancel it. Injected so tests drive time. */
export type Scheduler = (run: () => void, delayMs: number) => () => void;

export const realScheduler: Scheduler = (run, delayMs) => {
  const id = setTimeout(run, delayMs);
  return () => clearTimeout(id);
};
