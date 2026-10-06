import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { CallGate, GateAnswer } from "@/lib/call-gate";
import { ipKeyFrom, startTestCall, type StartTestCallDeps } from "@/lib/start-test-call";
import { vapiWebCallCreator } from "@/lib/vapi-web-call";
import { VISITOR_COOKIE } from "@/lib/visitor";

const VISITOR = "7b0c6d8e-1f2a-4b3c-8d4e-5f6a7b8c9d0e";
const ORG_ID = "org-1";
const IP_SECRET = "test-ip-secret";
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
    ipSecret: IP_SECRET,
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
    expect(input.ipKey).toBe(ipKeyFrom(request(), IP_SECRET));
  });

  it("keys the IP address with a server secret: a different secret gives a different key", () => {
    const key = ipKeyFrom(request(), IP_SECRET);
    expect(key).toMatch(/^[0-9a-f]{16}$/);
    expect(key).not.toContain("203.0.113.7");
    expect(key).toBe(ipKeyFrom(request(), IP_SECRET));
    expect(ipKeyFrom(request(), "another-secret")).not.toBe(key);
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
    const createWebCall = vapiWebCallCreator({ privateKey: PRIVATE_KEY, orgId: ORG_ID, assistantId: "asst-1", fetchImpl });
    const response = await startTestCall(request(), deps({ createWebCall }));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ webCallUrl: VAPI_CALL.webCallUrl, callId: VAPI_CALL.id });
    expect(text).not.toContain(PRIVATE_KEY);
    expect(text).not.toContain("control");
  });
});

describe("creating the Vapi web call", () => {
  const OPEN_TIMES: [string, string] = ["Tuesday, October 6 at 9 AM", "Tuesday, October 6 at 2 PM"];
  const CLOCK_MS = 1_790_000_000_500;

  async function sendOne() {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify(VAPI_CALL), { status: 201 }));
    const create = vapiWebCallCreator({ privateKey: PRIVATE_KEY, orgId: ORG_ID, assistantId: "asst-1", fetchImpl, now: () => CLOCK_MS });
    await create({ visitorId: VISITOR, openTimes: OPEN_TIMES });
    const [url, init] = fetchImpl.mock.calls[0];
    const authorization = new Headers(init!.headers).get("authorization") ?? "";
    return { url: String(url), init: init!, authorization, jwt: authorization.replace(/^Bearer /, "") };
  }

  it("sends Luna's ID, the Visitor ID and the open times, and nothing else, in the body", async () => {
    const { url, init } = await sendOne();
    expect(url).toBe("https://api.vapi.ai/call/web");
    expect(JSON.parse(String(init.body))).toEqual({
      assistantId: "asst-1",
      assistantOverrides: {
        metadata: { visitorId: VISITOR },
        variableValues: { openTime1: OPEN_TIMES[0], openTime2: OPEN_TIMES[1] },
      },
    });
  });

  it("authorizes with a Bearer token, and never sends the private key itself", async () => {
    const { init, authorization, jwt } = await sendOne();
    expect(authorization).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
    expect(authorization).not.toContain(PRIVATE_KEY);
    expect(String(init.body)).not.toContain(PRIVATE_KEY);
    expect(JSON.parse(Buffer.from(jwt.split(".")[0], "base64url").toString())).toEqual({ alg: "HS256", typ: "JWT" });
  });

  it("signs a 60-second public token locked to Luna, with no transient assistant", async () => {
    const { jwt } = await sendOne();
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
    expect(payload.orgId).toBe(ORG_ID);
    expect(payload.token).toEqual({
      tag: "public",
      restrictions: { enabled: true, allowedAssistantIds: ["asst-1"], allowTransientAssistant: false },
    });
    expect(payload.iat).toBe(Math.floor(CLOCK_MS / 1000));
    expect(payload.exp - payload.iat).toBe(60);
  });

  it("signs with the private key: the signature matches an HMAC of header.payload", async () => {
    const { jwt } = await sendOne();
    const [header, payload, signature] = jwt.split(".");
    expect(signature).toBe(createHmac("sha256", PRIVATE_KEY).update(`${header}.${payload}`).digest("base64url"));
  });

  it("fails when Vapi refuses", async () => {
    const create = vapiWebCallCreator({ privateKey: PRIVATE_KEY, orgId: ORG_ID, assistantId: "asst-1", fetchImpl: async () => new Response("no", { status: 400 }) });
    await expect(create({ visitorId: VISITOR, openTimes: ["a", "b"] })).rejects.toThrow();
  });
});
