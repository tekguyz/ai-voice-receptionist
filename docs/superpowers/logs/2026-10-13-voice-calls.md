# Voice calls, 2026-10-13 (spec: AI actor Sample Call)

Budget: 10. One row per Luna call. A bridged call also makes one Actor call; both are listed. Minutes: from each call's start and end in Vapi.

Text rehearsal was skipped: Vapi's Chat API answered 402 "Add a payment method to use chat."

| # | Luna call | Actor call | Why | Result | Minutes (Luna + Actor) |
|---|---|---|---|---|---|
| 1 | `01a13731-41c4-7000-823c-410bf1f48bae` (recorded) | `01a13731-3148-799d-8577-fb7493765f00` | Bridge sound check, recording on, 50 s cap, Luna unchanged (Gemini) | Pass. Both sides loud and clean (mean −28.7 / −25.7 dB, peak −1.5 / −0.5 dB). Speech never overlaps; the caller side is silent while Luna talks, so no echo. Each side's transcript matches the other's speech. Luna's turns slow: 2.8–4.3 s from the end of the caller's line to her reply. | 0.86 + 0.92 |

Bridge start timings (call 1): SDK 0.5 s, Actor joined 4.2 s, `/api/test-call` answered 6.1 s, Luna joined 7.4 s, Luna's greeting ends 13.1 s.

**Route:** the browser bridge won. Two Vapi web calls run in one tab once Daily is told to allow two call objects; no phone number was needed.
