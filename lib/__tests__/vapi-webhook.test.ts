import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createCallNotesStore } from "@/lib/call-notes-store";
import { handleVapiWebhook } from "@/lib/vapi-webhook";
import { fakeNotesStorage } from "./fake-notes-storage";
import { OPEN_TIMES, VISITOR_A, VISITOR_B, endOfCallReport } from "./vapi-report-fixture";

const SECRET = "test-webhook-secret";
const NOW = new Date("2026-10-06T16:00:00Z");

function setup({ failing = false } = {}) {
  const fake = fakeNotesStorage({ failing });
  const store = createCallNotesStore({ storage: fake.storage, prefix: "avr:test:" });
  const send = (message: unknown, secret: string | null = SECRET) => {
    const headers = new Headers({ "content-type": "application/json" });
    if (secret !== null) headers.set("x-vapi-secret", secret);
    return handleVapiWebhook(new Request("https://demo.example/api/vapi/webhook", { method: "POST", headers, body: JSON.stringify({ message }) }), {
      secret: SECRET,
      store,
      now: () => NOW,
    });
  };
  return { fake, store, send };
}

const nothingStored = (fake: ReturnType<typeof fakeNotesStorage>) => {
  expect(fake.writes).toBe(0);
  expect(fake.values.size).toBe(0);
  expect(fake.sets.size).toBe(0);
};

describe("the Vapi webhook: who may talk to it", () => {
  it("refuses a request with no secret, and stores nothing", async () => {
    const { fake, send } = setup();
    const response = await send(endOfCallReport(), null);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ reason: "unauthorized" });
    nothingStored(fake);
  });

  it("refuses a wrong secret, and stores nothing", async () => {
    const { fake, send } = setup();
    expect((await send(endOfCallReport(), "not-the-secret")).status).toBe(401);
    expect((await send(endOfCallReport(), "")).status).toBe(401);
    nothingStored(fake);
  });

  it("refuses a wrong secret on a tool call too", async () => {
    const { send } = setup();
    const response = await send({ type: "tool-calls", toolCallList: [] }, "nope");
    expect(response.status).toBe(401);
  });

  it("says bad request when the secret is right but the body is not JSON", async () => {
    const { fake, store } = setup();
    const headers = new Headers({ "x-vapi-secret": SECRET });
    const response = await handleVapiWebhook(new Request("https://demo.example/api/vapi/webhook", { method: "POST", headers, body: "{nope" }), {
      secret: SECRET,
      store,
      now: () => NOW,
    });
    expect(response.status).toBe(400);
    nothingStored(fake);
  });
});

describe("the Vapi webhook: the end-of-call report", () => {
  it("stores the Call Notes under the Visitor named in the call, and under nobody else", async () => {
    const { fake, store, send } = setup();
    const response = await send(endOfCallReport());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ saved: true });

    const saved = await store.get({ visitorId: VISITOR_A, callId: "call-123" });
    expect(saved?.notes.details).toEqual({ job: "AC blowing warm air", name: "Rosa Diaz" });
    expect(saved?.notes.booked).toBe(OPEN_TIMES[0]);
    expect(await store.list({ visitorId: VISITOR_B })).toEqual([]);
    expect(await store.get({ visitorId: VISITOR_B, callId: "call-123" })).toBeNull();
    for (const key of [...fake.values.keys(), ...fake.sets.keys()]) expect(key).toContain(VISITOR_A);
  });

  it("stores the same report twice as one entry", async () => {
    const { store, send } = setup();
    expect(await (await send(endOfCallReport())).json()).toEqual({ saved: true });
    expect(await (await send(endOfCallReport())).json()).toEqual({ saved: false });
    expect(await store.list({ visitorId: VISITOR_A })).toHaveLength(1);
  });

  it("ignores a report that is not one of our Test Calls (no Visitor ID), and stores nothing", async () => {
    const { fake, send } = setup();
    const response = await send(endOfCallReport({}, null));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ignored: "not-a-test-call" });
    nothingStored(fake);
  });

  it("says unavailable when the store is down, so Vapi can try again", async () => {
    const { send } = setup({ failing: true });
    const response = await send(endOfCallReport());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ reason: "unavailable" });
  });

  it("answers any other kind of message with an empty 200", async () => {
    const { fake, send } = setup();
    const response = await send({ type: "status-update", status: "ended" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
    nothingStored(fake);
  });
});

describe("the Vapi webhook: Luna's tool calls", () => {
  const call = endOfCallReport().call;
  const tools = (...list: { id: string; name: string; arguments: unknown }[]) => ({ type: "tool-calls", call, toolCallList: list });

  it("confirms a booking for an offered time, even if Luna wrote it in other capitals", async () => {
    const { fake, send } = setup();
    const response = await send(tools({ id: "t1", name: "bookTime", arguments: { time: "tuesday, october 6 at 2 pm" } }));
    expect(await response.json()).toEqual({ results: [{ name: "bookTime", toolCallId: "t1", result: `Booked for ${OPEN_TIMES[1]}.` }] });
    nothingStored(fake);
  });

  it("refuses a booking for a time that was not offered, and tells Luna the two that were", async () => {
    const { send } = setup();
    const response = await send(tools({ id: "t2", name: "bookTime", arguments: { time: "Friday at noon" } }));
    const [result] = (await response.json()).results;
    expect(result.toolCallId).toBe("t2");
    expect(result.result).toContain("not offered");
    expect(result.result).toContain(OPEN_TIMES[0]);
    expect(result.result).toContain(OPEN_TIMES[1]);
  });

  it("refuses every booking when the call carries no offered times", async () => {
    const { send } = setup();
    const response = await send({ type: "tool-calls", toolCallList: [{ id: "t3", name: "bookTime", arguments: { time: OPEN_TIMES[0] } }] });
    expect((await response.json()).results[0].result).toContain("not offered");
  });

  it("acknowledges recordDetail, reading the tool in either of Vapi's shapes", async () => {
    const { send } = setup();
    const response = await send(
      tools(
        { id: "t4", name: "recordDetail", arguments: { field: "job", value: "AC not cooling" } },
        { id: "t5", function: { name: "recordDetail", arguments: '{"field":"name","value":"Rosa"}' } } as never,
      ),
    );
    const { results } = await response.json();
    expect(results.map((r: { toolCallId: string; result: string }) => [r.toolCallId, r.result])).toEqual([
      ["t4", "Noted."],
      ["t5", "Noted."],
    ]);
  });
});
