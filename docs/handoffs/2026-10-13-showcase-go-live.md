# Handoff: AI Voice Receptionist showcase and go-live (2026-10-13)

From tekguyz/ai-voice-receptionist#9. This repo never edits its siblings, so
each message below is for a session in that repo. Paste it as the first
message.

The new demo:

- Repo: `tekguyz/ai-voice-receptionist`, `C:/Projects/ai-voice-receptionist`
- Live: https://ai-voice-receptionist-tekguyz.vercel.app
- Sample Business: Mangrove Air, a made-up South Florida AC repair shop. The
  Receptionist is Luna.
- Showcase: `showcase/` in the repo. 4 desktop pictures (landing, Sample Call,
  Call Notes, Dashboard), 2 phone pictures (landing, Call Notes), lossless WebP
  copies in `showcase/webp/`, a 4.5 s landing scroll in `showcase/video/`.
  Banner and TEKGUYZ credit hidden.
- The capture config lives in the app repo: `showcase/capture-config.json`.
  Run it with
  `node C:/Projects/claude-config/tools/capture/capture.mjs C:/Projects/ai-voice-receptionist/showcase/capture-config.json --out C:/Projects/ai-voice-receptionist/showcase`.

The old demo ("Sarah", repo `tekguyz/Real-Stone-Granite-AI-Experience`, site
`tekguyz-sarah.vercel.app`) is retired. Taking it down is
tekguyz/ai-voice-receptionist#10, after every link below points at the new
site.

## Message for `claude-config`

```text
The AI Voice Receptionist rebuild shipped (tekguyz/ai-voice-receptionist#9).
Live: https://ai-voice-receptionist-tekguyz.vercel.app. Read
C:/Projects/ai-voice-receptionist/docs/handoffs/2026-10-13-showcase-go-live.md.

1. DEMO-STANDARD.md, the AI Voice Receptionist row: Landing page and Demo are
   done (tekguyz/ai-voice-receptionist#7, #8). No sign-in: "Try the demo" sets
   a cookie, then the Visitor talks to Luna in the browser (no phone number).
   Limits: 1 Test Call per Visitor a day, 2 per IP, 5 per site a day, 30 a
   month; at a limit the Sample Call plays (a real call to Luna made by an AI
   actor). Call Notes deleted after 7 days. Showcase in the app's `showcase/`.
   Old "Sarah" demo retired; its takedown is tekguyz/ai-voice-receptionist#10.
2. tools/capture: the config now lives in the app repo,
   `C:/Projects/ai-voice-receptionist/showcase/capture-config.json`. Delete
   `apps/ai-voice-receptionist.json` (it points at the old site) and update
   the voice row in the README's "Which apps work today" table: run end to
   end 2026-10-14 on the live site, 4 desktop, 2 phone, landing video, config
   in the app repo.
3. New tools/capture feature, wanted for this app: a clip of a screen while
   it plays, with sound. The Sample Call (on /demo, "Play the Sample Call")
   runs 77 s with its own recording (`public/sample-call.mp3` in the app). A
   stories-size clip of about 15 s, from Playwright's video recording, with
   that part of the mp3 laid under it. tools/motion cannot do this: it may
   not animate app screens.
```

## Message for `tekguyz-one`

```text
The AI Voice Receptionist rebuild shipped (tekguyz/ai-voice-receptionist#9).
Read C:/Projects/ai-voice-receptionist/docs/handoffs/2026-10-13-showcase-go-live.md.

1. Rewrite projects/ai-voice-receptionist/about.md and engineering.md for the
   new build. New repo tekguyz/ai-voice-receptionist, new URL
   https://ai-voice-receptionist-tekguyz.vercel.app. The Receptionist is Luna
   (not Sarah); the Sample Business is the made-up Mangrove Air (AC repair,
   South Florida), not a stone shop. Calls run in the browser, no phone number
   dialled, no sign-in. The app's README, CONTEXT.md and docs/adr/ are the
   record. Say the old "Sarah" demo (repo Real-Stone-Granite-AI-Experience,
   tekguyz-sarah.vercel.app) is retired.
2. Tracker tekguyz/tekguyz-one#17: the voice receptionist part of "Demo
   rebuilds" is done except the old app's takedown
   (tekguyz/ai-voice-receptionist#10).
3. Swap old links to the new URL: brand/playbook.md, brand/solutions.md,
   projects/ai-voice-receptionist/about.md,
   growth/outreach/muse-work-pack/projects.md. Leave growth/outreach/sources/
   (history).
```

## Other old links (from #9's comment)

These still point at `tekguyz-sarah.vercel.app`. Each needs a session in its
own repo. Push means live for the site and the portfolio.

- `tekguyz/tekguyz` `README.md`: the voice row, "Open it".
- `tekguyz-site`: `content/work.ts`, `docs/CANONICAL.md`, `docs/PLAYBOOK.md`,
  `docs/SEO.md`.
- `portfolio`: `lib/projects.ts`.
- `muse-outbox`: `work-pack/projects.md` and the `context/` copy (refresh from
  tekguyz-one). `concierge/muse-export-2026-10-03.md` is a dated snapshot;
  leave it.
