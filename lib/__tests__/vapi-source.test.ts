import { describe, expect, it, vi } from "vitest";
import type { StartFailure } from "@/lib/call-source";
import type { CallEvent } from "@/lib/call-story";
import { createVapiSource, type StartResult, type VapiLike, type VapiSourceDeps } from "@/lib/vapi-source";

// A stand-in for the Vapi web SDK: the test plays Vapi's side by hand.
function fakeVapi({ joinFails = false, deferJoin = false } = {}) {
  let settleJoin: { resolve(): void; reject(error: Error): void } | null = null;
  const listeners = new Map<string, ((arg?: unknown) => void)[]>();
  const vapi: VapiLike & { emit(event: string, arg?: unknown): void; stopped: number; joined: unknown[] } = {
    stopped: 0,
    joined: [],
    on(event: string, listener: (arg?: any) => void) {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
    },
    async reconnect(call: { webCallUrl: string; id?: string }) {
      vapi.joined.push(call);
      if (joinFails) throw new Error("join failed");
      if (deferJoin) await new Promise<void>((resolve, reject) => (settleJoin = { resolve, reject }));
    },
    stop() {
      vapi.stopped++;
    },
    emit(event: string, arg?: unknown) {
      for (const listener of listeners.get(event) ?? []) listener(arg);
    },
  } as any;
  return Object.assign(vapi, {
    finishJoin: () => settleJoin?.resolve(),
    failJoin: () => settleJoin?.reject(new Error("join failed")),
  });
}

const OFFERED = ["Tuesday, October 6 at 9 AM", "Tuesday, October 6 at 2 PM"];

function harness(over: Partial<VapiSourceDeps> = {}, vapi = fakeVapi()) {
  let clock = 1000;
  const events: CallEvent[] = [];
  const failures: StartFailure[] = [];
  const callIds: string[] = [];
  const deps: VapiSourceDeps = {
    requestMicrophone: async () => true,
    startTestCall: async (): Promise<StartResult> => ({ ok: true, webCallUrl: "https://vapi.daily.co/room", callId: "call-1", openTimes: OFFERED }),
    createVapi: async () => vapi,
    now: () => clock,
    ...over,
  };
  const call = createVapiSource(deps).start({ onEvent: (e) => events.push(e), onFailed: (f) => failures.push(f), onCallId: (id) => callIds.push(id) });
  return { call, vapi, events, failures, callIds, tick: (ms: number) => (clock += ms) };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const finalLine = (role: "user" | "assistant", transcript: string) => ({ type: "transcript", transcriptType: "final", role, transcript });

describe("the Vapi source", () => {
  it("offers the Sample Call when the microphone is blocked, and asks the server nothing", async () => {
    const startTestCall = vi.fn();
    const { failures } = harness({ requestMicrophone: async () => false, startTestCall });
    await settle();
    expect(failures).toEqual(["microphone-blocked"]);
    expect(startTestCall).not.toHaveBeenCalled();
  });

  it("passes on the server's refusal and joins no call", async () => {
    const createVapi = vi.fn();
    const { failures } = harness({ startTestCall: async () => ({ ok: false, failure: "limit" }), createVapi });
    await settle();
    expect(failures).toEqual(["limit"]);
    expect(createVapi).not.toHaveBeenCalled();
  });

  it("reports a failed join when the room cannot be joined (the server already used the day's call)", async () => {
    const { failures, events } = harness({}, fakeVapi({ joinFails: true }));
    await settle();
    expect(failures).toEqual(["join-failed"]);
    expect(events).toEqual([]);
  });

  it("joins the room the server made", async () => {
    const { vapi } = harness();
    await settle();
    expect(vapi.joined).toEqual([{ webCallUrl: "https://vapi.daily.co/room", id: "call-1" }]);
  });

  it("tells the screen the call ID as soon as the server made the call", async () => {
    const { callIds } = harness();
    await settle();
    expect(callIds).toEqual(["call-1"]);
  });

  it("reports no call ID when the server refuses", async () => {
    const { callIds } = harness({ startTestCall: async () => ({ ok: false, failure: "limit" }) });
    await settle();
    expect(callIds).toEqual([]);
  });

  it("keeps a booking only for a time that was offered, written as offered", async () => {
    const { vapi, events } = harness();
    await settle();
    vapi.emit("message", {
      type: "tool-calls",
      toolCallList: [
        { function: { name: "bookTime", arguments: { time: "Friday at noon" } } },
        { function: { name: "bookTime", arguments: { time: "tuesday, october 6 at 2 pm" } } },
      ],
    });
    expect(events).toEqual([{ type: "booked", time: "Tuesday, October 6 at 2 PM", atMs: 0 }]);
  });

  it("turns only final transcripts into lines, timed from the join", async () => {
    const { vapi, events, tick } = harness();
    await settle();
    tick(1500);
    vapi.emit("message", { type: "transcript", transcriptType: "partial", role: "user", transcript: "Hi my" });
    vapi.emit("message", finalLine("user", "Hi, my AC is broken."));
    tick(500);
    vapi.emit("message", { type: 'transcript[transcriptType="final"]', role: "assistant", transcript: "Sorry to hear that." });
    expect(events).toEqual([
      { type: "line", speaker: "caller", text: "Hi, my AC is broken.", atMs: 1500 },
      { type: "line", speaker: "receptionist", text: "Sorry to hear that.", atMs: 2000 },
    ]);
  });

  it("turns Luna's tool calls into details and a booking", async () => {
    const { vapi, events } = harness();
    await settle();
    vapi.emit("message", {
      type: "tool-calls",
      toolCallList: [
        { function: { name: "recordDetail", arguments: '{"field":"job","value":"AC not cooling"}' } },
        { function: { name: "recordDetail", arguments: { field: "shoe size", value: "9" } } },
        { function: { name: "recordDetail", arguments: "null" } },
        { function: { name: "bookTime", arguments: { time: "Tuesday, October 6 at 9 AM" } } },
      ],
    });
    expect(events).toEqual([
      { type: "detail", field: "job", value: "AC not cooling", atMs: 0 },
      { type: "booked", time: "Tuesday, October 6 at 9 AM", atMs: 0 },
    ]);
  });

  it("ends with the time limit when Vapi says the call ran too long", async () => {
    const { vapi, events } = harness();
    await settle();
    vapi.emit("message", { type: "status-update", status: "ended", endedReason: "exceeded-max-duration" });
    vapi.emit("call-end");
    expect(events.at(-1)).toMatchObject({ type: "ended", reason: "time-limit" });
  });

  it("ends as finished by the Receptionist when Luna hangs up", async () => {
    const { vapi, events } = harness();
    await settle();
    vapi.emit("message", { type: "status-update", status: "ended", endedReason: "assistant-ended-call" });
    vapi.emit("call-end");
    expect(events.at(-1)).toMatchObject({ type: "ended", reason: "receptionist-finished" });
  });

  it("ends with the caller hanging up on stop, once, and passes later lines through", async () => {
    const { call, vapi, events } = harness();
    await settle();
    call.stop();
    call.stop();
    vapi.emit("call-end");
    vapi.emit("message", finalLine("user", "Bye."));
    expect(vapi.stopped).toBe(1);
    expect(events.filter((e) => e.type === "ended")).toEqual([{ type: "ended", reason: "caller-hung-up", atMs: 0 }]);
    expect(events.at(-1)).toMatchObject({ type: "line", text: "Bye." });
  });

  it("joins nothing if stopped while still connecting", async () => {
    const { call, vapi, events, failures } = harness();
    call.stop();
    await settle();
    expect(vapi.joined).toEqual([]);
    expect(events).toEqual([]);
    expect(failures).toEqual([]);
  });

  it("ends with an error when the call breaks mid-way", async () => {
    const { vapi, events } = harness();
    await settle();
    vapi.emit("error", new Error("network"));
    vapi.emit("call-end");
    expect(events.filter((e) => e.type === "ended")).toEqual([{ type: "ended", reason: "error", atMs: 0 }]);
  });

  it("counts a silence time-out as the caller hanging up, not a failed call", async () => {
    const { vapi, events } = harness();
    await settle();
    vapi.emit("message", { type: "status-update", status: "ended", endedReason: "silence-timed-out" });
    vapi.emit("call-end");
    expect(events.at(-1)).toMatchObject({ type: "ended", reason: "caller-hung-up" });
  });

  it("ignores the SDK's non-fatal audio-processing errors: the call still ends as finished", async () => {
    const { vapi, events } = harness();
    await settle();
    vapi.emit("error", { type: "audio-processing-setup-error", stage: "audio-processing-setup", error: { message: "KrispInitError: Canceled" } });
    vapi.emit("error", { type: "audio-processor-recovery-error", stage: "audio-processor-recovery", error: { message: "x" } });
    vapi.emit("call-end");
    expect(events.filter((e) => e.type === "ended")).toEqual([{ type: "ended", reason: "receptionist-finished", atMs: 0 }]);
  });

  it("ends with an error after a Daily call error", async () => {
    const { vapi, events } = harness();
    await settle();
    vapi.emit("error", { type: "daily-error", error: { message: "connection lost" } });
    vapi.emit("call-end");
    expect(events.filter((e) => e.type === "ended")).toEqual([{ type: "ended", reason: "error", atMs: 0 }]);
  });

  describe("while the room is still being joined", () => {
    it("emits nothing when stopped mid-join, then the join finishes", async () => {
      const vapi = fakeVapi({ deferJoin: true });
      const { call, events, failures } = harness({}, vapi);
      await settle();
      call.stop();
      vapi.finishJoin();
      await settle();
      expect(events).toEqual([]);
      expect(failures).toEqual([]);
      expect(vapi.stopped).toBe(1);
    });

    it("ignores a call-end the SDK fires before a join that then fails", async () => {
      const vapi = fakeVapi({ deferJoin: true });
      const { events, failures } = harness({}, vapi);
      await settle();
      vapi.emit("call-end");
      vapi.failJoin();
      await settle();
      expect(events).toEqual([]);
      expect(failures).toEqual(["join-failed"]);
    });

    it("keeps final lines that arrive before the join resolves, timed from the first message", async () => {
      const vapi = fakeVapi({ deferJoin: true });
      const { events, tick } = harness({}, vapi);
      await settle();
      tick(700);
      vapi.emit("message", finalLine("assistant", "Thanks for calling Mangrove Air."));
      tick(300);
      vapi.emit("message", finalLine("user", "Hi."));
      tick(400);
      vapi.finishJoin();
      await settle();
      expect(events).toEqual([
        { type: "line", speaker: "receptionist", text: "Thanks for calling Mangrove Air.", atMs: 0 },
        { type: "line", speaker: "caller", text: "Hi.", atMs: 300 },
      ]);
    });

    it("counts the call as started at the first message: stop() then ends it once", async () => {
      const vapi = fakeVapi({ deferJoin: true });
      const { call, events, failures } = harness({}, vapi);
      await settle();
      vapi.emit("message", finalLine("assistant", "Thanks for calling Mangrove Air."));
      call.stop();
      vapi.emit("call-end");
      vapi.finishJoin();
      await settle();
      expect(events.filter((e) => e.type === "ended")).toEqual([{ type: "ended", reason: "caller-hung-up", atMs: 0 }]);
      expect(failures).toEqual([]);
      expect(vapi.stopped).toBe(1);
    });

    it("emits no end for a call stopped before it started, even if a late message and call-end follow", async () => {
      const vapi = fakeVapi({ deferJoin: true });
      const { call, events } = harness({}, vapi);
      await settle();
      call.stop();
      vapi.emit("message", finalLine("assistant", "Thanks for calling Mangrove Air."));
      vapi.emit("call-end");
      vapi.finishJoin();
      await settle();
      expect(events.filter((e) => e.type === "ended")).toEqual([]);
    });

    it("ends with an error when the join fails after a message already started the call", async () => {
      const vapi = fakeVapi({ deferJoin: true });
      const { events, failures, tick } = harness({}, vapi);
      await settle();
      vapi.emit("message", finalLine("assistant", "Thanks for calling Mangrove Air."));
      tick(250);
      vapi.failJoin();
      await settle();
      expect(events).toEqual([
        { type: "line", speaker: "receptionist", text: "Thanks for calling Mangrove Air.", atMs: 0 },
        { type: "ended", reason: "error", atMs: 250 },
      ]);
      expect(failures).toEqual([]);
    });
  });
});
