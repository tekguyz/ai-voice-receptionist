import { describe, expect, it, vi } from "vitest";
import type { StartFailure } from "@/lib/call-source";
import type { CallEvent } from "@/lib/call-story";
import { createVapiSource, type StartResult, type VapiLike, type VapiSourceDeps } from "@/lib/vapi-source";

// A stand-in for the Vapi web SDK: the test plays Vapi's side by hand.
function fakeVapi({ joinFails = false } = {}) {
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
    },
    stop() {
      vapi.stopped++;
    },
    emit(event: string, arg?: unknown) {
      for (const listener of listeners.get(event) ?? []) listener(arg);
    },
  } as any;
  return vapi;
}

function harness(over: Partial<VapiSourceDeps> = {}, vapi = fakeVapi()) {
  let clock = 1000;
  const events: CallEvent[] = [];
  const failures: StartFailure[] = [];
  const deps: VapiSourceDeps = {
    requestMicrophone: async () => true,
    startTestCall: async (): Promise<StartResult> => ({ ok: true, webCallUrl: "https://vapi.daily.co/room", callId: "call-1" }),
    createVapi: async () => vapi,
    now: () => clock,
    ...over,
  };
  const call = createVapiSource(deps).start({ onEvent: (e) => events.push(e), onFailed: (f) => failures.push(f) });
  return { call, vapi, events, failures, tick: (ms: number) => (clock += ms) };
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

  it("reports a failed connect when the room cannot be joined", async () => {
    const { failures, events } = harness({}, fakeVapi({ joinFails: true }));
    await settle();
    expect(failures).toEqual(["connect-failed"]);
    expect(events).toEqual([]);
  });

  it("joins the room the server made", async () => {
    const { vapi } = harness();
    await settle();
    expect(vapi.joined).toEqual([{ webCallUrl: "https://vapi.daily.co/room", id: "call-1" }]);
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
});
