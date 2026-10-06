// The browser asks the server for a Test Call's saved Call Notes. The webhook
// saves them a moment after the call ends, so the screen asks until they are
// there, or gives up.

import type { CallNotes } from "@/lib/call-story";

export type SavedNotesAnswer = { status: "ready"; notes: CallNotes } | { status: "pending" };

export async function fetchSavedNotes(callId: string, fetchImpl: typeof fetch = fetch): Promise<SavedNotesAnswer> {
  const response = await fetchImpl(`/api/call-notes?callId=${encodeURIComponent(callId)}`, { cache: "no-store" });
  if (!response.ok) return { status: "pending" };
  const body = await response.json();
  return body?.status === "ready" && body.notes ? { status: "ready", notes: body.notes } : { status: "pending" };
}

export type WatchOptions = {
  fetchOnce(): Promise<SavedNotesAnswer>;
  sleep(ms: number): Promise<void>;
  /** A clock in milliseconds. */
  now(): number;
  /** Stops the watcher. After it, neither callback is called. */
  signal: AbortSignal;
  onReady(notes: CallNotes): void;
  onGiveUp(): void;
  intervalMs?: number;
  giveUpMs?: number;
};

export async function watchSavedNotes({ fetchOnce, sleep, now, signal, onReady, onGiveUp, intervalMs = 2000, giveUpMs = 60_000 }: WatchOptions): Promise<void> {
  const startedAt = now();
  while (!signal.aborted) {
    try {
      const answer = await fetchOnce();
      if (signal.aborted) return;
      if (answer.status === "ready") return onReady(answer.notes);
    } catch {
      // The network blinked: ask again.
    }
    if (signal.aborted) return;
    if (now() - startedAt >= giveUpMs) return onGiveUp();
    await sleep(intervalMs);
  }
}
