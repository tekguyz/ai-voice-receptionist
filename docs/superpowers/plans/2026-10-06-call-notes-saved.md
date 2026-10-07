# Call Notes Saved Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a Test Call, the Vapi webhook saves the Call Notes for the Visitor (7 days), and the Call Notes screen fills in from the saved copy.

**Architecture:** The server tells Vapi, on each call, where to send tool calls and the end-of-call report (a per-call `assistantOverrides.server`, so the Vercel Preview works too). One webhook route checks Vapi's secret first, answers Luna's two tools (a booking must be one of the two offered times), and on the report builds the Call Notes with the Call Story and saves them in a Redis-backed store, one entry per call, each with a 7-day expiry. The Call Notes screen opens at once from the browser's own copy, shows "Finishing the summary…", and asks `GET /api/call-notes` every 2 seconds until the saved copy is there.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Upstash Redis, Vapi (server messages).

**Spec:** Issue #5 (this ticket), parent spec #1 (modules 5 and 6, "Testing Decisions" seam 3), `docs/adr/0003-redis-not-supabase.md`, `docs/adr/0004-no-audio-kept.md`, `DESIGN.md`. The founder approved the design in chat on 2026-10-06, with decision A: the screen says "Our copy is deleted after 7 days." because Vapi keeps its own call logs.

## Global Constraints

- Words follow `CONTEXT.md`: Visitor, Sample Business, Receptionist, Test Call, Sample Call, Call Notes, Owner, Dashboard. Never "Sarah" or "Viora". Names come from `lib/sample-business.ts`.
- Every saved Call Notes entry expires 7 days after it is written (ADR 0003): `7 * 24 * 60 * 60` seconds.
- A Visitor reaches only their own Call Notes, through the random Visitor ID in the `avr_visitor` cookie.
- No audio is kept (ADR 0004). No text or email is ever sent.
- The webhook checks Vapi's secret before it reads anything else. A wrong or missing secret stores nothing.
- Secrets: never in git, never printed, never in a commit message. `VAPI_WEBHOOK_SECRET` lives in `.env.local` (gitignored) and in Vercel env. `.env.example` holds names only.
- The screen follows `DESIGN.md`: its tokens and its type scale. No new colors, no spinner, no new motion.
- Tests: while working, `npx vitest run <file>`. Before each commit, `npm run test:unit` once. Never `npm test`. Tests sit in `__tests__/` folders beside the code.
- Commands you give the founder must work in PowerShell 7 and Git Bash: paths as `C:/Projects/...`, chain with `&&`.
- Work on branch `voice-demo-batch-4`. Never push to `main`. Pushing the branch makes a Vercel Preview (not production). Say so in one line before the push.
- Every commit ends with the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (second `-m`).

## File Structure

| File | Does |
|---|---|
| `lib/open-times.ts` (modify) | add `matchOfferedTime` |
| `lib/loose-json.ts` (create) | `asRecord`, `asText`: read Vapi's JSON without trusting its shape |
| `lib/end-reason.ts` (create) | Vapi `endedReason` to our `EndReason` (moved out of `vapi-source.ts`) |
| `lib/tool-events.ts` (create) | a Luna tool call to a Call Story event (moved out of `vapi-source.ts`, plus the offered-time check) |
| `lib/vapi-source.ts`, `lib/call-source.ts`, `lib/vapi-browser.ts`, `lib/start-test-call.ts` (modify) | the browser learns the call ID and the two offered times |
| `lib/call-notes-store.ts` (create) | the Call Notes store (module 6) over a small storage interface |
| `lib/redis-notes-storage.ts` (create) | that storage interface on Upstash Redis |
| `lib/server-env.ts` (create) | production or not, and the Redis key prefix, in one place |
| `lib/call-notes-from-report.ts` (create) | Vapi's end-of-call report to Call Notes. The only file that knows the report's shape. |
| `lib/vapi-webhook.ts` (create), `app/api/vapi/webhook/route.ts` (create) | the Vapi webhook (module 5) |
| `lib/get-call-notes.ts` (create), `app/api/call-notes/route.ts` (create) | the Visitor reads their saved Call Notes |
| `lib/vapi-web-call.ts`, `app/api/test-call/route.ts` (modify) | each call carries its webhook address and secret |
| `vapi/luna.ts` (modify) | Luna sends tool calls and the report to the server; `bookTime` waits |
| `lib/saved-notes.ts` (create) | ask the server until the saved notes appear |
| `app/demo/call-screen.tsx`, `DESIGN.md` (modify) | the "still being finished" state, the saved line, the 7-day wording |
| `README.md`, `.env.example`, `docs/adr/0004-no-audio-kept.md` (modify) | docs |

---

### Task 1: Offered-time check

**Files:**
- Modify: `lib/open-times.ts`
- Test: `lib/__tests__/offered-time.test.ts`

**Interfaces:**
- Produces: `matchOfferedTime(time: string, offered: readonly string[]): string | null`. Returns the offered time as written in `offered` (so a booking is always saved in the offered spelling), or `null`. Ignores capital letters and extra spaces.

- [ ] **Step 1: Write the failing test** `lib/__tests__/offered-time.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { matchOfferedTime } from "@/lib/open-times";

const OFFERED = ["Tuesday, October 6 at 9 AM", "Tuesday, October 6 at 2 PM"];

describe("matching a booking to the offered open times", () => {
  it("accepts an offered time", () => {
    expect(matchOfferedTime("Tuesday, October 6 at 2 PM", OFFERED)).toBe("Tuesday, October 6 at 2 PM");
  });

  it("ignores capital letters and extra spaces, and answers with the offered spelling", () => {
    expect(matchOfferedTime("  tuesday, october 6  at 9 am ", OFFERED)).toBe("Tuesday, October 6 at 9 AM");
  });

  it("refuses a time that was not offered", () => {
    expect(matchOfferedTime("Tuesday, October 6 at 11 AM", OFFERED)).toBeNull();
    expect(matchOfferedTime("", OFFERED)).toBeNull();
  });

  it("refuses everything when nothing was offered", () => {
    expect(matchOfferedTime("Tuesday, October 6 at 9 AM", [])).toBeNull();
  });
});
```

- [ ] **Step 2: Run it. It must fail.** `npx vitest run lib/__tests__/offered-time.test.ts` → FAIL (`matchOfferedTime` is not exported).

- [ ] **Step 3: Add to the end of `lib/open-times.ts`:**

```ts

const normalize = (time: string) => time.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * The offered time the caller picked, written as offered, or null when the
 * caller's time is not one of them. Capital letters and spacing do not matter.
 */
export function matchOfferedTime(time: string, offered: readonly string[]): string | null {
  const wanted = normalize(time);
  return offered.find((candidate) => normalize(candidate) === wanted) ?? null;
}
```

- [ ] **Step 4: Run it. It must pass.** `npx vitest run lib/__tests__/offered-time.test.ts` → 4 passed.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-10-06-call-notes-saved.md lib/open-times.ts lib/__tests__/offered-time.test.ts && git commit -m "Plan for #5, and the offered-time check" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Shared helpers: loose JSON, end reason, tool events

New files only. `vapi-source.ts` does not change until Task 3.

**Files:**
- Create: `lib/loose-json.ts`, `lib/end-reason.ts`, `lib/tool-events.ts`
- Test: `lib/__tests__/end-reason.test.ts`, `lib/__tests__/tool-events.test.ts`

**Interfaces:**
- Consumes: `matchOfferedTime` (Task 1); `DETAIL_FIELDS`, `CallEvent`, `DetailField`, `EndReason` from `lib/call-story.ts`; `TOOL` from `lib/luna-tools.ts`.
- Produces:
  - `asRecord(value: unknown): Record<string, unknown>`, `asText(value: unknown): string` (trimmed string, or `""`).
  - `endReasonFrom(endedReason: string | undefined, sawError?: boolean): EndReason`.
  - `argumentsOf(raw: unknown): Record<string, unknown>` (accepts an object or a JSON string).
  - `eventFromToolCall(name: string | undefined, rawArgs: unknown, atMs: number, offered: readonly string[]): CallEvent | null`.

- [ ] **Step 1: Write the failing tests.**

`lib/__tests__/end-reason.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { endReasonFrom } from "@/lib/end-reason";

describe("Vapi's end reasons", () => {
  it("maps the time limit", () => {
    expect(endReasonFrom("exceeded-max-duration")).toBe("time-limit");
  });

  it("counts a caller who left or stayed silent as a caller who hung up", () => {
    expect(endReasonFrom("customer-ended-call")).toBe("caller-hung-up");
    expect(endReasonFrom("silence-timed-out")).toBe("caller-hung-up");
  });

  it("maps Luna hanging up", () => {
    expect(endReasonFrom("assistant-ended-call")).toBe("receptionist-finished");
  });

  it("maps any other reason to an error", () => {
    expect(endReasonFrom("pipeline-error-openai-llm-failed")).toBe("error");
  });

  it("has no reason: finished, unless the browser saw a fatal error", () => {
    expect(endReasonFrom(undefined)).toBe("receptionist-finished");
    expect(endReasonFrom(undefined, true)).toBe("error");
  });
});
```

`lib/__tests__/tool-events.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { eventFromToolCall } from "@/lib/tool-events";

const OFFERED = ["Tuesday, October 6 at 9 AM", "Tuesday, October 6 at 2 PM"];

describe("Luna's tool calls as Call Story events", () => {
  it("turns recordDetail into a detail, from an object or a JSON string", () => {
    expect(eventFromToolCall("recordDetail", { field: "job", value: " AC not cooling " }, 5, OFFERED)).toEqual({
      type: "detail",
      field: "job",
      value: "AC not cooling",
      atMs: 5,
    });
    expect(eventFromToolCall("recordDetail", '{"field":"name","value":"Rosa Diaz"}', 7, OFFERED)).toEqual({
      type: "detail",
      field: "name",
      value: "Rosa Diaz",
      atMs: 7,
    });
  });

  it("ignores a detail with an unknown field, no value, or arguments that are not an object", () => {
    expect(eventFromToolCall("recordDetail", { field: "shoe size", value: "9" }, 0, OFFERED)).toBeNull();
    expect(eventFromToolCall("recordDetail", { field: "job", value: "  " }, 0, OFFERED)).toBeNull();
    expect(eventFromToolCall("recordDetail", "null", 0, OFFERED)).toBeNull();
    expect(eventFromToolCall("recordDetail", "{not json", 0, OFFERED)).toBeNull();
  });

  it("turns a booking of an offered time into a booking, written as offered", () => {
    expect(eventFromToolCall("bookTime", { time: "tuesday, october 6 at 2 pm" }, 9, OFFERED)).toEqual({
      type: "booked",
      time: "Tuesday, October 6 at 2 PM",
      atMs: 9,
    });
  });

  it("ignores a booking of a time that was not offered, or when nothing was offered", () => {
    expect(eventFromToolCall("bookTime", { time: "Friday at noon" }, 0, OFFERED)).toBeNull();
    expect(eventFromToolCall("bookTime", { time: "Tuesday, October 6 at 9 AM" }, 0, [])).toBeNull();
  });

  it("ignores any other tool", () => {
    expect(eventFromToolCall("endCall", {}, 0, OFFERED)).toBeNull();
    expect(eventFromToolCall(undefined, {}, 0, OFFERED)).toBeNull();
  });
});
```

- [ ] **Step 2: Run them. They must fail.** `npx vitest run lib/__tests__/end-reason.test.ts lib/__tests__/tool-events.test.ts` → FAIL (modules not found).

- [ ] **Step 3: Write the three files.**

`lib/loose-json.ts`:

```ts
// Vapi's messages are read, never trusted: these turn "anything" into a
// record or a trimmed string, so a missing or odd field never throws.

export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export const asText = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
```

`lib/end-reason.ts`:

```ts
// Vapi's `endedReason`, as one of the Call Story's end reasons. The browser
// (lib/vapi-source.ts) and the webhook (lib/call-notes-from-report.ts) share it.

import type { EndReason } from "@/lib/call-story";

/** `sawError`: the browser saw a fatal error on the call. */
export function endReasonFrom(endedReason: string | undefined, sawError = false): EndReason {
  if (endedReason === "exceeded-max-duration") return "time-limit";
  // A Visitor who only listens is not a failed call.
  if (endedReason === "customer-ended-call" || endedReason === "silence-timed-out") return "caller-hung-up";
  if (endedReason?.startsWith("assistant-")) return "receptionist-finished";
  if (sawError || endedReason) return "error";
  return "receptionist-finished";
}
```

`lib/tool-events.ts`:

```ts
// Luna's two tool calls as Call Story events. The browser (live tags) and the
// webhook (saved Call Notes) share this, so they can never disagree.

import { DETAIL_FIELDS, type CallEvent, type DetailField } from "@/lib/call-story";
import { asRecord } from "@/lib/loose-json";
import { TOOL } from "@/lib/luna-tools";
import { matchOfferedTime } from "@/lib/open-times";

/** Tool arguments arrive as an object or as a JSON string. */
export function argumentsOf(raw: unknown): Record<string, unknown> {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return asRecord(value);
}

/**
 * The event for one tool call, or null when it is not one we keep. A booking
 * counts only for one of the `offered` open times, and is written as offered.
 */
export function eventFromToolCall(name: string | undefined, rawArgs: unknown, atMs: number, offered: readonly string[]): CallEvent | null {
  const args = argumentsOf(rawArgs);
  if (name === TOOL.recordDetail) {
    const field = args.field as DetailField;
    const value = typeof args.value === "string" ? args.value.trim() : "";
    return DETAIL_FIELDS.includes(field) && value ? { type: "detail", field, value, atMs } : null;
  }
  if (name === TOOL.bookTime) {
    const time = matchOfferedTime(typeof args.time === "string" ? args.time : "", offered);
    return time ? { type: "booked", time, atMs } : null;
  }
  return null;
}
```

- [ ] **Step 4: Run them. They must pass.** `npx vitest run lib/__tests__/end-reason.test.ts lib/__tests__/tool-events.test.ts` → all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/loose-json.ts lib/end-reason.ts lib/tool-events.ts lib/__tests__/end-reason.test.ts lib/__tests__/tool-events.test.ts && git commit -m "Share the end reason and tool call events between the browser and the webhook" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The browser learns the call ID and the offered times

The live screen must not show a Booked tag for a time the server will refuse. The server sends the two offered times with the call; the Vapi source filters on them and reports the call ID.

**Files:**
- Modify: `lib/start-test-call.ts`, `lib/call-source.ts`, `lib/vapi-source.ts`, `lib/vapi-browser.ts`
- Test: `lib/__tests__/start-test-call.test.ts`, `lib/__tests__/vapi-source.test.ts`

**Interfaces:**
- Consumes: `endReasonFrom`, `eventFromToolCall` (Task 2).
- Produces:
  - `POST /api/test-call` 200 body: `{ webCallUrl, callId, openTimes: [string, string] }`.
  - `StartResult` ok variant: `{ ok: true; webCallUrl: string; callId: string; openTimes: readonly string[] }`.
  - `CallHandlers.onCallId?(callId: string): void`: called once the server has made the call, before the join.

- [ ] **Step 1: Update the failing tests.**

In `lib/__tests__/start-test-call.test.ts`, change the test `returns only the room link and the call ID, never a secret or Vapi's control link`: rename it `returns only the room link, the call ID and the open times, never a secret or Vapi's control link`, and replace

```ts
    expect(JSON.parse(text)).toEqual({ webCallUrl: VAPI_CALL.webCallUrl, callId: VAPI_CALL.id });
```

with

```ts
    expect(JSON.parse(text)).toEqual({
      webCallUrl: VAPI_CALL.webCallUrl,
      callId: VAPI_CALL.id,
      openTimes: ["Tuesday, October 6 at 9 AM", "Tuesday, October 6 at 2 PM"],
    });
```

In `lib/__tests__/vapi-source.test.ts`:

1. Under the `fakeVapi` helper, add: `const OFFERED = ["Tuesday, October 6 at 9 AM", "Tuesday, October 6 at 2 PM"];`
2. In `harness`, add `const callIds: string[] = [];`, change the default `startTestCall` to `async (): Promise<StartResult> => ({ ok: true, webCallUrl: "https://vapi.daily.co/room", callId: "call-1", openTimes: OFFERED })`, change the start call to `createVapiSource(deps).start({ onEvent: (e) => events.push(e), onFailed: (f) => failures.push(f), onCallId: (id) => callIds.push(id) })`, and add `callIds` to the returned object.
3. Add these tests after `joins the room the server made`:

```ts
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
```

- [ ] **Step 2: Run them. They must fail.** `npx vitest run lib/__tests__/start-test-call.test.ts lib/__tests__/vapi-source.test.ts` → FAIL (no `openTimes` in the answer; no `callIds`).

- [ ] **Step 3: Write the code.**

`lib/start-test-call.ts`: replace

```ts
    const { webCallUrl, callId } = await deps.createWebCall({ visitorId, openTimes: openTimes(now) });
    return answer(200, { webCallUrl, callId });
```

with

```ts
    const times = openTimes(now);
    const { webCallUrl, callId } = await deps.createWebCall({ visitorId, openTimes: times });
    // The browser needs the two times only to show a booking that the server will accept.
    return answer(200, { webCallUrl, callId, openTimes: times });
```

`lib/call-source.ts`: in `CallHandlers`, add after `onEvent(event: CallEvent): void;`:

```ts
  /** The server made the call (a Test Call only). Called once, before the first event. */
  onCallId?(callId: string): void;
```

`lib/vapi-source.ts`:

1. Replace the two import lines
   `import { DETAIL_FIELDS, type CallEvent, type DetailField, type EndReason } from "@/lib/call-story";` and `import { TOOL } from "@/lib/luna-tools";` with:
   ```ts
   import type { EndReason } from "@/lib/call-story";
   import { endReasonFrom } from "@/lib/end-reason";
   import { eventFromToolCall } from "@/lib/tool-events";
   ```
2. Delete the local `function endReasonFrom(...) { ... }`, the local `function argumentsOf(...) { ... }`, and the local `function toEvent(...) { ... }` at the end of the file.
3. In `StartResult`, change the ok variant to `{ ok: true; webCallUrl: string; callId: string; openTimes: readonly string[] }`.
4. Change `start({ onEvent, onFailed }: CallHandlers) {` to `start({ onEvent, onFailed, onCallId }: CallHandlers) {`, and add `let offered: readonly string[] = [];` after `let sawError = false;`.
5. After `if (!result.ok) return onFailed(result.failure);` add:
   ```ts
        offered = result.openTimes;
        onCallId?.(result.callId);
   ```
6. In the `tool-calls` branch, replace
   ```ts
            const args = argumentsOf(call.function?.arguments);
            const event = toEvent(call.function?.name, args, at());
   ```
   with
   ```ts
            const event = eventFromToolCall(call.function?.name, call.function?.arguments, at(), offered);
   ```

`lib/vapi-browser.ts`: replace

```ts
        const { webCallUrl, callId } = await response.json();
        return { ok: true, webCallUrl, callId };
```

with

```ts
        const { webCallUrl, callId, openTimes } = await response.json();
        const offered = Array.isArray(openTimes) ? openTimes.filter((time): time is string => typeof time === "string") : [];
        return { ok: true, webCallUrl, callId, openTimes: offered };
```

- [ ] **Step 4: Run them. They must pass.** `npx vitest run lib/__tests__/start-test-call.test.ts lib/__tests__/vapi-source.test.ts` → all pass. Then `npm run typecheck` → no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/start-test-call.ts lib/call-source.ts lib/vapi-source.ts lib/vapi-browser.ts lib/__tests__/start-test-call.test.ts lib/__tests__/vapi-source.test.ts && git commit -m "The browser learns the call ID and the offered times, and shows only offered bookings" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The Call Notes store

**Files:**
- Create: `lib/call-notes-store.ts`, `lib/redis-notes-storage.ts`, `lib/server-env.ts`
- Modify: `app/api/test-call/route.ts` (use `server-env.ts`)
- Test: `lib/__tests__/fake-notes-storage.ts` (helper, not a test file), `lib/__tests__/call-notes-store.test.ts`

**Interfaces:**
- Produces:
  - `NOTES_TTL_SECONDS = 604800`, `NOTES_PER_VISITOR = 10`.
  - `SavedCallNotes = { callId: string; savedAt: string; notes: CallNotes }`.
  - `NotesStorage` (see code) and `CallNotesStore`:
    - `save({ visitorId, callId, notes, now }): Promise<{ saved: boolean }>`. `saved` is false when that call was already saved (the first copy stays).
    - `get({ visitorId, callId }): Promise<SavedCallNotes | null>`
    - `list({ visitorId }): Promise<SavedCallNotes[]>` (newest first, expired entries skipped)
  - `createCallNotesStore({ storage, prefix }): CallNotesStore`.
  - `redisNotesStorage(redis?): NotesStorage`.
  - `isProduction(): boolean`, `keyPrefix(): "avr:" | "avr:dev:"`.
  - Test helper `fakeNotesStorage({ failing? })` returning `{ storage, values, ttls, sets, writes }`.

- [ ] **Step 1: Write the test helper** `lib/__tests__/fake-notes-storage.ts`:

```ts
import type { NotesStorage, SavedCallNotes } from "@/lib/call-notes-store";

/** In-memory NotesStorage. Expiry is recorded in `ttls`, not enforced. */
export function fakeNotesStorage({ failing = false } = {}) {
  const values = new Map<string, SavedCallNotes>();
  const ttls = new Map<string, number>();
  const sets = new Map<string, Map<string, number>>();
  let writes = 0;
  const guard = () => {
    if (failing) throw new Error("Redis is down");
  };
  const ranked = (indexKey: string) => [...(sets.get(indexKey) ?? [])].sort((a, b) => b[1] - a[1]);

  const storage: NotesStorage = {
    async setIfNew(key, value, ttlSeconds) {
      guard();
      if (values.has(key)) return false;
      writes++;
      values.set(key, structuredClone(value));
      ttls.set(key, ttlSeconds);
      return true;
    },
    async getMany(keys) {
      guard();
      return keys.map((key) => structuredClone(values.get(key) ?? null));
    },
    async indexAdd(indexKey, member, score, ttlSeconds) {
      guard();
      writes++;
      const set = sets.get(indexKey) ?? new Map<string, number>();
      set.set(member, score);
      sets.set(indexKey, set);
      ttls.set(indexKey, ttlSeconds);
    },
    async indexTrim(indexKey, keep) {
      guard();
      for (const [member] of ranked(indexKey).slice(keep)) sets.get(indexKey)!.delete(member);
    },
    async indexNewest(indexKey, count) {
      guard();
      return ranked(indexKey)
        .slice(0, count)
        .map(([member]) => member);
    },
  };
  return { storage, values, ttls, sets, get writes() { return writes; } };
}
```

- [ ] **Step 2: Write the failing tests** `lib/__tests__/call-notes-store.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { NOTES_PER_VISITOR, NOTES_TTL_SECONDS, createCallNotesStore } from "@/lib/call-notes-store";
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
```

- [ ] **Step 3: Run it. It must fail.** `npx vitest run lib/__tests__/call-notes-store.test.ts` → FAIL (module not found).

- [ ] **Step 4: Write the code.**

`lib/call-notes-store.ts`:

```ts
// The Call Notes store: what the Receptionist captured, kept per Visitor for
// 7 days (ADR 0003). One entry per call, each with its own expiry, so there is
// no cleanup job. A short per-Visitor list, newest first, points to the entries.
// Keys hold the Visitor ID, so a Visitor can only ever reach their own.

import type { CallNotes } from "@/lib/call-story";

export const NOTES_TTL_SECONDS = 7 * 24 * 60 * 60;
export const NOTES_PER_VISITOR = 10;

export type SavedCallNotes = { readonly callId: string; readonly savedAt: string; readonly notes: CallNotes };

/** The slice of Redis the store needs. Tests use an in-memory one. */
export type NotesStorage = {
  /** Stores `value` under `key` for `ttlSeconds`, only if the key is new. True when it stored. */
  setIfNew(key: string, value: SavedCallNotes, ttlSeconds: number): Promise<boolean>;
  /** The values in key order; null for a key that is missing or has expired. */
  getMany(keys: readonly string[]): Promise<(SavedCallNotes | null)[]>;
  /** Puts `member` in the ranked list (a new score replaces the old one) and sets the list's expiry. */
  indexAdd(indexKey: string, member: string, score: number, ttlSeconds: number): Promise<void>;
  /** Keeps only the `keep` highest scores. */
  indexTrim(indexKey: string, keep: number): Promise<void>;
  /** The `count` highest-scored members, highest first. */
  indexNewest(indexKey: string, count: number): Promise<string[]>;
};

export type CallNotesStore = {
  /** `saved` is false when that call was already saved: the first copy stays. */
  save(input: { visitorId: string; callId: string; notes: CallNotes; now: Date }): Promise<{ saved: boolean }>;
  get(input: { visitorId: string; callId: string }): Promise<SavedCallNotes | null>;
  /** Newest first. An entry that has expired is left out. */
  list(input: { visitorId: string }): Promise<SavedCallNotes[]>;
};

export function createCallNotesStore({ storage, prefix }: { storage: NotesStorage; prefix: string }): CallNotesStore {
  const noteKey = (visitorId: string, callId: string) => `${prefix}notes:${visitorId}:${callId}`;
  const indexKey = (visitorId: string) => `${prefix}notes-index:${visitorId}`;

  return {
    async save({ visitorId, callId, notes, now }) {
      // List first: if the entry write fails and Vapi retries, the call still ends up listed.
      await storage.indexAdd(indexKey(visitorId), callId, now.getTime(), NOTES_TTL_SECONDS);
      await storage.indexTrim(indexKey(visitorId), NOTES_PER_VISITOR);
      const saved = await storage.setIfNew(noteKey(visitorId, callId), { callId, savedAt: now.toISOString(), notes }, NOTES_TTL_SECONDS);
      return { saved };
    },

    async get({ visitorId, callId }) {
      const [found] = await storage.getMany([noteKey(visitorId, callId)]);
      return found ?? null;
    },

    async list({ visitorId }) {
      const callIds = await storage.indexNewest(indexKey(visitorId), NOTES_PER_VISITOR);
      if (callIds.length === 0) return [];
      const found = await storage.getMany(callIds.map((callId) => noteKey(visitorId, callId)));
      return found.filter((entry): entry is SavedCallNotes => entry !== null);
    },
  };
}
```

`lib/redis-notes-storage.ts`:

```ts
import "server-only";
import { Redis } from "@upstash/redis";
import type { NotesStorage, SavedCallNotes } from "@/lib/call-notes-store";

// The Call Notes store's storage on Upstash Redis. This Redis is shared with
// the TEKGUYZ website: the store only ever names keys under its own prefix.
// Upstash turns objects to JSON and back by itself, so values go in as objects.
export function redisNotesStorage(redis: Redis = Redis.fromEnv({ signal: () => AbortSignal.timeout(3000) })): NotesStorage {
  return {
    async setIfNew(key, value, ttlSeconds) {
      return (await redis.set(key, value, { nx: true, ex: ttlSeconds })) === "OK";
    },
    async getMany(keys) {
      if (keys.length === 0) return [];
      const found = await redis.mget<(SavedCallNotes | null)[]>(...keys);
      return found.map((entry) => entry ?? null);
    },
    async indexAdd(indexKey, member, score, ttlSeconds) {
      const pipeline = redis.pipeline();
      pipeline.zadd(indexKey, { score, member });
      pipeline.expire(indexKey, ttlSeconds);
      await pipeline.exec();
    },
    async indexTrim(indexKey, keep) {
      await redis.zremrangebyrank(indexKey, 0, -(keep + 1));
    },
    async indexNewest(indexKey, count) {
      return redis.zrange<string[]>(indexKey, 0, count - 1, { rev: true });
    },
  };
}
```

`lib/server-env.ts`:

```ts
// Not NODE_ENV: Vercel Preview and a local `next start` are "production" builds
// but must use the dev limits and the avr:dev: keys. Only VERCEL_ENV says which.
export const isProduction = () => process.env.VERCEL_ENV === "production";

/** Every Redis key this app writes starts with this, so the shared Redis stays tidy. */
export const keyPrefix = () => (isProduction() ? "avr:" : "avr:dev:");
```

`app/api/test-call/route.ts`: add `import { isProduction, keyPrefix } from "@/lib/server-env";`; delete the comment line and `const production = process.env.VERCEL_ENV === "production";`; in the gate, replace `limits: production ? LIMITS : DEV_LIMITS,` with `limits: isProduction() ? LIMITS : DEV_LIMITS,` and `prefix: production ? "avr:" : "avr:dev:",` with `prefix: keyPrefix(),`.

- [ ] **Step 5: Run the tests. They must pass.** `npx vitest run lib/__tests__/call-notes-store.test.ts` → 7 passed. `npm run typecheck` → no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/call-notes-store.ts lib/redis-notes-storage.ts lib/server-env.ts app/api/test-call/route.ts lib/__tests__/fake-notes-storage.ts lib/__tests__/call-notes-store.test.ts && git commit -m "Add the Call Notes store: per Visitor, newest first, 7-day expiry" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Vapi's end-of-call report to Call Notes

This is the only file that knows the report's shape. If the live check (Task 10) shows a different shape, only this file and its fixture change.

**Files:**
- Create: `lib/call-notes-from-report.ts`
- Test: `lib/__tests__/vapi-report-fixture.ts` (helper), `lib/__tests__/call-notes-from-report.test.ts`

**Interfaces:**
- Consumes: `tellCallStory` (`lib/call-story.ts`), `eventFromToolCall`, `endReasonFrom`, `asRecord`, `asText`, `isVisitorId` (`lib/visitor.ts`).
- Produces:
  - `offeredTimesOf(call: unknown): string[]` (from `call.assistantOverrides.variableValues.openTime1/2`)
  - `visitorIdOf(call: unknown): string | null` (from `call.assistantOverrides.metadata.visitorId`, only if it is a valid Visitor ID)
  - `callNotesFromReport(message: unknown): { callId: string; visitorId: string; notes: CallNotes } | null`. Null when the report is not one of our Test Calls.
  - Fixture exports: `VISITOR_A`, `VISITOR_B`, `OPEN_TIMES`, `endOfCallReport(over?, visitorId?)`.

- [ ] **Step 1: Write the fixture** `lib/__tests__/vapi-report-fixture.ts` (shaped like Vapi's end-of-call-report; the live check confirms it):

```ts
export const VISITOR_A = "7b0c6d8e-1f2a-4b3c-8d4e-5f6a7b8c9d0e";
export const VISITOR_B = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
export const OPEN_TIMES: [string, string] = ["Tuesday, October 6 at 9 AM", "Tuesday, October 6 at 2 PM"];

const toolCall = (name: string, args: object) => ({ id: `tc-${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } });

/** What Vapi sends as `message` when a call ends: a short call that books 9 AM. */
export function endOfCallReport(over: Record<string, unknown> = {}, visitorId: string | null = VISITOR_A) {
  return {
    type: "end-of-call-report",
    endedReason: "assistant-ended-call",
    durationSeconds: 75.4,
    analysis: { summary: "Rosa Diaz called about an AC that blows warm air and booked Tuesday at 9 AM." },
    call: {
      id: "call-123",
      assistantOverrides: {
        ...(visitorId ? { metadata: { visitorId } } : {}),
        variableValues: { openTime1: OPEN_TIMES[0], openTime2: OPEN_TIMES[1] },
      },
    },
    artifact: {
      messages: [
        { role: "system", message: "You are Luna, the receptionist...", secondsFromStart: 0 },
        { role: "bot", message: "Thanks for calling Mangrove Air, this is Luna. How can I help you today?", secondsFromStart: 1.2 },
        { role: "user", message: "Hi, my AC is blowing warm air.", secondsFromStart: 6.5 },
        { role: "tool_calls", toolCalls: [toolCall("recordDetail", { field: "job", value: "AC blowing warm air" })], secondsFromStart: 8 },
        { role: "tool_call_result", name: "recordDetail", result: "Noted.", secondsFromStart: 8.2 },
        { role: "user", message: "Rosa Diaz.", secondsFromStart: 14 },
        { role: "tool_calls", toolCalls: [toolCall("recordDetail", { field: "name", value: "Rosa Diaz" })], secondsFromStart: 15 },
        { role: "user", message: "Tuesday at nine please.", secondsFromStart: 40 },
        { role: "tool_calls", toolCalls: [toolCall("bookTime", { time: "tuesday, october 6 at 9 am" })], secondsFromStart: 41 },
        { role: "bot", message: "You're all set for Tuesday at nine in the morning. Goodbye.", secondsFromStart: 46 },
      ],
    },
    ...over,
  };
}
```

- [ ] **Step 2: Write the failing tests** `lib/__tests__/call-notes-from-report.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { callNotesFromReport } from "@/lib/call-notes-from-report";
import { OPEN_TIMES, VISITOR_A, endOfCallReport } from "./vapi-report-fixture";

describe("Call Notes from Vapi's end-of-call report", () => {
  it("files the notes under the call and the Visitor named in the call's metadata", () => {
    const report = callNotesFromReport(endOfCallReport());
    expect(report?.callId).toBe("call-123");
    expect(report?.visitorId).toBe(VISITOR_A);
  });

  it("builds the transcript in order, Caller and Receptionist, with no system prompt", () => {
    const { notes } = callNotesFromReport(endOfCallReport())!;
    expect(notes.lines.map((l) => [l.speaker, l.atMs])).toEqual([
      ["receptionist", 1200],
      ["caller", 6500],
      ["caller", 14000],
      ["caller", 40000],
      ["receptionist", 46000],
    ]);
    expect(notes.lines[1].text).toBe("Hi, my AC is blowing warm air.");
  });

  it("takes the details and the booking from Luna's tool calls, with the booking as offered", () => {
    const { notes } = callNotesFromReport(endOfCallReport())!;
    expect(notes.details).toEqual({ job: "AC blowing warm air", name: "Rosa Diaz" });
    expect(notes.booked).toBe(OPEN_TIMES[0]);
  });

  it("drops a booking for a time that was not offered", () => {
    const report = endOfCallReport();
    const messages = report.artifact.messages.map((m) =>
      m.role === "tool_calls" && JSON.stringify(m).includes("bookTime")
        ? { ...m, toolCalls: [{ id: "x", type: "function", function: { name: "bookTime", arguments: '{"time":"Friday at noon"}' } }] }
        : m,
    );
    const { notes } = callNotesFromReport({ ...report, artifact: { messages } })!;
    expect(notes.booked).toBeNull();
  });

  it("uses Vapi's summary, and builds one from the details when Vapi sent none", () => {
    expect(callNotesFromReport(endOfCallReport())!.notes.summary).toBe("Rosa Diaz called about an AC that blows warm air and booked Tuesday at 9 AM.");
    const { notes } = callNotesFromReport(endOfCallReport({ analysis: {} }))!;
    expect(notes.summary).toBe(`Rosa Diaz called about AC blowing warm air. Booked for ${OPEN_TIMES[0]}.`);
  });

  it("maps the end reason and takes the duration from the report", () => {
    const { notes } = callNotesFromReport(endOfCallReport({ endedReason: "exceeded-max-duration" }))!;
    expect(notes.endReason).toBe("time-limit");
    expect(notes.durationMs).toBe(75400);
  });

  it("passes a Spanish transcript through unchanged", () => {
    const report = endOfCallReport();
    const messages = [{ role: "user", message: "Hola, mi aire acondicionado no enfría.", secondsFromStart: 5 }];
    const { notes } = callNotesFromReport({ ...report, artifact: { messages } })!;
    expect(notes.lines[0].text).toBe("Hola, mi aire acondicionado no enfría.");
  });

  it("makes notes even for an empty call", () => {
    const { notes } = callNotesFromReport(endOfCallReport({ artifact: { messages: [] }, analysis: {} }))!;
    expect(notes.lines).toEqual([]);
    expect(notes.summary).toBe("No details were captured. No time was booked.");
  });

  it("is not one of our Test Calls without a valid Visitor ID or a call ID", () => {
    expect(callNotesFromReport(endOfCallReport({}, null))).toBeNull();
    expect(callNotesFromReport(endOfCallReport({}, "not-a-visitor-id"))).toBeNull();
    expect(callNotesFromReport(endOfCallReport({ call: { assistantOverrides: { metadata: { visitorId: VISITOR_A } } } }))).toBeNull();
    expect(callNotesFromReport("garbage")).toBeNull();
    expect(callNotesFromReport(undefined)).toBeNull();
  });
});
```

- [ ] **Step 3: Run it. It must fail.** `npx vitest run lib/__tests__/call-notes-from-report.test.ts` → FAIL (module not found).

- [ ] **Step 4: Write** `lib/call-notes-from-report.ts`:

```ts
// Vapi's end-of-call report as Call Notes. This is the only file that knows
// the report's shape: the call's metadata, the transcript in `artifact.messages`
// and Vapi's summary. The Call Story does the rest, so the saved notes and the
// ones on the live screen come from the same code.

import { tellCallStory, type CallEvent, type CallNotes } from "@/lib/call-story";
import { endReasonFrom } from "@/lib/end-reason";
import { asRecord, asText } from "@/lib/loose-json";
import { eventFromToolCall } from "@/lib/tool-events";
import { isVisitorId } from "@/lib/visitor";

/** The two open times this call was told to offer: the values the server sent when it made the call. */
export function offeredTimesOf(call: unknown): string[] {
  const values = asRecord(asRecord(asRecord(call).assistantOverrides).variableValues);
  return [asText(values.openTime1), asText(values.openTime2)].filter(Boolean);
}

/** The Visitor who made this call, from the metadata the server sent. Null if it is missing or not a Visitor ID. */
export function visitorIdOf(call: unknown): string | null {
  const id = asRecord(asRecord(asRecord(call).assistantOverrides).metadata).visitorId;
  return isVisitorId(id) ? id : null;
}

export type ReportedCall = { callId: string; visitorId: string; notes: CallNotes };

/** Call Notes from an end-of-call report, or null when it is not one of our Test Calls. */
export function callNotesFromReport(message: unknown): ReportedCall | null {
  const report = asRecord(message);
  const call = asRecord(report.call);
  const callId = asText(call.id);
  const visitorId = visitorIdOf(call);
  if (!callId || !visitorId) return null;

  const offered = offeredTimesOf(call);
  const events: CallEvent[] = [];
  let atMs = 0;
  const messages = asRecord(report.artifact).messages;
  for (const entry of Array.isArray(messages) ? messages : []) {
    const item = asRecord(entry);
    if (typeof item.secondsFromStart === "number" && Number.isFinite(item.secondsFromStart)) {
      atMs = Math.max(atMs, Math.round(item.secondsFromStart * 1000));
    }
    const role = asText(item.role);
    if (role === "user" || role === "bot" || role === "assistant") {
      const text = asText(item.message);
      if (text) events.push({ type: "line", speaker: role === "user" ? "caller" : "receptionist", text, atMs });
    } else if (role === "tool_calls") {
      for (const toolCall of Array.isArray(item.toolCalls) ? item.toolCalls : []) {
        const fn = asRecord(asRecord(toolCall).function);
        const event = eventFromToolCall(asText(fn.name) || undefined, fn.arguments, atMs, offered);
        if (event) events.push(event);
      }
    }
  }

  const reportedMs = typeof report.durationSeconds === "number" ? Math.round(report.durationSeconds * 1000) : 0;
  events.push({ type: "ended", reason: endReasonFrom(asText(report.endedReason) || undefined), atMs: Math.max(atMs, reportedMs) });

  const summary = asText(asRecord(report.analysis).summary) || asText(report.summary) || undefined;
  const { notes } = tellCallStory(events, { summary });
  return notes ? { callId, visitorId, notes } : null;
}
```

- [ ] **Step 5: Run it. It must pass.** `npx vitest run lib/__tests__/call-notes-from-report.test.ts` → 9 passed.

- [ ] **Step 6: Commit**

```bash
git add lib/call-notes-from-report.ts lib/__tests__/vapi-report-fixture.ts lib/__tests__/call-notes-from-report.test.ts && git commit -m "Build Call Notes from Vapi's end-of-call report" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The Vapi webhook

**Files:**
- Create: `lib/vapi-webhook.ts`, `app/api/vapi/webhook/route.ts`
- Test: `lib/__tests__/vapi-webhook.test.ts`

**Interfaces:**
- Consumes: `CallNotesStore` (Task 4), `callNotesFromReport`, `offeredTimesOf` (Task 5), `argumentsOf` (Task 2), `matchOfferedTime` (Task 1), `TOOL`.
- Produces: `WEBHOOK_SECRET_HEADER = "x-vapi-secret"`; `handleVapiWebhook(request: Request, deps: { secret: string; store: CallNotesStore; now(): Date }): Promise<Response>`. Answers:
  - 401 `{ reason: "unauthorized" }`: secret wrong or missing. Nothing is read or stored.
  - 400 `{ reason: "bad-request" }`: body is not JSON.
  - `tool-calls`: 200 `{ results: [{ name, toolCallId, result }] }`
  - `end-of-call-report`: 200 `{ saved: boolean }`, or 200 `{ ignored: "not-a-test-call" }`, or 503 `{ reason: "unavailable" }` when the store fails.
  - any other message type: 200 `{}`.

- [ ] **Step 1: Write the failing tests** `lib/__tests__/vapi-webhook.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it. It must fail.** `npx vitest run lib/__tests__/vapi-webhook.test.ts` → FAIL (module not found).

- [ ] **Step 3: Write** `lib/vapi-webhook.ts`:

```ts
// The Vapi webhook: the one door Vapi uses to reach this app during a Test
// Call. It checks Vapi's secret first and reads nothing else until that
// passes. Then it answers Luna's tool calls (a booking must be one of the two
// open times offered) and, when the call ends, saves the Call Notes for the
// Visitor named in the call's metadata. Deps are injected so the tests need
// no Redis and no Vapi.
import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { callNotesFromReport, offeredTimesOf } from "@/lib/call-notes-from-report";
import type { CallNotesStore } from "@/lib/call-notes-store";
import { asRecord, asText } from "@/lib/loose-json";
import { TOOL } from "@/lib/luna-tools";
import { matchOfferedTime } from "@/lib/open-times";
import { argumentsOf } from "@/lib/tool-events";

export const WEBHOOK_SECRET_HEADER = "x-vapi-secret";

export type VapiWebhookDeps = { secret: string; store: CallNotesStore; now(): Date };

const answer = (status: number, body: object) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Compares digests, so the comparison takes the same time whatever is wrong. */
function secretMatches(given: string | null, secret: string): boolean {
  if (!given || !secret) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(secret));
}

export async function handleVapiWebhook(request: Request, deps: VapiWebhookDeps): Promise<Response> {
  if (!secretMatches(request.headers.get(WEBHOOK_SECRET_HEADER), deps.secret)) return answer(401, { reason: "unauthorized" });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return answer(400, { reason: "bad-request" });
  }

  const message = asRecord(asRecord(body).message);
  switch (message.type) {
    case "tool-calls":
      return answer(200, { results: answerToolCalls(message) });
    case "end-of-call-report":
      return saveReport(message, deps);
    default:
      return answer(200, {});
  }
}

function answerToolCalls(message: Record<string, unknown>) {
  const offered = offeredTimesOf(message.call);
  const list = Array.isArray(message.toolCallList) ? message.toolCallList : [];
  return list.map((raw) => {
    const item = asRecord(raw);
    const fn = asRecord(item.function);
    const name = asText(item.name) || asText(fn.name);
    const args = argumentsOf(item.arguments ?? fn.arguments);
    return { name, toolCallId: asText(item.id), result: resultFor(name, args, offered) };
  });
}

function resultFor(name: string, args: Record<string, unknown>, offered: readonly string[]): string {
  if (name === TOOL.recordDetail) return "Noted.";
  if (name === TOOL.bookTime) {
    const time = matchOfferedTime(asText(args.time), offered);
    if (time) return `Booked for ${time}.`;
    return offered.length > 0
      ? `That time was not offered. Offer only these two: ${offered.join(" or ")}.`
      : "That time was not offered. A dispatcher will call back to find a time.";
  }
  return "Unknown tool.";
}

async function saveReport(message: Record<string, unknown>, deps: VapiWebhookDeps): Promise<Response> {
  const report = callNotesFromReport(message);
  // A call with no Visitor in its metadata is not a Test Call from this app. Say OK so Vapi does not retry it.
  if (!report) return answer(200, { ignored: "not-a-test-call" });
  try {
    const { saved } = await deps.store.save({ ...report, now: deps.now() });
    return answer(200, { saved });
  } catch (error) {
    console.error("Vapi webhook: could not save Call Notes.", error instanceof Error ? error.message : error);
    return answer(503, { reason: "unavailable" });
  }
}
```

`app/api/vapi/webhook/route.ts`:

```ts
import { createCallNotesStore } from "@/lib/call-notes-store";
import { redisNotesStorage } from "@/lib/redis-notes-storage";
import { keyPrefix } from "@/lib/server-env";
import { handleVapiWebhook } from "@/lib/vapi-webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (!secret || !process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error("Vapi webhook: VAPI_WEBHOOK_SECRET, UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing.");
    return Response.json({ reason: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return handleVapiWebhook(request, {
    secret,
    store: createCallNotesStore({ storage: redisNotesStorage(), prefix: keyPrefix() }),
    now: () => new Date(),
  });
}
```

- [ ] **Step 4: Run it. It must pass.** `npx vitest run lib/__tests__/vapi-webhook.test.ts` → all pass. `npm run typecheck` → no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/vapi-webhook.ts app/api/vapi/webhook/route.ts lib/__tests__/vapi-webhook.test.ts && git commit -m "Add the Vapi webhook: check the secret, answer the tools, save the Call Notes" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The Visitor reads their saved Call Notes

**Files:**
- Create: `lib/get-call-notes.ts`, `app/api/call-notes/route.ts`
- Test: `lib/__tests__/get-call-notes.test.ts`

**Interfaces:**
- Consumes: `CallNotesStore`, `visitorIdFrom` (`lib/visitor.ts`).
- Produces: `getCallNotes(request: Request, deps: { store: CallNotesStore }): Promise<Response>` for `GET /api/call-notes?callId=<id>`:
  - 401 `{ reason: "no-visitor" }` with no Visitor cookie
  - 400 `{ reason: "bad-call-id" }` unless `callId` matches `^[A-Za-z0-9-]{1,64}$`
  - 200 `{ status: "ready", notes }` or 200 `{ status: "pending" }`
  - 503 `{ reason: "unavailable" }` when the store fails

- [ ] **Step 1: Write the failing tests** `lib/__tests__/get-call-notes.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it. It must fail.** `npx vitest run lib/__tests__/get-call-notes.test.ts` → FAIL (module not found).

- [ ] **Step 3: Write the code.**

`lib/get-call-notes.ts`:

```ts
// The Visitor reads their own saved Call Notes. The Visitor ID comes from the
// cookie, never from the request's address, so no one can ask for another
// Visitor's call: an ID that is not theirs is simply "pending".

import type { CallNotesStore } from "@/lib/call-notes-store";
import { visitorIdFrom } from "@/lib/visitor";

const CALL_ID = /^[A-Za-z0-9-]{1,64}$/;

const answer = (status: number, body: object) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function getCallNotes(request: Request, deps: { store: CallNotesStore }): Promise<Response> {
  const visitorId = visitorIdFrom(request.headers.get("cookie"));
  if (!visitorId) return answer(401, { reason: "no-visitor" });

  const callId = new URL(request.url).searchParams.get("callId") ?? "";
  if (!CALL_ID.test(callId)) return answer(400, { reason: "bad-call-id" });

  try {
    const saved = await deps.store.get({ visitorId, callId });
    return answer(200, saved ? { status: "ready", notes: saved.notes } : { status: "pending" });
  } catch (error) {
    console.error("Call Notes: could not read.", error instanceof Error ? error.message : error);
    return answer(503, { reason: "unavailable" });
  }
}
```

`app/api/call-notes/route.ts`:

```ts
import { createCallNotesStore } from "@/lib/call-notes-store";
import { getCallNotes } from "@/lib/get-call-notes";
import { redisNotesStorage } from "@/lib/redis-notes-storage";
import { keyPrefix } from "@/lib/server-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error("Call Notes: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing.");
    return Response.json({ reason: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return getCallNotes(request, { store: createCallNotesStore({ storage: redisNotesStorage(), prefix: keyPrefix() }) });
}
```

- [ ] **Step 4: Run it. It must pass.** `npx vitest run lib/__tests__/get-call-notes.test.ts` → 6 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/get-call-notes.ts app/api/call-notes/route.ts lib/__tests__/get-call-notes.test.ts && git commit -m "Let a Visitor read their own saved Call Notes" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Each call carries its webhook address; Luna sends to the server

**Files:**
- Modify: `lib/vapi-web-call.ts`, `app/api/test-call/route.ts`, `vapi/luna.ts`
- Test: `lib/__tests__/start-test-call.test.ts`, `vapi/__tests__/luna.test.ts`

**Interfaces:**
- Consumes: `VAPI_WEBHOOK_SECRET` env (Task 10 creates it).
- Produces: `vapiWebCallCreator({ ..., webhook?: { url: string; secret: string } })`. With `webhook`, the Vapi call body gets `assistantOverrides.server = { url, headers: { "X-Vapi-Secret": secret } }`. Luna: `serverMessages: ["tool-calls", "end-of-call-report"]`; `recordDetail` async; `bookTime` waits for the answer; `checkLuna` checks all of it.

- [ ] **Step 1: Write the failing tests.**

In `lib/__tests__/start-test-call.test.ts`, replace the line `  it("fails when Vapi refuses", async () => {` with this test followed by that same line:

```ts
  it("tells Vapi where to send tool calls and the report, with the webhook secret in a header only", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify(VAPI_CALL), { status: 201 }));
    const create = vapiWebCallCreator({
      privateKey: PRIVATE_KEY,
      orgId: ORG_ID,
      assistantId: "asst-1",
      fetchImpl,
      webhook: { url: "https://demo.example/api/vapi/webhook", secret: "hook-secret" },
    });
    const result = await create({ visitorId: VISITOR, openTimes: OPEN_TIMES });
    const [, init] = fetchImpl.mock.calls[0];
    expect(JSON.parse(String(init!.body)).assistantOverrides).toEqual({
      metadata: { visitorId: VISITOR },
      variableValues: { openTime1: OPEN_TIMES[0], openTime2: OPEN_TIMES[1] },
      server: { url: "https://demo.example/api/vapi/webhook", headers: { "X-Vapi-Secret": "hook-secret" } },
    });
    expect(new Headers(init!.headers).get("authorization")).not.toContain("hook-secret");
    expect(JSON.stringify(result)).not.toContain("hook-secret");
  });

  it("sends no server override when there is no webhook address (a local server Vapi cannot reach)", async () => {
    const { init } = await sendOne();
    expect(JSON.parse(String(init.body)).assistantOverrides).not.toHaveProperty("server");
  });

```

In `vapi/__tests__/luna.test.ts`, replace

```ts
    expect(checkLuna({ ...luna, server: { url: "https://example.com" } })).toContain("Luna must have no server URL until #5.");
```

with

```ts
    expect(checkLuna({ ...luna, server: { url: "https://example.com" } })).toContain(
      "Luna must have no saved server URL: the server gives each call its own webhook address.",
    );
```

and replace

```ts
    expect(checkLuna(noBooking)).toContain(`Tool ${TOOL.bookTime} is missing or not async.`);
```

with

```ts
    expect(checkLuna(noBooking)).toContain(`Tool ${TOOL.bookTime} is missing.`);
```

and add these tests before the final `});` of the `describe`:

```ts
  it("let recordDetail run without waiting, and make bookTime wait for the server's answer", () => {
    const luna = lunaAssistant() as any;
    const withTools = (edit: (tool: any) => any) => ({
      ...luna,
      model: { ...luna.model, tools: luna.model.tools.map((t: any) => (t.function?.name ? edit(t) : t)) },
    });
    expect(luna.model.tools.find((t: any) => t.function?.name === TOOL.recordDetail).async).toBe(true);
    expect(luna.model.tools.find((t: any) => t.function?.name === TOOL.bookTime).async).not.toBe(true);
    expect(checkLuna(withTools((t) => ({ ...t, async: true })))).toContain(`Tool ${TOOL.bookTime} must wait for the server's answer (not async).`);
    expect(checkLuna(withTools((t) => ({ ...t, async: false })))).toContain(`Tool ${TOOL.recordDetail} must be async.`);
    expect(checkLuna(withTools((t) => ({ ...t, server: { url: "https://example.com" } })))).toContain(`Tool ${TOOL.bookTime} must have no server URL of its own.`);
  });

  it("send tool calls and the end-of-call report to the server", () => {
    const luna = lunaAssistant() as any;
    expect(luna.serverMessages).toEqual(["tool-calls", "end-of-call-report"]);
    expect(checkLuna({ ...luna, serverMessages: [] })).toContain('The server must get "end-of-call-report" messages.');
  });

  it("tell Luna what to do when a booking is refused", () => {
    const prompt: string = (lunaAssistant() as any).model.messages[0].content;
    expect(prompt).toContain("answers that the time was not offered, offer the two open times again");
  });
```

- [ ] **Step 2: Run them. They must fail.** `npx vitest run lib/__tests__/start-test-call.test.ts vapi/__tests__/luna.test.ts` → FAIL.

- [ ] **Step 3: Write the code.**

`lib/vapi-web-call.ts`:

1. Replace the destructuring header
   ```ts
     assistantId,
     fetchImpl = fetch,
     now = Date.now,
   }: {
   ```
   with
   ```ts
     assistantId,
     webhook,
     fetchImpl = fetch,
     now = Date.now,
   }: {
   ```
2. In the type, replace `  assistantId: string;\n  fetchImpl?: typeof fetch;` with
   ```ts
     assistantId: string;
     /**
      * Where Vapi sends this call's tool calls and end-of-call report, and the
      * secret it must send back. Set on each call, so a Preview deploy gets its
      * own notes. Left out when Vapi cannot reach this server (local development).
      */
     webhook?: { url: string; secret: string };
     fetchImpl?: typeof fetch;
   ```
3. Replace
   ```ts
           assistantOverrides: { metadata: { visitorId }, variableValues: { openTime1, openTime2 } },
   ```
   with
   ```ts
           assistantOverrides: {
             metadata: { visitorId },
             variableValues: { openTime1, openTime2 },
             ...(webhook ? { server: { url: webhook.url, headers: { "X-Vapi-Secret": webhook.secret } } } : {}),
           },
   ```
   Also update the comment above `vapiWebCallCreator`'s return (the "Only these two leave the server" comment stays true: the secret never reaches the browser).

`app/api/test-call/route.ts`: inside `POST`, before `return startTestCall(`, add:

```ts
  // Vapi sends the tool calls and the end-of-call report here. It can only reach a public https address, so a local server saves no Call Notes.
  const webhookSecret = process.env.VAPI_WEBHOOK_SECRET;
  const origin = new URL(request.url).origin;
  const webhook = webhookSecret && origin.startsWith("https://") ? { url: `${origin}/api/vapi/webhook`, secret: webhookSecret } : undefined;
  if (!webhookSecret) console.error("Start Test Call: VAPI_WEBHOOK_SECRET is missing, so this call's Call Notes will not be saved.");
```

and change `createWebCall: vapiWebCallCreator({ privateKey, orgId, assistantId }),` to `createWebCall: vapiWebCallCreator({ privateKey, orgId, assistantId, webhook }),`.

`vapi/luna.ts`:

1. Replace the header comment lines
   ```
   // Both tools are client-side and async (no server URL): the browser sees each
   // tool call and turns it into a Call Story event. The webhook comes in #5.
   ```
   with
   ```
   // Neither tool has a server URL of its own. The server gives each call its own
   // webhook address (lib/vapi-web-call.ts), and Vapi sends the tool calls and the
   // end-of-call report there. recordDetail is async: Luna does not wait. bookTime
   // waits for the answer, so the webhook can refuse a time that was not offered.
   // The browser still sees each tool call and turns it into a Call Story event.
   ```
2. In `SYSTEM_PROMPT`, replace `If neither time works, say a dispatcher will call back to find a time, and do not book.` with `If neither time works, say a dispatcher will call back to find a time, and do not book. If ${TOOL.bookTime} answers that the time was not offered, offer the two open times again.`
3. In the `bookTime` tool, delete the line `          async: true,` that sits right above `          function: {` / `            name: TOOL.bookTime,` (leave the `recordDetail` one).
4. Replace `serverMessages: [],` with `serverMessages: ["tool-calls", "end-of-call-report"],`.
5. In `checkLuna`, replace
   ```ts
     if (luna.server?.url) problems.push("Luna must have no server URL until #5.");
     const tools: any[] = luna.model?.tools ?? [];
     for (const name of Object.values(TOOL)) {
       const tool = tools.find((t) => t.function?.name === name);
       if (!tool || tool.async !== true || tool.server?.url) problems.push(`Tool ${name} is missing or not async.`);
     }
   ```
   with
   ```ts
     if (luna.server?.url) problems.push("Luna must have no saved server URL: the server gives each call its own webhook address.");
     const tools: any[] = luna.model?.tools ?? [];
     for (const name of Object.values(TOOL)) {
       const tool = tools.find((t) => t.function?.name === name);
       if (!tool) problems.push(`Tool ${name} is missing.`);
       else if (tool.server?.url) problems.push(`Tool ${name} must have no server URL of its own.`);
       else if (name === TOOL.recordDetail && tool.async !== true) problems.push(`Tool ${name} must be async.`);
       else if (name === TOOL.bookTime && tool.async === true) problems.push(`Tool ${name} must wait for the server's answer (not async).`);
     }
   ```
   and after the `clientMessages` loop (the one ending with `The browser must get "${kind}" messages.`) add:
   ```ts
     const serverMessages: string[] = luna.serverMessages ?? [];
     for (const kind of ["tool-calls", "end-of-call-report"]) {
       if (!serverMessages.includes(kind)) problems.push(`The server must get "${kind}" messages.`);
     }
   ```

- [ ] **Step 4: Run them. They must pass.** `npx vitest run lib/__tests__/start-test-call.test.ts vapi/__tests__/luna.test.ts` → all pass. Then `npm run vapi:sync -- --dry-run` → prints Luna and ends with `Checks: all good.` (sends nothing). `npm run typecheck` → no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/vapi-web-call.ts app/api/test-call/route.ts vapi/luna.ts lib/__tests__/start-test-call.test.ts vapi/__tests__/luna.test.ts && git commit -m "Each call carries its webhook address; Luna sends tool calls and the report to the server" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The Call Notes screen fills in from the saved copy

**Files:**
- Create: `lib/saved-notes.ts`
- Modify: `app/demo/call-screen.tsx`, `DESIGN.md`
- Test: `lib/__tests__/saved-notes.test.ts`

**Interfaces:**
- Consumes: `GET /api/call-notes` (Task 7), `onCallId` (Task 3).
- Produces: `fetchSavedNotes(callId, fetchImpl?)`, `watchSavedNotes(options)` (below). Screen states for a Test Call's notes: `waiting` ("Finishing the summary…"), `late` (after 60 s), `saved`. The Sample Call keeps showing its notes at once (`sample`).

- [ ] **Step 1: Write the failing tests** `lib/__tests__/saved-notes.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it. It must fail.** `npx vitest run lib/__tests__/saved-notes.test.ts` → FAIL (module not found).

- [ ] **Step 3: Write** `lib/saved-notes.ts`:

```ts
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
```

- [ ] **Step 4: Run it. It must pass.** `npx vitest run lib/__tests__/saved-notes.test.ts` → 6 passed.

- [ ] **Step 5: Update the screen** `app/demo/call-screen.tsx`. Make these exact edits.

1. After `import { createSampleCallPlayer } from "@/lib/sample-call";` add `import { fetchSavedNotes, watchSavedNotes } from "@/lib/saved-notes";`.
2. Replace `export function CallScreen() {` with:
   ```tsx
   // What the screen knows about the saved copy of a Test Call's notes.
   type Saved = { kind: "waiting" } | { kind: "ready"; notes: CallNotes } | { kind: "late" };

   export function CallScreen() {
   ```
3. After `const [events, setEvents] = useState<CallEvent[]>([]);` add:
   ```tsx
     // The server's ID for the Test Call, and whether its notes are saved yet.
     const [callId, setCallId] = useState<string | null>(null);
     const [saved, setSaved] = useState<Saved>({ kind: "waiting" });
   ```
4. In `begin`, after `setSheetGone(false);` add `setCallId(null);` and `setSaved({ kind: "waiting" });` (two lines). In the `.start({ ... })` handlers, add before `onFailed: (failure) => {`:
   ```tsx
         onCallId: (id) => {
           if (number !== callNumber.current) return;
           setCallId(id);
         },
   ```
5. Replace
   ```tsx
     // The phase word for screen readers; never the ticking timer.
     const announcement = notes ? "Call ended" : phase.kind === "connecting" ? "Calling…" : phase.kind === "running" ? "On the line" : "";
   ```
   with
   ```tsx
     const ended = notes !== null;
     // A Test Call's notes are saved by the server a moment after the call ends: ask until they are there.
     useEffect(() => {
       if (!ended || mode !== "test") return;
       if (!callId) {
         setSaved({ kind: "late" });
         return;
       }
       const stop = new AbortController();
       watchSavedNotes({
         fetchOnce: () => fetchSavedNotes(callId),
         sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
         now: () => performance.now(),
         signal: stop.signal,
         onReady: (found) => setSaved({ kind: "ready", notes: found }),
         onGiveUp: () => setSaved({ kind: "late" }),
       });
       return () => stop.abort();
     }, [ended, mode, callId]);

     // The phase word for screen readers; never the ticking timer.
     const endedWord =
       mode === "sample"
         ? "Call ended"
         : saved.kind === "ready"
           ? "Call Notes ready"
           : saved.kind === "late"
             ? "Call ended. The summary did not arrive."
             : "Call ended. Finishing the notes.";
     const announcement = notes ? endedWord : phase.kind === "connecting" ? "Calling…" : phase.kind === "running" ? "On the line" : "";
   ```
6. Replace
   ```tsx
             notes={notes}
             againLabel={mode === "test" ? "Make another Test Call" : "Play the Sample Call again"}
   ```
   with
   ```tsx
             notes={saved.kind === "ready" ? saved.notes : notes}
             state={mode === "sample" ? "sample" : saved.kind === "ready" ? "saved" : saved.kind}
             againLabel={mode === "test" ? "Make another Test Call" : "Play the Sample Call again"}
   ```
7. Replace the line `<p className="mt-1 text-sm text-print-muted">Only the words are kept, for 7 days. Never your voice.</p>` with `<p className="mt-1 text-sm text-print-muted">Only the words are kept, never your voice. Our copy is deleted after 7 days.</p>`.
8. Replace
   ```tsx
   /** The yellow copy under the white sheet. It stays with the Owner: the Call Notes. */
   function OwnersCopy({ notes, againLabel, onAgain }: { notes: CallNotes; againLabel: string; onAgain: () => void }) {
   ```
   with
   ```tsx
   /**
    * `sample`: the Sample Call's notes, whole at once. A Test Call's notes start
    * as `waiting` (the browser's own copy, the summary still being written),
    * become `saved` when the server's copy arrives, or `late` if it never does.
    */
   type NotesState = "sample" | "waiting" | "late" | "saved";

   /** The yellow copy under the white sheet. It stays with the Owner: the Call Notes. */
   function OwnersCopy({ notes, state, againLabel, onAgain }: { notes: CallNotes; state: NotesState; againLabel: string; onAgain: () => void }) {
   ```
9. Replace
   ```tsx
               <p className="mt-2 max-w-[44ch] text-[1.375rem] leading-snug font-medium text-balance">{notes.summary}</p>
               <p className="mt-3 text-print-soft">
                 {END_REASONS[notes.endReason]} after {formatTime(notes.durationMs)}.
               </p>
   ```
   with
   ```tsx
               <p className="mt-2 max-w-[44ch] text-[1.375rem] leading-snug font-medium text-balance">
                 {state === "waiting"
                   ? "Finishing the summary…"
                   : state === "late"
                     ? "The summary did not arrive. The details below are from the call."
                     : notes.summary}
               </p>
               <p className="mt-3 text-print-soft">
                 {END_REASONS[notes.endReason]} after {formatTime(notes.durationMs)}.
               </p>
               {state === "saved" && <p className="mt-1 text-print-soft">Saved. Our copy is deleted after 7 days.</p>}
   ```

- [ ] **Step 6: Update `DESIGN.md`.** Read its Call Notes (Owner's copy) section. Next to the Body Lead summary description, add this paragraph:

  > **Summary, still being finished.** When a Test Call ends, the Owner's copy opens at once with the details and the transcript from the call. The Summary slot says "Finishing the summary…" in the same Body Lead type: no spinner, no new motion. The real summary replaces it by itself. If it has not come after 60 seconds, the slot says "The summary did not arrive. The details below are from the call." Once the server's copy is saved, a line in Print Soft under the end reason says "Saved. Our copy is deleted after 7 days." The Sample Call shows its notes whole, with no such line.

- [ ] **Step 7: Check it.** `npm run typecheck` → no errors. `npx vitest run lib/__tests__/saved-notes.test.ts` → pass. Then start the dev server with `preview_start` (`name: "dev"`), open `/`, press "Try the demo", play the Sample Call to the end, and confirm in the browser pane: the Call Notes open at once, the summary shows (no "Finishing…"), no "Saved." line, "Play the Sample Call again" works, and nothing scrolls sideways at 375 px wide. The Test Call path is checked on the Preview in Task 10.

- [ ] **Step 8: Commit**

```bash
git add lib/saved-notes.ts lib/__tests__/saved-notes.test.ts app/demo/call-screen.tsx DESIGN.md && git commit -m "Call Notes open at once, then fill in from the saved copy" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Docs, env, and Vapi's own retention

**Files:**
- Modify: `.env.example`, `README.md`, `docs/adr/0004-no-audio-kept.md`

- [ ] **Step 1: `.env.example`.** Append:

```
# A long random string you make up. Vapi sends it back on every webhook call.
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Set the same value in .env.local and in Vercel (Preview and Production).
VAPI_WEBHOOK_SECRET=
```

- [ ] **Step 2: `README.md`.**
  - Status table: `Shipped` gets ` · [#5 Step 4: Call Notes saved](https://github.com/tekguyz/ai-voice-receptionist/issues/5)` at the end of the list; `Next` becomes `[#6 Step 5: Dashboard](https://github.com/tekguyz/ai-voice-receptionist/issues/6)`; `Updated` becomes `2026-10-06`.
  - "What it does" (built so far): add the bullet `- After a Test Call, the Call Notes are saved for the Visitor and the screen fills in from the saved copy. Each entry is deleted after 7 days. The Vapi webhook (`app/api/vapi/webhook`) refuses any request without Vapi's secret.`
  - "What it never does": change the voice line to `Never keeps a Visitor's voice. Only words. This app deletes its copy after 7 days; Vapi keeps its own call logs under its own retention ([ADR 0004](docs/adr/0004-no-audio-kept.md)).`
  - "Run it locally": under the `.env.local` sentence add `Vapi can reach only a public address, so Call Notes are saved only on a deployed Preview or Production, not on localhost. Set VAPI_WEBHOOK_SECRET in .env.local and in Vercel.`

- [ ] **Step 3: Vapi's retention.** In the Vapi dashboard (the browser pane; ask the founder to sign in if it asks), find where Vapi shows how long it keeps call logs and transcripts (organization settings, or a call's detail page). Write down exactly what it says. If you cannot find it, say so; do not guess.

- [ ] **Step 4: `docs/adr/0004-no-audio-kept.md`.** Append:

```markdown

## Note, 2026-10-06: the 7 days is this app's copy

This app deletes its own copy of a call (the Call Notes and transcript) after 7 days. Vapi keeps its own call logs, with the transcript, under its own retention: <what the dashboard showed, or "not found in the dashboard">. So the screen says "Our copy is deleted after 7 days." and never promises that the words exist nowhere else. Audio is still never kept.
```

Replace the `<...>` with the real finding from Step 3.

- [ ] **Step 5: Commit**

```bash
git add .env.example README.md docs/adr/0004-no-audio-kept.md && git commit -m "Docs: Call Notes saved, the webhook secret, and what 7 days means" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Prove it on a Vercel Preview (founder in the loop)

Nothing here is a unit test. It proves what Vapi really sends. The report's shape and the per-call webhook address are the two things the docs did not settle.

- [ ] **Step 1: Make the secret, without printing it.** Run `node -e "require('fs').appendFileSync('.env.local', '\nVAPI_WEBHOOK_SECRET=' + require('crypto').randomBytes(32).toString('hex') + '\n')"`. Check: `node --env-file=.env.local -e "console.log(process.env.VAPI_WEBHOOK_SECRET.length)"` prints `64`. (`.env.local` is gitignored: confirm with `git check-ignore .env.local`.)

- [ ] **Step 2: Put it in Vercel, after the founder says yes.** Ask the founder in one line: "OK to add VAPI_WEBHOOK_SECRET to Vercel for Preview and Production?" Run `vercel env ls` first (it shows names only) to confirm the project is linked. Run `vercel env add --help` and use its documented non-interactive form, feeding the value from `.env.local` through stdin or a file. Never put the value on the command line, and never print it. Add it for Preview (all branches) and Production. Check with `vercel env ls`: the name is listed for both.

- [ ] **Step 3: Push the branch, one line first.** Tell the founder: "Pushing branch voice-demo-batch-4 makes a Vercel Preview, not production." Then `git push -u origin voice-demo-batch-4`. Wait for the Preview to be ready (`gh pr checks` after the PR exists, or the Vercel dashboard).

- [ ] **Step 4: Sync Luna, after the founder says yes.** Ask: "Syncing Luna changes the one Luna that production also uses. Until this branch is merged, production calls book without the webhook. OK?" Then `npm run vapi:sync -- --dry-run` (check `Checks: all good.`), then `npm run vapi:sync` → `Updated "Luna · Mangrove Air". All checks pass.`

- [ ] **Step 5: The founder makes one Test Call on the Preview** (English, books a time). Check each:
  - [ ] The live tags still fill in as Luna hears each detail (the browser still gets tool calls). The Booked tag shows.
  - [ ] The Call Notes open at once. The summary line says "Finishing the summary…", then fills in by itself within a few seconds. "Saved. Our copy is deleted after 7 days." appears.
  - [ ] Vapi dashboard, this call's logs: the webhook calls (the tool calls and the end-of-call report) show a 200 answer.
  - [ ] Redis expiry: write `ttl-check.mjs` in the repo root (never commit it; delete it after):
    ```js
    import { Redis } from "@upstash/redis";
    const redis = Redis.fromEnv();
    for await (const key of redis.scanIterator({ match: "avr:dev:notes*", count: 100 })) console.log(key.replace(/:[0-9a-f-]{36}:/, ":<visitor>:"), await redis.ttl(key));
    ```
    Run `node --env-file=.env.local ttl-check.mjs`. Every TTL printed is at most 604800 and above 600000. Then delete the file.

- [ ] **Step 6: If something fails, find out which of these it is, and change only that:**
  - *Live tags stopped.* The browser does not get tool calls once Vapi sends them to the server. Stop and tell the founder; do not guess a fix.
  - *The webhook got no calls (Vapi logs show none).* Vapi ignored the per-call webhook address. Use the fallback below.
  - *The webhook got calls but Vercel answered 401 or 403 (Vercel's own page).* The Preview is behind Vercel Deployment Protection. Tell the founder: either turn protection off for Previews, or give Vapi Vercel's protection-bypass header. Do not change Vercel settings yourself.
  - *The webhook got the report and answered 200 `ignored`.* The report's shape differs from the fixture (`call.assistantOverrides.metadata.visitorId` or `.variableValues` is somewhere else). Copy the real report from the Vapi log into `lib/__tests__/vapi-report-fixture.ts` (strip nothing but secrets), make Task 5's tests fail on it first, then fix only `lib/call-notes-from-report.ts`.
  - *Bookings are always refused.* Same cause: the tool-call message's `call` has no `assistantOverrides.variableValues`. Same fix in `offeredTimesOf`.

  **Fallback (only if Vapi ignored the per-call address).** Put the address on Luna instead, so only Production saves notes. In `vapi/luna.ts` change `export function lunaAssistant()` to `export function lunaAssistant(webhook?: { url: string; secret: string })` and add to the returned object `...(webhook ? { server: { url: webhook.url, headers: { "X-Vapi-Secret": webhook.secret } } } : {}),`. In `scripts/vapi-sync.ts` build it from env: `const webhook = process.env.VAPI_WEBHOOK_URL && process.env.VAPI_WEBHOOK_SECRET ? { url: process.env.VAPI_WEBHOOK_URL, secret: process.env.VAPI_WEBHOOK_SECRET } : undefined;` and call `lunaAssistant(webhook)`. In `checkLuna`, the no-saved-server-URL rule becomes: the saved URL must equal `VAPI_WEBHOOK_URL` when that is set. Update the tests and `.env.example` (`VAPI_WEBHOOK_URL`: the Production address plus `/api/vapi/webhook`), then tell the founder that Preview calls save no notes.

- [ ] **Step 7: Report to the founder** what each check showed. Commit any fix with its test first.

---

### Task 12: Finish

- [ ] **Step 1: Verify.** `npm run test:unit` once → all pass. `npm run typecheck` → no errors. (CI and the Preview build run the production build.)
- [ ] **Step 2: Open the PR** against `main`. Title: `Voice demo rebuild: Call Notes saved (#5)`. The body starts with `Closes #5`, lists what changed in plain words, notes the one-line Luna sync that already happened, and ends with the attribution line. After it opens, use the ccd_pr tools: `get_status`, then `bind_pr` if it is not bound, then read CI. Tell the founder the issue number (#5) and the PR number.
- [ ] **Step 3: Say plainly** that merging to `main` makes production live (Vercel), and that `VAPI_WEBHOOK_SECRET` is already set for Production (Task 11, Step 2). Update issue #15's carried-over line "the screen promises 7 days" with a comment: settled in #5, the screen now says "Our copy is deleted after 7 days."
- [ ] **Step 4: Leave nothing uncommitted** without saying so.

---

## Self-review

**Spec coverage (issue #5):**
- Webhook tests, seam 3: wrong or missing secret refused, nothing stored (Task 6); valid report stored under the right Visitor only (Task 6); same report twice stores one entry (Tasks 4, 6); a booking for a time not offered is refused (Task 6). ✓
- Every stored entry has a 7-day expiry (Task 4; live TTL check in Task 11). ✓
- Call Notes screen follows `DESIGN.md`, including "still being finished" (Task 9). ✓
- No text or email is ever sent: nothing in this plan sends one; the screen keeps "Not available in the demo. Nothing is sent." ✓
- Founder makes a Test Call on the Preview and sees its Call Notes (Task 11). ✓
- Screen content: summary, details, booked time, transcript, confirmation text preview, calendar line, "another Test Call" already exist in `OwnersCopy` and are kept. ✓
- Decision A (7-day wording): Tasks 9 and 10. ✓

**One refinement of the approved design:** while notes are being finished, the screen shows the browser's own copy (details, transcript) with only the summary pending, instead of an empty page. After 60 seconds the summary line says it did not arrive, and "Make another Test Call" is always there.

**Type consistency:** `matchOfferedTime` (T1) is used in T2 and T6. `eventFromToolCall(name, rawArgs, atMs, offered)` is the same in T2, T3 and T5. `endReasonFrom(endedReason, sawError?)` is the same in T2, T3 and T5. `CallNotesStore.save/get/list` and `SavedCallNotes` are the same in T4, T6 and T7. `StartResult.openTimes` and `CallHandlers.onCallId` are the same in T3 and T9. `NotesState` values (`sample`, `waiting`, `late`, `saved`) match between the screen and `OwnersCopy`.
