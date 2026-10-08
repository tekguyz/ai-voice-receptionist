<p align="center"><img src="docs/banner.svg" alt="AI Voice Receptionist" width="100%"></p>

<p align="center">
  <img alt="status" src="https://img.shields.io/badge/status-building-a8221a?style=flat&labelColor=17171a">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-faf08a?style=flat&labelColor=17171a">
  <img alt="storage" src="https://img.shields.io/badge/storage-Upstash%20Redis-a8221a?style=flat&labelColor=17171a">
  <img alt="tests" src="https://img.shields.io/badge/tests-Vitest-a8221a?style=flat&labelColor=17171a">
</p>

**A show-off demo of an AI Receptionist that answers the phone for a made-up South Florida AC repair shop.**

Live site: https://ai-voice-receptionist-tekguyz.vercel.app

## Status

| | |
|---|---|
| Phase | Building |
| Shipped | [#2 Step 1: setup and the Call Story](https://github.com/tekguyz/ai-voice-receptionist/issues/2) · [#3 Step 2: the look](https://github.com/tekguyz/ai-voice-receptionist/issues/3) · [#4 Step 3: live Test Call](https://github.com/tekguyz/ai-voice-receptionist/issues/4) · [#5 Step 4: Call Notes saved](https://github.com/tekguyz/ai-voice-receptionist/issues/5) · [#6 Step 5: Dashboard](https://github.com/tekguyz/ai-voice-receptionist/issues/6) · [#7 Step 6: landing page and design pass](https://github.com/tekguyz/ai-voice-receptionist/issues/7) |
| Known issues | [#15 Tune Luna: model, hang-up, speed](https://github.com/tekguyz/ai-voice-receptionist/issues/15) |
| Next | [#8 Step 7: record the real Sample Call](https://github.com/tekguyz/ai-voice-receptionist/issues/8) (built; waits for the founder's one recorded call, near the end of the build) |
| Updated | 2026-10-08 |

## What it does

Built so far:

- A landing page at `/` says what it does, shows a filled-in sample work order and has one "Try the demo" button. Only `/` is in search; demo screens are `noindex`. A link to it shows a preview card drawn by the app (`app/opengraph-image.tsx`). The demo banner has "Leave the demo" and "Built by TEKGUYZ". The Call Notes and the Dashboard end with "Want this answering for your shop? Talk to TEKGUYZ".
- A Visitor presses "Try the demo" (a cookie, no sign-in). Then "Call now" talks to Luna through the browser microphone. Words and tags fill in live. A call stops at 3 minutes. Limits are 1 Test Call per Visitor a day, 2 per IP address a day, 5 per site a day, and 30 a month. At a limit, with a blocked microphone, or when the call cannot connect, the Sample Call is offered.
- Turns a call's events (lines, captured details, a booking, the end) into the live call view and the Call Notes. This is the Call Story, in `lib/call-story.ts`.
- Plays a Sample Call on a plain screen at `/demo`: lines and detail tags appear in time, then the Call Notes show a summary, the details, the booked time and a preview of the confirmation text. The Visitor can pause, resume or stop it. Once the founder's call is recorded, it plays with sound, and the words and tags follow the sound's own clock. Until then it is a text-only placeholder.
- The Dashboard shows the Owner's side: three totals and recent calls, sample calls mixed with the Visitor's own.
- After a Test Call, the Call Notes are saved for the Visitor and the screen fills in from the saved copy. Each entry is deleted after 7 days. The Vapi webhook (`app/api/vapi/webhook`) refuses any request without Vapi's secret.
- The Receptionist answers in Spanish when the caller speaks Spanish (checked on test calls, 2026-10-05). The screens stay in English.

## What it never does

- Never dials a phone number. Test Calls run in the browser ([ADR 0001](docs/adr/0001-test-calls-run-in-the-browser.md)).
- No sign-in and no accounts ([ADR 0002](docs/adr/0002-demo-only-no-sign-in.md)).
- Never keeps a Visitor's voice. Only words. This app deletes its copy after 7 days; Vapi keeps its own call logs under its own retention ([ADR 0004](docs/adr/0004-no-audio-kept.md)).
- Never sends a text or email. The confirmation text is a preview.
- Never uses a real business. The Sample Business is made up.
- The browser never holds a Vapi key. The server makes each call with a 60-second token that only works for Luna.

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, Vitest, on Vercel. Voice is the Vapi web SDK. Upstash Redis holds call limits and Call Notes ([ADR 0003](docs/adr/0003-redis-not-supabase.md)).

## Run it locally

Prerequisites: Node 24, a Vapi account and an Upstash Redis database.

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`. Vapi can reach only a public address, so Call Notes are saved only on a deployed Preview or Production, not on localhost. Set `VAPI_WEBHOOK_SECRET` in `.env.local` and in Vercel. Then:

```bash
npm run vapi:sync
npm run dev
```

Open `http://localhost:3000` and press "Try the demo".

Luna's settings live in `vapi/luna.ts`. Never edit Luna in the Vapi dashboard; the next sync overwrites it.

To test what would be sent without sending: `npm run vapi:sync -- --dry-run`.

The Sample Business and Receptionist names live in one file, `lib/sample-business.ts`.

## Record the Sample Call

The Sample Call is one real Test Call the founder makes with made-up details, recorded on purpose ([ADR 0004](docs/adr/0004-no-audio-kept.md)). Recording is off for every Visitor. It turns on only on the laptop's `npm run dev`, never on Vercel.

1. Add two lines to `.env.local`. The second is the deployed site: Vapi cannot reach the laptop, so Luna's booking goes to its webhook.

   ```
   SAMPLE_CALL_RECORDING=on
   SAMPLE_CALL_WEBHOOK_ORIGIN=https://ai-voice-receptionist-tekguyz.vercel.app
   ```

2. Run `npm run dev`, open the demo and press "Call now". The terminal says "This call is recorded for the Sample Call." Make up every detail. Give all four (name, job, urgency, address) and book one of the two times Luna offers ("tomorrow at 9 AM" or "tomorrow at 2 PM"). Let Luna end the call.
3. Delete the two lines from `.env.local`. Recording is off again.
4. Pull the call. It writes `public/sample-call.mp3` and `lib/sample-call.json`:

   ```bash
   npm run sample-call:pull
   ```

5. Check it: `npx vitest run lib/__tests__/sample-call.test.ts` (the Call Story test and the file size), then play it on `/demo` and listen. If the words come early or late, pull again with `-- <callId> --offset-ms <ms>`.
6. Commit both files. Then delete the call and its recording from Vapi:

   ```bash
   npm run sample-call:pull -- --delete <callId>
   ```

## Tests

```bash
npm run test:unit
```

Never `npm test`: it prints an error and stops on purpose. There is no database, so there is no integration suite.

CI (`.github/workflows/ci.yml`) runs typecheck, `test:unit` and build on every pull request and on every push to `main`.

## Docs

- Spec: [#1](https://github.com/tekguyz/ai-voice-receptionist/issues/1)
- Glossary: [`CONTEXT.md`](CONTEXT.md)
- Product: [`PRODUCT.md`](PRODUCT.md)
- Decisions: [`docs/adr/`](docs/adr/)
- Design references: [`refs/`](refs/)
- Design rules: [`DESIGN.md`](DESIGN.md)

---

<p align="center"><sub>Built by <a href="https://tekguyz.com">TEKGUYZ</a></sub></p>
