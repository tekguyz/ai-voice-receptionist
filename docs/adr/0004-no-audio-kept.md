# No audio is kept

Audio recording is switched off in Vapi. Only the words of a Test Call (the
transcript) and its Call Notes are kept, for 7 days. A Visitor is a stranger,
and a voice is personal data. The screen says this in one line before the call
starts. Do not turn recording on to add a playback feature.

The one exception is the Sample Call. Its sound is a single call to Luna,
made by an AI actor with made-up details and recorded on purpose, once. It
holds no Visitor's voice.

## Note, 2026-10-06: the 7 days is this app's copy

This app deletes its own copy of a call (the Call Notes and transcript) after 7 days. Vapi keeps its own call logs, with the transcript, under its own retention: not checked in the dashboard (it needs the founder's sign-in). Vapi's docs ("Zero Data Retention (ZDR)", read 2026-10-06) say Vapi stores transcripts, messages, summaries and detailed call logs unless the organization turns on Zero Data Retention in the dashboard, and give no time limit. So the screen says "Our copy is deleted after 7 days." and never promises that the words exist nowhere else. Audio is still never kept.

## Note, 2026-10-08: how the one recording is made

Luna's saved settings keep recording off, and `npm run vapi:sync` refuses any other setting. The Sample Call turns recording on for that one call only (`assistantOverrides.artifactPlan`), from `lib/sample-call-recording.ts`. That switch works only on the laptop's `npm run dev` with `SAMPLE_CALL_RECORDING=on` in `.env.local`, and never on a Vercel deploy, so no Visitor's call can be recorded. Vapi's record of every other call has an empty recording (`recording: { mono: {} }`, checked 2026-10-08). After the sound is saved in the repo, `npm run sample-call:pull -- --delete <callId>` deletes the call and its recording from Vapi.

## Note, 2026-10-13: both voices are AI

The founder could not record the Sample Call, so an AI actor made it: a second Vapi assistant ("Caller actor · Mangrove Air", `vapi/actor.ts`) played the caller and called the real Luna from a dev-only page (`/dev/actor-call`). The one recording holds no human voice at all: both sides are AI. Recording is still off for every Visitor, and the same laptop-only switch made this one recording. Two calls were recorded (a sound check and the keeper); both were deleted from Vapi after the sound was committed. Vapi keeps only their times, cost and settings: no recording, no transcript.
