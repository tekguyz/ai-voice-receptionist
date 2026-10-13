# AI actor: the Sample Call and Luna's tuning, with no founder recording

Issues #8 (Sample Call) and #15 (tune Luna). Parent spec #1.
Rules: `PRODUCT.md`, `CONTEXT.md`, `docs/adr/0004-no-audio-kept.md`.
Approved in chat with the founder on 2026-10-13.

## Goal

The founder cannot record the Sample Call. So an AI actor makes it: a second
Vapi assistant plays the customer and calls the real Luna. The same actor
also makes Luna's tuning calls, so the founder does not make test calls.

Done means: a Visitor who presses "Call now" gets a Luna who is quick,
confirms the booking before she hangs up, and never reads her notes aloud;
and a Visitor who plays the Sample Call hears a short, clean, real call.

The founder listens **once**, at the end, to the kept Sample Call.

## Cost rules (the founder's first concern)

Past work failed and had to be redone, and each redo cost money. So:

- **Rehearse in text first.** Before any voice call, run the Actor against
  Luna in text with Vapi's Chat API (`POST /chat`, read its docs first). Text
  is cheap and shows script bugs (wrong order, hang-up, narration). If the
  Chat API cannot run Luna with her tools, say so in one line and skip text
  rehearsal; do not build a substitute.
- **Voice call budget: 10 calls for the whole job.** Each voice call targets
  under 2 minutes. Luna's 180 s cap stays. Count every call. At 10, stop and
  ask the founder before one more.
- **One change at a time.** Never make a voice call to test a change that a
  text rehearsal already shows is broken.
- **Recording only for the bridge sound check and the keeper.** Every other
  actor call runs with recording off.

## 1. The Actor

- `vapi/actor.ts`: the Actor's Vapi settings, the same shape as
  `vapi/luna.ts`. Name: "Caller actor · Mangrove Air". Not a Receptionist;
  it never appears to a Visitor except as the caller's voice in the Sample
  Call.
- Persona (all made up): Marco Delgado, AC stopped cooling last night, 85
  degrees in the house, his mom is staying with him so it is urgent, address
  4450 Northeast 18th Avenue, Miami. Picks "tomorrow at 9 AM". Answers one
  thing at a time, briefly, like a real caller. Lets Luna end the call.
- A Spanish variant of the same persona (`actorAssistant("es")`) for one
  Spanish check. The Sample Call itself is English.
- Voice: an ElevenLabs premade man's voice, clearly unlike Luna's.
- Recording off in its saved settings, like Luna.
- `npm run vapi:sync` syncs both Luna and the Actor, with the same checks.
  `--dry-run` still sends nothing.

## 2. Connecting the two voices: test first, then pick

**First try: the browser bridge.** A dev-only page, `app/dev/actor-call/`,
returns 404 unless `NODE_ENV === "development"` and not on Vercel (the same
guard as `lib/sample-call-recording.ts`). It starts a Luna web call and an
Actor web call and feeds each call's speaker audio into the other's
microphone (override `getUserMedia` with a Web Audio stream from the other
call's remote track). Luna's call goes through the app's normal
`/api/test-call` path, so her tools and webhook work as in a real Test Call.

**Bridge check:** one voice call, recording on, under 60 s. Pull its sound.
Pass if both voices are clear, there is no echo or feedback loop, and both
sides take turns. If the bridge cannot work (for example the Vapi SDK will
not run two calls on one page, even in two tabs), stop work on it within
about an hour.

**Backup: phone.** Give Luna a free Vapi phone number for the job; the Actor
calls it with Vapi's outbound call API. Remove the number when done. Use this
only if the bridge fails. Tell the founder which route won and why.

## 3. Tuning Luna (#15)

Fix the four findings in #15, in this order, one change at a time:

1. **Hangs up without confirming.** Swap the model first (a GPT-4.1-class
   mini model). If it still hangs up, remove the `endCall` tool and end the
   call with Vapi's end-call phrases instead.
2. **Reads her notes aloud** (Spanish). Check after the model swap.
3. **Slow turns.** Measure from the Vapi call log.
4. **Slow start** (5–7 s from "Call now"). Measure each step in the
   browser. Preload the Vapi SDK when the Test Call screen opens. This one
   is tested on the Test Call screen, not with the Actor.

**Report script:** `scripts/luna-report.ts` (`npm run luna:report --
<callId>`). Reads one Vapi call and prints: all four details captured (yes
or no), time booked, confirmation spoken before the call ended, any spoken
tool narration, average and slowest turn time, length. Unit-tested on saved
call JSON.

**Pass bar for Luna** (checked on the last English voice call and the one
Spanish voice call):

- Name, job, urgency and address captured; a time booked.
- She speaks the full confirmation, then goodbye, then the call ends.
- No tool narration in her speech.
- Average turn under 2 s.
- The voice stays "Jessica" unless the founder picks another at the end.

## 4. The keeper: the Sample Call

- Made only after Luna passes the bar. One voice call, recording on through
  the existing switch (`SAMPLE_CALL_RECORDING=on`, laptop dev only).
- Keep it only if the report passes and the call is under 2 minutes. If it
  fails, one retry. If that fails too, stop and tell the founder why.
- `npm run sample-call:pull` writes `public/sample-call.mp3` and
  `lib/sample-call.json`. Its "founder" wording becomes "AI actor".
- `npx vitest run lib/__tests__/sample-call.test.ts` passes.
- Check sync on `/demo` by the event times against the sound (Claude cannot
  hear). Then the founder listens once.
- Delete every recorded call from Vapi with
  `npm run sample-call:pull -- --delete <callId>`, after the commit and
  with the founder's yes.

## 5. Honest words

- While the Sample Call plays, one line on the call screen: "A real call to
  Luna. The caller is an AI actor."
- `CONTEXT.md`, **Sample Call**: "one real call to the Receptionist, made by
  an AI actor that plays the caller, recorded on purpose." Drop "the founder
  made".
- `PRODUCT.md`, Evidence on Hand: the same change.
- ADR 0004: a dated note. The one recording holds no human voice at all:
  both sides are AI. Recording is still off for every Visitor.
- README: replace "Record the Sample Call" with the actor steps.
- Issue #8: a comment that says the founder steps are replaced by this spec.

## Not in this job

Go live (#9) and retiring the old app (#10). They come next, in their own
session.

## Done

- One PR from `voice-demo-batch-10`, `closes #8` and `closes #15`.
- `npm run test:unit` passes; `npm run typecheck` passes.
- The PR body lists every voice call made (ID, why, result) and the total
  minutes.
- Pushing makes a Vercel Preview only; merging to `main` is live.
