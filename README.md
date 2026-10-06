<p align="center"><img src="docs/banner.svg" alt="AI Voice Receptionist" width="100%"></p>

<p align="center">
  <img alt="status" src="https://img.shields.io/badge/status-building-a8221a?style=flat&labelColor=17171a">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-faf08a?style=flat&labelColor=17171a">
  <img alt="storage" src="https://img.shields.io/badge/storage-Upstash%20Redis-a8221a?style=flat&labelColor=17171a">
  <img alt="tests" src="https://img.shields.io/badge/tests-Vitest-a8221a?style=flat&labelColor=17171a">
</p>

**A show-off demo of an AI Receptionist that answers the phone for a made-up South Florida AC repair shop.**

Live site: https://ai-voice-receptionist-tekguyz.vercel.app (the landing page is a placeholder until step 6)

## Status

| | |
|---|---|
| Phase | Building |
| Shipped | [#2 Step 1: setup and the Call Story](https://github.com/tekguyz/ai-voice-receptionist/issues/2) · [#3 Step 2: the look](https://github.com/tekguyz/ai-voice-receptionist/issues/3) · [#4 Step 3: live Test Call](https://github.com/tekguyz/ai-voice-receptionist/issues/4) |
| Known issues | [#15 Tune Luna: model, hang-up, speed](https://github.com/tekguyz/ai-voice-receptionist/issues/15) |
| Next | [#5 Step 4: Call Notes saved](https://github.com/tekguyz/ai-voice-receptionist/issues/5) |
| Updated | 2026-10-05 |

## What it does

Built so far:

- A Visitor presses "Try the demo" (a cookie, no sign-in). Then "Call now" talks to Luna through the browser microphone. Words and tags fill in live. A call stops at 3 minutes. Limits are 1 Test Call per Visitor a day, 2 per IP address a day, 5 per site a day, and 30 a month. At a limit, with a blocked microphone, or when the call cannot connect, the Sample Call is offered.
- Turns a call's events (lines, captured details, a booking, the end) into the live call view and the Call Notes. This is the Call Story, in `lib/call-story.ts`.
- Plays a Sample Call on a plain screen at `/demo`: lines and detail tags appear in time, then the Call Notes show a summary, the details, the booked time and a preview of the confirmation text.

Planned (spec [#1](https://github.com/tekguyz/ai-voice-receptionist/issues/1)):

- The Dashboard shows the Owner's side: totals and recent Call Notes.
- The Receptionist answers in Spanish when the caller speaks Spanish (checked on test calls, 2026-10-05).

## What it never does

- Never dials a phone number. Test Calls run in the browser ([ADR 0001](docs/adr/0001-test-calls-run-in-the-browser.md)).
- No sign-in and no accounts ([ADR 0002](docs/adr/0002-demo-only-no-sign-in.md)).
- Never keeps a Visitor's voice. Only words, for 7 days ([ADR 0004](docs/adr/0004-no-audio-kept.md)).
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

Fill in `.env.local`. Then:

```bash
npm run vapi:sync
npm run dev
```

Open `http://localhost:3000` and press "Try the demo".

Luna's settings live in `vapi/luna.ts`. Never edit Luna in the Vapi dashboard; the next sync overwrites it.

To test what would be sent without sending: `npm run vapi:sync -- --dry-run`.

The Sample Business and Receptionist names live in one file, `lib/sample-business.ts`.

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
