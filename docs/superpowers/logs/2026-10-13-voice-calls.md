# Voice calls, 2026-10-13 (spec: AI actor Sample Call)

Budget: 10. One row per Luna call. A bridged call also makes one Actor call; both are listed. Minutes: from each call's start and end in Vapi.

Text rehearsal was skipped: Vapi's Chat API answered 402 "Add a payment method to use chat."

| # | Luna call | Actor call | Why | Result | Minutes (Luna + Actor) |
|---|---|---|---|---|---|
| 1 | `01a13731-41c4-7000-823c-410bf1f48bae` (recorded) | `01a13731-3148-799d-8577-fb7493765f00` | Bridge sound check, recording on, 50 s cap, Luna unchanged (Gemini) | Pass. Both sides loud and clean (mean −28.7 / −25.7 dB, peak −1.5 / −0.5 dB). Speech never overlaps; the caller side is silent while Luna talks, so no echo. Each side's transcript matches the other's speech. Luna's turns slow: 2.8–4.3 s from the end of the caller's line to her reply. | 0.86 + 0.92 |
| 2 | `01a13734-d726-7cc6-bd4c-271b7a4a5db8` | `01a13734-cba0-7cc6-8d19-fec207ac4579` | Change 1: Luna on gpt-4.1-mini (was Gemini 3.5 Flash) | Fail. Finding 1 stays: after `bookTime` she says "Goodbye." and ends the call, no confirmation. Finding 3 better: average turn 1823 ms (model 863 ms). Also seen: she wrote a made-up name ("John Doe") before asking, and she talked over the caller while he read the address digit by digit. | 1.54 + 1.59 |
| 3 | `01a13738-bf79-7cc6-bd6d-085bfc2760cb` | `01a13738-b317-7000-8281-2393398cad1a` | Change 2: no `endCall` tool; Luna ends by her goodbye phrase. Actor says the address in one phrase. | Finding 1 fixed: confirmation, then goodbye, then the end (`assistant-said-end-call-phrase`). Report PASS, average turn 1798 ms. Not keeper quality: she said the Spanish goodbye in an English call, and the Actor talked over her time offer, so he picked "the first time" without hearing it. | 1.44 + 1.50 |
| 4 | `01a1373b-e1ab-7331-9cca-6950402db5b8` | `01a1373b-d564-7eee-88a5-fd9cfc28f1e1` | Change 3: goodbye in the call's language. Actor waits 1.2 s before answering. | **English pass bar met.** Four details, booked, "You're all set … Thanks for calling Mangrove Air. Have a great day.", then the end. No narration. Average turn 1868 ms (slowest 2356). No talking over. Not keeper quality yet: the Actor said "eighty degrees", left out his mom, and said "No" to a correct read-back; Vapi heard Luna's greeting as "Mangrover". | 1.37 + 1.43 |
| 5 | `01a1373f-be3f-7cc6-8d86-38846d95c642` | `01a1373f-b177-733f-a7f4-021038910366` | Spanish check (finding 2). Also: greeting with a full stop after the name; Actor keeps to its script. | Finding 2 fixed: no narration. Report PASS, average turn 1634 ms. Greeting now heard as "Mangrove Air." But she switched to English after the address (read-back, confirmation, goodbye). | 1.50 + 1.55 |
| 6 | `01a13742-7c61-799d-85fa-29597fa6efdd` | `01a13742-74b8-7ccd-97ad-545721bebb90` | Spanish recheck after "stay in Spanish to the goodbye" | Fail. Read-back and times now in Spanish. After `bookTime`, Vapi's English filler "One moment." played; the Actor said "Claro" and "Gracias"; Luna's transcriber heard "Claire" and "Gracious", she saved "Claire" as the name and ended in English. Average turn 2765 ms. The founder said not to focus on Spanish: no more Spanish calls; the rest goes to an issue. | 1.68 + 1.72 |
| 7 | `01a13746-5699-7dd9-a485-862123c619fb` (recorded, **keeper**) | `01a13746-492f-7000-8011-9d9efc7f78f4` | The Sample Call, recording on, English | **Kept.** Report PASS: four details, booked "tomorrow at 9 AM", "You're all set for tomorrow at nine in the morning at …, Thanks for calling Mangrove Air. Have a great day.", then the end. No narration. Average turn 1582 ms. 77 s. Pulled with `--offset-ms -230`; three lines Vapi logged with no length are placed at their real speech start. | 1.28 + 1.35 |

Bridge start timings (call 1): SDK 0.5 s, Actor joined 4.2 s, `/api/test-call` answered 6.1 s, Luna joined 7.4 s, Luna's greeting ends 13.1 s.

**Route:** the browser bridge won. Two Vapi web calls run in one tab once Daily is told to allow two call objects; no phone number was needed.

**Total: 7 voice calls.** Luna 9.7 min, Actor 10.1 min (19.8 min of Vapi calls). Budget left: 3.

## Start time (finding 4)

Measured on the bridge page (it runs the same `/api/test-call`, SDK load and room join as the Test Call screen):

- SDK load: 0.1–0.5 s once cached; the Test Call screen now loads it when it opens, so "Call now" no longer waits for it.
- `/api/test-call` (gate, signed token, Vapi create): 0.7–1.0 s (server log).
- Room join: 1.0–1.5 s.
- Join to the end of Luna's greeting: about 5.4 s; the greeting itself lasts about 3 s, so she starts speaking about 2.4 s after the join.

Not measured: the microphone prompt. The built-in browser has no microphone, and the bridge does not use one.

## Deleted from Vapi (founder's yes, 2026-10-13)

`01a13731-41c4-7000-823c-410bf1f48bae` (bridge check) and `01a13746-5699-7dd9-a485-862123c619fb` (keeper), with `npm run sample-call:pull -- --delete <callId>`. Checked after: the recording answers 404, and the call record keeps no transcript and no messages, only its times, cost and settings.

## The founder's own Test Call (not in the budget)

`01a137d9-2700-7ff6-bfa2-c25da4e9292d`, 2026-10-13 20:39 local, on the `voice-demo-batch-11` preview, from a Pixel 9a. 111 s, $0.18. Ended: `customer-ended-call` (the founder pressed End Call at 1:58 in the recording).

- All four details and the booking were right: Alfredo Gomez, AC not working, immediate, 4450 Northeast 18th Court, Deerfield Beach 33306, Wednesday, October 14 at 9 AM. Average turn 1763 ms.
- `luna:report` FAIL only because the founder ended the call while she read the confirmation. Not a Luna bug.
- She said "You're all set" at 95.9 s, before `bookTime` ran (100.2 s).
- She said "We have two open times" twice in one reply.
- Vapi heard "Mangrover" again, and wrote "Madam" and "the three of the better" for the caller.
- The screen recording has no call sound (mean −60 dB). Android's recorder cannot take Chrome's call audio or the microphone while Chrome uses it. Not an app bug.
- On a phone, "What was said" shows only the newest 2 lines during the call (`latest={2}`). Short lines ("De", "We have --", "Madam,") show, then the next line pushes them out. The full list shows at the end. It works as built, but it looked broken to the founder.
