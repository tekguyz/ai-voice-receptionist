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
| 4 | `01a1373b-e1ab-7331-9cca-6950402db5b8` | `01a1373b-d564-7eee-88a5-fd9cfc28f1e1` | Change 3: goodbye in the call's language. Actor waits 1.2 s before answering. | **English pass bar met.** Four details, booked, "You're all set … Thanks for calling Mangrove Air. Have a great day.", then the end. No narration. Average turn 1868 ms (slowest 2356). No talking over. Not keeper quality yet: the Actor said "eighty degrees", left out his mom, and said "No" to a correct read-back; Vapi heard Luna's greeting as "Mangrover". | 1.37 + 1.43 |
| 5 | `01a1373f-be3f-7cc6-8d86-38846d95c642` | `01a1373f-b177-733f-a7f4-021038910366` | Spanish check (finding 2). Also: greeting with a full stop after the name; Actor keeps to its script. | Finding 2 fixed: no narration. Report PASS, average turn 1634 ms. Greeting now heard as "Mangrove Air." But she switched to English after the address (read-back, confirmation, goodbye). | 1.50 + 1.55 |
