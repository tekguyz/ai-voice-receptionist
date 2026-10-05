# Live Test Call Implementation Plan (#4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Visitor presses "Call now", talks to Luna through the browser microphone, and watches the words and tags fill in; every refusal or failure leads to the Sample Call.

**Architecture:** Luna's Vapi settings live in `vapi/luna.ts` and reach Vapi through `npm run vapi:sync`. "Call now" posts to `/api/test-call`; the server runs the Call Gate (Redis counters, fail closed), then creates one Vapi web call with the private key and returns only the room link. The browser joins that room with the Vapi web SDK's `reconnect()`, so it never holds a key that can start calls or change Luna. Both tools are client-side and async (no server URL in #4): the browser turns their calls into Call Story events. The webhook arrives in #5.

**Tech Stack:** Next.js 16 App Router, TypeScript 7, Tailwind 4, Vitest 5, `@vapi-ai/web` 2.x, `@upstash/redis` 1.x, Node 24 (runs `.ts` scripts directly).

**Spec:** tekguyz/ai-voice-receptionist#1 (spec), #4 (this ticket, with the review notes from PR #11 and PR #12 and the founder's decisions in its comments). Read `CONTEXT.md`, `PRODUCT.md`, `DESIGN.md` first.

## Global Constraints

- Words follow `CONTEXT.md`: Visitor, Sample Business, Receptionist, Test Call, Sample Call, Call Notes, Owner, Dashboard. Never "Sarah" or "Viora". Names come from `lib/sample-business.ts` ("Mangrove Air", "Luna").
- Limits (founder, 2026-10-04): **1 Test Call per Visitor a day**, **2 per IP address a day**, **5 per site a day**, **30 per site a month**. Days and months are in `America/New_York`. At any limit the Sample Call is offered.
- A Test Call is **180 seconds** at most, set on Luna in Vapi, never from the browser.
- **Recording off** in Vapi (ADR 0004). No audio is ever kept.
- Redis is shared with the TEKGUYZ website. This app reads and writes **only keys that start with `avr:`** (`avr:dev:` in development). Never `KEYS`, `SCAN`, `FLUSHDB` or a delete of any other key.
- The Call Gate **fails closed**: if Redis is down, no Test Call starts (the Sample Call is offered).
- The browser never receives the private key, the assistant settings or Vapi's `monitor.controlUrl`. `/api/test-call` returns exactly `{ webCallUrl, callId }`.
- Secrets live only in `.env.local` (gitignored). Never print a key. `.env.example` holds names only.
- Tests: while working, `npx vitest run <file>`. Before each commit, `npm run test:unit`. **Never `npm test`.** Also `npm run typecheck` before each commit.
- Look follows `DESIGN.md`: three inks (Form Red, Carbon Blue, black print), square corners, two motions only. No purple.
- Work on branch `voice-demo-batch-3` in `C:/Projects/ai-voice-receptionist`. No worktrees.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Map

| File | Job |
|---|---|
| `vapi/luna.ts` | Luna's Vapi settings, system prompt, tool names, and `checkLuna()` |
| `vapi/__tests__/luna.test.ts` | Luna's settings keep the safety rules |
| `scripts/vapi-sync.ts` | Creates or updates Luna in Vapi, then checks what Vapi saved |
| `lib/calendar-day.ts` | Today's date, day key and month key in `America/New_York` |
| `lib/open-times.ts` | The two made-up open times Luna offers |
| `lib/call-gate.ts` | The Call Gate: limits, keys, refusal reasons, `CounterStore` interface |
| `lib/redis-counter-store.ts` | `CounterStore` on Upstash Redis |
| `lib/visitor.ts` | Visitor cookie name, new IDs, ID check, cookie reading |
| `app/api/visit/route.ts` | "Try the demo": sets the Visitor cookie, sends to `/demo` |
| `lib/vapi-web-call.ts` | Server: creates one Vapi web call |
| `lib/start-test-call.ts` | Server: the Start Test Call handler, deps injected |
| `app/api/test-call/route.ts` | Wires the handler to real deps |
| `lib/scheduler.ts` | `Scheduler` moved out of `call-source.ts` |
| `lib/call-source.ts` | The call source contract (start failures, stop) |
| `lib/call-story.ts` | First `ended` wins; arrival order; readonly; `DETAIL_FIELDS` |
| `lib/vapi-source.ts` | Browser: Vapi web SDK messages to Call Story events |
| `lib/vapi-browser.ts` | Browser deps for the Vapi source (mic, fetch, SDK) |
| `app/demo/call-screen.tsx` | The Test Call screen; falls back to the Sample Call |
| `app/_ui/ticket.tsx` | Adds `EndCallButton`, `PhoneIcon` |

---

### Task 1: Luna in the repo, and `npm run vapi:sync`

**Files:**
- Create: `vapi/luna.ts`, `vapi/__tests__/luna.test.ts`, `scripts/vapi-sync.ts`, `.env.example`
- Modify: `package.json` (script), `tsconfig.json` (`allowImportingTsExtensions`)

**Interfaces:**
- Produces: `LUNA_NAME: string`, `MAX_CALL_SECONDS = 180`, `TOOL = { recordDetail: "recordDetail", bookTime: "bookTime" }`, `lunaAssistant(): Record<string, unknown>`, `checkLuna(saved: unknown): string[]` (empty array = all good). The system prompt uses Vapi variables `{{openTime1}}` and `{{openTime2}}`; Task 5 fills them per call.

- [ ] **Step 1: Let Node run the repo's `.ts` files.** Node 24 strips types but needs `.ts` on relative imports. In `tsconfig.json` `compilerOptions`, add `"allowImportingTsExtensions": true` (allowed because `noEmit` is true). Run `npm run typecheck`. Expected: pass.

- [ ] **Step 2: Write the failing test** `vapi/__tests__/luna.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LUNA_NAME, MAX_CALL_SECONDS, TOOL, checkLuna, lunaAssistant } from "@/vapi/luna";
import { SAMPLE_BUSINESS } from "@/lib/sample-business";

describe("Luna's Vapi settings", () => {
  it("pass every safety check as written in the repo", () => {
    expect(checkLuna(lunaAssistant())).toEqual([]);
  });

  it("answer as the Sample Business and offer only the two open times", () => {
    const luna = lunaAssistant() as any;
    expect(LUNA_NAME).toContain(SAMPLE_BUSINESS.receptionistName);
    expect(luna.firstMessage).toContain(SAMPLE_BUSINESS.name);
    const prompt: string = luna.model.messages[0].content;
    expect(prompt).toContain("{{openTime1}}");
    expect(prompt).toContain("{{openTime2}}");
    expect(prompt).toMatch(/Spanish/);
    expect(prompt).not.toMatch(/Sarah|Viora/);
  });

  it("flag recording, a longer call, a server URL or a missing tool", () => {
    const luna = lunaAssistant() as any;
    expect(checkLuna({ ...luna, artifactPlan: { recordingEnabled: true } })).toContain("Recording must be off.");
    expect(checkLuna({ ...luna, maxDurationSeconds: 600 })).toContain(`Calls must stop at ${MAX_CALL_SECONDS} seconds.`);
    expect(checkLuna({ ...luna, server: { url: "https://example.com" } })).toContain("Luna must have no server URL until #5.");
    const noBooking = { ...luna, model: { ...luna.model, tools: luna.model.tools.filter((t: any) => t.function?.name !== TOOL.bookTime) } };
    expect(checkLuna(noBooking)).toContain(`Tool ${TOOL.bookTime} is missing or not async.`);
  });
});
```

- [ ] **Step 3: Run it.** `npx vitest run vapi/__tests__/luna.test.ts`. Expected: FAIL, cannot find `@/vapi/luna`.

- [ ] **Step 4: Write `vapi/luna.ts`.**

```ts
// Luna, the Receptionist, as Vapi settings. This file is the source of truth:
// `npm run vapi:sync` sends it to Vapi. Never edit Luna in the Vapi dashboard;
// the next sync overwrites it.
//
// Both tools are client-side and async (no server URL): the browser sees each
// tool call and turns it into a Call Story event. The webhook comes in #5.

import { SAMPLE_BUSINESS } from "../lib/sample-business.ts";

const { name: business, receptionistName: luna, trade, area } = SAMPLE_BUSINESS;

export const LUNA_NAME = `${luna} · ${business}`;
export const MAX_CALL_SECONDS = 180;
export const TOOL = { recordDetail: "recordDetail", bookTime: "bookTime" } as const;

// ElevenLabs premade voice "Jessica". The founder picks the final voice by ear.
const VOICE_ID = "cgSgspJ2msm6clMCkdW9";

export const SYSTEM_PROMPT = `You are ${luna}, the receptionist who answers the phone for ${business}, an ${trade} company in ${area}. This is a demo: the caller is trying you out and was told to make up their details. Treat it like a real service call.

On every call:
1. Find out what is wrong (the job).
2. Find out how urgent it is.
3. Get the caller's name.
4. Get the service address.
5. Offer exactly these two open times: {{openTime1}}, or {{openTime2}}. Book the one the caller picks.
6. Confirm the booking in one sentence, say goodbye, and end the call.

Tools:
- As soon as you learn the name, the job, the urgency or the address, call ${TOOL.recordDetail} with that one field. If the caller corrects a detail, call it again with the new value. Write values short, the way they would go on a work order. Write the job and the urgency in English; write names and addresses as the caller said them.
- When the caller picks a time, call ${TOOL.bookTime} with that time exactly as written above. Never offer or book any other time. If neither time works, say a dispatcher will call back to find a time, and do not book.
- After you say goodbye, call endCall.

How you talk:
- Warm, calm and quick, like a good front desk. One question at a time. Never more than two short sentences in a row.
- If the caller speaks Spanish, answer in Spanish and stay in Spanish for the rest of the call.
- Never give prices. Say the technician gives a quote on site.
- If the caller asks something off topic, answer in one short sentence and steer back to their service call.
- The call stops after 3 minutes. Keep it moving; aim to finish within 2 minutes.
- Say times the way people say them ("tomorrow at nine in the morning"). Never read out symbols or formatting.
- If asked whether you are an AI, say yes: you are ${business}'s AI receptionist.`;

export function lunaAssistant() {
  return {
    name: LUNA_NAME,
    firstMessage: `Thanks for calling ${business}, this is ${luna}. How can I help you today?`,
    firstMessageMode: "assistant-speaks-first",
    endCallMessage: "Thanks for calling. Goodbye!",
    maxDurationSeconds: MAX_CALL_SECONDS,
    silenceTimeoutSeconds: 30,
    model: {
      provider: "google",
      model: "gemini-3.5-flash",
      temperature: 0.3,
      messages: [{ role: "system", content: SYSTEM_PROMPT }],
      tools: [
        {
          type: "function",
          async: true,
          function: {
            name: TOOL.recordDetail,
            description: "Write down one detail the caller gave. Call it as soon as you learn it, and again if the caller corrects it.",
            parameters: {
              type: "object",
              properties: {
                field: { type: "string", enum: ["name", "job", "urgency", "address"], description: "Which detail this is." },
                value: { type: "string", description: "The detail, short, as it would go on a work order." },
              },
              required: ["field", "value"],
            },
          },
        },
        {
          type: "function",
          async: true,
          function: {
            name: TOOL.bookTime,
            description: "Book the open time the caller picked. Use one of the two open times you offered, exactly as written in your instructions.",
            parameters: {
              type: "object",
              properties: { time: { type: "string", description: "The open time the caller picked, exactly as offered." } },
              required: ["time"],
            },
          },
        },
        { type: "endCall" },
      ],
    },
    voice: { provider: "11labs", model: "eleven_flash_v2_5", voiceId: VOICE_ID },
    transcriber: { provider: "deepgram", model: "flux-general-multi", languages: ["en", "es"] },
    artifactPlan: { recordingEnabled: false, videoRecordingEnabled: false },
    clientMessages: ["transcript", "tool-calls", "status-update"],
    serverMessages: [],
  };
}

/** What is wrong with a saved Luna, in plain words. An empty list means all good. */
export function checkLuna(saved: unknown): string[] {
  const luna = (saved ?? {}) as any;
  const problems: string[] = [];
  if (luna.artifactPlan?.recordingEnabled !== false) problems.push("Recording must be off.");
  if (luna.artifactPlan?.videoRecordingEnabled === true) problems.push("Video recording must be off.");
  if (luna.maxDurationSeconds !== MAX_CALL_SECONDS) problems.push(`Calls must stop at ${MAX_CALL_SECONDS} seconds.`);
  if (luna.server?.url) problems.push("Luna must have no server URL until #5.");
  const tools: any[] = luna.model?.tools ?? [];
  for (const name of Object.values(TOOL)) {
    const tool = tools.find((t) => t.function?.name === name);
    if (!tool || tool.async !== true || tool.server?.url) problems.push(`Tool ${name} is missing or not async.`);
  }
  if (!tools.some((t) => t.type === "endCall")) problems.push("Luna must be able to end the call.");
  const prompt: string = luna.model?.messages?.[0]?.content ?? "";
  if (!prompt.includes("{{openTime1}}") || !prompt.includes("{{openTime2}}")) problems.push("The prompt must offer {{openTime1}} and {{openTime2}}.");
  const messages: string[] = luna.clientMessages ?? [];
  for (const kind of ["transcript", "tool-calls", "status-update"]) {
    if (!messages.includes(kind)) problems.push(`The browser must get "${kind}" messages.`);
  }
  return problems;
}
```

- [ ] **Step 5: Run the test.** `npx vitest run vapi/__tests__/luna.test.ts`. Expected: PASS (3 tests).

- [ ] **Step 6: Write `scripts/vapi-sync.ts`.**

```ts
// Sends Luna (vapi/luna.ts) to Vapi: creates her the first time, updates her
// after, then reads back what Vapi saved and checks it.
//
//   npm run vapi:sync -- --dry-run   prints what would be sent; sends nothing
//   npm run vapi:sync                creates or updates Luna
//
// Reads VAPI_PRIVATE_KEY from .env.local. Never prints it.

import { LUNA_NAME, checkLuna, lunaAssistant } from "../vapi/luna.ts";

const API = "https://api.vapi.ai";
const body = lunaAssistant();

if (process.argv.includes("--dry-run")) {
  console.log(JSON.stringify(body, null, 2));
  console.log(`\nDry run: nothing sent. Checks: ${checkLuna(body).join(" ") || "all good."}`);
  process.exit(0);
}

const key = process.env.VAPI_PRIVATE_KEY;
if (!key) {
  console.error("VAPI_PRIVATE_KEY is missing. Add it to .env.local.");
  process.exit(1);
}

async function vapi(path: string, init: { method?: string; body?: unknown } = {}) {
  const response = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Vapi ${init.method ?? "GET"} ${path} answered ${response.status}: ${text}`);
  return JSON.parse(text);
}

const named = ((await vapi("/assistant?limit=100")) as { id: string; name?: string }[]).filter((a) => a.name === LUNA_NAME);
if (named.length > 1) {
  console.error(`${named.length} assistants are named "${LUNA_NAME}". Delete the extras in the Vapi dashboard, then run again.`);
  process.exit(1);
}

const saved = named[0]
  ? await vapi(`/assistant/${named[0].id}`, { method: "PATCH", body })
  : await vapi("/assistant", { method: "POST", body });

const problems = checkLuna(saved);
if (problems.length > 0) {
  console.error(`Vapi saved Luna, but she fails these checks:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`${named[0] ? "Updated" : "Created"} "${LUNA_NAME}". All checks pass.`);
console.log(`VAPI_ASSISTANT_ID=${saved.id}`);
```

- [ ] **Step 7: Add the script** to `package.json` `scripts`: `"vapi:sync": "node --env-file-if-exists=.env.local scripts/vapi-sync.ts"`.

- [ ] **Step 8: Dry run.** `npm run vapi:sync -- --dry-run`. Expected: Luna's JSON, then "Dry run: nothing sent. Checks: all good."

- [ ] **Step 9: Write `.env.example`** (names only, never values):

```
# Copy to .env.local and fill in. Git ignores .env.local.

# Vapi dashboard > API keys > Private API keys. Server only.
VAPI_PRIVATE_KEY=
# Printed by `npm run vapi:sync`.
VAPI_ASSISTANT_ID=

# Upstash console > the Redis database > REST API.
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

- [ ] **Step 10:** `npm run test:unit` and `npm run typecheck`. Expected: pass. Commit `vapi/ scripts/ package.json tsconfig.json .env.example` with message "Keep Luna's Vapi settings in the repo, with a sync script".

The controller (not the sub-agent) runs the real sync after this task: it needs the founder's key. If Vapi rejects a field (for example the transcriber's `languages`), read Vapi's error, check the Vapi docs (context7 `/websites/vapi_ai`), fix `vapi/luna.ts`, and note the change in the PR.

---

### Task 2: Calendar day and the two open times

**Files:**
- Create: `lib/calendar-day.ts`, `lib/open-times.ts`, `lib/__tests__/open-times.test.ts`

**Interfaces:**
- Produces: `TIME_ZONE = "America/New_York"`; `localDate(now: Date): { year: number; month: number; day: number }`; `dayKey(now: Date): string` (`"2026-10-04"`); `monthKey(now: Date): string` (`"2026-10"`); `openTimes(now: Date): [string, string]`.

- [ ] **Step 1: Write the failing test** `lib/__tests__/open-times.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { dayKey, monthKey } from "@/lib/calendar-day";
import { openTimes } from "@/lib/open-times";

// Times are written in UTC; South Florida is UTC-4 in October.
describe("the open times Luna offers", () => {
  it("are 9 AM and 2 PM the next day", () => {
    expect(openTimes(new Date("2026-10-06T15:00:00Z"))).toEqual([
      "Wednesday, October 7 at 9 AM",
      "Wednesday, October 7 at 2 PM",
    ]);
  });

  it("skip Sunday", () => {
    // Saturday afternoon in Miami.
    expect(openTimes(new Date("2026-10-10T18:00:00Z"))[0]).toBe("Monday, October 12 at 9 AM");
  });

  it("go by the date in Miami, not in UTC", () => {
    // Monday 11:30 PM in Miami is already Tuesday in UTC.
    expect(openTimes(new Date("2026-10-06T03:30:00Z"))[0]).toBe("Tuesday, October 6 at 9 AM");
  });

  it("roll over the end of the month", () => {
    expect(openTimes(new Date("2026-10-31T14:00:00Z"))[0]).toBe("Monday, November 2 at 9 AM");
  });
});

describe("the calendar day", () => {
  it("names the day and month in Miami", () => {
    const lateMondayInMiami = new Date("2026-10-06T03:30:00Z");
    expect(dayKey(lateMondayInMiami)).toBe("2026-10-05");
    expect(monthKey(new Date("2026-11-01T02:00:00Z"))).toBe("2026-10");
  });
});
```

- [ ] **Step 2: Run it.** `npx vitest run lib/__tests__/open-times.test.ts`. Expected: FAIL, modules not found.

- [ ] **Step 3: Write `lib/calendar-day.ts`.**

```ts
// Days and months as the Sample Business sees them: South Florida time.
// Call limits reset at midnight here, and open times are dates here.

export const TIME_ZONE = "America/New_York";

const parts = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, year: "numeric", month: "numeric", day: "numeric" });

export function localDate(now: Date): { year: number; month: number; day: number } {
  const get = (type: string) => Number(parts.formatToParts(now).find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function dayKey(now: Date): string {
  const { year, month, day } = localDate(now);
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function monthKey(now: Date): string {
  const { year, month } = localDate(now);
  return `${year}-${pad(month)}`;
}
```

- [ ] **Step 4: Write `lib/open-times.ts`.**

```ts
// The Sample Business's made-up calendar: Luna offers 9 AM and 2 PM on the
// next day that is not Sunday. Nothing is ever booked in a real calendar.

import { localDate } from "@/lib/calendar-day";

const label = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" });

export function openTimes(now: Date): [string, string] {
  const { year, month, day } = localDate(now);
  // Date-only arithmetic in UTC, so no clock change can shift the day.
  let next = new Date(Date.UTC(year, month - 1, day + 1));
  if (next.getUTCDay() === 0) next = new Date(Date.UTC(year, month - 1, day + 2));
  const date = label.format(next);
  return [`${date} at 9 AM`, `${date} at 2 PM`];
}
```

- [ ] **Step 5: Run the test.** Expected: PASS (5 tests). Then `npm run test:unit`, `npm run typecheck`, commit "Add the calendar day and the two open times".

---

### Task 3: The Call Gate

**Files:**
- Create: `lib/call-gate.ts`, `lib/redis-counter-store.ts`, `lib/__tests__/call-gate.test.ts`
- Modify: `package.json` (add `@upstash/redis`)

**Interfaces:**
- Consumes: `dayKey`, `monthKey` from Task 2.
- Produces:

```ts
export type GateLimits = { perVisitorPerDay: number; perIpPerDay: number; sitePerDay: number; sitePerMonth: number };
export const LIMITS: GateLimits;      // 1, 2, 5, 30
export const DEV_LIMITS: GateLimits;  // 10, 10, 10, 60 (dev keys are separate: prefix "avr:dev:")
export type GateRefusal = "visitor-limit" | "ip-limit" | "site-day-limit" | "site-month-limit" | "unavailable";
export type GateAnswer = { allowed: true; release(): Promise<void> } | { allowed: false; reason: GateRefusal };
export type CounterStore = {
  increment(counters: readonly { key: string; ttlSeconds: number }[]): Promise<number[]>;
  decrement(keys: readonly string[]): Promise<void>;
};
export type CallGate = { check(input: { visitorId: string; ipKey: string; now: Date }): Promise<GateAnswer> };
export function createCallGate(options: { store: CounterStore; limits: GateLimits; prefix: string }): CallGate;
export function redisCounterStore(): CounterStore; // in lib/redis-counter-store.ts
```

- [ ] **Step 1:** `npm install @upstash/redis@^1.39.0`.

- [ ] **Step 2: Write the failing test** `lib/__tests__/call-gate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LIMITS, createCallGate, type CounterStore } from "@/lib/call-gate";

// An in-memory CounterStore. Expiry is recorded, not enforced: the gate's
// day and month keys change by name, so the tests never need it.
function fakeStore({ failing = false } = {}) {
  const counts = new Map<string, number>();
  const ttls = new Map<string, number>();
  const store: CounterStore = {
    async increment(counters) {
      if (failing) throw new Error("Redis is down");
      return counters.map(({ key, ttlSeconds }) => {
        counts.set(key, (counts.get(key) ?? 0) + 1);
        ttls.set(key, ttlSeconds);
        return counts.get(key)!;
      });
    },
    async decrement(keys) {
      for (const key of keys) counts.set(key, (counts.get(key) ?? 0) - 1);
    },
  };
  return { store, counts, ttls };
}

// Noon in Miami on Monday 2026-10-05.
const NOON = new Date("2026-10-05T16:00:00Z");
const NEXT_DAY = new Date("2026-10-06T16:00:00Z");

function gateWith(store: CounterStore) {
  return createCallGate({ store, limits: LIMITS, prefix: "avr:" });
}

describe("the Call Gate", () => {
  it("allows a Visitor's first Test Call of the day and refuses the second", async () => {
    const gate = gateWith(fakeStore().store);
    expect((await gate.check({ visitorId: "v1", ipKey: "ip1", now: NOON })).allowed).toBe(true);
    expect(await gate.check({ visitorId: "v1", ipKey: "ip1", now: NOON })).toEqual({ allowed: false, reason: "visitor-limit" });
  });

  it("refuses a third Test Call from one IP address in a day, even from a new Visitor", async () => {
    const gate = gateWith(fakeStore().store);
    await gate.check({ visitorId: "v1", ipKey: "ip1", now: NOON });
    await gate.check({ visitorId: "v2", ipKey: "ip1", now: NOON });
    expect(await gate.check({ visitorId: "v3", ipKey: "ip1", now: NOON })).toEqual({ allowed: false, reason: "ip-limit" });
  });

  it("refuses the 6th Test Call on the site in a day", async () => {
    const gate = gateWith(fakeStore().store);
    for (let i = 1; i <= 5; i++) {
      expect((await gate.check({ visitorId: `v${i}`, ipKey: `ip${i}`, now: NOON })).allowed).toBe(true);
    }
    expect(await gate.check({ visitorId: "v6", ipKey: "ip6", now: NOON })).toEqual({ allowed: false, reason: "site-day-limit" });
  });

  it("refuses the 31st Test Call on the site in a month", async () => {
    const gate = gateWith(fakeStore().store);
    let n = 0;
    for (let day = 1; day <= 6; day++) {
      const now = new Date(Date.UTC(2026, 9, day, 16));
      for (let i = 0; i < 5; i++, n++) {
        expect((await gate.check({ visitorId: `v${n}`, ipKey: `ip${n}`, now })).allowed).toBe(true);
      }
    }
    const day7 = new Date(Date.UTC(2026, 9, 7, 16));
    expect(await gate.check({ visitorId: "late", ipKey: "late", now: day7 })).toEqual({ allowed: false, reason: "site-month-limit" });
  });

  it("gives each Visitor a new Test Call after midnight in Miami", async () => {
    const gate = gateWith(fakeStore().store);
    await gate.check({ visitorId: "v1", ipKey: "ip1", now: NOON });
    expect((await gate.check({ visitorId: "v1", ipKey: "ip1", now: NEXT_DAY })).allowed).toBe(true);
  });

  it("does not let two Visitors share a count", async () => {
    const gate = gateWith(fakeStore().store);
    await gate.check({ visitorId: "v1", ipKey: "ip1", now: NOON });
    expect((await gate.check({ visitorId: "v2", ipKey: "ip2", now: NOON })).allowed).toBe(true);
  });

  it("does not use up a count when it refuses", async () => {
    const { store, counts } = fakeStore();
    const gate = gateWith(store);
    await gate.check({ visitorId: "v1", ipKey: "ip1", now: NOON });
    await gate.check({ visitorId: "v1", ipKey: "ip1", now: NOON });
    expect(counts.get("avr:gate:site:day:2026-10-05")).toBe(1);
  });

  it("gives the count back on release, for a call that never connected", async () => {
    const { store } = fakeStore();
    const gate = gateWith(store);
    const answer = await gate.check({ visitorId: "v1", ipKey: "ip1", now: NOON });
    if (!answer.allowed) throw new Error("expected allowed");
    await answer.release();
    expect((await gate.check({ visitorId: "v1", ipKey: "ip1", now: NOON })).allowed).toBe(true);
  });

  it("refuses when the store is down", async () => {
    const gate = gateWith(fakeStore({ failing: true }).store);
    expect(await gate.check({ visitorId: "v1", ipKey: "ip1", now: NOON })).toEqual({ allowed: false, reason: "unavailable" });
  });

  it("touches only keys under its prefix, and every key expires", async () => {
    const { store, counts, ttls } = fakeStore();
    await gateWith(store).check({ visitorId: "v1", ipKey: "ip1", now: NOON });
    for (const key of counts.keys()) expect(key.startsWith("avr:")).toBe(true);
    for (const ttl of ttls.values()) expect(ttl).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run it.** `npx vitest run lib/__tests__/call-gate.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 4: Write `lib/call-gate.ts`.**

```ts
// The Call Gate: may this Visitor start a Test Call now? Every Test Call costs
// money, so the server asks this before every call, and the answer is "no"
// whenever it cannot be sure (fail closed).
//
// Counters: per Visitor a day, per IP address a day, the whole site a day and
// a month. Each is one Redis counter whose name holds the day or month, so a
// new day starts from zero. The gate adds 1 to all four at once; if any goes
// over its limit, it takes all four back and refuses. INCR is atomic, so two
// calls at once can never both get the last slot.

import { dayKey, monthKey } from "@/lib/calendar-day";

export type GateLimits = { perVisitorPerDay: number; perIpPerDay: number; sitePerDay: number; sitePerMonth: number };

/** Founder, 2026-10-04. Cost comes first. */
export const LIMITS: GateLimits = { perVisitorPerDay: 1, perIpPerDay: 2, sitePerDay: 5, sitePerMonth: 30 };
/** Local development: room to test, on separate counters. The $10 Vapi credit is the wall. */
export const DEV_LIMITS: GateLimits = { perVisitorPerDay: 10, perIpPerDay: 10, sitePerDay: 10, sitePerMonth: 60 };

export type GateRefusal = "visitor-limit" | "ip-limit" | "site-day-limit" | "site-month-limit" | "unavailable";
export type GateAnswer = { allowed: true; release(): Promise<void> } | { allowed: false; reason: GateRefusal };

/** The slice of Redis the gate needs. Tests use an in-memory one. */
export type CounterStore = {
  /** Adds 1 to each key, sets its expiry, and returns the new counts in order. */
  increment(counters: readonly { key: string; ttlSeconds: number }[]): Promise<number[]>;
  decrement(keys: readonly string[]): Promise<void>;
};

export type CallGate = { check(input: { visitorId: string; ipKey: string; now: Date }): Promise<GateAnswer> };

const DAY_TTL = 2 * 24 * 60 * 60;
const MONTH_TTL = 35 * 24 * 60 * 60;

export function createCallGate({ store, limits, prefix }: { store: CounterStore; limits: GateLimits; prefix: string }): CallGate {
  return {
    async check({ visitorId, ipKey, now }) {
      const day = dayKey(now);
      const month = monthKey(now);
      const counters = [
        { key: `${prefix}gate:visitor:${visitorId}:${day}`, ttlSeconds: DAY_TTL, limit: limits.perVisitorPerDay, reason: "visitor-limit" },
        { key: `${prefix}gate:ip:${ipKey}:${day}`, ttlSeconds: DAY_TTL, limit: limits.perIpPerDay, reason: "ip-limit" },
        { key: `${prefix}gate:site:day:${day}`, ttlSeconds: DAY_TTL, limit: limits.sitePerDay, reason: "site-day-limit" },
        { key: `${prefix}gate:site:month:${month}`, ttlSeconds: MONTH_TTL, limit: limits.sitePerMonth, reason: "site-month-limit" },
      ] as const;
      const keys = counters.map((c) => c.key);
      const giveBack = () => store.decrement(keys);

      try {
        const counts = await store.increment(counters);
        const over = counters.find((c, i) => counts[i] > c.limit);
        if (over) {
          await giveBack();
          return { allowed: false, reason: over.reason };
        }
        return { allowed: true, release: giveBack };
      } catch {
        return { allowed: false, reason: "unavailable" };
      }
    },
  };
}
```

- [ ] **Step 5: Run the test.** Expected: PASS (10 tests).

- [ ] **Step 6: Write `lib/redis-counter-store.ts`** (a thin adapter, no unit test; Task 9 checks it against the real Redis):

```ts
import "server-only";
import { Redis } from "@upstash/redis";
import type { CounterStore } from "@/lib/call-gate";

// The Call Gate's counters on Upstash Redis. This Redis is shared with the
// TEKGUYZ website: the gate only ever names keys under its own prefix.
export function redisCounterStore(redis: Redis = Redis.fromEnv({ signal: () => AbortSignal.timeout(3000) })): CounterStore {
  return {
    async increment(counters) {
      const pipeline = redis.pipeline();
      for (const { key, ttlSeconds } of counters) {
        pipeline.incr(key);
        pipeline.expire(key, ttlSeconds);
      }
      const results = await pipeline.exec<number[]>();
      return counters.map((_, i) => results[i * 2]);
    },
    async decrement(keys) {
      const pipeline = redis.pipeline();
      for (const key of keys) pipeline.decr(key);
      await pipeline.exec();
    },
  };
}
```

If `Redis.fromEnv` does not accept `signal` in this version, drop the argument and use `Redis.fromEnv()`. If `server-only` is not installed, `npm install server-only` and add `vi.mock("server-only", () => ({}))` wherever a test imports a file that imports it.

- [ ] **Step 7:** `npm run test:unit`, `npm run typecheck`. Commit "Add the Call Gate with Redis counters".

---

### Task 4: Visitor identity ("Try the demo")

**Files:**
- Create: `lib/visitor.ts`, `app/api/visit/route.ts`, `app/api/visit/__tests__/route.test.ts`
- Modify: `app/page.tsx` (stub button), `app/demo/page.tsx` (send away without a Visitor)

**Interfaces:**
- Produces: `VISITOR_COOKIE = "avr_visitor"`, `newVisitorId(): string`, `isVisitorId(value: unknown): value is string`, `visitorIdFrom(cookieHeader: string | null): string | null`.

- [ ] **Step 1: Write the failing test** `app/api/visit/__tests__/route.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/visit/route";
import { VISITOR_COOKIE, isVisitorId, visitorIdFrom } from "@/lib/visitor";

describe("Try the demo", () => {
  it("gives a new Visitor an ID in an http-only cookie and opens the Test Call screen", async () => {
    const response = await POST(new Request("http://localhost/api/visit", { method: "POST" }));
    expect(response.status).toBe(303);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/demo");
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toMatch(new RegExp(`^${VISITOR_COOKIE}=`));
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    expect(isVisitorId(visitorIdFrom(cookie.split(";")[0]))).toBe(true);
  });

  it("keeps a returning Visitor's ID", async () => {
    const id = "7b0c6d8e-1f2a-4b3c-8d4e-5f6a7b8c9d0e";
    const response = await POST(
      new Request("http://localhost/api/visit", { method: "POST", headers: { cookie: `${VISITOR_COOKIE}=${id}` } }),
    );
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

describe("reading the Visitor cookie", () => {
  it("ignores a missing or made-up value", () => {
    expect(visitorIdFrom(null)).toBeNull();
    expect(visitorIdFrom(`${VISITOR_COOKIE}=not-an-id`)).toBeNull();
    expect(visitorIdFrom("other=1")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it.** `npx vitest run app/api/visit/__tests__/route.test.ts`. Expected: FAIL.

- [ ] **Step 3: Write `lib/visitor.ts`.**

```ts
// A Visitor is known only by a random ID in an http-only cookie. No sign-in
// (ADR 0002). The ID files the Visitor's Test Calls and counts their limit.

export const VISITOR_COOKIE = "avr_visitor";
export const VISITOR_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function newVisitorId(): string {
  return crypto.randomUUID();
}

export function isVisitorId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** The Visitor ID in a Cookie header, or null when there is none or it is not ours. */
export function visitorIdFrom(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === VISITOR_COOKIE) {
      const value = rest.join("=");
      return isVisitorId(value) ? value : null;
    }
  }
  return null;
}
```

- [ ] **Step 4: Write `app/api/visit/route.ts`.**

```ts
import { NextResponse } from "next/server";
import { VISITOR_COOKIE, VISITOR_COOKIE_MAX_AGE, newVisitorId, visitorIdFrom } from "@/lib/visitor";

// "Try the demo" posts here. Only a POST makes a Visitor, so link previews
// and crawlers never do.
export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/demo", request.url), 303);
  if (!visitorIdFrom(request.headers.get("cookie"))) {
    response.cookies.set(VISITOR_COOKIE, newVisitorId(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: VISITOR_COOKIE_MAX_AGE,
    });
  }
  return response;
}
```

- [ ] **Step 5: Run the test.** Expected: PASS (3 tests).

- [ ] **Step 6: Send a person with no Visitor ID to `/`.** In `app/demo/page.tsx` make the page async, read the cookie, and redirect:

```tsx
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { VISITOR_COOKIE, isVisitorId } from "@/lib/visitor";
import { CallScreen } from "./call-screen";

export const metadata: Metadata = {
  title: "Test Call · AI Voice Receptionist",
  robots: { index: false, follow: false },
};

export default async function DemoPage() {
  const visitorId = (await cookies()).get(VISITOR_COOKIE)?.value;
  if (!isVisitorId(visitorId)) redirect("/");
  return <CallScreen />;
}
```

Until Task 8 creates `CallScreen`, keep importing `SampleCallScreen` from `./sample-call-screen` here, so the build stays green; Task 8 swaps the import.

- [ ] **Step 7: Stub the button on `/`** (the landing page comes in step 6 of the rebuild). In `app/page.tsx`, replace the `Link` paragraph with:

```tsx
<form method="post" action="/api/visit">
  <button type="submit" className="underline">
    Try the demo
  </button>
</form>
```

Remove the unused `Link` import.

- [ ] **Step 8:** `npm run test:unit`, `npm run typecheck`, `npm run build`. Commit "Add Visitor identity: Try the demo sets a cookie".

---

### Task 5: Start Test Call (server)

**Files:**
- Create: `lib/vapi-web-call.ts`, `lib/start-test-call.ts`, `app/api/test-call/route.ts`, `lib/__tests__/start-test-call.test.ts`

**Interfaces:**
- Consumes: `CallGate`, `createCallGate`, `LIMITS`, `DEV_LIMITS` (Task 3); `redisCounterStore` (Task 3); `visitorIdFrom` (Task 4); `openTimes` (Task 2).
- Produces:

```ts
// lib/vapi-web-call.ts
export type WebCall = { webCallUrl: string; callId: string };
export type CreateWebCall = (input: { visitorId: string; openTimes: [string, string] }) => Promise<WebCall>;
export function vapiWebCallCreator(options: { privateKey: string; assistantId: string; fetchImpl?: typeof fetch }): CreateWebCall;

// lib/start-test-call.ts
export type StartTestCallDeps = { gate: CallGate; createWebCall: CreateWebCall; now(): Date };
/** Response bodies: 200 { webCallUrl, callId } · 401/429/502/503 { reason } */
export async function startTestCall(request: Request, deps: StartTestCallDeps): Promise<Response>;
export function ipKeyFrom(request: Request): string;
```

The `reason` values the browser reads: `"no-visitor"` (401), a `GateRefusal` other than `"unavailable"` (429), `"unavailable"` (503), `"connect-failed"` (502).

- [ ] **Step 1: Write the failing test** `lib/__tests__/start-test-call.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it.** `npx vitest run lib/__tests__/start-test-call.test.ts`. Expected: FAIL.

- [ ] **Step 3: Write `lib/vapi-web-call.ts`.**

```ts
// Server only: creates one Vapi web call for Luna with the private key. The
// browser then joins the call's room (the Vapi web SDK's reconnect) and never
// holds a key that can start calls or change Luna's settings.

export type WebCall = { webCallUrl: string; callId: string };
export type CreateWebCall = (input: { visitorId: string; openTimes: [string, string] }) => Promise<WebCall>;

export function vapiWebCallCreator({
  privateKey,
  assistantId,
  fetchImpl = fetch,
}: {
  privateKey: string;
  assistantId: string;
  fetchImpl?: typeof fetch;
}): CreateWebCall {
  return async ({ visitorId, openTimes: [openTime1, openTime2] }) => {
    const response = await fetchImpl("https://api.vapi.ai/call/web", {
      method: "POST",
      headers: { Authorization: `Bearer ${privateKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        assistantId,
        assistantOverrides: { metadata: { visitorId }, variableValues: { openTime1, openTime2 } },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Vapi refused the web call: ${response.status} ${await response.text()}`);
    const call = (await response.json()) as { id?: string; webCallUrl?: string; transport?: { callUrl?: string } };
    const webCallUrl = call.webCallUrl ?? call.transport?.callUrl;
    if (!call.id || !webCallUrl) throw new Error("Vapi's web call has no ID or room link.");
    // Only these two leave the server. Vapi's answer also holds a control
    // link that can steer the call; it must never reach the browser.
    return { webCallUrl, callId: call.id };
  };
}
```

- [ ] **Step 4: Write `lib/start-test-call.ts`.**

```ts
// Start Test Call: the one door to a Test Call. Checks the Visitor, runs the
// Call Gate, then creates one Vapi web call. Deps are injected so the tests
// need no Redis and no Vapi.

import { createHash } from "node:crypto";
import type { CallGate } from "@/lib/call-gate";
import { openTimes } from "@/lib/open-times";
import type { CreateWebCall } from "@/lib/vapi-web-call";
import { visitorIdFrom } from "@/lib/visitor";

export type StartTestCallDeps = { gate: CallGate; createWebCall: CreateWebCall; now(): Date };

/** The caller's IP address (first in x-forwarded-for, as Vercel sets it), hashed so Redis never holds it. */
export function ipKeyFrom(request: Request): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

const answer = (status: number, body: object) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function startTestCall(request: Request, deps: StartTestCallDeps): Promise<Response> {
  const visitorId = visitorIdFrom(request.headers.get("cookie"));
  if (!visitorId) return answer(401, { reason: "no-visitor" });

  const now = deps.now();
  const gate = await deps.gate.check({ visitorId, ipKey: ipKeyFrom(request), now });
  if (!gate.allowed) return answer(gate.reason === "unavailable" ? 503 : 429, { reason: gate.reason });

  try {
    const { webCallUrl, callId } = await deps.createWebCall({ visitorId, openTimes: openTimes(now) });
    return answer(200, { webCallUrl, callId });
  } catch (error) {
    console.error("Start Test Call: Vapi did not start the call.", error instanceof Error ? error.message : error);
    await gate.release().catch(() => {});
    return answer(502, { reason: "connect-failed" });
  }
}
```

- [ ] **Step 5: Run the test.** Expected: PASS (8 tests).

- [ ] **Step 6: Write `app/api/test-call/route.ts`.**

```ts
import { DEV_LIMITS, LIMITS, createCallGate } from "@/lib/call-gate";
import { redisCounterStore } from "@/lib/redis-counter-store";
import { startTestCall } from "@/lib/start-test-call";
import { vapiWebCallCreator } from "@/lib/vapi-web-call";

export const dynamic = "force-dynamic";

const production = process.env.NODE_ENV === "production";

export async function POST(request: Request) {
  const privateKey = process.env.VAPI_PRIVATE_KEY;
  const assistantId = process.env.VAPI_ASSISTANT_ID;
  if (!privateKey || !assistantId || !process.env.UPSTASH_REDIS_REST_URL) {
    console.error("Start Test Call: VAPI_PRIVATE_KEY, VAPI_ASSISTANT_ID or Upstash settings are missing.");
    return Response.json({ reason: "unavailable" }, { status: 503 });
  }
  return startTestCall(request, {
    gate: createCallGate({
      store: redisCounterStore(),
      limits: production ? LIMITS : DEV_LIMITS,
      prefix: production ? "avr:" : "avr:dev:",
    }),
    createWebCall: vapiWebCallCreator({ privateKey, assistantId }),
    now: () => new Date(),
  });
}
```

- [ ] **Step 7:** `npm run test:unit`, `npm run typecheck`, `npm run build`. Commit "Add Start Test Call: gate first, then one server-made web call".

---

### Task 6: The call source contract and Call Story fixes

From the PR #11 review notes on #4. Settle these before the Vapi source.

**Files:**
- Create: `lib/scheduler.ts`
- Modify: `lib/call-source.ts`, `lib/call-story.ts`, `lib/sample-call.ts`, `lib/__tests__/call-story.test.ts`, `lib/__tests__/sample-call.test.ts`, `app/demo/sample-call-screen.tsx` (new `start` signature and `DETAIL_FIELDS` import)

**Interfaces:**
- Produces:

```ts
// lib/call-source.ts
export type StartFailure = "microphone-blocked" | "limit" | "unavailable" | "connect-failed";
export type CallHandlers = {
  onEvent(event: CallEvent): void;
  /** The call never started: no event came before this and none comes after. */
  onFailed(failure: StartFailure): void;
};
export type RunningCall = {
  /** Ends the call. If it had started and not ended, the source emits one `ended` (caller-hung-up), then nothing more. */
  stop(): void;
};
export type CallSource = { start(handlers: CallHandlers): RunningCall };

// lib/scheduler.ts
export type Scheduler = (run: () => void, delayMs: number) => () => void;
export const realScheduler: Scheduler;

// lib/call-story.ts (added)
export const DETAIL_FIELDS: readonly DetailField[]; // ["name", "job", "urgency", "address"]
```

- [ ] **Step 1: Write failing tests.** Add to `lib/__tests__/call-story.test.ts`:

```ts
describe("after the call ends", () => {
  it("keeps a late final line, but the duration and reason come from the first end", () => {
    const { view, notes } = tellCallStory([
      { type: "line", speaker: "receptionist", text: "Hello", atMs: 0 },
      { type: "ended", reason: "caller-hung-up", atMs: 4000 },
      { type: "line", speaker: "caller", text: "Bye", atMs: 4600 },
      { type: "ended", reason: "error", atMs: 5000 },
    ]);
    expect(view.lines.map((l) => l.text)).toEqual(["Hello", "Bye"]);
    expect(notes!.endReason).toBe("caller-hung-up");
    expect(notes!.durationMs).toBe(4000);
  });
});

describe("a corrected detail", () => {
  it("takes the value that arrived last, whatever its time stamp", () => {
    const { view } = tellCallStory([
      { type: "detail", field: "name", value: "Rosa", atMs: 6000 },
      { type: "detail", field: "name", value: "Rose", atMs: 5000 },
    ]);
    expect(view.details.name).toBe("Rose");
  });
});
```

Replace the player's "emits nothing more once stopped" test in `lib/__tests__/sample-call.test.ts` with the new contract (and change every `.start((event) => heard.push(event))` to `.start({ onEvent: (event) => heard.push(event), onFailed: () => {} })`):

```ts
it("ends with the caller hanging up when stopped, then emits nothing more", () => {
  const clock = fakeScheduler();
  const heard: CallEvent[] = [];
  const call = createSampleCallPlayer(events, clock.schedule).start({ onEvent: (event) => heard.push(event), onFailed: () => {} });

  clock.advanceTo(2000);
  call.stop();
  call.stop();
  clock.advanceTo(10000);
  expect(heard).toEqual([events[0], events[1], { type: "ended", reason: "caller-hung-up", atMs: 2000 }]);
});

it("does nothing when stopped after it ended", () => {
  const clock = fakeScheduler();
  const heard: CallEvent[] = [];
  const call = createSampleCallPlayer(events, clock.schedule).start({ onEvent: (event) => heard.push(event), onFailed: () => {} });
  clock.advanceTo(5000);
  call.stop();
  expect(heard).toEqual(events);
});
```

Rule: **the stop's `ended` takes the `atMs` of the last event the player emitted** (2000 in the test above). The player needs no clock.

- [ ] **Step 2: Run them.** `npx vitest run lib/__tests__/call-story.test.ts lib/__tests__/sample-call.test.ts`. Expected: the new tests FAIL.

- [ ] **Step 3: Move `Scheduler` and `realScheduler`** from `lib/call-source.ts` into `lib/scheduler.ts` (same code). Update `lib/sample-call.ts` to import from there.

- [ ] **Step 4: Write the new contract** in `lib/call-source.ts`:

```ts
// A call source feeds Call Story events to the screens. The Sample Call
// player is one; the Vapi source is the other. Screens take a CallSource and
// never know which one they have.

import type { CallEvent } from "@/lib/call-story";

/** Why a call never started. Each one leads the screen to offer the Sample Call. */
export type StartFailure = "microphone-blocked" | "limit" | "unavailable" | "connect-failed";

export type CallHandlers = {
  onEvent(event: CallEvent): void;
  /** The call never started: no event came before this and none comes after. */
  onFailed(failure: StartFailure): void;
};

export type RunningCall = {
  /**
   * Ends the call. If it had started and not yet ended, the source emits one
   * `ended` with reason `caller-hung-up`, then nothing more. Safe to call twice.
   */
  stop(): void;
};

export type CallSource = {
  start(handlers: CallHandlers): RunningCall;
};
```

- [ ] **Step 5: Update the player** in `lib/sample-call.ts`:

```ts
export function createSampleCallPlayer(
  events: readonly CallEvent[] = SAMPLE_CALL_EVENTS,
  schedule: Scheduler = realScheduler,
): CallSource {
  return {
    start({ onEvent }) {
      let lastAtMs = 0;
      let ended = false;
      const emit = (event: CallEvent) => {
        if (ended) return;
        lastAtMs = event.atMs;
        if (event.type === "ended") ended = true;
        onEvent(event);
      };
      const cancels = events.map((event) => schedule(() => emit(event), event.atMs));
      return {
        stop() {
          for (const cancel of cancels) cancel();
          emit({ type: "ended", reason: "caller-hung-up", atMs: lastAtMs });
        },
      };
    },
  };
}
```

- [ ] **Step 6: Update the Call Story** in `lib/call-story.ts`:
  - Add `export const DETAIL_FIELDS: readonly DetailField[] = ["name", "job", "urgency", "address"];`
  - Make `CallView` and `CallNotes` fields `readonly` (and their arrays `readonly TranscriptLine[]`).
  - In the loop: once an `ended` has been seen, ignore any later `ended`, and stop moving `elapsedMs` forward; still add later `line`, `detail` and `booked` events.
  - Add to the header comment: "A later value for the same field replaces the earlier one in **arrival order**, not by `atMs`."

```ts
  for (const event of events) {
    if (!endReason) elapsedMs = Math.max(elapsedMs, event.atMs);
    switch (event.type) {
      // line, detail, booked: unchanged
      case "ended":
        // The first end wins: Vapi can send a last final line, or a second
        // end, after the call has already ended.
        endReason ??= event.reason;
        break;
    }
  }
```

- [ ] **Step 7: Update `app/demo/sample-call-screen.tsx`** so it still builds: `source.start({ onEvent: (event) => setEvents((soFar) => [...soFar, event]), onFailed: () => {} })`, import `DETAIL_FIELDS` from `@/lib/call-story` instead of building its own, and keep `stop()` resetting the screen as today (it ignores the final `ended` by clearing events after stopping: call `call.current?.stop()`, then `setEvents([])`).

- [ ] **Step 8:** Run the two test files (PASS), then `npm run test:unit`, `npm run typecheck`. Commit "Settle the call source contract: start failures, stop ends the call, first end wins".

---

### Task 7: The Vapi source

**Files:**
- Create: `lib/vapi-source.ts`, `lib/__tests__/vapi-source.test.ts`, `lib/vapi-browser.ts`
- Modify: `package.json` (add `@vapi-ai/web`)

**Interfaces:**
- Consumes: `CallSource`, `CallHandlers`, `StartFailure` (Task 6); `TOOL` (Task 1); `DETAIL_FIELDS`, `CallEvent`, `EndReason` (Task 6).
- Produces:

```ts
export type VapiLike = {
  on(event: "message", listener: (message: unknown) => void): void;
  on(event: "call-end", listener: () => void): void;
  on(event: "error", listener: (error: unknown) => void): void;
  reconnect(call: { webCallUrl: string; id?: string }): Promise<void>;
  stop(): void;
};
export type StartResult = { ok: true; webCallUrl: string; callId: string } | { ok: false; failure: StartFailure };
export type VapiSourceDeps = {
  requestMicrophone(): Promise<boolean>;
  startTestCall(): Promise<StartResult>;
  createVapi(): Promise<VapiLike>;
  now(): number;
};
export function createVapiSource(deps: VapiSourceDeps): CallSource;
export function browserVapiSourceDeps(): VapiSourceDeps; // lib/vapi-browser.ts
```

- [ ] **Step 1:** `npm install @vapi-ai/web@^2.7.1`.

- [ ] **Step 2: Write the failing test** `lib/__tests__/vapi-source.test.ts`:

```ts
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
    async reconnect(call) {
      vapi.joined.push(call);
      if (joinFails) throw new Error("join failed");
    },
    stop() {
      vapi.stopped++;
    },
    emit(event, arg) {
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
```

- [ ] **Step 3: Run it.** `npx vitest run lib/__tests__/vapi-source.test.ts`. Expected: FAIL.

- [ ] **Step 4: Write `lib/vapi-source.ts`.**

```ts
// The Vapi source: a Test Call as Call Story events. It asks for the
// microphone, asks our server to start the call, joins the room the server
// made, and turns Vapi's messages into events. The Vapi web SDK and the
// browser are injected (VapiSourceDeps) so tests play Vapi's side by hand.

import type { CallHandlers, CallSource, StartFailure } from "@/lib/call-source";
import { DETAIL_FIELDS, type CallEvent, type DetailField, type EndReason } from "@/lib/call-story";
import { TOOL } from "@/vapi/luna";

export type VapiLike = {
  on(event: "message", listener: (message: unknown) => void): void;
  on(event: "call-end", listener: () => void): void;
  on(event: "error", listener: (error: unknown) => void): void;
  reconnect(call: { webCallUrl: string; id?: string }): Promise<void>;
  stop(): void;
};

export type StartResult = { ok: true; webCallUrl: string; callId: string } | { ok: false; failure: StartFailure };

export type VapiSourceDeps = {
  /** Asks for the microphone, then lets it go again. True when allowed. */
  requestMicrophone(): Promise<boolean>;
  /** POSTs to /api/test-call. */
  startTestCall(): Promise<StartResult>;
  createVapi(): Promise<VapiLike>;
  /** A clock in milliseconds. */
  now(): number;
};

type Message = {
  type?: string;
  transcriptType?: string;
  role?: string;
  transcript?: string;
  status?: string;
  endedReason?: string;
  toolCallList?: { function?: { name?: string; arguments?: unknown } }[];
};

function endReasonFrom(endedReason: string | undefined, sawError: boolean): EndReason {
  if (endedReason === "exceeded-max-duration") return "time-limit";
  if (endedReason === "customer-ended-call") return "caller-hung-up";
  if (endedReason?.startsWith("assistant-")) return "receptionist-finished";
  if (sawError || endedReason) return "error";
  return "receptionist-finished";
}

function argumentsOf(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

export function createVapiSource(deps: VapiSourceDeps): CallSource {
  return {
    start({ onEvent, onFailed }: CallHandlers) {
      let stopped = false;
      let vapi: VapiLike | null = null;
      let startedAt = 0;
      let ended = false;
      let endedReason: string | undefined;
      let sawError = false;

      const at = () => Math.max(0, deps.now() - startedAt);
      const end = (reason: EndReason) => {
        if (ended) return;
        ended = true;
        onEvent({ type: "ended", reason, atMs: at() });
      };

      const onMessage = (raw: unknown) => {
        const message = (raw ?? {}) as Message;
        const type = message.type ?? "";
        if (type.startsWith("transcript")) {
          const final = message.transcriptType === "final" || type.includes('"final"');
          const text = message.transcript?.trim();
          if (final && text) {
            onEvent({ type: "line", speaker: message.role === "user" ? "caller" : "receptionist", text, atMs: at() });
          }
        } else if (type === "tool-calls") {
          for (const call of message.toolCallList ?? []) {
            const args = argumentsOf(call.function?.arguments);
            const event = toEvent(call.function?.name, args, at());
            if (event) onEvent(event);
          }
        } else if (type === "status-update" && message.status === "ended") {
          endedReason = message.endedReason;
        }
      };

      (async () => {
        if (!(await deps.requestMicrophone())) return stopped || onFailed("microphone-blocked");
        if (stopped) return;
        const result = await deps.startTestCall();
        if (stopped) return;
        if (!result.ok) return onFailed(result.failure);
        try {
          vapi = await deps.createVapi();
          if (stopped) return;
          vapi.on("message", onMessage);
          vapi.on("error", () => {
            sawError = true;
          });
          vapi.on("call-end", () => end(endReasonFrom(endedReason, sawError)));
          await vapi.reconnect({ webCallUrl: result.webCallUrl, id: result.callId });
          startedAt = deps.now();
        } catch {
          vapi = null;
          if (!stopped) onFailed("connect-failed");
        }
      })();

      return {
        stop() {
          if (stopped) return;
          stopped = true;
          if (vapi) {
            vapi.stop();
            end("caller-hung-up");
          }
        },
      };
    },
  };
}

function toEvent(name: string | undefined, args: Record<string, unknown>, atMs: number): CallEvent | null {
  if (name === TOOL.recordDetail) {
    const field = args.field as DetailField;
    const value = typeof args.value === "string" ? args.value.trim() : "";
    return DETAIL_FIELDS.includes(field) && value ? { type: "detail", field, value, atMs } : null;
  }
  if (name === TOOL.bookTime) {
    const time = typeof args.time === "string" ? args.time.trim() : "";
    return time ? { type: "booked", time, atMs } : null;
  }
  return null;
}
```

Note on the tests: `startedAt` is set after `reconnect` resolves, so in the tests the clock reads 1000 at join and events right after the join are at 0 ms. If a test fails only on `atMs`, fix the code, not the test, unless the test contradicts this rule.

- [ ] **Step 5: Run the test.** Expected: PASS (11 tests). If `@/vapi/luna` pulls `../lib/sample-business.ts` and Vite complains about the `.ts` extension, it should not (Vite allows it); if it does, move `TOOL` into `lib/tools.ts` and import it from both places.

- [ ] **Step 6: Write `lib/vapi-browser.ts`** (browser only; checked live in Task 9, not unit tested):

```ts
// The real browser behind the Vapi source: the microphone, our server, and
// the Vapi web SDK (loaded only when a Test Call starts).

import type { StartFailure } from "@/lib/call-source";
import type { StartResult, VapiLike, VapiSourceDeps } from "@/lib/vapi-source";

const FAILURE_BY_STATUS: Record<number, StartFailure> = { 429: "limit", 502: "connect-failed" };

export function browserVapiSourceDeps(): VapiSourceDeps {
  return {
    async requestMicrophone() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        for (const track of stream.getTracks()) track.stop();
        return true;
      } catch {
        return false;
      }
    },
    async startTestCall(): Promise<StartResult> {
      try {
        const response = await fetch("/api/test-call", { method: "POST" });
        if (!response.ok) return { ok: false, failure: FAILURE_BY_STATUS[response.status] ?? "unavailable" };
        const { webCallUrl, callId } = await response.json();
        return { ok: true, webCallUrl, callId };
      } catch {
        return { ok: false, failure: "connect-failed" };
      }
    },
    async createVapi() {
      const { default: Vapi } = await import("@vapi-ai/web");
      // The SDK wants a key, but joining a room the server made (reconnect)
      // never calls Vapi's API, so no key is given to the browser.
      return new Vapi("no-key-needed-for-reconnect") as unknown as VapiLike;
    },
    now: () => performance.now(),
  };
}
```

- [ ] **Step 7:** `npm run test:unit`, `npm run typecheck`, `npm run build`. Commit "Add the Vapi source: messages to Call Story events".

---

### Task 8: The Test Call screen

**Files:**
- Create: `app/demo/call-screen.tsx`
- Modify: `app/_ui/ticket.tsx` (add `EndCallButton`, `PhoneIcon`), `app/demo/page.tsx` (render `CallScreen`), `DESIGN.md` (end button is built; sound wave still open)
- Delete: `app/demo/sample-call-screen.tsx` once `call-screen.tsx` covers the Sample Call (move `TopSheet` and `OwnersCopy` across; change only what this task needs)

**Interfaces:**
- Consumes: `createVapiSource` + `browserVapiSourceDeps` (Task 7); `createSampleCallPlayer` (Task 6); `tellCallStory`, `DETAIL_FIELDS` (Task 6); `StartFailure` (Task 6).

**Behaviour (one screen, both sources — PR #12 review note 1):**

| Phase | Status line | Controls |
|---|---|---|
| ready | "Your receptionist is standing by" | Stamp "Call now" (phone icon). Under it, Print Muted: "Make up your details. Don't give your real name or address." and "Only the words are kept, for 7 days. Never your voice." Then a Form button "Play the Sample Call". |
| connecting | "Calling…" | Form button "Cancel" (calls `stop()`, back to ready) |
| live, Test Call | lamp, "On the line", ticking timer | `EndCallButton` "End call" |
| live, Sample Call | lamp, "On the line", timer | Form button "Stop the Sample Call" (resets to ready, as today) |
| failed | the notice below, in Print Muted under the status | Stamp "Play the Sample Call" (autofocus) and Form button "Try calling again" only for `connect-failed` |
| ended | Call Notes (the yellow Owner's copy) | "Make another Test Call" (Test Call) or "Play the Sample Call again" (Sample Call) |

Notices:
- `microphone-blocked`: "Your microphone is blocked, so the call can't start. You can still hear how it works."
- `limit`: "The Test Calls for today are used up. You can still hear how it works."
- `unavailable` / `connect-failed`: "The call couldn't connect. You can still hear how it works."

The microphone is asked for only inside the "Call now" click (the Vapi source does it first). The timer ticks every 250 ms while live (PR #12 review note 2): keep `startedAt = performance.now()` when the first event arrives, show `max(view.elapsedMs, now - startedAt)` while live and `view.elapsedMs` once ended. In the Owner's copy, `scrollTo` and focus move to `useLayoutEffect` (review note 3).

- [ ] **Step 1: Add to `app/_ui/ticket.tsx`:**

```tsx
/** Ends a Test Call: solid Form Red, square, white Form caps. No glow, no pulse (DESIGN.md). */
export function EndCallButton({ onClick, autoFocus }: { onClick: () => void; autoFocus?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      autoFocus={autoFocus}
      className="inline-flex min-h-14 w-full items-center justify-center gap-3 bg-form px-4 font-form text-[1.375rem] font-extrabold tracking-wide text-sheet uppercase hover:bg-form-deep"
    >
      <PhoneIcon />
      End call
    </button>
  );
}

export function PhoneIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 fill-current">
      <path d="M6.6 2.2 4.4 2c-.9 0-2 .9-1.9 2.2.4 6.6 6.7 12.9 13.3 13.3 1.3.1 2.2-1 2.2-1.9l-.2-2.2c0-.5-.4-.9-.9-1l-3-.7c-.4-.1-.9.1-1.1.5l-.9 1.5c-2-1-3.9-2.9-4.9-4.9l1.5-.9c.4-.2.6-.7.5-1.1l-.7-3c-.1-.5-.5-.9-1-.9Z" />
    </svg>
  );
}
```

Check `globals.css` defines `form-deep` (DESIGN.md lists Form Red, Deep #8a1b14 as defined in the theme). If the Tailwind class name differs, use the defined one.

- [ ] **Step 2: Write `app/demo/call-screen.tsx`.** Start from `sample-call-screen.tsx` (keep `TopSheet` layout, `OwnersCopy`, the sheet lift). Replace the source handling with this state:

```tsx
type Mode = "test" | "sample";
type Phase =
  | { kind: "ready" }
  | { kind: "connecting" }
  | { kind: "failed"; failure: StartFailure }
  | { kind: "running"; mode: Mode };

export function CallScreen() {
  const [testCall] = useState<CallSource>(() => createVapiSource(browserVapiSourceDeps()));
  const [sampleCall] = useState<CallSource>(() => createSampleCallPlayer());
  const [phase, setPhase] = useState<Phase>({ kind: "ready" });
  const [mode, setMode] = useState<Mode>("test");
  const [events, setEvents] = useState<CallEvent[]>([]);
  const call = useRef<RunningCall | null>(null);

  useEffect(() => () => call.current?.stop(), []);

  function begin(next: Mode) {
    call.current?.stop();
    setEvents([]);
    setMode(next);
    setPhase(next === "test" ? { kind: "connecting" } : { kind: "running", mode: next });
    call.current = (next === "test" ? testCall : sampleCall).start({
      onEvent: (event) => {
        setPhase({ kind: "running", mode: next });
        setEvents((soFar) => [...soFar, event]);
      },
      onFailed: (failure) => {
        call.current = null;
        setPhase({ kind: "failed", failure });
      },
    });
  }

  function endTestCall() {
    call.current?.stop(); // the source emits `ended` (caller-hung-up): Call Notes open
    call.current = null;
  }

  function cancelOrStopSample() {
    call.current?.stop();
    call.current = null;
    setEvents([]);
    setPhase({ kind: "ready" });
  }
  // ...render: tellCallStory(events); notes → OwnersCopy (+ sheet lift); else TopSheet with
  // the status and controls from the table above.
}
```

`TopSheet` takes the status and the controls as props (or children) instead of building Sample Call buttons itself, so the same sheet serves both sources. Keep every class from `DESIGN.md`; add nothing purple; the only new mark is the End button.

- [ ] **Step 3: Swap the page.** `app/demo/page.tsx` renders `<CallScreen />` (Task 4, Step 6 code). Delete `app/demo/sample-call-screen.tsx`.

- [ ] **Step 4: Update `DESIGN.md`**: the End button line becomes "**End button (Test Call):** solid Form Red, white Form caps, square, min-height 56px, full width in the call column, phone icon. No glow, no pulse." Under open items, add: "The live sound wave (story 28) is not built yet."

- [ ] **Step 5: Check it builds.** `npm run typecheck`, `npm run build`, `npm run test:unit`.

- [ ] **Step 6: Check it in the browser pane** (controller, with the dev server from `.claude/launch.json`): with no cookie, `/demo` sends to `/`; "Try the demo" opens `/demo`; the ready sheet matches the table; "Play the Sample Call" plays and ends in Call Notes; at 375px wide nothing scrolls sideways. Screenshots for the PR.

- [ ] **Step 7:** Commit "Add the Test Call screen, with the Sample Call as fallback".

---

### Task 9: Live check (controller and founder)

Not a sub-agent task. Needs the real keys.

- [ ] **Step 1: Sync Luna.** `npm run vapi:sync`. Expected: `Created "Luna · Mangrove Air". All checks pass.` and a `VAPI_ASSISTANT_ID=` line. Add that line to `.env.local` (it is an ID, not a secret, but it stays out of git).
- [ ] **Step 2: Read Luna back** in the Vapi dashboard (browser pane): Assistants → Luna. Check recording off, max duration 180 s, no server URL, tools present, transcriber multilingual.
- [ ] **Step 3: Check the Call Gate against the real Redis** with the dev server: press "Call now" in the browser pane. Expected: `avr:dev:gate:*` keys appear (read with a REST `GET .../keys/avr:dev:*`), each with a TTL; no other key changes.
- [ ] **Step 4: Check the fallbacks** in the browser pane: microphone blocked → notice + Sample Call; with `DEV_LIMITS` temporarily irrelevant, force a refusal by calling twice past a limit only if cheap — otherwise trust the unit tests.
- [ ] **Step 5: Founder:** one Test Call in English and one in Spanish on `localhost`. Sees the words and the tags fill in, the booking, and Call Notes at the end. Founder also picks the voice by ear (Vapi dashboard voice preview); the controller updates `VOICE_ID` and syncs again.
- [ ] **Step 6: Founder: lock the public key** that Vapi will not let us delete: Vapi → API keys → Public Key → Allowed Assistants: Luna only; Transient Assistant: off; Allowed origins: `https://ai-voice-receptionist.vercel.app`. Our app never uses it.
- [ ] **Step 7: Check the calls in Vapi logs**: no recording on either call; each under 180 s.

### Task 10: Ship

- [ ] README: Status table (Shipped #2, #3, #4; Next #5), "Run it locally" now needs `.env.local` from `.env.example` and `npm run vapi:sync`; stack line drops "(planned)" for Vapi and Upstash.
- [ ] Issue #4: write the mechanism (server-created web call + `reconnect`), the IP limit (2 a day), the dev limits, and anything Vapi changed in Task 9.
- [ ] `npm run test:unit`, `npm run typecheck`, `npm run build`. Review with `superpowers:requesting-code-review`. Push the branch, open the PR (closes #4). No Vercel project exists yet, so nothing goes live.
