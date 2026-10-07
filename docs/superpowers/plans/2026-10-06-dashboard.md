# Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Owner's Dashboard: an answering switch, three totals and the recent calls (sample calls mixed with the Visitor's own Test Calls, newest first), each opening its Call Notes.

**Architecture:** Two pure modules carry the logic. `lib/sample-calls.ts` builds a fixed set of made-up calls, each dated a fixed number of minutes before now and run through the Call Story. `lib/dashboard.ts` mixes them with the Visitor's saved Call Notes, counts the totals, labels the times in South Florida time, and finds one call by its ID for the Visitor. The screens are server components: `/demo/dashboard` and `/demo/dashboard/[callId]`. The Call Notes sheet moves out of the call screen into `app/_ui/call-notes.tsx`, so the call screen and the Dashboard show the same sheet.

**Tech Stack:** Next.js 16 App Router (server components), TypeScript, Tailwind 4, Vitest, Upstash Redis (through the existing Call Notes store).

**Spec:** Issue #6 (this ticket); parent spec #1, module 9 "Dashboard data", user stories 41–47, and "Testing Decisions"; `DESIGN.md`; `CONTEXT.md`. The founder approved the design in chat on 2026-10-06:
- "Calls answered" counts real calls only (sample and the Visitor's). Spam is not in it, so the three totals do not overlap.
- "Jobs booked" counts calls with a booked time. "Spam blocked" counts sample spam calls only.
- The answering switch only changes the screen, with a line that says so.
- If Redis fails or is not set up, the Dashboard shows the sample calls only. No error screen.
- After a call, the Call Notes get an "Open the Dashboard" link (story 41).

## Global Constraints

- Words follow `CONTEXT.md`: Visitor, Sample Business, Receptionist, Test Call, Sample Call, Call Notes, Owner, Dashboard. Never "Sarah" or "Viora". Names come from `lib/sample-business.ts` (Mangrove Air, Luna).
- Sample calls use made-up names and addresses. They are not the Sample Call (the one recorded call); they are "sample calls" on the Dashboard only.
- Dates are relative to now and shown in South Florida time (`TIME_ZONE` in `lib/calendar-day.ts`).
- A Visitor reaches only their own Call Notes, through the Visitor ID in the `avr_visitor` cookie. Never from the address.
- No text or email is ever sent. No audio is kept.
- Demo routes are `noindex`. A demo screen with no Visitor ID redirects to `/`.
- The screens follow `DESIGN.md`: its tokens, its type scale, three inks, square corners, one shadow (the top sheet only; the Dashboard has none), no new motion. No purple.
- Screens get no unit tests. They are checked in the browser pane.
- Tests: while working, `npx vitest run <file>`. Before each commit, `npm run test:unit` once. Never `npm test`. Tests sit in `__tests__/` beside the code.
- Work on branch `voice-demo-batch-5`. Never push to `main`. Pushing the branch makes a Vercel Preview (not production).
- Every commit ends with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (as a second `-m`).

## Review Focus

1. **A call near midnight in Miami.** "Today" and "Yesterday" follow the day in Miami, not in UTC. Pinned in Task 2 ("go by the day in Miami, not in UTC").
2. **A Visitor opens another Visitor's call by its ID.** They get "not found", never the notes. Pinned in Task 2 (`findDashboardCall` with Visitor B).
3. **Redis is down.** The Dashboard still shows the sample calls; opening a saved call gives "not found", not a crash. Pinned in Task 2 (`savedCallsFor` and `findDashboardCall` with a failing store).
4. **A call ID with odd characters in the address** (`../x`, `a:b`). Never reaches Redis; "not found". Pinned in Task 2.
5. **A sample call's booked time goes stale.** The booked time is one of the two times offered on the call's own date, so it moves with today. Pinned in Task 1.

---

## File Structure

| File | Does |
|---|---|
| `lib/sample-business.ts` (modify) | add `TEST_CALL_TICKET`, the number printed on a Test Call's work order |
| `lib/sample-calls.ts` (create) | the Dashboard's sample calls, dated relative to now, built with the Call Story |
| `lib/dashboard.ts` (create) | mix, totals, time labels, find one call, read the Visitor's calls safely |
| `lib/server-notes-store.ts` (create) | the Call Notes store on Redis, or null when Redis is not set up |
| `app/_ui/call-notes.tsx` (create) | the Call Notes sheet (moved out of the call screen), plus the labels it shares |
| `app/_ui/ticket.tsx` (modify) | add `FormLink`: a link that looks like a Form Button |
| `app/demo/call-screen.tsx` (modify) | use the shared sheet; add "Open the Dashboard" |
| `app/demo/dashboard/page.tsx` (create) | the Dashboard screen |
| `app/demo/dashboard/answering-switch.tsx` (create) | the answering status and its on-screen switch |
| `app/demo/dashboard/[callId]/page.tsx` (create) | one call's Call Notes |
| `DESIGN.md` (modify) | the Dashboard and Form Link components |

---

### Task 1: Sample calls

**Files:**
- Modify: `lib/sample-business.ts`
- Create: `lib/sample-calls.ts`
- Test: `lib/__tests__/sample-calls.test.ts`

**Interfaces:**
- Consumes: `tellCallStory`, `DETAIL_FIELDS`, types `CallDetails`, `CallEvent`, `CallNotes`, `EndReason`, `Speaker` from `@/lib/call-story`; `openTimes(now: Date): [string, string]` from `@/lib/open-times`.
- Produces:
  - `export const TEST_CALL_TICKET = "04127";` in `@/lib/sample-business`.
  - `export type SampleCall = { readonly id: string; readonly at: Date; readonly spam: boolean; readonly number: string; readonly notes: CallNotes }`
  - `export function sampleCalls(now: Date): SampleCall[]` — 7 calls, newest first, 2 spam, 4 booked.

- [ ] **Step 1: Add the Test Call's ticket number**

Append to `lib/sample-business.ts`:

```ts

// Decoration on a made-up work order, not a real record. A Test Call's work
// order and its Call Notes print this number; sample calls print lower ones.
export const TEST_CALL_TICKET = "04127";
```

- [ ] **Step 2: Write the failing test**

Create `lib/__tests__/sample-calls.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { openTimes } from "@/lib/open-times";
import { sampleCalls } from "@/lib/sample-calls";

// Tuesday, October 6, 12:00 PM in Miami.
const NOW = new Date("2026-10-06T16:00:00Z");
const MINUTE = 60_000;

describe("the Dashboard's sample calls", () => {
  it("are dated a fixed time before now, so they never look stale", () => {
    const aMonthLater = new Date("2026-11-06T17:00:00Z");
    const ages = (now: Date) => sampleCalls(now).map((call) => (now.getTime() - call.at.getTime()) / MINUTE);
    expect(ages(aMonthLater)).toEqual(ages(NOW));
    expect(ages(NOW)[0]).toBe(38);
  });

  it("all happened in the last 3 days, newest first", () => {
    const calls = sampleCalls(NOW);
    for (const call of calls) {
      expect(call.at.getTime()).toBeLessThan(NOW.getTime());
      expect(call.at.getTime()).toBeGreaterThan(NOW.getTime() - 3 * 24 * 60 * MINUTE);
    }
    const times = calls.map((call) => call.at.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("are seven calls: two spam, four booked", () => {
    const calls = sampleCalls(NOW);
    expect(calls).toHaveLength(7);
    expect(calls.filter((call) => call.spam)).toHaveLength(2);
    expect(calls.filter((call) => call.notes.booked)).toHaveLength(4);
  });

  it("each have full Call Notes", () => {
    for (const call of sampleCalls(NOW)) {
      expect(call.notes.summary).not.toBe("");
      expect(call.notes.lines.length).toBeGreaterThan(1);
      expect(call.notes.durationMs).toBeGreaterThan(0);
    }
  });

  it("book one of the two times offered on the call's own date", () => {
    for (const call of sampleCalls(NOW).filter((c) => c.notes.booked)) {
      expect(openTimes(call.at)).toContain(call.notes.booked);
      expect(call.notes.summary).toContain(call.notes.booked!);
      expect(call.notes.confirmationText).toContain(call.notes.booked!);
    }
    // 22 hours 10 minutes before Tuesday noon is Monday afternoon in Miami: Luna offered Tuesday.
    const tuneUp = sampleCalls(NOW).find((call) => call.id === "sample-tune-up")!;
    expect(tuneUp.notes.booked).toBe("Tuesday, October 6 at 2 PM");
  });

  it("capture nothing and book nothing when they are spam", () => {
    for (const call of sampleCalls(NOW).filter((c) => c.spam)) {
      expect(call.notes.details).toEqual({});
      expect(call.notes.booked).toBeNull();
    }
  });

  it("have their own IDs and ticket numbers", () => {
    const calls = sampleCalls(NOW);
    expect(new Set(calls.map((call) => call.id)).size).toBe(calls.length);
    expect(new Set(calls.map((call) => call.number)).size).toBe(calls.length);
    for (const call of calls) {
      expect(call.id).toMatch(/^sample-[a-z-]+$/);
      expect(call.number).not.toBe("04127");
    }
  });
});
```

- [ ] **Step 3: Run the test to see it fail**

Run: `npx vitest run lib/__tests__/sample-calls.test.ts`
Expected: FAIL, "Cannot find module '@/lib/sample-calls'" (or similar).

- [ ] **Step 4: Write the sample calls**

Create `lib/sample-calls.ts`:

```ts
// The Dashboard's sample calls: made-up calls Luna took for the Sample
// Business while the Owner worked. Each is dated a fixed number of minutes
// before now, so the Dashboard never looks stale, and each runs through the
// Call Story like every other call. A booked time is one of the two times
// offered on the call's own date. Names and addresses are made up.
// Not the Sample Call: that is the one recorded call (lib/sample-call.ts).

import {
  DETAIL_FIELDS,
  tellCallStory,
  type CallDetails,
  type CallEvent,
  type CallNotes,
  type EndReason,
  type Speaker,
} from "@/lib/call-story";
import { openTimes } from "@/lib/open-times";

export type SampleCall = {
  readonly id: string;
  readonly at: Date;
  readonly spam: boolean;
  /** The ticket number printed on its Call Notes. */
  readonly number: string;
  readonly notes: CallNotes;
};

type Script = {
  id: string;
  number: string;
  minutesAgo: number;
  spam?: true;
  details?: CallDetails;
  /** Which of the two offered times the caller picked. */
  picks?: 0 | 1;
  endReason: EndReason;
  durationMs: number;
  summary: (booked: string | null) => string;
  lines: (offered: readonly [string, string]) => [Speaker, string][];
};

const GREETING: [Speaker, string] = ["receptionist", "Thanks for calling Mangrove Air, this is Luna. How can I help?"];
const NOT_A_SERVICE_CALL: [Speaker, string] = ["receptionist", "This line is for Mangrove Air service calls. Goodbye."];

// Newest first.
const SCRIPTS: readonly Script[] = [
  {
    id: "sample-warm-air",
    number: "04126",
    minutesAgo: 38,
    details: { name: "Carla Mendez", job: "AC blowing warm air", urgency: "urgent, the house is at 84 degrees", address: "2215 Palm Shadow Lane, Miramar" },
    picks: 0,
    endReason: "receptionist-finished",
    durationMs: 118_000,
    summary: (booked) => `Carla Mendez's AC is running but blowing warm air, and the house is at 84 degrees. Booked for ${booked}.`,
    lines: (offered) => [
      GREETING,
      ["caller", "Hi, my AC is running but it's blowing warm air. It's 84 in here."],
      ["receptionist", "I'm sorry, that's no fun in this heat. Can I get your name?"],
      ["caller", "Carla Mendez."],
      ["receptionist", "Thanks, Carla. What's the address?"],
      ["caller", "2215 Palm Shadow Lane in Miramar."],
      ["receptionist", `I can send a technician ${offered[0]} or ${offered[1]}. Which works better?`],
      ["caller", "The first one, please."],
      ["receptionist", `You're booked for ${offered[0]}. You'll get a text to confirm. Stay cool, Carla.`],
    ],
  },
  {
    id: "sample-spam-warranty",
    number: "04125",
    minutesAgo: 172,
    spam: true,
    endReason: "receptionist-finished",
    durationMs: 21_000,
    summary: () => "A recorded sales message about a car warranty. Luna ended the call. Nothing was booked.",
    lines: () => [
      GREETING,
      ["caller", "This is an important message about your vehicle's extended warranty. Press one to speak to"],
      NOT_A_SERVICE_CALL,
    ],
  },
  {
    id: "sample-no-cooling",
    number: "04124",
    minutesAgo: 312,
    details: { name: "Ana Lucía Ortiz", job: "AC not cooling", urgency: "urgent, her elderly mother is at home", address: "4410 SW 92nd Court, Westchester" },
    picks: 1,
    endReason: "receptionist-finished",
    durationMs: 142_000,
    summary: (booked) => `Ana Lucía Ortiz called in Spanish: the AC is not cooling and her elderly mother is at home. Booked for ${booked}.`,
    // The caller spoke Spanish, so Luna did too. The screens stay in English.
    lines: () => [
      GREETING,
      ["caller", "Hola, ¿habla español? El aire acondicionado no enfría."],
      ["receptionist", "Claro que sí. Lo siento mucho. ¿Me dice su nombre, por favor?"],
      ["caller", "Ana Lucía Ortiz."],
      ["receptionist", "Gracias, Ana Lucía. ¿Es urgente?"],
      ["caller", "Sí, mi mamá es mayor y hace mucho calor en la casa."],
      ["receptionist", "Entiendo. ¿Cuál es la dirección?"],
      ["caller", "4410 SW 92nd Court, en Westchester."],
      ["receptionist", "Puedo enviar un técnico el próximo día disponible, a las 9 de la mañana o a las 2 de la tarde. ¿Cuál prefiere?"],
      ["caller", "A las 2, por favor."],
      ["receptionist", "Listo, quedó reservado. Le llegará un mensaje de texto para confirmar."],
    ],
  },
  {
    id: "sample-tune-up",
    number: "04123",
    minutesAgo: 1_330,
    details: { name: "Derek Lawson", job: "yearly AC tune-up", urgency: "not urgent", address: "905 Coral Ridge Drive, Coral Springs" },
    picks: 1,
    endReason: "receptionist-finished",
    durationMs: 96_000,
    summary: (booked) => `Derek Lawson wants a yearly AC tune-up. Not urgent. Booked for ${booked}.`,
    lines: (offered) => [
      GREETING,
      ["caller", "Hi, I'd like to set up a yearly tune-up for my AC."],
      ["receptionist", "Happy to help. Can I get your name?"],
      ["caller", "Derek Lawson."],
      ["receptionist", "And the address, Derek?"],
      ["caller", "905 Coral Ridge Drive, Coral Springs."],
      ["receptionist", `I have ${offered[0]} or ${offered[1]}.`],
      ["caller", "The afternoon works."],
      ["receptionist", `Done. You're booked for ${offered[1]}.`],
    ],
  },
  {
    id: "sample-spam-listing",
    number: "04122",
    minutesAgo: 1_905,
    spam: true,
    endReason: "receptionist-finished",
    durationMs: 26_000,
    summary: () => "A robocall about a business listing. Luna ended the call. Nothing was booked.",
    lines: () => [
      GREETING,
      ["caller", "Your business listing will be suspended today unless you verify it. Press one to"],
      NOT_A_SERVICE_CALL,
    ],
  },
  {
    id: "sample-thermostat-price",
    number: "04121",
    minutesAgo: 2_870,
    details: { name: "Keisha Grant", job: "price for a smart thermostat", urgency: "not urgent" },
    endReason: "caller-hung-up",
    durationMs: 74_000,
    summary: () => "Keisha Grant asked what a smart thermostat costs to install. She will call back. Nothing was booked.",
    lines: () => [
      GREETING,
      ["caller", "Hi, how much do you charge to put in a smart thermostat?"],
      ["receptionist", "Good question. The technician gives the price on site after a quick look. Can I get your name?"],
      ["caller", "Keisha Grant. I'll think about it and call back."],
      ["receptionist", "No problem, Keisha. I'll let the team know you asked. Have a good day."],
    ],
  },
  {
    id: "sample-leak",
    number: "04120",
    minutesAgo: 4_210,
    details: { name: "Tom Becker", job: "water leaking from the indoor unit", urgency: "urgent", address: "318 Banyan Isle Way, Pembroke Pines" },
    picks: 0,
    endReason: "receptionist-finished",
    durationMs: 131_000,
    summary: (booked) => `Tom Becker has water leaking from the indoor AC unit onto the floor. Luna told him to turn the system off. Booked for ${booked}.`,
    lines: (offered) => [
      GREETING,
      ["caller", "Hey, there's water dripping from my AC unit inside, onto the floor."],
      ["receptionist", "Thanks for calling right away. Turn the system off for now if you can. What's your name?"],
      ["caller", "Tom Becker."],
      ["receptionist", "And your address, Tom?"],
      ["caller", "318 Banyan Isle Way, Pembroke Pines."],
      ["receptionist", `I can get someone out ${offered[0]} or ${offered[1]}.`],
      ["caller", "The earliest, please."],
      ["receptionist", `You're booked for ${offered[0]}. You'll get a text to confirm.`],
    ],
  },
];

export function sampleCalls(now: Date): SampleCall[] {
  return SCRIPTS.map((script) => play(script, now));
}

function play(script: Script, now: Date): SampleCall {
  const at = new Date(now.getTime() - script.minutesAgo * 60_000);
  const offered = openTimes(at);
  const booked = script.picks === undefined ? null : offered[script.picks];
  const lines = script.lines(offered);
  // Lines spread evenly over the call; the details and the booking land part way.
  const step = Math.round(script.durationMs / (lines.length + 1));
  const events: CallEvent[] = lines.map(([speaker, text], i) => ({ type: "line", speaker, text, atMs: step * (i + 1) }));
  for (const field of DETAIL_FIELDS) {
    const value = script.details?.[field];
    if (value) events.push({ type: "detail", field, value, atMs: step });
  }
  if (booked) events.push({ type: "booked", time: booked, atMs: step * lines.length });
  events.push({ type: "ended", reason: script.endReason, atMs: script.durationMs });

  const { notes } = tellCallStory(events, { summary: script.summary(booked) });
  // Never null: the last event is always `ended`.
  return { id: script.id, at, spam: script.spam === true, number: script.number, notes: notes! };
}
```

- [ ] **Step 5: Run the test to see it pass**

Run: `npx vitest run lib/__tests__/sample-calls.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

Run `npm run test:unit` once (all pass), then:

```bash
git add lib/sample-business.ts lib/sample-calls.ts lib/__tests__/sample-calls.test.ts
git commit -m "Add the Dashboard's sample calls, dated relative to now" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Dashboard data

**Files:**
- Create: `lib/dashboard.ts`
- Test: `lib/__tests__/dashboard.test.ts`

**Interfaces:**
- Consumes: `sampleCalls(now)`, `SampleCall` from Task 1; `TEST_CALL_TICKET` from `@/lib/sample-business`; `CallNotesStore`, `SavedCallNotes` from `@/lib/call-notes-store`; `TIME_ZONE`, `localDate` from `@/lib/calendar-day`.
- Produces:
  - `export type DashboardCall = { readonly id: string; readonly at: Date; readonly whose: "sample" | "yours"; readonly spam: boolean; readonly number: string; readonly notes: CallNotes }`
  - `export type Totals = { readonly answered: number; readonly booked: number; readonly spam: number }`
  - `export function buildDashboard(input: { saved: readonly SavedCallNotes[]; now: Date }): { totals: Totals; calls: DashboardCall[] }`
  - `export function callTimeLabel(at: Date, now: Date): string` — "Today · 11:22 AM", "Yesterday · 4:15 PM", "Sat · 9:03 AM", "Sep 29 · 2:10 PM"
  - `export async function savedCallsFor(input: { visitorId: string; store: CallNotesStore | null }): Promise<SavedCallNotes[]>`
  - `export async function findDashboardCall(input: { callId: string; visitorId: string; now: Date; store: CallNotesStore | null }): Promise<DashboardCall | null>`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/dashboard.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCallNotesStore, type SavedCallNotes } from "@/lib/call-notes-store";
import { tellCallStory, type CallEvent } from "@/lib/call-story";
import { buildDashboard, callTimeLabel, findDashboardCall, savedCallsFor } from "@/lib/dashboard";
import { fakeNotesStorage } from "./fake-notes-storage";

// Tuesday, October 6, 12:00 PM in Miami (UTC-4 in October).
const NOW = new Date("2026-10-06T16:00:00Z");
const VISITOR_A = "11111111-1111-4111-8111-111111111111";
const VISITOR_B = "22222222-2222-4222-8222-222222222222";

function testCall(callId: string, minutesAgo: number, booked: string | null): SavedCallNotes {
  const events: CallEvent[] = [
    { type: "detail", field: "name", value: "Rosa Diaz", atMs: 1000 },
    ...(booked ? [{ type: "booked" as const, time: booked, atMs: 2000 }] : []),
    { type: "ended", reason: "receptionist-finished", atMs: 3000 },
  ];
  return { callId, savedAt: new Date(NOW.getTime() - minutesAgo * 60_000).toISOString(), notes: tellCallStory(events).notes! };
}

function storeWith(...entries: [visitorId: string, call: SavedCallNotes][]) {
  const store = createCallNotesStore({ storage: fakeNotesStorage().storage, prefix: "avr:test:" });
  return Promise.all(entries.map(([visitorId, call]) => store.save({ visitorId, callId: call.callId, notes: call.notes, now: new Date(call.savedAt) }))).then(() => store);
}

afterEach(() => vi.restoreAllMocks());

describe("the Dashboard's totals", () => {
  it("count the sample calls when the Visitor has made no Test Call", () => {
    const { totals, calls } = buildDashboard({ saved: [], now: NOW });
    expect(totals).toEqual({ answered: 5, booked: 4, spam: 2 });
    expect(calls).toHaveLength(7);
  });

  it("add the Visitor's own calls to calls answered and jobs booked, never to spam", () => {
    const saved = [testCall("call-1", 5, "Wednesday, October 7 at 9 AM"), testCall("call-2", 90, null)];
    expect(buildDashboard({ saved, now: NOW }).totals).toEqual({ answered: 7, booked: 5, spam: 2 });
  });
});

describe("the Dashboard's recent calls", () => {
  it("mix the Visitor's calls with the sample calls, newest first", () => {
    const saved = [testCall("call-1", 5, null), testCall("call-2", 400, null)];
    const { calls } = buildDashboard({ saved, now: NOW });
    expect(calls).toHaveLength(9);
    expect(calls[0]).toMatchObject({ id: "call-1", whose: "yours", spam: false, number: "04127" });
    expect(calls.find((call) => call.id === "call-2")?.whose).toBe("yours");
    const times = calls.map((call) => call.at.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("never look stale: the newest sample call is 38 minutes old on any day", () => {
    for (const now of [NOW, new Date("2027-03-15T09:30:00Z")]) {
      const newestSample = buildDashboard({ saved: [], now }).calls[0];
      expect(callTimeLabel(newestSample.at, now)).toMatch(/^(Today|Yesterday) · /);
      expect(now.getTime() - newestSample.at.getTime()).toBe(38 * 60_000);
    }
  });
});

describe("the time of a call", () => {
  it("says Today, Yesterday, the weekday, then the date", () => {
    expect(callTimeLabel(new Date("2026-10-06T15:22:00Z"), NOW)).toBe("Today · 11:22 AM");
    expect(callTimeLabel(new Date("2026-10-05T20:15:00Z"), NOW)).toBe("Yesterday · 4:15 PM");
    expect(callTimeLabel(new Date("2026-10-03T13:03:00Z"), NOW)).toBe("Sat · 9:03 AM");
    expect(callTimeLabel(new Date("2026-09-29T18:10:00Z"), NOW)).toBe("Sep 29 · 2:10 PM");
  });

  it("goes by the day in Miami, not in UTC", () => {
    // 11:30 PM Monday in Miami is already Tuesday in UTC; 10 AM Monday is still "Today".
    expect(callTimeLabel(new Date("2026-10-05T14:00:00Z"), new Date("2026-10-06T03:30:00Z"))).toBe("Today · 10:00 AM");
  });
});

describe("a Visitor's own calls", () => {
  it("are only theirs", async () => {
    const store = await storeWith([VISITOR_A, testCall("call-a", 5, null)], [VISITOR_B, testCall("call-b", 5, null)]);
    expect((await savedCallsFor({ visitorId: VISITOR_A, store })).map((call) => call.callId)).toEqual(["call-a"]);
  });

  it("are none when Redis is not set up or is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const down = createCallNotesStore({ storage: fakeNotesStorage({ failing: true }).storage, prefix: "avr:test:" });
    expect(await savedCallsFor({ visitorId: VISITOR_A, store: null })).toEqual([]);
    expect(await savedCallsFor({ visitorId: VISITOR_A, store: down })).toEqual([]);
  });
});

describe("opening one call", () => {
  it("finds any sample call, for any Visitor", async () => {
    const call = await findDashboardCall({ callId: "sample-leak", visitorId: VISITOR_B, now: NOW, store: null });
    expect(call).toMatchObject({ id: "sample-leak", whose: "sample", number: "04120" });
  });

  it("finds the Visitor's own call", async () => {
    const store = await storeWith([VISITOR_A, testCall("call-a", 5, null)]);
    const call = await findDashboardCall({ callId: "call-a", visitorId: VISITOR_A, now: NOW, store });
    expect(call).toMatchObject({ id: "call-a", whose: "yours", spam: false, number: "04127" });
    expect(call?.notes.details.name).toBe("Rosa Diaz");
  });

  it("does not find another Visitor's call", async () => {
    const store = await storeWith([VISITOR_A, testCall("call-a", 5, null)]);
    expect(await findDashboardCall({ callId: "call-a", visitorId: VISITOR_B, now: NOW, store })).toBeNull();
  });

  it("does not find a call ID with odd characters, or any call when Redis is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const store = await storeWith([VISITOR_A, testCall("call-a", 5, null)]);
    for (const callId of ["../x", "a:b", "", "a".repeat(65)]) {
      expect(await findDashboardCall({ callId, visitorId: VISITOR_A, now: NOW, store })).toBeNull();
    }
    const down = createCallNotesStore({ storage: fakeNotesStorage({ failing: true }).storage, prefix: "avr:test:" });
    expect(await findDashboardCall({ callId: "call-a", visitorId: VISITOR_A, now: NOW, store: down })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run lib/__tests__/dashboard.test.ts`
Expected: FAIL, "Cannot find module '@/lib/dashboard'" (or similar).

- [ ] **Step 3: Write the Dashboard data**

Create `lib/dashboard.ts`:

```ts
// The Dashboard's data (spec module 9): the sample calls plus the Visitor's
// own saved Call Notes, newest first, and the three totals counted from that
// mix. "Calls answered" leaves spam out, so the totals do not overlap.
// "Spam blocked" comes from sample calls only: a Test Call is never spam.

import type { CallNotesStore, SavedCallNotes } from "@/lib/call-notes-store";
import type { CallNotes } from "@/lib/call-story";
import { TIME_ZONE, localDate } from "@/lib/calendar-day";
import { TEST_CALL_TICKET } from "@/lib/sample-business";
import { sampleCalls, type SampleCall } from "@/lib/sample-calls";

export type DashboardCall = {
  readonly id: string;
  readonly at: Date;
  readonly whose: "sample" | "yours";
  readonly spam: boolean;
  /** The ticket number printed on its Call Notes. */
  readonly number: string;
  readonly notes: CallNotes;
};

export type Totals = { readonly answered: number; readonly booked: number; readonly spam: number };

const fromSample = (call: SampleCall): DashboardCall => ({ ...call, whose: "sample" });

const fromSaved = (saved: SavedCallNotes): DashboardCall => ({
  id: saved.callId,
  at: new Date(saved.savedAt),
  whose: "yours",
  spam: false,
  number: TEST_CALL_TICKET,
  notes: saved.notes,
});

export function buildDashboard({ saved, now }: { saved: readonly SavedCallNotes[]; now: Date }): { totals: Totals; calls: DashboardCall[] } {
  const calls = [...saved.map(fromSaved), ...sampleCalls(now).map(fromSample)].sort((a, b) => b.at.getTime() - a.at.getTime());
  const real = calls.filter((call) => !call.spam);
  return {
    totals: { answered: real.length, booked: real.filter((call) => call.notes.booked).length, spam: calls.length - real.length },
    calls,
  };
}

const clock = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" });
const weekday = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "short" });
const monthDay = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, month: "short", day: "numeric" });

/** The day in Miami, as a whole number of days. */
function dayNumber(date: Date): number {
  const { year, month, day } = localDate(date);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

/** "Today · 11:22 AM", "Yesterday · 4:15 PM", "Sat · 9:03 AM", "Sep 29 · 2:10 PM". Days are Miami days. */
export function callTimeLabel(at: Date, now: Date): string {
  const daysAgo = dayNumber(now) - dayNumber(at);
  const day = daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : daysAgo < 6 ? weekday.format(at) : monthDay.format(at);
  // Intl may put a narrow no-break space before AM/PM: make it a plain space.
  return `${day} · ${clock.format(at).replace(/\s/g, " ")}`;
}

/** The Visitor's saved Call Notes, newest first. None when Redis is not set up or is down. */
export async function savedCallsFor({ visitorId, store }: { visitorId: string; store: CallNotesStore | null }): Promise<SavedCallNotes[]> {
  if (!store) return [];
  try {
    return await store.list({ visitorId });
  } catch (error) {
    console.error("Dashboard: could not read the Visitor's calls.", error instanceof Error ? error.message : error);
    return [];
  }
}

const CALL_ID = /^[A-Za-z0-9-]{1,64}$/;

/** One call on the Dashboard: any sample call, or one of the Visitor's own. Null otherwise. */
export async function findDashboardCall({
  callId,
  visitorId,
  now,
  store,
}: {
  callId: string;
  visitorId: string;
  now: Date;
  store: CallNotesStore | null;
}): Promise<DashboardCall | null> {
  const sample = sampleCalls(now).find((call) => call.id === callId);
  if (sample) return fromSample(sample);
  if (!store || !CALL_ID.test(callId)) return null;
  try {
    const saved = await store.get({ visitorId, callId });
    return saved ? fromSaved(saved) : null;
  } catch (error) {
    console.error("Dashboard: could not read a call.", error instanceof Error ? error.message : error);
    return null;
  }
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run lib/__tests__/dashboard.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

Run `npm run test:unit` once (all pass), then:

```bash
git add lib/dashboard.ts lib/__tests__/dashboard.test.ts
git commit -m "Dashboard data: the mix, the totals, the time of a call, and one call per Visitor" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: One Call Notes sheet, and a way to the Dashboard

Moves the Call Notes sheet out of the call screen with no change to how it looks, adds `FormLink`, and puts "Open the Dashboard" on the Call Notes after a call. No unit tests (a screen); `npm run typecheck` and the browser check in Task 5.

**Files:**
- Create: `app/_ui/call-notes.tsx`
- Modify: `app/_ui/ticket.tsx` (the `FormButton` function)
- Modify: `app/demo/call-screen.tsx`

**Interfaces:**
- Consumes: `TEST_CALL_TICKET` from Task 1.
- Produces:
  - `export function FormLink({ href, children }: { href: string; children: ReactNode })` in `@/app/_ui/ticket`.
  - In `@/app/_ui/call-notes`: `DETAIL_LABELS`, `SECTION_LABEL`, `formatTime(ms: number): string`, `type NotesState = "sample" | "waiting" | "late" | "saved"`, and
    `export function CallNotesSheet(props: { notes: CallNotes; state: NotesState; number: string; spam?: boolean; when?: string; actions: ReactNode })`.

- [ ] **Step 1: Add `FormLink` to `app/_ui/ticket.tsx`**

Add `import Link from "next/link";` under the existing `import type { ReactNode } from "react";`. Replace the whole `FormButton` function (from its `/** A quieter control: printed outline, same ink. */` comment to its closing brace) with:

```tsx
const FORM_BUTTON =
  "inline-flex min-h-12 items-center justify-center border-2 border-form px-5 font-form text-lg font-bold tracking-wide text-form uppercase hover:bg-form hover:text-sheet";

/** A quieter control: printed outline, same ink. */
export function FormButton({ children, onClick, autoFocus }: { children: ReactNode; onClick: () => void; autoFocus?: boolean }) {
  return (
    <button type="button" onClick={onClick} autoFocus={autoFocus} className={FORM_BUTTON}>
      {children}
    </button>
  );
}

/** A link to another screen. It looks exactly like a Form Button. */
export function FormLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={FORM_BUTTON}>
      {children}
    </Link>
  );
}
```

- [ ] **Step 2: Create `app/_ui/call-notes.tsx`**

The body is the current `OwnersCopy` from `app/demo/call-screen.tsx`, with four changes: the ticket number comes from `number`; `when` is printed before the end reason; a spam call shows "Spam blocked" in place of the text preview and drops the calendar line; the buttons come from `actions`.

```tsx
"use client";

// The Call Notes: the yellow Owner's copy (DESIGN.md). The call screen shows
// it when a call ends; the Dashboard shows it for any call in its list.

import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { Field, Transcript } from "@/app/_ui/ticket";
import { DETAIL_FIELDS, type CallDetails, type CallNotes } from "@/lib/call-story";
import { SAMPLE_BUSINESS } from "@/lib/sample-business";

export const DETAIL_LABELS: Record<keyof CallDetails, string> = {
  name: "Name",
  job: "Job",
  urgency: "Urgency",
  address: "Address",
};

const END_REASONS = {
  "caller-hung-up": "Caller hung up",
  "receptionist-finished": "Receptionist finished",
  "time-limit": "Time limit reached",
  error: "Call failed",
} as const;

export const SECTION_LABEL = "font-form text-sm leading-tight font-bold tracking-wider text-form uppercase";

export function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * `sample`: notes shown whole at once (the Sample Call, a Dashboard sample
 * call). A Test Call's notes start as `waiting` (the browser's own copy, the
 * summary still being written), become `saved` when the server's copy
 * arrives, or `late` if it never does.
 */
export type NotesState = "sample" | "waiting" | "late" | "saved";

export function CallNotesSheet({
  notes,
  state,
  number,
  spam = false,
  when,
  actions,
}: {
  notes: CallNotes;
  state: NotesState;
  /** The ticket number printed in the header. */
  number: string;
  /** A spam call: no text to the caller, nothing for the calendar. */
  spam?: boolean;
  /** When the call came in, for example "Today · 11:22 AM". */
  when?: string;
  actions: ReactNode;
}) {
  const title = useRef<HTMLHeadingElement>(null);
  const [summaryId, textId, talkId] = [useId(), useId(), useId()];

  // The white sheet comes off from the top: start the Owner's copy there,
  // and move focus to its title so the change is announced. Before paint, so
  // the copy never shows at the old scroll position.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0 });
    title.current?.focus({ preventScroll: true });
  }, []);

  return (
    <article aria-label="Call Notes" className="copy-still mx-auto max-w-[960px]">
      <div className="perforation mb-4" />
      <header className="text-form">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 border-2 border-form px-5 pt-3 pb-2.5">
          <h1 ref={title} tabIndex={-1} className="font-form text-[2.25rem] leading-none font-extrabold tracking-tight uppercase">
            Call Notes
          </h1>
          <p className="font-form text-lg leading-none font-bold uppercase">
            Owner&apos;s copy · No. {number}
          </p>
        </div>
        <p className="border-x-2 border-b-2 border-form px-5 py-1.5 font-form text-[0.9375rem] font-semibold tracking-wide uppercase">
          {SAMPLE_BUSINESS.name} · {SAMPLE_BUSINESS.trade} · {SAMPLE_BUSINESS.area}
        </p>
      </header>

      <div className="grid gap-x-12 gap-y-8 pt-6 md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="grid content-start gap-8">
          <section aria-labelledby={summaryId}>
            <h2 id={summaryId} className={SECTION_LABEL}>
              Summary
            </h2>
            <p className="mt-2 max-w-[44ch] text-[1.375rem] leading-snug font-medium text-balance">
              {state === "waiting"
                ? "Finishing the summary…"
                : state === "late"
                  ? "The summary did not arrive. The details below are from the call."
                  : notes.summary}
            </p>
            <p className="mt-3 text-print-soft">
              {when && `${when}. `}
              {END_REASONS[notes.endReason]} after {formatTime(notes.durationMs)}.
            </p>
            {state === "saved" && <p className="mt-1 text-print-soft">Saved. Our copy is deleted after 7 days.</p>}
          </section>

          <dl className="grid gap-4 [&_dd]:border-form">
            {DETAIL_FIELDS.map((field) => (
              <Field key={field} label={DETAIL_LABELS[field]} value={notes.details[field]} empty="Not captured" />
            ))}
            <Field label="Booked" value={notes.booked} empty="Nothing booked" />
            <Field label="Taken by" value={`${SAMPLE_BUSINESS.receptionistName}, Receptionist`} />
          </dl>
          {!spam && <p className="text-print-soft">In a real setup, the booking lands in the business&apos;s calendar.</p>}
        </div>

        <div className="grid content-start gap-8">
          {spam ? (
            <section aria-labelledby={textId} className="border-2 border-form p-5">
              <h2 id={textId} className={SECTION_LABEL}>
                Spam blocked
              </h2>
              <p className="mt-2 text-[1.0625rem] leading-relaxed">
                {SAMPLE_BUSINESS.receptionistName} ended the call. No text goes to a spam caller.
              </p>
            </section>
          ) : (
            <section aria-labelledby={textId} className="border-2 border-form p-5">
              <h2 id={textId} className={SECTION_LABEL}>
                Text to the caller · preview
              </h2>
              <p className="mt-2 text-[1.0625rem] leading-relaxed">{notes.confirmationText}</p>
              <p className="mt-4 border-t border-form pt-3 text-sm text-print-soft">Not available in the demo. Nothing is sent.</p>
            </section>
          )}

          <section aria-labelledby={talkId}>
            <h2 id={talkId} className={`${SECTION_LABEL} mb-4`}>
              What was said
            </h2>
            <Transcript lines={notes.lines} receptionistName={SAMPLE_BUSINESS.receptionistName} />
          </section>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap gap-3 border-t-2 border-form pt-6">{actions}</div>
    </article>
  );
}
```

- [ ] **Step 3: Use the shared sheet in `app/demo/call-screen.tsx`**

1. In the imports: change the `react` import to `import { useEffect, useId, useRef, useState, type ReactNode } from "react";` (`useLayoutEffect` moved out). Add `FormLink` to the `@/app/_ui/ticket` import list. Add:
   ```tsx
   import { CallNotesSheet, DETAIL_LABELS, SECTION_LABEL, formatTime } from "@/app/_ui/call-notes";
   ```
   Change the `@/lib/call-story` import to `import { DETAIL_FIELDS, tellCallStory, type CallEvent, type CallNotes, type CallView } from "@/lib/call-story";`.
   Change the `@/lib/sample-business` import to `import { SAMPLE_BUSINESS, TEST_CALL_TICKET } from "@/lib/sample-business";`.
2. Delete the local `DETAIL_LABELS`, `END_REASONS`, `SECTION_LABEL` and `formatTime` definitions, and the `TICKET_NUMBER` constant with its comment.
3. Replace the two `TICKET_NUMBER` uses in `TopSheet` with `TEST_CALL_TICKET`.
4. Replace the `<OwnersCopy ... />` element with:
   ```tsx
   <CallNotesSheet
     notes={saved.kind === "ready" ? saved.notes : notes}
     state={mode === "sample" ? "sample" : saved.kind === "ready" ? "saved" : saved.kind}
     number={TEST_CALL_TICKET}
     actions={
       <>
         <FormButton onClick={() => begin(mode)}>{mode === "test" ? "Make another Test Call" : "Play the Sample Call again"}</FormButton>
         <FormLink href="/demo/dashboard">Open the Dashboard</FormLink>
       </>
     }
   />
   ```
5. Delete the `NotesState` type, its doc comment, and the whole `OwnersCopy` function at the bottom of the file.

- [ ] **Step 4: Check the types**

Run: `npm run typecheck`
Expected: no errors. If `useId` or another import is now unused, the typecheck does not fail on it; remove any unused import by hand.

- [ ] **Step 5: Commit**

Run `npm run test:unit` once (all pass), then:

```bash
git add app/_ui/call-notes.tsx app/_ui/ticket.tsx app/demo/call-screen.tsx
git commit -m "One Call Notes sheet for the call screen and the Dashboard; Call Notes open the Dashboard" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The Dashboard screens

**Files:**
- Create: `lib/server-notes-store.ts`
- Create: `app/demo/dashboard/answering-switch.tsx`
- Create: `app/demo/dashboard/page.tsx`
- Create: `app/demo/dashboard/[callId]/page.tsx`
- Modify: `DESIGN.md`

**Interfaces:**
- Consumes: `buildDashboard`, `callTimeLabel`, `savedCallsFor`, `findDashboardCall`, `DashboardCall` (Task 2); `CallNotesSheet`, `SECTION_LABEL` (Task 3); `DemoBanner`, `FormLink` from `@/app/_ui/ticket`; `VISITOR_COOKIE`, `isVisitorId` from `@/lib/visitor`.
- Produces: `export function serverNotesStore(): CallNotesStore | null`; the routes `/demo/dashboard` and `/demo/dashboard/[callId]`.

- [ ] **Step 1: The store on the server**

Create `lib/server-notes-store.ts`:

```ts
import "server-only";
import { createCallNotesStore, type CallNotesStore } from "@/lib/call-notes-store";
import { redisNotesStorage } from "@/lib/redis-notes-storage";
import { keyPrefix } from "@/lib/server-env";

/** The Call Notes store on Redis, or null when Redis is not set up here. */
export function serverNotesStore(): CallNotesStore | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error("Dashboard: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing.");
    return null;
  }
  return createCallNotesStore({ storage: redisNotesStorage(), prefix: keyPrefix() });
}
```

- [ ] **Step 2: The answering switch**

Create `app/demo/dashboard/answering-switch.tsx`:

```tsx
"use client";

// The answering status and its switch. In the demo it changes only this
// screen: nothing is sent anywhere, and the next visit starts "on" again.

import { useId, useState } from "react";
import { SAMPLE_BUSINESS } from "@/lib/sample-business";

export function AnsweringSwitch() {
  const [on, setOn] = useState(true);
  const noteId = useId();
  const name = SAMPLE_BUSINESS.receptionistName;

  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-y-2 border-form py-3">
      <p className="flex items-center gap-3 font-form text-2xl font-bold uppercase">
        {/* The lamp: solid while answering, a red ring when not. */}
        <span aria-hidden="true" className={`inline-block size-3 rounded-full border-2 border-form ${on ? "bg-form" : ""}`} />
        {on ? "Answering" : "Not answering"}
      </p>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-describedby={noteId}
        onClick={() => setOn((value) => !value)}
        className="ml-auto inline-flex min-h-12 items-center gap-3 font-form text-lg font-bold tracking-wide text-form uppercase"
      >
        <span className="sr-only">{name} answers calls</span>
        <span aria-hidden="true" className={`flex h-7 w-12 border-2 border-form p-0.5 ${on ? "justify-end bg-form" : "justify-start"}`}>
          <span className={`block aspect-square h-full ${on ? "bg-sheet" : "bg-form"}`} />
        </span>
        <span aria-hidden="true" className="w-8 text-left">
          {on ? "On" : "Off"}
        </span>
      </button>
      <p id={noteId} className="w-full text-sm text-print-soft">
        {on ? `${name} answers every call.` : "Calls would go to voicemail."} In the demo, this switch changes only this screen.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: The Dashboard page**

Create `app/demo/dashboard/page.tsx`:

```tsx
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SECTION_LABEL } from "@/app/_ui/call-notes";
import { DemoBanner, FormLink } from "@/app/_ui/ticket";
import { buildDashboard, callTimeLabel, savedCallsFor, type DashboardCall } from "@/lib/dashboard";
import { SAMPLE_BUSINESS } from "@/lib/sample-business";
import { serverNotesStore } from "@/lib/server-notes-store";
import { VISITOR_COOKIE, isVisitorId } from "@/lib/visitor";
import { AnsweringSwitch } from "./answering-switch";

export const metadata: Metadata = {
  title: "Dashboard · AI Voice Receptionist",
  robots: { index: false, follow: false },
};

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default async function DashboardPage() {
  const visitorId = (await cookies()).get(VISITOR_COOKIE)?.value;
  if (!isVisitorId(visitorId)) redirect("/");

  const now = new Date();
  const saved = await savedCallsFor({ visitorId, store: serverNotesStore() });
  const { totals, calls } = buildDashboard({ saved, now });

  return (
    <>
      <DemoBanner />
      <main className="mx-auto max-w-[960px] px-4 pt-4 pb-10 md:pt-12">
        <header className="text-form">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 border-2 border-form px-5 pt-3 pb-2.5">
            <h1 className="font-form text-[2.25rem] leading-none font-extrabold tracking-tight uppercase">Dashboard</h1>
            <p className="font-form text-lg leading-none font-bold uppercase">Owner&apos;s view</p>
          </div>
          <p className="border-x-2 border-b-2 border-form px-5 py-1.5 font-form text-[0.9375rem] font-semibold tracking-wide uppercase">
            {SAMPLE_BUSINESS.name} · {SAMPLE_BUSINESS.trade} · {SAMPLE_BUSINESS.area}
          </p>
        </header>

        <p className="mt-6 max-w-[44ch] text-[1.375rem] leading-snug font-medium text-balance">
          While you worked, {SAMPLE_BUSINESS.receptionistName} answered {count(totals.answered, "call")} and booked{" "}
          {count(totals.booked, "job")}.
        </p>

        <AnsweringSwitch />

        <dl aria-label="Totals" className="mt-6 grid grid-cols-3 divide-x-2 divide-form border-2 border-form">
          <Total label="Calls answered" value={totals.answered} />
          <Total label="Jobs booked" value={totals.booked} />
          <Total label="Spam blocked" value={totals.spam} />
        </dl>

        <section aria-labelledby="recent-calls" className="mt-8">
          <h2 id="recent-calls" className={`${SECTION_LABEL} border-b-2 border-form pb-2`}>
            Recent calls
          </h2>
          <ol>
            {calls.map((call) => (
              <li key={call.id} className="border-b border-form">
                <CallRow call={call} when={callTimeLabel(call.at, now)} />
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-10 flex flex-wrap gap-3 border-t-2 border-form pt-6">
          <FormLink href="/demo">Make a Test Call</FormLink>
        </div>
      </main>
    </>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid content-start gap-1 px-3 py-3 md:px-5">
      <dt className={SECTION_LABEL}>{label}</dt>
      <dd className="font-form text-[2.25rem] leading-none font-extrabold">{value}</dd>
    </div>
  );
}

function CallRow({ call, when }: { call: DashboardCall; when: string }) {
  const caller = call.spam ? "Spam call" : (call.notes.details.name ?? "Unknown caller");
  const job = call.spam ? `Blocked by ${SAMPLE_BUSINESS.receptionistName}` : (call.notes.details.job ?? "No job captured");
  return (
    <Link href={`/demo/dashboard/${call.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 px-1 py-3 hover:bg-form/5">
      <span className="grid gap-0.5">
        <span className="text-sm text-print-soft">{when}</span>
        <span className="text-[1.0625rem] font-semibold">{caller}</span>
        <span className="text-print-soft first-letter:uppercase">{job}</span>
      </span>
      <span className="flex flex-col items-end gap-1 pt-0.5">
        {call.whose === "yours" && <Mark filled>Your call</Mark>}
        {call.notes.booked && <Mark>Booked</Mark>}
        {call.spam && <Mark>Spam</Mark>}
      </span>
    </Link>
  );
}

/** A small square mark printed beside a call. */
function Mark({ children, filled = false }: { children: string; filled?: boolean }) {
  return (
    <span
      className={`border-2 border-form px-1.5 font-form text-sm leading-tight font-bold tracking-wider whitespace-nowrap uppercase ${filled ? "bg-form text-sheet" : "text-form"}`}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 4: One call's Call Notes**

Create `app/demo/dashboard/[callId]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CallNotesSheet } from "@/app/_ui/call-notes";
import { DemoBanner, FormLink } from "@/app/_ui/ticket";
import { callTimeLabel, findDashboardCall } from "@/lib/dashboard";
import { serverNotesStore } from "@/lib/server-notes-store";
import { VISITOR_COOKIE, isVisitorId } from "@/lib/visitor";

export const metadata: Metadata = {
  title: "Call Notes · AI Voice Receptionist",
  robots: { index: false, follow: false },
};

export default async function DashboardCallPage({ params }: { params: Promise<{ callId: string }> }) {
  const visitorId = (await cookies()).get(VISITOR_COOKIE)?.value;
  if (!isVisitorId(visitorId)) redirect("/");

  const { callId } = await params;
  const now = new Date();
  // Only a sample call or one of this Visitor's own: anything else is "not found".
  const call = await findDashboardCall({ callId, visitorId, now, store: serverNotesStore() });
  if (!call) notFound();

  return (
    <>
      <DemoBanner />
      <main className="mx-auto max-w-[1200px] px-4 pt-4 pb-10 md:pt-12">
        <CallNotesSheet
          notes={call.notes}
          state={call.whose === "yours" ? "saved" : "sample"}
          number={call.number}
          spam={call.spam}
          when={callTimeLabel(call.at, now)}
          actions={
            <>
              <FormLink href="/demo/dashboard">Back to the Dashboard</FormLink>
              <FormLink href="/demo">Make a Test Call</FormLink>
            </>
          }
        />
      </main>
    </>
  );
}
```

- [ ] **Step 5: Record the components in `DESIGN.md`**

In `DESIGN.md`, under `### Buttons (call controls)`, after the `- **Form Button (secondary):** ...` line, add:

```markdown
- **Form Link:** a link to another screen ("Open the Dashboard", "Make a Test Call"). It looks exactly like a Form Button.
```

Then, after the `### Perforation` section (before `### Motion`), add:

```markdown
### Dashboard (the Owner's view)
The yellow copy as a 960px page with no white sheet: the Owner reads it; nothing is being written. The outlined header says "Dashboard" with "Owner's view" at right, over the business line. One Body Lead line says what the Receptionist handled. The answering row sits between two 2px red rules: the lamp (solid red while answering, a red ring when not), the status in Title caps, and a square switch at right (2px red frame and a square knob; filled red when on). A Small line in Print Soft says the switch changes only this screen. The three totals are one outlined box split in three by 2px red rules: a red Label over a Form 800 number at 2.25rem in Print Black. Recent calls are rows ruled in 1px solid red, each a link: the time in Small Print Soft, the caller in Body 600, the job in Print Soft, and square marks at right in red Label caps ("Booked", "Spam" outlined; "Your call" filled red with white caps). Hover tints a row with 5% red. A call opens on its own page as the Owner's copy, with its time before the end reason. A spam call's copy shows "Spam blocked" where the text preview would be.
```

- [ ] **Step 6: Check the types**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

Run `npm run test:unit` once (all pass), then:

```bash
git add lib/server-notes-store.ts app/demo/dashboard DESIGN.md
git commit -m "The Dashboard: answering switch, three totals, recent calls that open their Call Notes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Check it in the browser pane

No code unless the check finds a fault. The founder does not open anything: the agent checks and sends screenshots.

- [ ] **Step 1: Start the dev server**

Use `preview_start` with `{ name: "dev" }` (from `.claude/launch.json`; it takes any free port). Note the port it reports. Never use `localhost:3000` by habit.

- [ ] **Step 2: Become a Visitor**

Navigate to `/` on that port and click "Try the demo". The server sets the `avr_visitor` cookie and opens `/demo`.

- [ ] **Step 3: Check the Dashboard at phone width**

`resize_window` with preset `mobile`. Navigate to `/demo/dashboard`. Check, with `read_page` and `read_console_messages`:
- Header "Dashboard", the Body Lead line ("While you worked, Luna answered 5 calls and booked 4 jobs." when the Visitor has no saved call).
- Totals 5, 4, 2. The three boxes fit at 375px with no side scroll (`document.documentElement.scrollWidth <= innerWidth` via `javascript_tool`).
- 7 rows, newest first; the first says "Today · …" or "Yesterday · …".
- Clicking the switch flips "Answering" to "Not answering" and `aria-checked` to `false`.
- No console errors, no hydration warnings.
Take a screenshot.

- [ ] **Step 4: Open calls**

Click the first row (a booked call): the Call Notes show its time, "Booked" filled, a text preview, "Back to the Dashboard". Go back; open a spam row: "Spam blocked" in place of the preview, no calendar line. Navigate to `/demo/dashboard/not-a-real-call`: the 404 page. Take a screenshot of one Call Notes page.

- [ ] **Step 5: Check desktop width**

`resize_window` with preset `desktop`. Reload `/demo/dashboard`. Take a screenshot. Check the page is 960px wide and centred.

- [ ] **Step 6: The way in from a call**

Navigate to `/demo` and press "Play the Sample Call". Let it play to the end (it plays in real time; wait with `computer` `wait` steps and `find` "Call Notes"). On its Call Notes, check both buttons show: "Play the Sample Call again" and "Open the Dashboard". Click "Open the Dashboard". It must land on `/demo/dashboard`.

- [ ] **Step 7: Check the motion rule**

`javascript_tool`: `getComputedStyle(document.querySelector('[role=switch]')).transitionDuration` is `0s` (no new motion).

- [ ] **Step 8: Finish**

Run `npm run test:unit` and `npm run typecheck` once more. Fix and commit anything the check found. Tell the founder the branch is ready for a PR, and that pushing makes a Vercel Preview, not production.
