import { describe, expect, it, vi } from "vitest";
import type { CallNotes } from "@/lib/call-story";
import { fetchSavedNotes, watchSavedNotes, type SavedNotesAnswer } from "@/lib/saved-notes";

const NOTES: CallNotes = {
  summary: "Rosa called.",
  lines: [],
  details: {},
  booked: null,
  endReason: "receptionist-finished",
  durationMs: 1000,
  confirmationText: "Hi.",
};

// A clock that moves only when the watcher sleeps.
function clock() {
  let t = 0;
  return { now: () => t, sleep: async (ms: number) => void (t += ms) };
}

function watch(answers: (() => Promise<SavedNotesAnswer>)[], signal = new AbortController().signal) {
  const onReady = vi.fn();
  const onGiveUp = vi.fn();
  let n = 0;
  const fetchOnce = vi.fn(() => answers[Math.min(n++, answers.length - 1)]());
  const done = watchSavedNotes({ fetchOnce, ...clock(), signal, onReady, onGiveUp });
  return { done, onReady, onGiveUp, fetchOnce };
}

const pending = async (): Promise<SavedNotesAnswer> => ({ status: "pending" });
const ready = async (): Promise<SavedNotesAnswer> => ({ status: "ready", notes: NOTES });

describe("asking for the saved notes", () => {
  it("fills in as soon as the notes are saved", async () => {
    const { done, onReady, onGiveUp, fetchOnce } = watch([pending, pending, ready]);
    await done;
    expect(onReady).toHaveBeenCalledOnce();
    expect(onReady).toHaveBeenCalledWith(NOTES);
    expect(onGiveUp).not.toHaveBeenCalled();
    expect(fetchOnce).toHaveBeenCalledTimes(3);
  });

  it("gives up after 60 seconds, asking every 2 seconds", async () => {
    const { done, onReady, onGiveUp, fetchOnce } = watch([pending]);
    await done;
    expect(onGiveUp).toHaveBeenCalledOnce();
    expect(onReady).not.toHaveBeenCalled();
    expect(fetchOnce).toHaveBeenCalledTimes(31);
  });

  it("keeps asking after a failed request", async () => {
    const { done, onReady } = watch([async () => { throw new Error("offline"); }, ready]);
    await done;
    expect(onReady).toHaveBeenCalledWith(NOTES);
  });

  it("says nothing once the screen has moved on", async () => {
    const stop = new AbortController();
    const { done, onReady, onGiveUp } = watch([async () => (stop.abort(), { status: "ready", notes: NOTES })], stop.signal);
    await done;
    expect(onReady).not.toHaveBeenCalled();
    expect(onGiveUp).not.toHaveBeenCalled();
  });
});

describe("fetching the saved notes", () => {
  const respond = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it("asks for the call by its ID and reads a ready answer", async () => {
    const fetchImpl = respond(200, { status: "ready", notes: NOTES });
    expect(await fetchSavedNotes("call-1", fetchImpl)).toEqual({ status: "ready", notes: NOTES });
    expect(vi.mocked(fetchImpl).mock.calls[0][0]).toBe("/api/call-notes?callId=call-1");
  });

  it("treats a pending answer, an error status or an odd body as pending", async () => {
    expect(await fetchSavedNotes("call-1", respond(200, { status: "pending" }))).toEqual({ status: "pending" });
    expect(await fetchSavedNotes("call-1", respond(503, { reason: "unavailable" }))).toEqual({ status: "pending" });
    expect(await fetchSavedNotes("call-1", respond(200, { status: "ready" }))).toEqual({ status: "pending" });
  });
});
