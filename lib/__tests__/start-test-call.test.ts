import { describe, expect, it, vi } from "vitest";
import type { CallGate, GateAnswer } from "@/lib/call-gate";
import { startTestCall, type StartTestCallDeps } from "@/lib/start-test-call";
import { vapiWebCallCreator } from "@/lib/vapi-web-call";
import { VISITOR_COOKIE } from "@/lib/visitor";

const VISITOR = "7b0c6d8e-1f2a-4b3c-8d4e-5f6a7b8c9d0e";
const PRIVATE_KEY = "test-private-key-never-leaves-the-server";
const NOW = new Date("2026-10-05T16:00:00Z");

function request(cookie: string | null = `${VISITOR_COOKIE}=${VISITOR}`) {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
  if (cookie) headers.set("cookie", cookie);
  return new Request("http://localhost/api/test-call", { method: "POST", headers });
}

function gateAnswering(answer: GateAnswer): CallGate & { calls: unknown[] } {
  const calls: unknown[] = [];
  return { calls, check: async (input) => (calls.push(input), answer) };
}

// What Vapi sends back for a new web call, including fields the browser must never see.
const VAPI_CALL = {
  id: "call-123",
  webCallUrl: "https://vapi.daily.co/room-abc",
  orgId: "org-1",
  assistantId: "asst-1",
  monitor: { controlUrl: "https://control.vapi.ai/call-123/control", listenUrl: "wss://listen.vapi.ai/call-123" },
  assistantOverrides: { variableValues: { openTime1: "x" } },
};

function deps(over: Partial<StartTestCallDeps> = {}): StartTestCallDeps {
  return {
    gate: gateAnswering({ allowed: true, release: async () => {} }),
    createWebCall: async () => ({ webCallUrl: VAPI_CALL.webCallUrl, callId: VAPI_CALL.id }),
    now: () => NOW,
    ...over,
  };
}

describe("Start Test Call", () => {
  it("refuses a request with no Visitor ID and asks nobody", async () => {
    const createWebCall = vi.fn();
    const gate = gateAnswering({ allowed: true, release: async () => {} });
    const response = await startTestCall(request(null), deps({ gate, createWebCall }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ reason: "no-visitor" });
    expect(gate.calls).toEqual([]);
    expect(createWebCall).not.toHaveBeenCalled();
  });

  it("refuses when the Call Gate refuses, and starts no call", async () => {
    const createWebCall = vi.fn();
    const response = await startTestCall(request(), deps({ gate: gateAnswering({ allowed: false, reason: "site-day-limit" }), createWebCall }));
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ reason: "site-day-limit" });
    expect(createWebCall).not.toHaveBeenCalled();
  });

  it("says unavailable when the Call Gate cannot count", async () => {
    const response = await startTestCall(request(), deps({ gate: gateAnswering({ allowed: false, reason: "unavailable" }) }));
    expect(response.status).toBe(503);
  });

  it("asks the gate with the Visitor ID and a hashed first IP address", async () => {
    const gate = gateAnswering({ allowed: true, release: async () => {} });
    await startTestCall(request(), deps({ gate }));
    const [input] = gate.calls as { visitorId: string; ipKey: string; now: Date }[];
    expect(input.visitorId).toBe(VISITOR);
    expect(input.now).toBe(NOW);
    expect(input.ipKey).toMatch(/^[0-9a-f]{16}$/);
    expect(input.ipKey).not.toContain("203.0.113.7");
  });

  it("gives the count back when Vapi cannot start the call", async () => {
    const release = vi.fn(async () => {});
    const response = await startTestCall(
      request(),
      deps({ gate: gateAnswering({ allowed: true, release }), createWebCall: async () => { throw new Error("Vapi 500"); } }),
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ reason: "connect-failed" });
    expect(release).toHaveBeenCalledOnce();
  });

  it("returns only the room link and the call ID, never a secret or Vapi's control link", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(VAPI_CALL), { status: 201 }));
    const createWebCall = vapiWebCallCreator({ privateKey: PRIVATE_KEY, assistantId: "asst-1", fetchImpl });
    const response = await startTestCall(request(), deps({ createWebCall }));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ webCallUrl: VAPI_CALL.webCallUrl, callId: VAPI_CALL.id });
    expect(text).not.toContain(PRIVATE_KEY);
    expect(text).not.toContain("control");
  });
});

describe("creating the Vapi web call", () => {
  it("sends Luna's ID, the Visitor ID and the open times, with the key only in the header", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify(VAPI_CALL), { status: 201 }));
    const create = vapiWebCallCreator({ privateKey: PRIVATE_KEY, assistantId: "asst-1", fetchImpl });
    await create({ visitorId: VISITOR, openTimes: ["Tuesday, October 6 at 9 AM", "Tuesday, October 6 at 2 PM"] });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe("https://api.vapi.ai/call/web");
    expect(new Headers(init!.headers).get("authorization")).toBe(`Bearer ${PRIVATE_KEY}`);
    const body = JSON.parse(String(init!.body));
    expect(body.assistantId).toBe("asst-1");
    expect(body.assistantOverrides.metadata).toEqual({ visitorId: VISITOR });
    expect(body.assistantOverrides.variableValues).toEqual({
      openTime1: "Tuesday, October 6 at 9 AM",
      openTime2: "Tuesday, October 6 at 2 PM",
    });
    expect(String(init!.body)).not.toContain(PRIVATE_KEY);
  });

  it("fails when Vapi refuses", async () => {
    const create = vapiWebCallCreator({ privateKey: PRIVATE_KEY, assistantId: "asst-1", fetchImpl: async () => new Response("no", { status: 400 }) });
    await expect(create({ visitorId: VISITOR, openTimes: ["a", "b"] })).rejects.toThrow();
  });
});
