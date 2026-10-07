# Step 6: logo, landing page, link preview and banner way out

Issue #7 (step 6 of 9). Parent spec #1: user stories 1–11 and module 10.
Rules: `claude-config/DEMO-STANDARD.md`, `DESIGN.md`, `PRODUCT.md`, `CONTEXT.md`.
Approved in chat with the founder on 2026-10-07.

## Goal

A link to the app opens a landing page that sells the demo by itself, on a
phone first. The link shows a real preview card. Search engines find `/` and
nothing behind it. Every demo screen has a banner with a way out and the
"Built by TEKGUYZ" credit.

Not in this step: the design pass (Impeccable critique, polish, one
web-design-guidelines check). Issue #7 says it runs later, in a fresh window
after `/clear`, on every screen together.

## 1. Logo, icons and link preview: the founder picks

Decided: **one of each.** A product logo for "AI Voice Receptionist", and a
small matching mark for the Sample Business "Mangrove Air". Never TEKGUYZ.

- **Mockup page:** `docs/design/logos.html`, a plain HTML file, opened in the
  browser pane. Three options, A, B and C, all in the Service Ticket world
  (three inks, square corners, no purple). Each option shows:
  1. The product logo (a small mark and the name) on the canary copy and on
     a dark ground.
  2. The favicon at real size in a fake browser tab, at 16 px and 32 px.
  3. The home-screen icon (180 px, as iOS shows it).
  4. The link preview card, the way WhatsApp or a text shows it: picture,
     title, line, address.
  5. The Mangrove Air mark on the work order header.
- The founder picks from screenshots. The pick, with its colours and shapes,
  goes in `DESIGN.md` (a new "Logo and icons" part).
- **It ships as a full set, made from code, never by hand:**
  - `app/icon.svg`: the favicon.
  - `app/apple-icon.tsx`: Next.js draws the 180 px PNG from code with
    `ImageResponse`. This replaces the standard's `app/apple-icon.png` file
    and its "script makes the PNG" rule with the same result: one source,
    no hand-made PNG. The page still gets an `apple-touch-icon` link.
  - `app/opengraph-image.tsx`: the 1200 × 630 link preview picture.
  - The logo on the landing page; the Mangrove Air mark in the work order
    header (`TicketHeader`) and the Dashboard header.
  - The app is not installable, so no manifest icons.
- **Fonts for drawn images:** `ImageResponse` cannot use `next/font`. The
  Barlow Condensed and Barlow files it needs are kept in `app/_og/` (TTF or
  WOFF, not WOFF2), with a `README.md` that says where they came from (Google
  Fonts, SIL Open Font License). FancyFam is the model.
- Hex values in drawn images copy the tokens in `app/globals.css`, with a
  comment saying so.

## 2. The landing page at `/`

Layout A, approved. Canary copy ground, the Service Ticket parts. It speaks as
TEKGUYZ about the product; the sample work order speaks as Mangrove Air.

**Top (the hero).** On a phone: one column. From 1024 px: two columns, words
left, the sample work order right.

- The product logo.
- Headline (draft): "An AI receptionist that answers when you can't."
- Line (draft): "It picks up, takes down the job, books a time and hands you
  the notes. Try it now in your browser: it answers for Mangrove Air, a
  made-up AC repair shop."
- The **Try the demo** stamp button. It is the submit button of a
  `<form method="post" action="/api/visit">`. No GET ever makes a Visitor.
- A Small line under it (draft): "No signup. No phone number. Your browser
  asks for the microphone only when you call."
- **The sample work order:** the white top sheet with the ticket header, the
  filled fields (name, job, urgency, address, booked) and the first lines of
  "What was said". Made from the real parts in `app/_ui/ticket.tsx`, filled by
  running `SAMPLE_CALL_EVENTS` through `tellCallStory`, so it always matches
  the Sample Call (step 7 swaps in the real recording, and this follows). It
  is labelled "A sample call" so nobody takes it for a live one. It is a
  picture of the app, not a control: no buttons in it.

**How it works** (three numbered steps, drafts):

1. **Call.** Press Call now and talk. No phone number, no signup.
2. **Watch it write.** Luna asks your name, the job, how urgent it is and the
   address, then offers two open times. Each detail is written on the work
   order as you say it.
3. **Read the Owner's side.** When you hang up, the Call Notes show a summary,
   the booked time and the text the caller would get. The Dashboard shows
   every call.

**For shops and trades that miss calls** (draft): "You're on a roof, under a
house or out on a boat. The phone rings, and the job goes to whoever picks up
first. A receptionist like Luna answers for your business, takes the job and
books it. If the caller speaks Spanish, it answers in Spanish."

**Good to know** (drafts, every line true today):

- Mangrove Air is made up. Nothing you book is real, and no text is sent.
- Make up your details. Only the words are kept, never your voice. Our copy
  is deleted after 7 days.
- One Test Call a day, 3 minutes at most. If calls are used up or your
  microphone is blocked, the Sample Call plays instead.

**Footer:** "Built by TEKGUYZ" linking to `https://tekguyz.com`, small and
calm.

**Rules for the copy:** plain words, short, the TEKGUYZ voice. No made-up
numbers, quotes, results or customer names. No "Sign in" link (ADR 0002).
Final wording may change in the design pass.

**Accessibility:** one `h1`; sections with headings; the button works by
keyboard with the carbon focus ring; WCAG 2.2 AA contrast from `DESIGN.md`.

## 3. The demo banner

`DemoBanner` in `app/_ui/ticket.tsx`, used on every demo screen (Test Call,
Dashboard, a call's Call Notes).

- Left: "Demo · Made-up business", as now.
- Right: **Leave the demo** (a plain link to `/`) and **Built by TEKGUYZ**
  (link to `https://tekguyz.com`). White on black, canary on hover, canary
  focus ring (`DESIGN.md`).
- Leaving keeps the Visitor cookie. A Visitor who comes back with "Try the
  demo" finds their call and their Call Notes still there.
- At 375 px it must show every word. If one line does not fit, it wraps to two
  rows; nothing is hidden or cut off.

**Dashboard link before a first call.** The Test Call screen's ready state
gets an **Open the Dashboard** Form Link beside "Play the Sample Call". The
banner stays a banner, not a menu.

## 4. Search and link preview

- The root layout keeps `noindex` as the default, so no page is indexed by
  mistake. `/` alone sets `robots: { index: true, follow: true }`.
- Demo screens keep their own `noindex`.
- `lib/site.ts` (model: FancyFam): `siteUrl()` from
  `VERCEL_PROJECT_PRODUCTION_URL`, `http://localhost:3000` locally. Used for
  `metadataBase`, `robots.ts` and `sitemap.ts`, so the preview image URL is
  absolute and matches the live address.
- `app/robots.ts`: allow all, point to the sitemap. Demo screens are kept out
  by their `noindex` tag, not by robots.txt (a blocked crawler never sees the
  tag).
- `app/sitemap.ts`: only `/`.
- Landing page metadata: title "AI Voice Receptionist", a one-line
  description, Open Graph and Twitter `summary_large_image` from
  `opengraph-image`, with an `alt`.
- **Checked in the browser pane:** the meta tags on `/` and a demo route,
  `/robots.txt`, `/sitemap.xml`, `/opengraph-image` and `/apple-icon` render.
  After the Preview deploys, the tags are checked again there.

## 5. Tests

- **Unit (Vitest):** `robots` and `sitemap` list only what they should
  (`sitemap` has `/` only). No unit tests for screens (spec #1).
- **One Playwright file, CI only:** `e2e/landing-to-call-notes.spec.ts`.
  1. `/` shows the headline and is indexable; it has no "Sign in" link.
  2. "Try the demo" opens `/demo`, which has `noindex` and the banner with
     "Leave the demo" and "Built by TEKGUYZ".
  3. "Play the Sample Call" plays to Call Notes. Playwright's fake clock skips
     the wait. No Vapi, no Redis.
- `@playwright/test` is a dev dependency; `playwright.config.ts` starts the
  built app. A new `e2e` job in `.github/workflows/ci.yml` installs Chromium,
  builds and runs it. Vitest ignores `e2e/`. It is not run on the laptop.

## Out of scope

- The design pass (later, fresh window).
- Showcase pictures and the real Sample Call recording (step 7, #8).
- The step 5 leftovers: sample-call times move per page load; a saved call is
  dated at save time, not start time; the CALL_ID rule is in two files; every
  Visitor call prints ticket 04127; a missing reverse-midnight test; plain
  values exported from the "use client" file `app/_ui/call-notes.tsx`. They go
  in a new issue at the end of this step.
- Embedding the demo in the portfolio's frame (not in the portfolio's list of
  framed demos).

## Done when

The acceptance list on #7, except the design pass line, which stays open for
the fresh window.
