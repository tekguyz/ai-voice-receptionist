import { describe, expect, it } from "vitest";
import { createCallNotesStore } from "@/lib/call-notes-store";
import { callNotesFromReport } from "@/lib/call-notes-from-report";
import { getCallNotes } from "@/lib/get-call-notes";
import { VISITOR_COOKIE } from "@/lib/visitor";
import { fakeNotesStorage } from "./fake-notes-storage";
import { VISITOR_A, VISITOR_B, endOfCallReport } from "./vapi-report-fixture";

const NOW = new Date("2026-10-06T16:00:00Z");

async function setup({ failing = false } = {}) {
  const store = createCallNotesStore({ storage: fakeNotesStorage({ failing }).storage, prefix: "avr:test:" });
  if (!failing) {
    const report = callNotesFromReport(endOfCallReport())!;
    await store.save({ ...report, now: NOW });
  }
  const ask = (query: string, visitorId: string | null = VISITOR_A) =>
    getCallNotes(
      new Request(`https://demo.example/api/call-notes${query}`, { headers: visitorId ? { cookie: `${VISITOR_COOKIE}=${visitorId}` } : {} }),
      { store },
    );
  return { ask };
}

describe("reading saved Call Notes", () => {
  it("gives a Visitor their own Call Notes", async () => {
    const { ask } = await setup();
    const response = await ask("?callId=call-123");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ready");
    expect(body.notes.details.name).toBe("Rosa Diaz");
  });

  it("says pending while the notes are not saved yet", async () => {
    const { ask } = await setup();
    const response = await ask("?callId=call-not-yet");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "pending" });
  });

  it("says pending, not the notes, to another Visitor who asks for the same call", async () => {
    const { ask } = await setup();
    expect(await (await ask("?callId=call-123", VISITOR_B)).json()).toEqual({ status: "pending" });
  });

  it("refuses a request with no Visitor", async () => {
    const { ask } = await setup();
    const response = await ask("?callId=call-123", null);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ reason: "no-visitor" });
  });

  it("refuses a call ID that is missing or has odd characters", async () => {
    const { ask } = await setup();
    for (const query of ["", "?callId=", "?callId=a:b", "?callId=../x", `?callId=${"a".repeat(65)}`]) {
      const response = await ask(query);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ reason: "bad-call-id" });
    }
  });

  it("says unavailable when the store is down", async () => {
    const { ask } = await setup({ failing: true });
    expect((await ask("?callId=call-123")).status).toBe(503);
  });
});
