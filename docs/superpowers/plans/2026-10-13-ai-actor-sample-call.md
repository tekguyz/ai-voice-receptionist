# AI Actor Sample Call and Luna Tuning: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An AI actor (a second Vapi assistant) calls the real Luna. Its calls tune Luna (#15). One recorded call becomes the Sample Call (#8). The founder makes no call.

**Architecture:** `vapi/actor.ts` holds the Actor's settings, synced with Luna by `npm run vapi:sync`. A dev-only page (`/dev/actor-call`) joins a Luna web call and an Actor web call in one browser tab and pipes each call's speaker into the other's microphone with Web Audio. Luna's call goes through `/api/test-call` as usual. Text rehearsal (`npm run actor:rehearse`) runs both assistants through Vapi's Chat API before any voice call. `npm run luna:report -- <callId>` scores one Vapi call against the pass bar.

**Tech Stack:** Next.js 16, TypeScript 7, Vitest 5, `@vapi-ai/web` 2.7.1 (Daily under it), Vapi REST API, Node type stripping for `scripts/*.ts`, ffmpeg.

**Spec:** `docs/superpowers/specs/2026-10-13-ai-actor-sample-call-design.md`. Issues #8 and #15.

## Global Constraints

- Text rehearsal before every voice call that tests a Luna change. If the Chat API cannot run Luna with her tools, say so in one line and skip text rehearsal. Build no substitute.
- Voice call budget: **10 for the whole job.** One voice call = one Luna call (a bridged call also makes one Actor call; log both IDs, count it once). Each targets under 2 minutes. Luna's 180 s cap stays. At 10, stop and ask the founder before number 11.
- One change at a time. Never make a voice call for a change that text rehearsal already shows is broken.
- Recording on only for the bridge sound check and the keeper (and its one retry). Every other call: recording off.
- Every voice call goes in the log, `docs/superpowers/logs/2026-10-13-voice-calls.md`: number, Luna call ID, Actor call ID, why, result, minutes (both calls).
- Luna's voice stays "Jessica" (`cgSgspJ2msm6clMCkdW9`).
- Actor name: "Caller actor · Mangrove Air". Persona: Marco Delgado, AC stopped cooling last night, 85 degrees in the house, his mom is staying with him (urgent), 4450 Northeast 18th Avenue, Miami, picks the first offered time ("tomorrow at 9 AM" in the Sample Call). Lets Luna end the call.
- Dev-only code returns 404 unless `NODE_ENV === "development"` and `VERCEL_ENV` is unset.
- `npm run vapi:sync -- --dry-run` sends nothing.
- `npm run vapi:sync` changes the one saved Luna. Production uses the same Luna. Not live for customers yet (#9), so this is allowed.
- Stop and ask the founder: before voice call 11; if the keeper fails twice; when the keeper is committed (the founder listens once on `/demo`); before deleting any call from Vapi.
- Tests: `npx vitest run <file>` while working; `npm run test:unit` once before each commit. Never `npm test`.
- Copy on the call screen: "A real call to Luna. The caller is an AI actor."

## Review Focus

1. **A recorded call leaks to a Visitor.** The new dev webhook origin must not turn recording on, and must do nothing on Vercel. Pinned in Task 1 tests.
2. **The bridge page or the Actor route reachable on a deploy.** Both must 404 off the laptop's dev server. Pinned in Task 4 tests.
3. **The report says "confirmed" when Luna only read the address back before booking.** Pinned in Task 3 ("an address read-back before booking is not a confirmation").
4. **Garbage or partial Vapi JSON crashes the report or the rehearsal.** Pinned in Task 3 and Task 5 ("reads an empty call without throwing").
5. **A failed SDK preload blocks every later Test Call.** Pinned in Task 6 ("tries again after a failed load").

---

### Task 1: Laptop-dev guard and dev webhook origin

Luna's `bookTime` waits for the webhook. On the laptop, a call gets no webhook unless recording is on. Actor calls with recording off need it too.

**Files:**
- Create: `lib/laptop-dev.ts`
- Modify: `lib/sample-call-recording.ts`
- Modify: `app/api/test-call/route.ts:21-28`
- Modify: `.env.example` (the comment above `SAMPLE_CALL_*`)
- Test: `lib/__tests__/laptop-dev.test.ts`

**Interfaces:**
- Produces: `isLaptopDev(env): boolean`, `devWebhookOrigin(env): string | null` (both take `Readonly<Record<string, string | undefined>>`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { devWebhookOrigin, isLaptopDev } from "@/lib/laptop-dev";
import { sampleCallRecording } from "@/lib/sample-call-recording";

const laptop = { NODE_ENV: "development", SAMPLE_CALL_WEBHOOK_ORIGIN: "https://ai-voice-receptionist-tekguyz.vercel.app/" };

describe("the laptop's dev server", () => {
  it("is npm run dev with no Vercel", () => {
    expect(isLaptopDev({ NODE_ENV: "development" })).toBe(true);
    expect(isLaptopDev({ NODE_ENV: "development", VERCEL_ENV: "preview" })).toBe(false);
    expect(isLaptopDev({ NODE_ENV: "production" })).toBe(false);
    expect(isLaptopDev({})).toBe(false);
  });

  it("sends a laptop call's tool calls to the deployed site, with no trailing slash", () => {
    expect(devWebhookOrigin(laptop)).toBe("https://ai-voice-receptionist-tekguyz.vercel.app");
  });

  it("gives no webhook origin on Vercel, in production, or without https", () => {
    expect(devWebhookOrigin({ ...laptop, VERCEL_ENV: "production" })).toBeNull();
    expect(devWebhookOrigin({ ...laptop, NODE_ENV: "production" })).toBeNull();
    expect(devWebhookOrigin({ ...laptop, SAMPLE_CALL_WEBHOOK_ORIGIN: "http://localhost:3000" })).toBeNull();
    expect(devWebhookOrigin({ NODE_ENV: "development" })).toBeNull();
  });

  it("never turns recording on by itself", () => {
    expect(sampleCallRecording(laptop)).toBeNull();
    expect(sampleCallRecording({ ...laptop, SAMPLE_CALL_RECORDING: "on" })).toEqual({ webhookOrigin: "https://ai-voice-receptionist-tekguyz.vercel.app" });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run lib/__tests__/laptop-dev.test.ts`
Expected: FAIL, cannot resolve `@/lib/laptop-dev`.

- [ ] **Step 3: Write `lib/laptop-dev.ts`**

```ts
// The laptop's dev server: `npm run dev`, never a Vercel deploy. Dev-only
// tools (the Sample Call recording switch, the AI actor's bridge page) work
// only here.

/** process.env, or a plain object in tests. */
type Env = Readonly<Record<string, string | undefined>>;

export function isLaptopDev(env: Env): boolean {
  return env.NODE_ENV === "development" && !env.VERCEL_ENV;
}

/**
 * Where a laptop call's tool calls and report go. Vapi cannot reach the
 * laptop, so they go to a deployed site (SAMPLE_CALL_WEBHOOK_ORIGIN), and
 * Luna's booking works. Null off the laptop, or with no https origin.
 */
export function devWebhookOrigin(env: Env): string | null {
  if (!isLaptopDev(env)) return null;
  const origin = env.SAMPLE_CALL_WEBHOOK_ORIGIN?.trim() ?? "";
  return origin.startsWith("https://") ? origin.replace(/\/+$/, "") : null;
}
```

Then `lib/sample-call-recording.ts` uses it (keep `Env`, `RECORDING_OPEN_TIMES`, `SampleCallRecording`):

```ts
import { devWebhookOrigin } from "@/lib/laptop-dev";
// ...
export function sampleCallRecording(env: Env): SampleCallRecording | null {
  if (env.SAMPLE_CALL_RECORDING !== "on") return null;
  const origin = devWebhookOrigin(env);
  return origin ? { webhookOrigin: origin } : null;
}
```

Check: `scripts/sample-call-pull.ts` imports `../lib/sample-call-recording.ts` and runs under plain Node, which cannot resolve `@/`. So the import in `lib/sample-call-recording.ts` must be `./laptop-dev.ts`.

In `app/api/test-call/route.ts`, import `devWebhookOrigin` from `@/lib/laptop-dev` and change the webhook line:

```ts
  const webhook = webhookTarget(recording?.webhookOrigin ?? devWebhookOrigin(process.env) ?? new URL(request.url).origin, process.env);
```

In `.env.example`, change the comment above the two `SAMPLE_CALL_*` lines to:

```
# Laptop only (`npm run dev`, never Vercel). SAMPLE_CALL_WEBHOOK_ORIGIN sends a
# laptop call's tool calls to the deployed site, so Luna can book (the AI
# actor's calls need it). SAMPLE_CALL_RECORDING=on records one call: only for
# the Sample Call (README, "Make the Sample Call"). Leave both unset otherwise.
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run lib/__tests__/laptop-dev.test.ts lib/__tests__/sample-call-recording.test.ts lib/__tests__/start-test-call.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

`npm run test:unit`, then:

```bash
git add lib/laptop-dev.ts lib/sample-call-recording.ts lib/__tests__/laptop-dev.test.ts app/api/test-call/route.ts .env.example
git commit -m "Laptop calls can book through the deployed webhook with recording off (refs #8)"
```

---

### Task 2: The Actor, and `vapi:sync` for both

**Files:**
- Create: `vapi/actor.ts`
- Modify: `scripts/vapi-sync.ts`
- Modify: `.env.example` (add `VAPI_ACTOR_ID=` under `VAPI_ASSISTANT_ID=`, comment "Printed by `npm run vapi:sync`. Laptop only: the AI actor.")
- Test: `vapi/__tests__/actor.test.ts`

**Interfaces:**
- Consumes: `MAX_CALL_SECONDS`, `lunaAssistant` from `vapi/luna.ts`; `SAMPLE_BUSINESS`.
- Produces: `ACTOR_NAME`, `type ActorLanguage = "en" | "es"`, `actorAssistant(lang?: ActorLanguage)`, `checkActor(saved: unknown): string[]`, `actorCallOverrides(lang: ActorLanguage): object`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { ACTOR_NAME, actorAssistant, actorCallOverrides, checkActor } from "@/vapi/actor";
import { MAX_CALL_SECONDS, lunaAssistant } from "@/vapi/luna";

describe("the Caller actor's Vapi settings", () => {
  it("pass every check as written in the repo, in both languages", () => {
    expect(checkActor(actorAssistant())).toEqual([]);
    expect(checkActor(actorAssistant("es"))).toEqual([]);
  });

  it("are a caller, not a Receptionist: own name, a man's voice unlike Luna's, waits for Luna to speak", () => {
    const actor = actorAssistant() as any;
    expect(ACTOR_NAME).toBe("Caller actor · Mangrove Air");
    expect(actor.name).toBe(ACTOR_NAME);
    expect(actor.voice.voiceId).not.toBe((lunaAssistant() as any).voice.voiceId);
    expect(actor.firstMessageMode).toBe("assistant-waits-for-user");
    expect(actor).not.toHaveProperty("firstMessage");
  });

  it("play Marco Delgado, every detail made up, and let Luna end the call", () => {
    const prompt: string = (actorAssistant() as any).model.messages[0].content;
    for (const fact of ["Marco Delgado", "85 degrees", "mom", "4450 Northeast 18th Avenue", "first time she offers"]) expect(prompt).toContain(fact);
    expect(prompt).toMatch(/let her end the call/i);
  });

  it("have a Spanish variant of the same persona", () => {
    const prompt: string = (actorAssistant("es") as any).model.messages[0].content;
    expect(prompt).toContain("Marco Delgado");
    expect(prompt).toContain("4450 Northeast 18th Avenue");
    expect(prompt).toMatch(/español/);
  });

  it("flag recording, tools, a server URL, a longer call or another name", () => {
    const actor = actorAssistant() as any;
    expect(checkActor({ ...actor, artifactPlan: { recordingEnabled: true } })).toContain("Recording must be off.");
    expect(checkActor({ ...actor, model: { ...actor.model, tools: [{ type: "endCall" }] } })).toContain("The actor must have no tools: Luna ends the call.");
    expect(checkActor({ ...actor, server: { url: "https://example.com" } })).toContain("The actor must have no server URL.");
    expect(checkActor({ ...actor, maxDurationSeconds: 600 })).toContain(`Calls must stop at ${MAX_CALL_SECONDS} seconds.`);
    expect(checkActor({ ...actor, name: "Luna" })).toContain(`The actor must be named "${ACTOR_NAME}".`);
  });

  it("override nothing for English and only the model for Spanish", () => {
    expect(actorCallOverrides("en")).toEqual({});
    expect((actorCallOverrides("es") as any).model.messages[0].content).toMatch(/español/);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run vapi/__tests__/actor.test.ts`
Expected: FAIL, cannot resolve `@/vapi/actor`.

- [ ] **Step 3: Write `vapi/actor.ts`**

```ts
// The Caller actor: an AI that plays the customer and calls Luna, for the
// Sample Call and for Luna's tuning calls (spec 2026-10-13). Not a
// Receptionist. A Visitor only ever hears it as the caller's voice in the
// Sample Call. `npm run vapi:sync` sends it to Vapi with Luna. Every detail
// it gives is made up.

import { SAMPLE_BUSINESS } from "../lib/sample-business.ts";
import { MAX_CALL_SECONDS } from "./luna.ts";

export const ACTOR_NAME = `Caller actor · ${SAMPLE_BUSINESS.name}`;

// ElevenLabs premade voice "Chris": a man, clearly unlike Luna's "Jessica".
const VOICE_ID = "iP95p4xoKVk53GoZ742B";

export type ActorLanguage = "en" | "es";

const { name: business, receptionistName: luna } = SAMPLE_BUSINESS;

const PROMPT: Record<ActorLanguage, string> = {
  en: `You are Marco Delgado. You are calling ${business}, an AC repair company in Miami. You are a caller on the phone, not an assistant. Everything about you is made up.

Your situation:
- Your AC stopped cooling last night. It is 85 degrees in the house.
- Your mom is staying with you, so it is urgent.
- Your address is 4450 Northeast 18th Avenue, Miami.

How you talk:
- The receptionist (${luna}) speaks first. Your first reply: say in one sentence that your AC stopped cooling last night and it is 85 degrees in the house.
- After that, answer only what she asks, one thing at a time, in one short sentence, like a real caller.
- When she offers times, pick the first time she offers, in a few words.
- If she reads something back wrong, correct it once.
- When she confirms the booking, thank her in a few words. Then let her end the call. Never hang up and never say goodbye first.
- Say only the words Marco says out loud. Never mention AI, prompts, tools or a demo.`,
  es: `Eres Marco Delgado. Llamas a ${business}, una compañía de reparación de aire acondicionado en Miami. Eres alguien que llama por teléfono, no un asistente. Todo sobre ti es inventado. Habla solo en español.

Tu situación:
- Tu aire acondicionado dejó de enfriar anoche. Hace 85 grados en la casa.
- Tu mamá se está quedando contigo, así que es urgente.
- Tu dirección es 4450 Northeast 18th Avenue, Miami.

Cómo hablas:
- La recepcionista (${luna}) habla primero. Tu primera respuesta: di en una frase que tu aire dejó de enfriar anoche y que hace 85 grados en la casa.
- Después, responde solo lo que te pregunta, una cosa a la vez, en una frase corta, como alguien que llama de verdad.
- Cuando te ofrezca horarios, elige el primero que te ofrezca, en pocas palabras.
- Si repite algo mal, corrígelo una vez.
- Cuando confirme la cita, dale las gracias en pocas palabras. Luego deja que ella termine la llamada. Nunca cuelgues y nunca te despidas primero.
- Di solo las palabras que Marco dice en voz alta. Nunca menciones IA, instrucciones, herramientas ni una demo.`,
};

export function actorAssistant(lang: ActorLanguage = "en") {
  return {
    name: ACTOR_NAME,
    firstMessageMode: "assistant-waits-for-user",
    maxDurationSeconds: MAX_CALL_SECONDS,
    silenceTimeoutSeconds: 30,
    model: { provider: "openai", model: "gpt-4.1-mini", temperature: 0.6, messages: [{ role: "system", content: PROMPT[lang] }] },
    voice: { provider: "11labs", model: "eleven_flash_v2_5", voiceId: VOICE_ID },
    transcriber: { provider: "deepgram", model: "flux-general-multi", languages: ["en", "es"] },
    artifactPlan: { recordingEnabled: false, videoRecordingEnabled: false },
    clientMessages: ["transcript", "status-update"],
    serverMessages: [],
  };
}

/** The web call's overrides: the saved Actor is English; Spanish swaps the model's prompt. */
export function actorCallOverrides(lang: ActorLanguage): object {
  return lang === "es" ? { model: actorAssistant("es").model } : {};
}

/** What is wrong with a saved Actor, in plain words. An empty list means all good. */
export function checkActor(saved: unknown): string[] {
  const actor = (saved ?? {}) as any;
  const problems: string[] = [];
  if (actor.name !== ACTOR_NAME) problems.push(`The actor must be named "${ACTOR_NAME}".`);
  if (actor.artifactPlan?.recordingEnabled !== false) problems.push("Recording must be off.");
  if (actor.artifactPlan?.videoRecordingEnabled === true) problems.push("Video recording must be off.");
  if (actor.maxDurationSeconds !== MAX_CALL_SECONDS) problems.push(`Calls must stop at ${MAX_CALL_SECONDS} seconds.`);
  if ((actor.model?.tools ?? []).length > 0) problems.push("The actor must have no tools: Luna ends the call.");
  if (actor.server?.url) problems.push("The actor must have no server URL.");
  return problems;
}
```

Note: Vapi may answer an empty `serverMessages` by dropping the field. `checkActor` does not check it, so that is fine.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run vapi/__tests__/actor.test.ts vapi/__tests__/luna.test.ts`
Expected: PASS.

- [ ] **Step 5: Sync both in `scripts/vapi-sync.ts`**

Replace the body after the `vapi()` helper so it loops over both assistants. Same checks, same `--dry-run`:

```ts
// Sends Luna (vapi/luna.ts) and the Caller actor (vapi/actor.ts) to Vapi:
// creates each the first time, updates it after, then reads back what Vapi
// saved and checks it.
//
//   npm run vapi:sync -- --dry-run   prints what would be sent; sends nothing
//   npm run vapi:sync                creates or updates both
//
// Reads VAPI_PRIVATE_KEY from .env.local. Never prints it.

import { ACTOR_NAME, actorAssistant, checkActor } from "../vapi/actor.ts";
import { LUNA_NAME, checkLuna, lunaAssistant } from "../vapi/luna.ts";

const API = "https://api.vapi.ai";
const ASSISTANTS = [
  { name: LUNA_NAME, body: lunaAssistant(), check: checkLuna, idVar: "VAPI_ASSISTANT_ID" },
  { name: ACTOR_NAME, body: actorAssistant(), check: checkActor, idVar: "VAPI_ACTOR_ID" },
];

if (process.argv.includes("--dry-run")) {
  for (const { name, body, check } of ASSISTANTS) {
    console.log(JSON.stringify(body, null, 2));
    console.log(`\n${name}: dry run, nothing sent. Checks: ${check(body).join(" ") || "all good."}\n`);
  }
  process.exit(0);
}
// ... key check and vapi() unchanged ...

const all = (await vapi("/assistant?limit=100")) as { id: string; name?: string }[];
for (const { name, body, check, idVar } of ASSISTANTS) {
  const named = all.filter((a) => a.name === name);
  if (named.length > 1) {
    console.error(`${named.length} assistants are named "${name}". Delete the extras in the Vapi dashboard, then run again.`);
    process.exit(1);
  }
  const saved = named[0] ? await vapi(`/assistant/${named[0].id}`, { method: "PATCH", body }) : await vapi("/assistant", { method: "POST", body });
  const problems = check(saved);
  if (problems.length > 0) {
    console.error(`Vapi saved "${name}", but it fails these checks:\n- ${problems.join("\n- ")}`);
    process.exit(1);
  }
  console.log(`${named[0] ? "Updated" : "Created"} "${name}". All checks pass.`);
  console.log(`${idVar}=${saved.id}`);
}
```

- [ ] **Step 6: Dry run, then real sync**

Run: `npm run vapi:sync -- --dry-run`. Expected: both bodies, both "all good.", nothing sent.
Run: `npm run vapi:sync`. Expected: "Updated Luna", "Created Caller actor", two ID lines. Luna's body is unchanged, so her PATCH is a no-op.
Add `VAPI_ACTOR_ID=<id>` to `.env.local` (git ignores it). Sync costs no call.

- [ ] **Step 7: Commit**

`npm run test:unit`, then:

```bash
git add vapi/actor.ts vapi/__tests__/actor.test.ts scripts/vapi-sync.ts .env.example
git commit -m "The Caller actor: Marco Delgado, synced with Luna (refs #8, refs #15)"
```

---

### Task 3: `npm run luna:report`

**Files:**
- Create: `scripts/luna-check.ts` (pure; plain relative imports only)
- Create: `scripts/luna-report.ts` (CLI)
- Create: `scripts/__tests__/luna-call-fixture.ts`
- Test: `scripts/__tests__/luna-check.test.ts`
- Modify: `package.json` scripts: `"luna:report": "node --env-file-if-exists=.env.local scripts/luna-report.ts"`

**Interfaces:**
- Consumes: `TOOL` (`lib/luna-tools.ts`), `callSeconds` (`scripts/sample-call-file.ts`).
- Produces: `type LunaReport`, `lunaReport(call: unknown): LunaReport`, `lunaFailures(report: LunaReport, options?: { checkTurns?: boolean }): string[]`, `formatLunaReport(report: LunaReport, options?): string`, `narrationIn(text: string): boolean`.

- [ ] **Step 1: Read one real call's shape (free)**

GET one past Luna call. Save it to the scratchpad only (it holds the founder's 2026-10-05 voice transcript; never commit it):

```bash
node --env-file=.env.local -e "const k=process.env.VAPI_PRIVATE_KEY,a=process.env.VAPI_ASSISTANT_ID;fetch('https://api.vapi.ai/call?assistantId='+a+'&limit=3',{headers:{Authorization:'Bearer '+k}}).then(r=>r.json()).then(c=>fetch('https://api.vapi.ai/call/'+c[0].id,{headers:{Authorization:'Bearer '+k}})).then(r=>r.text()).then(t=>require('fs').writeFileSync(process.argv[1],t))" "<scratchpad>/past-call.json"
```

Confirm these names, and change the fixture and code below to match if they differ:
- `artifact.messages[]`: `role` (`bot`, `user`, `tool_calls`, `tool_call_result`), `message`, `secondsFromStart`, `duration`.
- `tool_calls`: `toolCalls[].id`, `toolCalls[].function.name`, `.arguments` (a JSON string).
- `tool_call_result`: `toolCallId`, `name`, `result`.
- `artifact.performanceMetrics.turnLatencies[].turnLatency` (ms).
- `startedAt`, `endedAt`, `endedReason`, `cost`.

- [ ] **Step 2: Write the fixture**

`scripts/__tests__/luna-call-fixture.ts`: a made-up call in that shape.

```ts
// A made-up Vapi call (GET /call/{id}) in the shape Vapi sends, for luna:report.
// Every detail is made up. `edit` swaps parts for one test.

type Message = Record<string, unknown>;

const tool = (id: string, name: string, args: object, at: number): Message[] => [
  { role: "tool_calls", toolCalls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }], secondsFromStart: at },
];
const result = (id: string, name: string, text: string, at: number): Message => ({ role: "tool_call_result", toolCallId: id, name, result: text, secondsFromStart: at });

export function goodMessages(): Message[] {
  return [
    { role: "system", message: "You are Luna...", secondsFromStart: 0 },
    { role: "bot", message: "Thanks for calling Mangrove Air, this is Luna. How can I help you today?", secondsFromStart: 0.5 },
    { role: "user", message: "My AC stopped cooling last night and it's 85 degrees in the house.", secondsFromStart: 4 },
    ...tool("t1", "recordDetail", { field: "job", value: "AC not cooling" }, 8),
    { role: "bot", message: "I'm sorry to hear that. Is anyone at home at risk from the heat?", secondsFromStart: 8.2 },
    { role: "user", message: "My mom is staying with me, so it's urgent.", secondsFromStart: 12 },
    ...tool("t2", "recordDetail", { field: "urgency", value: "Urgent, elderly mother at home" }, 15),
    { role: "bot", message: "Understood. What's your name?", secondsFromStart: 15.1 },
    { role: "user", message: "Marco Delgado.", secondsFromStart: 17 },
    ...tool("t3", "recordDetail", { field: "name", value: "Marco Delgado" }, 18.5),
    { role: "bot", message: "Thanks, Marco. What's the service address?", secondsFromStart: 18.6 },
    { role: "user", message: "4450 Northeast 18th Avenue, Miami.", secondsFromStart: 21 },
    ...tool("t4", "recordDetail", { field: "address", value: "4450 NE 18th Ave, Miami" }, 24),
    { role: "bot", message: "That's 4450 Northeast 18th Avenue in Miami. I can do tomorrow at 9 AM, or tomorrow at 2 PM.", secondsFromStart: 24.1 },
    { role: "user", message: "Tomorrow at 9 is great.", secondsFromStart: 30 },
    ...tool("t5", "bookTime", { time: "tomorrow at 9 AM" }, 31.5),
    result("t5", "bookTime", "Booked for tomorrow at 9 AM.", 32),
    { role: "bot", message: "You're all set for tomorrow at nine in the morning at 4450 Northeast 18th Avenue.", secondsFromStart: 32.5 },
    { role: "bot", message: "Thanks for calling Mangrove Air. Goodbye!", secondsFromStart: 37 },
  ];
}

export function lunaCall(edit: { messages?: Message[]; turnLatencies?: number[]; endedReason?: string } = {}) {
  return {
    id: "call-made-up",
    startedAt: "2026-10-13T15:00:00.000Z",
    endedAt: "2026-10-13T15:00:40.500Z",
    endedReason: edit.endedReason ?? "assistant-ended-call",
    cost: 0.21,
    artifact: {
      messages: edit.messages ?? goodMessages(),
      performanceMetrics: { turnLatencies: (edit.turnLatencies ?? [1400, 1600, 1500, 1900, 1700]).map((turnLatency) => ({ turnLatency })) },
    },
  };
}
```

- [ ] **Step 3: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { formatLunaReport, lunaFailures, lunaReport, narrationIn } from "../luna-check";
import { goodMessages, lunaCall } from "./luna-call-fixture";

describe("luna:report", () => {
  it("passes a good call: four details, a booking, the confirmation, quick turns", () => {
    const report = lunaReport(lunaCall());
    expect(report.details).toEqual({ name: "Marco Delgado", job: "AC not cooling", urgency: "Urgent, elderly mother at home", address: "4450 NE 18th Ave, Miami" });
    expect(report.booked).toBe("tomorrow at 9 AM");
    expect(report.confirmed).toBe(true);
    expect(report.narration).toEqual([]);
    expect(report.averageTurnMs).toBe(1620);
    expect(report.slowestTurnMs).toBe(1900);
    expect(report.seconds).toBe(40.5);
    expect(lunaFailures(report)).toEqual([]);
    expect(formatLunaReport(report)).toContain("PASS");
  });

  it("fails a call where Luna books and hangs up with only a goodbye (finding 1)", () => {
    const messages = goodMessages().filter((m) => !String(m.message ?? "").startsWith("You're all set"));
    const report = lunaReport(lunaCall({ messages }));
    expect(report.confirmed).toBe(false);
    expect(lunaFailures(report)).toContain("She did not speak the confirmation before the call ended.");
  });

  it("an address read-back before booking is not a confirmation", () => {
    const messages = goodMessages().filter((m) => !String(m.message ?? "").startsWith("You're all set"));
    expect(lunaReport(lunaCall({ messages })).confirmed).toBe(false);
  });

  it("is not confirmed when the caller hung up, even after a confirmation", () => {
    expect(lunaReport(lunaCall({ endedReason: "customer-ended-call" })).confirmed).toBe(false);
  });

  it("flags tool narration in English and Spanish (finding 2)", () => {
    expect(narrationIn("Based on the user's input, I will record their name as Marco Delgado.")).toBe(true);
    expect(narrationIn("Let's call the record detail tool.")).toBe(true);
    expect(narrationIn("Voy a usar la herramienta para guardar su nombre.")).toBe(true);
    expect(narrationIn("Thanks, Marco. What's the service address?")).toBe(false);
    const messages = [...goodMessages(), { role: "bot", message: "Let's call the record detail tool.", secondsFromStart: 38 }];
    expect(lunaFailures(lunaReport(lunaCall({ messages })))).toContain('Tool narration: "Let\'s call the record detail tool."');
  });

  it("fails slow turns (finding 3), and can skip the turn check for text rehearsal", () => {
    const report = lunaReport(lunaCall({ turnLatencies: [2500, 3100] }));
    expect(report.averageTurnMs).toBe(2800);
    expect(lunaFailures(report)).toContain("Average turn 2800 ms; the bar is under 2000 ms.");
    expect(lunaFailures(report, { checkTurns: false })).toEqual([]);
  });

  it("does not count a refused booking as booked", () => {
    const messages = goodMessages().map((m) => (m.role === "tool_call_result" ? { ...m, result: "That time was not offered. Offer only these two: x or y." } : m));
    const report = lunaReport(lunaCall({ messages }));
    expect(report.booked).toBeNull();
    expect(lunaFailures(report)).toContain("No time was booked.");
  });

  it("reads an empty call without throwing", () => {
    const report = lunaReport({});
    expect(report.details).toEqual({ name: null, job: null, urgency: null, address: null });
    expect(report.averageTurnMs).toBeNull();
    expect(lunaFailures(report)).toContain("Missing: name, job, urgency, address.");
  });
});
```

- [ ] **Step 4: Run it to see it fail**

Run: `npx vitest run scripts/__tests__/luna-check.test.ts`
Expected: FAIL, cannot resolve `../luna-check`.

- [ ] **Step 5: Write `scripts/luna-check.ts`**

```ts
// The pure half of `npm run luna:report`: reads one Vapi call (GET /call/{id})
// and checks it against Luna's pass bar (spec 2026-10-13). Also scores the
// text rehearsal. Plain relative imports only, so Node can run it.

import { TOOL } from "../lib/luna-tools.ts";
import { callSeconds } from "./sample-call-file.ts";

const FIELDS = ["name", "job", "urgency", "address"] as const;
type Field = (typeof FIELDS)[number];
export const MAX_AVERAGE_TURN_MS = 2000;

export type LunaReport = {
  details: Record<Field, string | null>;
  booked: string | null;
  confirmed: boolean;
  endedReason: string;
  narration: string[];
  averageTurnMs: number | null;
  slowestTurnMs: number | null;
  seconds: number;
  cost: number | null;
};

const record = (value: unknown): Record<string, any> => (value && typeof value === "object" ? (value as Record<string, any>) : {});
const list = (value: unknown): Record<string, any>[] => (Array.isArray(value) ? value.map(record) : []);
function argsOf(raw: unknown): Record<string, any> {
  if (typeof raw !== "string") return record(raw);
  try {
    return record(JSON.parse(raw));
  } catch {
    return {};
  }
}

// Luna reading her tools or notes aloud (finding 2 in #15).
const NARRATION = /\b(record ?detail|book ?time|end ?call|tool|function|herramienta|funci[oó]n|the user's input|based on the user)\b/i;

export function narrationIn(text: string): boolean {
  return NARRATION.test(text);
}

export function lunaReport(call: unknown): LunaReport {
  const c = record(call);
  const messages = list(record(c.artifact).messages ?? c.messages);
  const details: Record<Field, string | null> = { name: null, job: null, urgency: null, address: null };
  const bookCalls = new Map<string, number>();
  const spoken: { text: string; at: number }[] = [];
  let booked: string | null = null;
  let bookedAt = Infinity;

  for (const m of messages) {
    const at = typeof m.secondsFromStart === "number" ? m.secondsFromStart : 0;
    if ((m.role === "bot" || m.role === "assistant") && typeof m.message === "string") spoken.push({ text: m.message, at });
    if (m.role === "tool_calls") {
      for (const toolCall of list(m.toolCalls)) {
        const fn = record(toolCall.function);
        const args = argsOf(fn.arguments);
        if (fn.name === TOOL.recordDetail && FIELDS.includes(args.field) && typeof args.value === "string") details[args.field as Field] = args.value;
        if (fn.name === TOOL.bookTime) bookCalls.set(String(toolCall.id ?? ""), at);
      }
    }
    if (m.role === "tool_call_result" && (bookCalls.has(String(m.toolCallId ?? "")) || m.name === TOOL.bookTime)) {
      const time = String(m.result ?? "").match(/^Booked for (.+?)\.?$/)?.[1];
      if (time) {
        booked = time;
        bookedAt = bookCalls.get(String(m.toolCallId ?? "")) ?? at;
      }
    }
  }

  const endedReason = typeof c.endedReason === "string" ? c.endedReason : "";
  // The confirmation names the street number, after the booking. A read-back before booking does not count.
  const houseNumber = details.address?.match(/\d+/)?.[0];
  const confirmed =
    booked !== null && endedReason.startsWith("assistant-") && Boolean(houseNumber) && spoken.some((s) => s.at >= bookedAt - 1 && s.text.includes(houseNumber!));

  const turns = list(record(record(c.artifact).performanceMetrics).turnLatencies)
    .map((t) => t.turnLatency)
    .filter((ms): ms is number => typeof ms === "number" && ms > 0);

  return {
    details,
    booked,
    confirmed,
    endedReason,
    narration: spoken.map((s) => s.text).filter(narrationIn),
    averageTurnMs: turns.length ? Math.round(turns.reduce((a, b) => a + b, 0) / turns.length) : null,
    slowestTurnMs: turns.length ? Math.max(...turns) : null,
    seconds: callSeconds(call),
    cost: typeof c.cost === "number" ? c.cost : null,
  };
}

/** Why the call misses the pass bar. Empty means it passes. */
export function lunaFailures(report: LunaReport, { checkTurns = true }: { checkTurns?: boolean } = {}): string[] {
  const failures: string[] = [];
  const missing = FIELDS.filter((f) => !report.details[f]);
  if (missing.length) failures.push(`Missing: ${missing.join(", ")}.`);
  if (!report.booked) failures.push("No time was booked.");
  if (!report.confirmed) failures.push("She did not speak the confirmation before the call ended.");
  for (const line of report.narration) failures.push(`Tool narration: "${line}"`);
  if (checkTurns) {
    if (report.averageTurnMs === null) failures.push("No turn times in the call log.");
    else if (report.averageTurnMs >= MAX_AVERAGE_TURN_MS) failures.push(`Average turn ${report.averageTurnMs} ms; the bar is under ${MAX_AVERAGE_TURN_MS} ms.`);
  }
  return failures;
}

export function formatLunaReport(report: LunaReport, options: { checkTurns?: boolean } = {}): string {
  const failures = lunaFailures(report, options);
  const yes = (ok: boolean) => (ok ? "yes" : "no");
  return [
    `Details: ${FIELDS.map((f) => `${f} ${report.details[f] ? `"${report.details[f]}"` : "MISSING"}`).join("; ")}`,
    `All four details: ${yes(FIELDS.every((f) => report.details[f]))}`,
    `Booked: ${report.booked ?? "no"}`,
    `Confirmation before the end: ${yes(report.confirmed)} (ended: ${report.endedReason || "?"})`,
    `Tool narration: ${report.narration.length ? report.narration.map((l) => `"${l}"`).join(" | ") : "none"}`,
    `Turns: average ${report.averageTurnMs ?? "?"} ms, slowest ${report.slowestTurnMs ?? "?"} ms`,
    `Length: ${report.seconds} s${report.cost === null ? "" : `, cost $${report.cost.toFixed(2)}`}`,
    failures.length ? `FAIL\n- ${failures.join("\n- ")}` : "PASS",
  ].join("\n");
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run scripts/__tests__/luna-check.test.ts`
Expected: PASS. Then run the checker on the saved past call:
`node -e "import('./scripts/luna-check.ts').then(m=>console.log(m.formatLunaReport(m.lunaReport(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))))))" "<scratchpad>/past-call.json"`
Expected: real numbers (average turn 2100–3500 ms, as #15 says). If a field reads null, the shape guess in Step 1 was wrong: fix the fixture and code, re-run.

- [ ] **Step 7: Write the CLI `scripts/luna-report.ts`**

```ts
// Scores one Vapi call against Luna's pass bar (spec 2026-10-13).
//
//   npm run luna:report -- <callId>
//
// Reads VAPI_PRIVATE_KEY from .env.local. Never prints it. Exit code 1 when the call fails the bar.

import { formatLunaReport, lunaFailures, lunaReport } from "./luna-check.ts";

const key = process.env.VAPI_PRIVATE_KEY;
const callId = process.argv[2];

// No process.exit() after a fetch: on Windows it can crash Node while the connection closes.
process.exitCode = await main();

async function main(): Promise<number> {
  if (!key) {
    console.error("VAPI_PRIVATE_KEY is missing. Add it to .env.local.");
    return 1;
  }
  if (!callId) {
    console.error("Usage: npm run luna:report -- <callId>");
    return 1;
  }
  const response = await fetch(`https://api.vapi.ai/call/${encodeURIComponent(callId)}`, { headers: { Authorization: `Bearer ${key}` } });
  if (!response.ok) {
    console.error(`Vapi answered ${response.status}: ${await response.text()}`);
    return 1;
  }
  const report = lunaReport(await response.json());
  console.log(formatLunaReport(report));
  return lunaFailures(report).length ? 1 : 0;
}
```

Add the `luna:report` line to `package.json`. Run `npm run luna:report -- <the past call's ID>`. Expected: the same output as Step 6, exit code 1.

- [ ] **Step 8: Commit**

`npm run test:unit`, then:

```bash
git add scripts/luna-check.ts scripts/luna-report.ts scripts/__tests__/luna-check.test.ts scripts/__tests__/luna-call-fixture.ts package.json
git commit -m "npm run luna:report scores one call against Luna's pass bar (refs #15)"
```

---

### Task 4: The bridge page (dev only)

**Files:**
- Create: `app/dev/actor-call/page.tsx`
- Create: `app/dev/actor-call/bridge.tsx`
- Create: `app/dev/actor-call/start/route.ts`
- Test: `app/dev/actor-call/__tests__/guard.test.ts`

**Interfaces:**
- Consumes: `isLaptopDev` (Task 1), `actorCallOverrides`, `ActorLanguage` (Task 2), `signWebCallToken` (`lib/vapi-web-call.ts`), `/api/visit`, `/api/test-call`.
- Produces: `GET /dev/actor-call?lang=en|es&seconds=N` (the page), `POST /dev/actor-call/start?lang=en|es` → `{ callId, webCallUrl }`.

- [ ] **Step 1: Free pre-check: can two Vapi calls live on one page?**

Daily allows one call object per page unless `allowMultipleCallInstances: true`, and the Vapi SDK does not pass that option on. The bridge wraps `Daily.createCallObject` to add it. This only works if the page and the SDK share one `@daily-co/daily-js` module. Check it with no call: on the bridge page (after Step 4), run in the browser console via `javascript_tool`: build two `Vapi` objects after the wrap, call `reconnect({ webCallUrl: "https://vapi.daily.co/does-not-exist" })` on both. Pass: neither error says "Duplicate DailyIframe instances". If it fails: put each call in its own same-origin `<iframe>` of a tiny `/dev/actor-call/side` page, and pipe audio across frames (same origin shares the tab's process). Time box for the whole bridge: about one hour. Past that, go to Task 9 (phone backup).

- [ ] **Step 2: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import ActorCallPage from "@/app/dev/actor-call/page";
import { POST } from "@/app/dev/actor-call/start/route";

// Vitest runs with NODE_ENV=test: not the laptop's dev server.
describe("the AI actor's bridge, off the laptop's dev server", () => {
  it("has no page", () => {
    expect(() => ActorCallPage()).toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });

  it("starts no actor call", async () => {
    const response = await POST(new Request("http://localhost/dev/actor-call/start", { method: "POST" }));
    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run app/dev/actor-call/__tests__/guard.test.ts`
Expected: FAIL, cannot resolve the page.

- [ ] **Step 4: Write the three files**

`app/dev/actor-call/page.tsx`:

```tsx
// Dev only: the AI actor calls Luna in this tab (spec 2026-10-13). 404 on
// every deploy and in production.
import { notFound } from "next/navigation";
import { isLaptopDev } from "@/lib/laptop-dev";
import { ActorBridge } from "./bridge";

export const dynamic = "force-dynamic";

export default function ActorCallPage() {
  if (!isLaptopDev(process.env)) notFound();
  return <ActorBridge />;
}
```

`app/dev/actor-call/start/route.ts`:

```ts
// Dev only: creates one web call for the Caller actor. Same signed token as
// a Test Call (lib/vapi-web-call.ts), locked to the Actor. No webhook: the
// Actor has no tools. 404 on every deploy.
import { isLaptopDev } from "@/lib/laptop-dev";
import { signWebCallToken } from "@/lib/vapi-web-call";
import { actorCallOverrides, type ActorLanguage } from "@/vapi/actor";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isLaptopDev(process.env)) return new Response("Not found", { status: 404 });
  const { VAPI_PRIVATE_KEY: privateKey, VAPI_ORG_ID: orgId, VAPI_ACTOR_ID: actorId } = process.env;
  if (!privateKey || !orgId || !actorId) return Response.json({ reason: "VAPI_PRIVATE_KEY, VAPI_ORG_ID or VAPI_ACTOR_ID is missing." }, { status: 503 });
  const lang: ActorLanguage = new URL(request.url).searchParams.get("lang") === "es" ? "es" : "en";
  const response = await fetch("https://api.vapi.ai/call/web", {
    method: "POST",
    headers: { Authorization: `Bearer ${signWebCallToken({ privateKey, orgId, assistantId: actorId, nowMs: Date.now() })}`, "Content-Type": "application/json" },
    body: JSON.stringify({ assistantId: actorId, assistantOverrides: actorCallOverrides(lang) }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return Response.json({ reason: `Vapi refused the actor call: ${response.status} ${await response.text()}` }, { status: 502 });
  const call = (await response.json()) as { id?: string; webCallUrl?: string; transport?: { callUrl?: string } };
  return Response.json({ callId: call.id, webCallUrl: call.webCallUrl ?? call.transport?.callUrl });
}
```

If Vapi refuses the Spanish model override (public token), sync a second assistant "Caller actor (es) · Mangrove Air" instead and pick its ID by `lang`. Decide only when the Spanish call needs it.

`app/dev/actor-call/bridge.tsx`:

```tsx
"use client";

// Dev only. Joins a Luna web call and a Caller actor web call in this tab.
// Each call's microphone is a Web Audio stream; the other call's speaker
// (the "Vapi Speaker" participant) feeds it. No real microphone is used.
// Luna's call goes through /api/test-call, like any Test Call.

import { useState } from "react";

type VapiCall = {
  on(event: string, listener: (payload: any) => void): void;
  reconnect(call: { webCallUrl: string; id?: string }): Promise<void>;
  stop(): void | Promise<void>;
  getDailyCallObject(): any;
};

// Daily allows one call object per page unless told otherwise, and the Vapi
// SDK does not pass that option on. Wrap it once.
function allowTwoCalls(Daily: any) {
  if (Daily.__twoCalls) return;
  const create = Daily.createCallObject.bind(Daily);
  Daily.createCallObject = (options: object = {}) => create({ ...options, allowMultipleCallInstances: true });
  Daily.__twoCalls = true;
}

// Feeds `from`'s remote voice into `into`, once per track.
function pipe(from: VapiCall, context: AudioContext, into: MediaStreamAudioDestinationNode) {
  const daily = from.getDailyCallObject();
  const seen = new Set<string>();
  const connect = (track: MediaStreamTrack | undefined, participant: any) => {
    if (!track || participant?.local || participant?.user_name !== "Vapi Speaker" || track.kind !== "audio" || seen.has(track.id)) return;
    seen.add(track.id);
    context.createMediaStreamSource(new MediaStream([track])).connect(into);
  };
  for (const p of Object.values<any>(daily.participants())) connect(p.tracks?.audio?.persistentTrack, p);
  daily.on("track-started", (e: any) => connect(e?.track, e?.participant));
}

async function post(url: string) {
  const response = await fetch(url, { method: "POST" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${url} answered ${response.status}: ${JSON.stringify(body)}`);
  return body as { callId: string; webCallUrl: string };
}

export function ActorBridge() {
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  async function start() {
    setRunning(true);
    const say = (line: string) => {
      console.log(`[bridge] ${line}`);
      setLog((all) => [...all, line]);
    };
    const params = new URLSearchParams(location.search);
    const lang = params.get("lang") === "es" ? "es" : "en";
    const capSeconds = Number(params.get("seconds") ?? 170);
    const t0 = performance.now();
    const mark = (step: string) => say(`${Math.round(performance.now() - t0)} ms: ${step}`);
    try {
      const context = new AudioContext();
      const toLuna = context.createMediaStreamDestination();
      const toActor = context.createMediaStreamDestination();
      allowTwoCalls((await import("@daily-co/daily-js")).default);
      const { default: Vapi } = await import("@vapi-ai/web");
      mark("SDK loaded");
      const make = (into: MediaStreamAudioDestinationNode) =>
        new Vapi("no-key-needed-for-reconnect", undefined, undefined, { audioSource: into.stream.getAudioTracks()[0] }) as unknown as VapiCall;
      const actor = make(toActor);
      const luna = make(toLuna);

      await fetch("/api/visit", { method: "POST", redirect: "manual" });
      // The Actor joins first: it waits for Luna to speak.
      const actorCall = await post(`/dev/actor-call/start?lang=${lang}`);
      say(`Actor call ${actorCall.callId}`);
      await actor.reconnect({ webCallUrl: actorCall.webCallUrl, id: actorCall.callId });
      pipe(actor, context, toLuna);
      mark("Actor joined");

      const lunaCall = await post("/api/test-call");
      say(`Luna call ${lunaCall.callId}`);
      mark("Luna call created (/api/test-call)");
      let heardLuna = false;
      luna.on("message", (m: any) => {
        if (String(m?.type).startsWith("transcript") && m.transcriptType === "final") {
          if (!heardLuna && m.role !== "user") mark("Luna's first words");
          heardLuna ||= m.role !== "user";
          say(`${m.role === "user" ? "Actor" : "Luna"}: ${m.transcript}`);
        }
        if (m?.type === "tool-calls") for (const t of m.toolCallList ?? []) say(`  [${t.function?.name}] ${JSON.stringify(t.function?.arguments)}`);
      });
      const hangUp = (why: string) => {
        say(why);
        void Promise.resolve(actor.stop()).catch(() => {});
        void Promise.resolve(luna.stop()).catch(() => {});
        setRunning(false);
      };
      luna.on("call-end", () => hangUp("Luna's call ended."));
      await luna.reconnect({ webCallUrl: lunaCall.webCallUrl, id: lunaCall.callId });
      pipe(luna, context, toActor);
      mark("Luna joined");
      setTimeout(() => hangUp(`Stopped at the ${capSeconds} s cap.`), capSeconds * 1000);
    } catch (error) {
      say(`Failed: ${error instanceof Error ? error.message : String(error)}`);
      setRunning(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6 font-mono text-sm">
      <h1 className="mb-4 text-lg font-bold">AI actor calls Luna (dev only)</h1>
      <button type="button" className="border px-3 py-2" onClick={start} disabled={running}>
        Start the call
      </button>
      <ol className="mt-4 space-y-1">
        {log.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ol>
    </main>
  );
}
```

`@daily-co/daily-js` is already installed (the Vapi SDK depends on it). Import it only on this dev page.

- [ ] **Step 5: Run the test and typecheck**

Run: `npx vitest run app/dev/actor-call/__tests__/guard.test.ts` → PASS.
Run: `npm run typecheck` → PASS. If `@daily-co/daily-js` types fight the `any`, keep the `any` (dev page).

- [ ] **Step 6: Free checks in the browser**

`preview_start` `{ name: "dev" }`. Open `/dev/actor-call`. Expect the page and the button. Do the Step 1 pre-check with `javascript_tool`. Do not press "Start the call" yet. Check the production webhook is live with no call: `POST https://ai-voice-receptionist-tekguyz.vercel.app/api/vapi/webhook` with no secret answers 401.

- [ ] **Step 7: Commit**

`npm run test:unit`, then:

```bash
git add app/dev/actor-call
git commit -m "Dev-only bridge page: the AI actor calls Luna in one tab (refs #8)"
```

---

### Task 5: Text rehearsal through the Chat API

**Files:**
- Create: `scripts/chat-turn.ts` (pure)
- Create: `scripts/actor-rehearsal.ts` (CLI)
- Test: `scripts/__tests__/chat-turn.test.ts`
- Modify: `package.json`: `"actor:rehearse": "node --env-file-if-exists=.env.local scripts/actor-rehearsal.ts"`

**Interfaces:**
- Consumes: `lunaAssistant` (`vapi/luna.ts`), `actorAssistant` (Task 2), `lunaReport`, `formatLunaReport` (Task 3), `RECORDING_OPEN_TIMES`.
- Produces: `chatTurn(output: unknown, at: number): { text: string; ended: boolean; messages: object[] }` — `messages` are in the Vapi call-message shape that `lunaReport` reads.

- [ ] **Step 1: Probe the Chat API (one chat, text only)**

Docs read 2026-10-13: `POST https://api.vapi.ai/chat` takes `assistantId` or a transient `assistant`, `input` (text or a message list), `previousChatId`, and `assistantOverrides` (in chat, only `variableValues` works). The docs do not say if tools run. So probe once: a transient Luna (`lunaAssistant()` plus `server: { url: "<SAMPLE_CALL_WEBHOOK_ORIGIN>/api/vapi/webhook", headers: { "X-Vapi-Secret": <VAPI_WEBHOOK_SECRET> } }`), `variableValues` = `RECORDING_OPEN_TIMES`, input: a message list with Luna's greeting and "I'm Marco Delgado, my AC stopped cooling, it's urgent, 4450 Northeast 18th Avenue. Tomorrow at 9 works." Save the raw JSON to the scratchpad. Read `output`.

Decide:
- **A.** `output` shows `recordDetail` and `bookTime` calls, and a `Booked for` result: full rehearsal. Go on.
- **B.** Tools run, but `bookTime` is refused because the chat carries no `call`: the webhook cannot see the offered times. Then rehearse the order, the confirmation, the narration and the hang-up anyway, and ignore the refusal lines. Do not change the webhook for this.
- **C.** No tool calls, or an error: say in one line "The Chat API cannot run Luna with her tools," skip text rehearsal for the job, and skip Steps 2–6. Still commit nothing for this task.

A 402 answer (no payment method) counts as C.

- [ ] **Step 2: Write the failing test from the probe's real shape**

Copy the probe's `output` items, with made-up words only, into the test. Below is the expected OpenAI-like shape; change it to match the probe:

```ts
import { describe, expect, it } from "vitest";
import { lunaReport } from "../luna-check";
import { chatTurn } from "../chat-turn";

const output = [
  { role: "assistant", tool_calls: [{ id: "c1", type: "function", function: { name: "bookTime", arguments: '{"time":"tomorrow at 9 AM"}' } }] },
  { role: "tool", tool_call_id: "c1", content: "Booked for tomorrow at 9 AM." },
  { role: "assistant", content: "You're all set for tomorrow at nine in the morning at 4450 Northeast 18th Avenue. Goodbye!" },
  { role: "assistant", tool_calls: [{ id: "c2", type: "function", function: { name: "endCall", arguments: "{}" } }] },
];

describe("a chat turn", () => {
  it("joins the spoken text and sees the end of the call", () => {
    const turn = chatTurn(output, 10);
    expect(turn.text).toBe("You're all set for tomorrow at nine in the morning at 4450 Northeast 18th Avenue. Goodbye!");
    expect(turn.ended).toBe(true);
  });

  it("turns tool calls and results into call messages luna:report reads", () => {
    const { messages } = chatTurn(output, 10);
    const report = lunaReport({ endedReason: "assistant-ended-call", artifact: { messages: [
      { role: "tool_calls", toolCalls: [{ id: "a", function: { name: "recordDetail", arguments: '{"field":"address","value":"4450 NE 18th Ave"}' } }], secondsFromStart: 1 },
      ...messages,
    ] } });
    expect(report.booked).toBe("tomorrow at 9 AM");
    expect(report.confirmed).toBe(true);
  });

  it("reads an empty or broken output without throwing", () => {
    expect(chatTurn(undefined, 0)).toEqual({ text: "", ended: false, messages: [] });
    expect(chatTurn([{ role: "assistant" }, "x"], 0).text).toBe("");
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run scripts/__tests__/chat-turn.test.ts` → FAIL, cannot resolve `../chat-turn`.

- [ ] **Step 4: Write `scripts/chat-turn.ts`**

```ts
// The pure half of `npm run actor:rehearse`: one Chat API reply from Luna, as
// spoken text and as the call messages luna:report reads. Plain relative
// imports only, so Node can run it.

const record = (value: unknown): Record<string, any> => (value && typeof value === "object" ? (value as Record<string, any>) : {});

export type ChatTurn = { text: string; ended: boolean; messages: object[] };

/** `at`: this turn's place in the rehearsal, used as its secondsFromStart. */
export function chatTurn(output: unknown, at: number): ChatTurn {
  const said: string[] = [];
  const messages: object[] = [];
  let ended = false;
  for (const item of (Array.isArray(output) ? output : []).map(record)) {
    if (item.role === "assistant" && typeof item.content === "string" && item.content.trim()) {
      said.push(item.content.trim());
      messages.push({ role: "bot", message: item.content.trim(), secondsFromStart: at });
    }
    const calls = (Array.isArray(item.tool_calls) ? item.tool_calls : []).map(record);
    if (calls.length) messages.push({ role: "tool_calls", toolCalls: calls.map((c) => ({ id: c.id, function: record(c.function) })), secondsFromStart: at });
    if (calls.some((c) => record(c.function).name === "endCall")) ended = true;
    if (item.role === "tool") messages.push({ role: "tool_call_result", toolCallId: item.tool_call_id, result: item.content, secondsFromStart: at });
  }
  return { text: said.join(" "), ended, messages };
}
```

- [ ] **Step 5: Run the test** → PASS.

- [ ] **Step 6: Write the CLI `scripts/actor-rehearsal.ts`**

```ts
// Text rehearsal: the Caller actor talks to Luna through Vapi's Chat API, no
// voice. Both are transient assistants built from this repo, so a Luna change
// is rehearsed before it is synced. Luna's tools go to the deployed webhook.
//
//   npm run actor:rehearse                 English
//   npm run actor:rehearse -- --lang es    Spanish
//
// Reads VAPI_PRIVATE_KEY, VAPI_WEBHOOK_SECRET and SAMPLE_CALL_WEBHOOK_ORIGIN
// from .env.local. Never prints a key. Exit code 1 when Luna misses the bar
// (turn times are not checked in text).

import { RECORDING_OPEN_TIMES } from "../lib/sample-call-recording.ts";
import { actorAssistant, type ActorLanguage } from "../vapi/actor.ts";
import { lunaAssistant } from "../vapi/luna.ts";
import { chatTurn } from "./chat-turn.ts";
import { formatLunaReport, lunaFailures, lunaReport } from "./luna-check.ts";

const MAX_TURNS = 16;
const { VAPI_PRIVATE_KEY: key, VAPI_WEBHOOK_SECRET: secret, SAMPLE_CALL_WEBHOOK_ORIGIN: origin } = process.env;
const lang: ActorLanguage = process.argv.includes("es") ? "es" : "en";

async function chat(body: object): Promise<{ id: string; output: unknown }> {
  const response = await fetch("https://api.vapi.ai/chat", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Vapi /chat answered ${response.status}: ${text}`);
  return JSON.parse(text);
}

process.exitCode = await main();

async function main(): Promise<number> {
  if (!key || !secret || !origin?.startsWith("https://")) {
    console.error("VAPI_PRIVATE_KEY, VAPI_WEBHOOK_SECRET or an https SAMPLE_CALL_WEBHOOK_ORIGIN is missing in .env.local.");
    return 1;
  }
  const luna = { ...lunaAssistant(), server: { url: `${origin.replace(/\/+$/, "")}/api/vapi/webhook`, headers: { "X-Vapi-Secret": secret } } };
  const overrides = { variableValues: { openTime1: RECORDING_OPEN_TIMES[0], openTime2: RECORDING_OPEN_TIMES[1] } };
  const actor = actorAssistant(lang);
  const messages: object[] = [{ role: "bot", message: luna.firstMessage, secondsFromStart: 0 }];
  console.log(`Luna: ${luna.firstMessage}`);

  let lunaSays = luna.firstMessage;
  let lunaChat: string | undefined;
  let actorChat: string | undefined;
  let ended = false;
  for (let turn = 1; turn <= MAX_TURNS && !ended; turn++) {
    const actorReply = await chat({ assistant: actor, input: lunaSays, ...(actorChat ? { previousChatId: actorChat } : {}) });
    actorChat = actorReply.id;
    const actorSays = chatTurn(actorReply.output, turn).text;
    console.log(`Actor: ${actorSays}`);
    messages.push({ role: "user", message: actorSays, secondsFromStart: turn });

    const input = lunaChat ? actorSays : [{ role: "assistant", content: luna.firstMessage }, { role: "user", content: actorSays }];
    const lunaReply = await chat({ assistant: luna, assistantOverrides: overrides, input, ...(lunaChat ? { previousChatId: lunaChat } : {}) });
    lunaChat = lunaReply.id;
    const said = chatTurn(lunaReply.output, turn + 0.5);
    for (const m of said.messages as any[]) {
      if (m.role === "tool_calls") for (const t of m.toolCalls) console.log(`  [${t.function?.name}] ${t.function?.arguments ?? ""}`);
      if (m.role === "tool_call_result") console.log(`  -> ${m.result}`);
    }
    if (said.text) console.log(`Luna: ${said.text}`);
    messages.push(...said.messages);
    lunaSays = said.text || "...";
    ended = said.ended;
  }
  console.log(ended ? "\nLuna ended the call." : `\nNo end after ${MAX_TURNS} turns.`);
  const report = lunaReport({ endedReason: ended ? "assistant-ended-call" : "rehearsal-turn-limit", artifact: { messages } });
  console.log(`\n${formatLunaReport(report, { checkTurns: false })}`);
  return lunaFailures(report, { checkTurns: false }).length ? 1 : 0;
}
```

Run: `npm run actor:rehearse`. Expected: a full transcript. Today's Gemini Luna may fail the bar; that is the baseline. Keep the output in the scratchpad.

- [ ] **Step 7: Commit**

`npm run test:unit`, then:

```bash
git add scripts/chat-turn.ts scripts/actor-rehearsal.ts scripts/__tests__/chat-turn.test.ts package.json
git commit -m "npm run actor:rehearse: the actor and Luna in text, before any voice call (refs #15)"
```

---

### Task 6: Preload the Vapi SDK when the Test Call screen opens (#15 finding 4)

**Files:**
- Modify: `lib/vapi-browser.ts`
- Modify: `app/demo/call-screen.tsx` (one `useEffect` near the top of `CallScreen`)
- Test: `lib/__tests__/vapi-browser.test.ts`

**Interfaces:**
- Produces: `onceLoader<T>(load: () => Promise<T>): () => Promise<T>`, `preloadVapi(): Promise<typeof import("@vapi-ai/web")>`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { onceLoader } from "@/lib/vapi-browser";

describe("loading the Vapi SDK", () => {
  it("loads once, however often it is asked", async () => {
    let loads = 0;
    const load = onceLoader(async () => ++loads);
    expect(await Promise.all([load(), load(), load()])).toEqual([1, 1, 1]);
    expect(loads).toBe(1);
  });

  it("tries again after a failed load, so one bad preload does not block every call", async () => {
    let loads = 0;
    const load = onceLoader(async () => {
      loads++;
      if (loads === 1) throw new Error("offline");
      return "sdk";
    });
    await expect(load()).rejects.toThrow("offline");
    expect(await load()).toBe("sdk");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run lib/__tests__/vapi-browser.test.ts` → FAIL, `onceLoader` is not exported.

- [ ] **Step 3: Implement**

In `lib/vapi-browser.ts`, update the header comment ("loaded when the Test Call screen opens, so "Call now" does not wait for it"), and add:

```ts
/** Runs `load` once and shares its answer. After a failure, the next ask tries again. */
export function onceLoader<T>(load: () => Promise<T>): () => Promise<T> {
  let loading: Promise<T> | null = null;
  return () =>
    (loading ??= load().catch((error: unknown) => {
      loading = null;
      throw error;
    }));
}

/** Starts the Vapi web SDK's download. The Test Call screen calls it when it opens. */
export const preloadVapi = onceLoader(() => import("@vapi-ai/web"));
```

In `createVapi`: `const { default: Vapi } = await preloadVapi();`.

In `app/demo/call-screen.tsx`, import `preloadVapi` with `browserVapiSourceDeps` and add after the unmount effect:

```tsx
  // "Call now" should not wait for the SDK's download (issue #15).
  useEffect(() => {
    preloadVapi().catch(() => {});
  }, []);
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run lib/__tests__/vapi-browser.test.ts lib/__tests__/vapi-source.test.ts` → PASS. `npm run typecheck` → PASS.

- [ ] **Step 5: Check in the browser (no call)**

Reload `/demo`. With `read_network_requests`, check the Vapi SDK chunk loads on open, before any press. Check the console has no errors.

- [ ] **Step 6: Commit**

`npm run test:unit`, then:

```bash
git add lib/vapi-browser.ts lib/__tests__/vapi-browser.test.ts app/demo/call-screen.tsx
git commit -m "Test Call screen loads the Vapi SDK when it opens, not on Call now (refs #15)"
```

---

### Task 7: Bridge sound check (voice call 1, recording on)

**Files:**
- Create: `docs/superpowers/logs/2026-10-13-voice-calls.md` (the running log)

- [ ] **Step 1: Start the log**

```markdown
# Voice calls, 2026-10-13 (spec: AI actor Sample Call)

Budget: 10. One row per Luna call. A bridged call also makes one Actor call; both are listed. Minutes: from each call's start and end in Vapi.

| # | Luna call | Actor call | Why | Result | Minutes (Luna + Actor) |
|---|---|---|---|---|---|
```

- [ ] **Step 2: Recording on for this one call**

Add to `.env.local`: `SAMPLE_CALL_RECORDING=on` and `SAMPLE_CALL_WEBHOOK_ORIGIN=https://ai-voice-receptionist-tekguyz.vercel.app`. Restart the dev server. Open `/dev/actor-call?seconds=50`. Press "Start the call" (with `computer`; the click starts the AudioContext). Check the server log says "This call is recorded for the Sample Call." Wait for the 50 s cap. Then remove `SAMPLE_CALL_RECORDING=on` at once (keep the origin line), and restart.

- [ ] **Step 3: Pull the sound and judge it (Claude cannot hear)**

With a scratchpad script: GET the Luna call, download `artifact.recording.stereoUrl` (fall back to `/call/<id>/mono-recording`) into the scratchpad. Then, per channel, `ffmpeg -af "astats" ` and `silencedetect`:
- Both channels have speech (mean volume above −50 dB) and no clipping (peak below −0.5 dB).
- No echo: no Luna words in the caller lines of Luna's transcript, and no Actor line repeats Luna's last line.
- Turns: Luna's and the Actor's speech overlap less than 10 % of the time (silencedetect windows), and the transcript alternates.
- Luna's transcript of the caller matches the Actor's own transcript (same facts: AC, 85, mom).

Pass: all four. Log row 1 with both IDs, "bridge check", pass or fail, minutes. Note the recorded Luna call ID for deletion later (stop 4). Also log the start timings the page printed (SDK, `/api/test-call`, join, first words).

- [ ] **Step 4: Decide the route**

Pass: the bridge wins. Fail and not fixable in the hour: Task 9 (phone). Commit the log.

```bash
git add docs/superpowers/logs/2026-10-13-voice-calls.md
git commit -m "Voice call log: bridge check (refs #8)"
```

---

### Task 8: Tune Luna, one change at a time (#15)

Each change: edit `vapi/luna.ts` (with its test), `npm run actor:rehearse` until text passes, `npm run vapi:sync`, then one voice call on `/dev/actor-call`, then `npm run luna:report -- <lunaCallId>`, then one log row. Recording off for all of these.

**Files:**
- Modify: `vapi/luna.ts`, `vapi/__tests__/luna.test.ts`
- Modify: `docs/superpowers/logs/2026-10-13-voice-calls.md`

- [ ] **Step 1: Change 1, the model (finding 1)**

Test first, in `vapi/__tests__/luna.test.ts`:

```ts
  // Issue #15: Gemini 3.5 Flash hung up without confirming and read its notes aloud.
  it("use a GPT-4.1-class mini model", () => {
    const model = (lunaAssistant() as any).model;
    expect(model.provider).toBe("openai");
    expect(model.model).toBe("gpt-4.1-mini");
  });
```

Run it (FAIL). In `lunaAssistant()`: `provider: "openai", model: "gpt-4.1-mini"`. Run it (PASS). `npm run actor:rehearse`, then `npm run actor:rehearse -- --lang es`. Both must show the confirmation before `endCall` and no narration. If text fails, fix the prompt in text first (one change, its own test), never in voice.

Then `npm run vapi:sync`, one English voice call, `npm run luna:report -- <id>`. Log it. Commit:

```bash
git add vapi/luna.ts vapi/__tests__/luna.test.ts docs/superpowers/logs/2026-10-13-voice-calls.md
git commit -m "Luna runs on gpt-4.1-mini (refs #15)"
```

- [ ] **Step 2: Change 2, only if she still hangs up without confirming**

Remove the `endCall` tool. End the call by phrase. Tests first:

```ts
  it("end the call by her goodbye phrase, not a tool, so she cannot hang up before confirming", () => {
    const luna = lunaAssistant() as any;
    expect(luna.model.tools.some((t: any) => t.type === "endCall")).toBe(false);
    expect(luna.endCallPhrases).toEqual(["have a great day", "que tenga un buen día"]);
    expect(luna.model.messages[0].content).toContain('end with exactly "Thanks for calling Mangrove Air, have a great day!"');
    expect(checkLuna({ ...luna, endCallPhrases: [] })).toContain("Luna must be able to end the call.");
  });
```

In `checkLuna`: `if (!tools.some((t) => t.type === "endCall") && !(luna.endCallPhrases ?? []).length) problems.push("Luna must be able to end the call.");`. In the prompt, step 6 ends: `Then end with exactly "Thanks for calling ${business}, have a great day!" (in Spanish: "Gracias por llamar a ${business}, ¡que tenga un buen día!"). Never say "have a great day" before that.` Remove the endCall line from "Tools" and replace the old test that expects `Never call endCall in the same reply as`. Rehearse in text (the rehearsal sees no endCall now: set `ended` in `chatTurn` also when the text contains a phrase from `lunaAssistant().endCallPhrases`, with its own test). Sync, one voice call, report, log, commit "Luna ends the call by her goodbye phrase (refs #15)".

- [ ] **Step 3: Spanish check (finding 2)**

One Spanish voice call: `/dev/actor-call?lang=es`. Report it. Narration must be "none". If narration remains: one prompt change with its test, rehearse in Spanish, then one more Spanish call.

- [ ] **Step 4: Turn time (finding 3)**

Read average and slowest turn from each report so far. If the last English call averages under 2000 ms, done. If not: read `artifact.performanceMetrics` of that call and find the biggest part (model, voice, transcriber, endpointing). Make one change for that part only, with its test (for example a shorter `startSpeakingPlan` wait for endpointing). Rehearsal cannot measure speed, so skip it for a setting-only change. One voice call, report, log.

- [ ] **Step 5: Start time (finding 4), measured, not with the Actor**

Task 6 shipped the preload. Measure each step in the browser on `/demo`: page open → SDK chunk done (resource timing), "Call now" → microphone allowed, `/api/test-call` time (network log), join, first words (`javascript_tool` hooks `performance.now()` on the first transcript message). The microphone step may not work in the built-in browser. If it does not, use the bridge page timings from the voice calls above (they run the same `/api/test-call`, SDK load and join) and say so. Spend a voice call on `/demo` only if the microphone works there; hang up right after Luna's first words. Log the step times in the log file.

- [ ] **Step 6: Pass bar on the last English call and the Spanish call**

Both reports PASS (four details, booked, confirmation then goodbye then the end, no narration, average turn under 2 s). Voice still "Jessica". Commit the log.

---

### Task 9 (backup, only if the bridge fails): phone route

Only after Task 7 fails. Read `https://docs.vapi.ai/free-telephony.md` and `https://docs.vapi.ai/calls/outbound-calling.md` first. Create one free Vapi number with Luna as its assistant and `server` pointing to the webhook (recording off). Add `scripts/actor-phone-call.ts`: `POST /call` with `assistantId: VAPI_ACTOR_ID`, `phoneNumberId`, `customer.number` = Luna's number. The keeper then needs recording on that call's Luna side: set `artifactPlan.recordingEnabled: true` on the number's assistant overrides for that one call only, then off. Remove the number when done (it is ours, made in this job; still say so). Tell the founder which route won and why. Same budget, same log.

---

### Task 10: The keeper (the Sample Call)

**Files:**
- Modify: `scripts/sample-call-file.ts:48` (the `about` line), `scripts/__tests__/sample-call-file.test.ts`
- Modify: `scripts/sample-call-pull.ts` (header comment, README name in the "No recorded call" message)
- Generated: `public/sample-call.mp3`, `lib/sample-call.json`

- [ ] **Step 1: "founder" becomes "AI actor" in the pull (test first)**

```ts
  it("says the call was made by the AI actor, every detail made up", () => {
    expect(file().about).toBe("A real call to Luna by an AI actor that plays the caller, 2026-10-09. Pulled by `npm run sample-call:pull` (issue #8). Every caller detail is made up.");
  });
```

Run (FAIL). Change `about` to `` `A real call to Luna by an AI actor that plays the caller, ${recordedOn}. Pulled by \`npm run sample-call:pull\` (issue #8). Every caller detail is made up.` ``. Run (PASS). In `scripts/sample-call-pull.ts`: header "Makes the AI actor's recorded call to Luna the Sample Call (issue #8, ADR 0004)."; the no-call message points to README "Make the Sample Call". Commit.

- [ ] **Step 2: Make the keeper (one voice call, recording on)**

Only after Task 8 Step 6 passes. Add `SAMPLE_CALL_RECORDING=on`, restart, open `/dev/actor-call` (English, `seconds=170`), check "This call is recorded for the Sample Call." in the server log, press start. When it ends, remove the line and restart. Recording is off again.

- [ ] **Step 3: Judge it**

`npm run luna:report -- <id>` must PASS and the call must be under 120 s. Fail: log it, one retry (Step 2 again). Second fail: **stop and tell the founder why.** Log every try.

- [ ] **Step 4: Pull and test**

```bash
npm run sample-call:pull -- <callId>
npx vitest run lib/__tests__/sample-call.test.ts scripts/__tests__/sample-call-file.test.ts
```

Read the timing check line. If the first sound and Vapi's first line differ by more than 200 ms, pull again with `--offset-ms <difference>`. File under 1 MB.

- [ ] **Step 5: Check sync on `/demo` (Claude cannot hear)**

Open `/demo`, play the Sample Call. With `javascript_tool`, log each line's on-screen time against `audio.currentTime` (the call screen's timer follows the sound). Check against `silencedetect` speech starts in the mp3: each line within 500 ms of a speech start. Test pause and resume once.

- [ ] **Step 6: Commit the keeper**

`npm run test:unit`, then:

```bash
git add public/sample-call.mp3 lib/sample-call.json scripts/sample-call-file.ts scripts/__tests__/sample-call-file.test.ts scripts/sample-call-pull.ts docs/superpowers/logs/2026-10-13-voice-calls.md
git commit -m "The Sample Call: a real call to Luna by the AI actor (refs #8)"
```

- [ ] **Step 7: Stop. The founder listens once on `/demo`.** In the same message, list the recorded call IDs (bridge check, keeper, any retry) and ask to delete them from Vapi (stop 4). Wait.

---

### Task 11: Honest words

**Files:**
- Modify: `lib/sample-call.ts` (header comment and a new constant), `lib/__tests__/sample-call.test.ts`
- Modify: `app/demo/call-screen.tsx` (running Sample Call status)
- Modify: `lib/sample-call-recording.ts`, `lib/vapi-web-call.ts:67`, `app/api/test-call/route.ts:21` (comments: "the founder's Sample Call" → "the Sample Call")
- Modify: `CONTEXT.md`, `PRODUCT.md`, `docs/adr/0004-no-audio-kept.md`, `README.md`

**Interfaces:**
- Produces: `SAMPLE_CALL_CREDIT: string` from `lib/sample-call.ts`.

- [ ] **Step 1: Failing test**

In `lib/__tests__/sample-call.test.ts`, in "the Sample Call":

```ts
  it("says who the caller is while it plays", () => {
    expect(SAMPLE_CALL_CREDIT).toBe("A real call to Luna. The caller is an AI actor.");
  });
```

Run: FAIL (not exported).

- [ ] **Step 2: Implement**

`lib/sample-call.ts`: header line 1–2 becomes "The Sample Call: one real call to Luna, made by an AI actor that plays the caller and recorded on purpose (ADR 0004), and the player that emits its Call Story events in step with its sound." Add:

```ts
import { SAMPLE_BUSINESS } from "@/lib/sample-business";

/** One line on the call screen while the Sample Call plays. */
export const SAMPLE_CALL_CREDIT = `A real call to ${SAMPLE_BUSINESS.receptionistName}. The caller is an AI actor.`;
```

`app/demo/call-screen.tsx`, `case "running"`: wrap the status in a fragment and add the line for the Sample Call only, same style as the screen's other small notes:

```tsx
      status = (
        <>
          <p className={CALL_STATUS}>
            {/* unchanged */}
          </p>
          {phase.mode === "sample" && <p className="mt-1 text-sm text-print-muted">{SAMPLE_CALL_CREDIT}</p>}
        </>
      );
```

Run the test: PASS. `npm run typecheck`: PASS. Check on `/demo` (play, read the line, screenshot, phone width 375 px too).

- [ ] **Step 3: Docs**

- `CONTEXT.md`, **Sample Call**: replace "It is one real Test Call that the founder made and recorded on purpose." with "It is one real call to the Receptionist, made by an AI actor that plays the caller, recorded on purpose."
- `PRODUCT.md`, Evidence on Hand: "- The Sample Call: one real call to the Receptionist, made by an AI actor that plays the caller, recorded on purpose."
- `docs/adr/0004-no-audio-kept.md`: the exception paragraph says "a single call to Luna made by an AI actor with made-up details". Add:

  ```markdown
  ## Note, 2026-10-13: both voices are AI

  The founder could not record the Sample Call, so an AI actor made it: a second Vapi assistant ("Caller actor · Mangrove Air", `vapi/actor.ts`) played the caller and called the real Luna from a dev-only page (`/dev/actor-call`). The one recording holds no human voice at all: both sides are AI. Recording is still off for every Visitor, and the same laptop-only switch made this one recording. The recorded calls were deleted from Vapi after the sound was committed.
  ```

- `README.md`: replace the "Record the Sample Call" section with "Make the Sample Call": `npm run vapi:sync` (prints `VAPI_ACTOR_ID`), the two `.env.local` lines, `npm run actor:rehearse`, `npm run dev`, open `/dev/actor-call`, press start, `npm run luna:report -- <callId>`, remove `SAMPLE_CALL_RECORDING`, pull, test, commit, delete. Add `luna:report` and `actor:rehearse` to the scripts list if the README has one.

- [ ] **Step 4: Commit**

`npm run test:unit`, then:

```bash
git add lib/sample-call.ts lib/__tests__/sample-call.test.ts app/demo/call-screen.tsx lib/sample-call-recording.ts lib/vapi-web-call.ts app/api/test-call/route.ts CONTEXT.md PRODUCT.md docs/adr/0004-no-audio-kept.md README.md
git commit -m "Honest words: the Sample Call's caller is an AI actor (refs #8)"
```

---

### Task 12: Finish

- [ ] **Step 1: After the founder's yes, delete the recorded calls**

For each recorded call ID the founder approved: `npm run sample-call:pull -- --delete <callId>`. Log it.

- [ ] **Step 2: Issue #8 comment**

```bash
gh issue comment 8 --body "The founder steps in the comment above are replaced by the spec docs/superpowers/specs/2026-10-13-ai-actor-sample-call-design.md: an AI actor made the Sample Call. See the PR from voice-demo-batch-10."
```

- [ ] **Step 3: Verify**

`npm run test:unit` and `npm run typecheck`: both pass (superpowers:verification-before-completion: read the output).

- [ ] **Step 4: Push and open one PR (do not merge)**

Say first: pushing this branch makes a Vercel Preview only; merging to `main` is live.

```bash
git push
gh pr create --base main --head voice-demo-batch-10 --title "AI actor makes the Sample Call; Luna tuned" --body-file <scratchpad>/pr-body.md
```

The body: what changed, which route won (bridge or phone) and why, Luna before and after (per finding), the voice call log table with total minutes, "closes #8", "closes #15", and the attribution line. Then `mcp__ccd_pr__get_status` / `bind_pr`. Tell the founder the PR number and what to do next.
