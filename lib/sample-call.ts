// The Sample Call: a stored, timed list of Call Story events and the player
// that emits them in step with playback.
//
// PLACEHOLDER: text only, no sound. Step 7 of the rebuild replaces this list
// with the founder's real recorded call and plays its audio. Every caller
// detail below is made up.

import type { CallSource } from "@/lib/call-source";
import type { CallEvent } from "@/lib/call-story";
import { realScheduler, type Scheduler } from "@/lib/scheduler";
import { SAMPLE_BUSINESS } from "@/lib/sample-business";

const { name: business, receptionistName } = SAMPLE_BUSINESS;

export const SAMPLE_CALL_EVENTS: readonly CallEvent[] = [
  { type: "line", speaker: "receptionist", text: `Thanks for calling ${business}, this is ${receptionistName}. How can I help?`, atMs: 0 },
  { type: "line", speaker: "caller", text: "Hi, my AC stopped cooling last night and it's 85 in the house.", atMs: 3500 },
  { type: "detail", field: "job", value: "AC not cooling", atMs: 5000 },
  { type: "line", speaker: "receptionist", text: "I'm sorry, that's no fun in this heat. Is anyone at home at risk, like a baby or someone elderly?", atMs: 7500 },
  { type: "line", speaker: "caller", text: "My mom is staying with us, so as soon as possible, please.", atMs: 11000 },
  { type: "detail", field: "urgency", value: "Urgent, as soon as possible", atMs: 12500 },
  { type: "line", speaker: "receptionist", text: "Understood. Can I get your name and the address of the home?", atMs: 14500 },
  { type: "line", speaker: "caller", text: "Marco Delgado, 1207 Mango Tree Lane in Kendall.", atMs: 17500 },
  { type: "detail", field: "name", value: "Marco Delgado", atMs: 18500 },
  { type: "detail", field: "address", value: "1207 Mango Tree Lane, Kendall", atMs: 19000 },
  { type: "line", speaker: "receptionist", text: "Thanks, Marco. I have tomorrow at 9 AM or tomorrow at 2 PM. Which works?", atMs: 21000 },
  { type: "line", speaker: "caller", text: "Nine in the morning, please.", atMs: 24500 },
  { type: "booked", time: "tomorrow, 9:00 AM", atMs: 25500 },
  { type: "line", speaker: "receptionist", text: "You're booked for tomorrow at 9 AM. You'll get a text to confirm. Stay cool, Marco!", atMs: 26500 },
  { type: "ended", reason: "receptionist-finished", atMs: 30000 },
];

/** The Call Notes summary, written like the Dashboard's sample calls. Only facts from the lines above. */
export const SAMPLE_CALL_SUMMARY =
  "Marco Delgado's AC stopped cooling last night and it's 85 in the house. His mom is staying with him, so it's urgent. Booked for tomorrow, 9:00 AM.";

/** Plays a timed event list: each event is emitted when playback reaches its time. */
export function createSampleCallPlayer(
  events: readonly CallEvent[] = SAMPLE_CALL_EVENTS,
  schedule: Scheduler = realScheduler,
): CallSource {
  return {
    start({ onEvent }) {
      let lastAtMs = 0;
      let ended = false;
      const emit = (event: CallEvent) => {
        if (ended) return;
        lastAtMs = event.atMs;
        if (event.type === "ended") ended = true;
        onEvent(event);
      };
      const cancels = events.map((event) => schedule(() => emit(event), event.atMs));
      return {
        stop() {
          for (const cancel of cancels) cancel();
          emit({ type: "ended", reason: "caller-hung-up", atMs: lastAtMs });
        },
      };
    },
  };
}
