# Voice calls, 2026-10-13 (spec: AI actor Sample Call)

Budget: 10. One row per Luna call. A bridged call also makes one Actor call; both are listed. Minutes: from each call's start and end in Vapi.

Text rehearsal was skipped: Vapi's Chat API answered 402 "Add a payment method to use chat."

| # | Luna call | Actor call | Why | Result | Minutes (Luna + Actor) |
|---|---|---|---|---|---|
| 1 | `01a13731-41c4-7000-823c-410bf1f48bae` (recorded) | `01a13731-3148-799d-8577-fb7493765f00` | Bridge sound check, recording on, 50 s cap, Luna unchanged (Gemini) | Pass. Both sides loud and clean (mean −28.7 / −25.7 dB, peak −1.5 / −0.5 dB). Speech never overlaps; the caller side is silent while Luna talks, so no echo. Each side's transcript matches the other's speech. Luna's turns slow: 2.8–4.3 s from the end of the caller's line to her reply. | 0.86 + 0.92 |

Bridge start timings (call 1): SDK 0.5 s, Actor joined 4.2 s, `/api/test-call` answered 6.1 s, Luna joined 7.4 s, Luna's greeting ends 13.1 s.

**Route:** the browser bridge won. Two Vapi web calls run in one tab once Daily is told to allow two call objects; no phone number was needed.
| 2 | `01a13734-d726-7cc6-bd4c-271b7a4a5db8` | `01a13734-cba0-7cc6-8d19-fec207ac4579` | Change 1: Luna on gpt-4.1-mini (was Gemini 3.5 Flash) | Fail. Finding 1 stays: after `bookTime` she says "Goodbye." and ends the call, no confirmation. Finding 3 better: average turn 1823 ms (model 863 ms). Also seen: she wrote a made-up name ("John Doe") before asking, and she talked over the caller while he read the address digit by digit. | 1.54 + 1.59 |
| 3 | `01a13738-bf79-7cc6-bd6d-085bfc2760cb` | `01a13738-b317-7000-8281-2393398cad1a` | Change 2: no `endCall` tool; Luna ends by her goodbye phrase. Actor says the address in one phrase. | Finding 1 fixed: confirmation, then goodbye, then the end (`assistant-said-end-call-phrase`). Report PASS, average turn 1798 ms. Not keeper quality: she said the Spanish goodbye in an English call, and the Actor talked over her time offer, so he picked "the first time" without hearing it. | 1.44 + 1.50 |
