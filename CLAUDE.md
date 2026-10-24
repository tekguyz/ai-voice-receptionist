# AI Voice Receptionist: rules for this repo

A public demo: Luna, an AI Receptionist, answers calls for Mangrove Air, a
made-up South Florida AC repair shop. Visitors talk to her in the browser.

Read before the work:

- `README.md`: what it does, how to run it, the Status block.
- `CONTEXT.md`: the words. Use them exactly (Visitor, Test Call, Sample Call,
  Call Notes, Receptionist).
- `PRODUCT.md`: who it is for, names, limits.
- `DESIGN.md`: the look. Impeccable follows it.
- `docs/adr/`: decisions. A new decision gets a new ADR.

## Things that go live at once

- **A push to `main` goes live** on Vercel. Say so in one line before it.
- **`npm run vapi:sync` changes live Luna right away**, before any PR is
  merged. Run `npm run vapi:sync -- --dry-run` first and read what it would send.

## Recording the Sample Call

- Recording is on for **one call only**: `SAMPLE_CALL_RECORDING=on` in
  `.env.local`, one call, then delete that line.
- Pull the call (`npm run sample-call:pull -- <callId>`), commit, then delete
  it from Vapi (`npm run sample-call:pull -- --delete <callId>`).
- The steps are in the README, "Make the Sample Call".
- A new pull rewrites `lib/sample-call.json`. Its test checks that Luna
  confirms after the booking; if it fails, fix the times in the file.

## Other repos

This repo never edits its sibling repos (`tekguyz-site`, `portfolio`,
`tekguyz-one`, `claude-config`). Hand off by message: write the message in
`docs/handoffs/` and tell the founder which repo it is for.

## Tests

- `npm run test:unit` (Vitest). Never `npm test`.
- `npm run luna:report -- <lunaCallId>` scores a real call to Luna. Read the
  transcript by eye too.
- `e2e/` is Playwright, run by CI only.
