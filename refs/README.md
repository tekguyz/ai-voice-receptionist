# Design references — AI Voice Receptionist rebuild

Read this first in the `/grill-with-docs`. Saved 2026-10-03. Not a decision.
Context: tekguyz/tekguyz-one #7 and #17. Full background and open questions:
`C:/Projects/tekguyz-one/docs/voice-demo-design-refs.md`.

**Founder's verdict:** likes the layout and ideas of all of these. **Does not
want the purple.** The colors come from the "pick the look" ticket, not from
these pictures.

The pictures are from a Dribbble design for an AI receptionist app (the
assistant is called "Viora" there). They are references, not assets. Do not
ship them or copy the name.

## The pictures

| File | What it shows |
|---|---|
| `01-test-call-home-screen.webp` | Home screen of a business ("Luke's Mechanic"). A glowing orb, the line "Your assistant is standing by", a big **Call Now** button, and "Test call from +999 …" with a refresh icon. Three round buttons below: share, redo, explore. **This is the Test Call idea.** |
| `02-three-screens-forwarding-dashboard-live-call.webp` | Three phone screens. **Left:** Call Forwarding setup (Set Up / Turn Off, mobile network, ring duration, Dial Activation Code, Set Up Manually, Test Forwarding). **Middle:** a morning dashboard. "Viora is answering" switch, three numbers (calls answered, booked today, spam blocked), and a Recent Call card with a booking. **Right:** a live call. |
| `03-live-call-in-hand.webp` | Close-up of the live call screen. Caller name, number and timer, a sound wave, the live transcript (Caller and assistant lines), and tags that fill in as the call goes: Job, Urgency, Address captured. Row of controls with a red end button. |

## Ideas worth taking to the grill

- **Test Call as the demo's front door.** A visitor presses one button and
  talks to the receptionist. Fits `claude-config/DEMO-STANDARD.md`.
- **Live view during the call:** transcript plus tags that fill in as the
  AI hears them (job, urgency, address).
- **After the call:** a "what the assistant handled" dashboard: calls
  answered, booked, spam blocked, and a recent-call card with the booking.
- **Forwarding setup screen.** Probably not for a demo. Ask in the grill.

## Open for the grill

- New repo, or rebuild inside `tekguyz/Real-Stone-Granite-AI-Experience`?
- Theme on TEKGUYZ, not on Real Stone & Granite (#7 says probably).
- Colors: anything but purple.
- Phone or desktop first? These references are all phone.
