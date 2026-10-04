# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router), TypeScript, Tailwind, Vitest, on Vercel. Voice by Vapi
through its web SDK. Storage is Upstash Redis (ADR 0003). Decided in the
2026-10-03 grill; full spec in tekguyz/ai-voice-receptionist#1.

## Users

**Primary:** the owner of a small shop or trade that misses calls (AC repair,
roofing, marine repair). They open a link on their phone, from a text or
WhatsApp, often between jobs. In about a minute they decide whether this is
worth a call to TEKGUYZ.

Others who open the link (friends, family, developers, people it gets passed
to) get the same experience; no screen is designed for them first.

## Product Purpose

A show-off demo of an AI that answers the phone for a small business. The
Visitor talks to the Receptionist of a made-up Sample Business through the
browser, watches it capture the job and book a time, then sees the Owner's
side: Call Notes and a Dashboard. Success: an owner hears it work on their own
phone and wants one for their business.

It proves the TEKGUYZ offering "AI Voice Agents", and is the proof for the
"After-hours receptionist" package.

## Positioning

The Visitor does not watch a video of an AI receptionist; they call one, in
one press, with no signup and no phone number, and see the Owner's side fill
in live as they talk.

## Operating Context

- Opened from a link, landing page first, then "Try the demo" (one press).
- Screens: Test Call, live call, Call Notes, Dashboard. Phone first; on a
  desktop the phone sits in the middle and the details fill in beside it.
- A Test Call uses the microphone. Some Visitors will be in a truck, a shop or
  a noisy job site, and some will block the microphone; the Sample Call covers
  them.

## Capabilities and Constraints

- Words follow `CONTEXT.md`: Visitor, Sample Business, Receptionist, Test
  Call, Sample Call, Call Notes, Owner, Dashboard.
- Demo only: no sign-in, no accounts (ADR 0002).
- Test Calls run in the browser; no phone number is dialled (ADR 0001).
- A Test Call is 3 minutes at most. Limits (founder, 2026-10-04; cost comes
  first): 1 per Visitor a day, also limited by IP address; 5 per site a day
  and 30 a month. At a limit, or with no microphone, the Sample Call plays.
- The Receptionist asks name, job, urgency and address, and books one of two
  made-up open times. No calendar is connected. Nothing is sent; the
  confirmation text is a preview with "Not available in the demo."
- The Receptionist switches to Spanish if the caller does; the screens stay in
  English.
- Only words are kept, for 7 days. Never a Visitor's voice (ADR 0004).
- Follows `claude-config/DEMO-STANDARD.md`: landing page, link preview,
  "Try the demo", demo banner, "Built by TEKGUYZ", showcase pictures.
- Names (founder, 2026-10-04): the Sample Business is "Mangrove Air", the
  Receptionist is "Luna".

## Brand Commitments

- The app is a TEKGUYZ product. The landing page and the demo banner speak as
  TEKGUYZ and carry "Built by TEKGUYZ" with a link to tekguyz.com.
- The Receptionist and the in-app screens speak as the Sample Business.
- Voice follows the TEKGUYZ brand playbook: plain English, the way you talk to
  an owner across the counter. Short. Show, do not claim. Never say a thing is
  built, running or proven when it is not.
- The design references in `refs/` set layout and ideas only. **No purple.**
  Never copy the references' assistant name ("Viora") or their pictures.
- Never the old demo's name ("Sarah") or its client's name.

## Evidence on Hand

- A real, working Test Call once the Receptionist ships; it is the proof.
- The Sample Call: one Test Call the founder records on purpose.
- None measured: no calls recovered, no revenue, no customer quotes. Do not
  invent any, and do not reuse the old demo's unsourced industry statistics.

## Product Principles

1. **Hear it, then believe it.** The Test Call is the pitch; every screen
   points to it or follows from it.
2. **Nobody leaves with nothing.** A limit, a blocked microphone or a dropped
   call always leads to the Sample Call, never a dead end.
3. **The Owner's side is the product.** Call Notes and the Dashboard show what
   the owner pays for: no missed job, every detail captured.
4. **Honest demo.** Say what is sample data and what is not available in the
   demo. Claim nothing that is not real.
5. **One thumb, one minute.** An owner between jobs on a phone gets it fast.

## Accessibility & Inclusion

WCAG 2.2 AA. The live transcript is real text that screen readers can follow.
The call works by keyboard. Motion calms down when reduced motion is on.
English screens; the Receptionist speaks English and Spanish.
