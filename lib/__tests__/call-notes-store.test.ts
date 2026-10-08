import { describe, expect, it } from "vitest";
import { NOTES_PER_VISITOR, NOTES_TTL_SECONDS, createCallNotesStore, isCallId } from "@/lib/call-notes-store";
import type { CallNotes } from "@/lib/call-story";
import { fakeNotesStorage } from "./fake-notes-storage";

const ROSA = "7b0c6d8e-1f2a-4b3c-8d4e-5f6a7b8c9d0e";
const OTHER = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const NOW = new Date("2026-10-06T16:00:00Z");

function notes(summary: string): CallNotes {
  return {
    summary,
    lines: [{ speaker: "caller", text: "Hi.", atMs: 1000 }],
    details: { name: "Rosa Diaz" },
    booked: null,
    endReason: "receptionist-finished",
    durationMs: 60_000,
    confirmationText: "Hi Rosa, this is Mangrove Air.",
  };
}

function setup() {
  const fake = fakeNotesStorage();
  return { fake, store: createCallNotesStore({ storage: fake.storage, prefix: "avr:test:" }) };
}

describe("the Call Notes store", () => {
  it("keeps a Visitor's Call Notes and gives them back", async () => {
    const { store } = setup();
    expect(await store.save({ visitorId: ROSA, callId: "call-1", notes: notes("First"), now: NOW })).toEqual({ saved: true });
    expect(await store.get({ visitorId: ROSA, callId: "call-1" })).toEqual({
      callId: "call-1",
      savedAt: "2026-10-06T16:00:00.000Z",
      notes: notes("First"),
    });
  });

  it("never gives one Visitor another Visitor's Call Notes", async () => {
    const { store } = setup();
    await store.save({ visitorId: ROSA, callId: "call-1", notes: notes("First"), now: NOW });
    expect(await store.get({ visitorId: OTHER, callId: "call-1" })).toBeNull();
    expect(await store.list({ visitorId: OTHER })).toEqual([]);
  });

  it("saves the same call once: the second save changes nothing", async () => {
    const { store } = setup();
    await store.save({ visitorId: ROSA, callId: "call-1", notes: notes("First"), now: NOW });
    expect(await store.save({ visitorId: ROSA, callId: "call-1", notes: notes("Second"), now: NOW })).toEqual({ saved: false });
    const list = await store.list({ visitorId: ROSA });
    expect(list).toHaveLength(1);
    expect(list[0].notes.summary).toBe("First");
  });

  it("lists newest first", async () => {
    const { store } = setup();
    for (const [i, id] of ["call-a", "call-b", "call-c"].entries()) {
      await store.save({ visitorId: ROSA, callId: id, notes: notes(id), now: new Date(NOW.getTime() + i * 60_000) });
    }
    expect((await store.list({ visitorId: ROSA })).map((n) => n.callId)).toEqual(["call-c", "call-b", "call-a"]);
  });

  it("keeps only the newest few", async () => {
    const { store } = setup();
    for (let i = 0; i < NOTES_PER_VISITOR + 2; i++) {
      await store.save({ visitorId: ROSA, callId: `call-${i}`, notes: notes(`n${i}`), now: new Date(NOW.getTime() + i * 60_000) });
    }
    const list = await store.list({ visitorId: ROSA });
    expect(list).toHaveLength(NOTES_PER_VISITOR);
    expect(list[0].callId).toBe(`call-${NOTES_PER_VISITOR + 1}`);
    expect(list.map((n) => n.callId)).not.toContain("call-0");
  });

  it("gives every entry, and the list that points to them, a 7-day expiry", async () => {
    const { store, fake } = setup();
    await store.save({ visitorId: ROSA, callId: "call-1", notes: notes("First"), now: NOW });
    expect(NOTES_TTL_SECONDS).toBe(7 * 24 * 60 * 60);
    expect(fake.ttls.size).toBe(2);
    for (const ttl of fake.ttls.values()) expect(ttl).toBe(NOTES_TTL_SECONDS);
  });

  it("skips an entry that has already expired", async () => {
    const { store, fake } = setup();
    await store.save({ visitorId: ROSA, callId: "call-1", notes: notes("First"), now: NOW });
    await store.save({ visitorId: ROSA, callId: "call-2", notes: notes("Second"), now: new Date(NOW.getTime() + 60_000) });
    for (const key of fake.values.keys()) if (key.endsWith(":call-2")) fake.values.delete(key);
    expect((await store.list({ visitorId: ROSA })).map((n) => n.callId)).toEqual(["call-1"]);
    expect(await store.get({ visitorId: ROSA, callId: "call-2" })).toBeNull();
  });
});

describe("a call ID", () => {
  it("is 1 to 64 letters, digits and dashes", () => {
    expect(isCallId("call-123")).toBe(true);
    expect(isCallId(ROSA)).toBe(true);
    expect(isCallId("a".repeat(64))).toBe(true);
    for (const bad of ["", "a".repeat(65), "call:123", "call 123", "../call", "call\n"]) expect(isCallId(bad)).toBe(false);
  });
});
