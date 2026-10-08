// The Dashboard's sample calls: made-up calls Luna took for the Sample
// Business while the Owner worked. Each is dated a fixed number of minutes
// before the start of this hour, so the Dashboard never looks stale and the
// times hold still between page loads, and each runs through the Call Story
// like every other call. A booked time is one of the two times
// offered on the call's own date. Names and addresses are made up.
// Not the Sample Call: that is the one recorded call (lib/sample-call.ts).

import {
  DETAIL_FIELDS,
  tellCallStory,
  type CallDetails,
  type CallEvent,
  type CallNotes,
  type EndReason,
  type Speaker,
} from "@/lib/call-story";
import { openTimes } from "@/lib/open-times";

export type SampleCall = {
  readonly id: string;
  readonly at: Date;
  readonly spam: boolean;
  /** The ticket number printed on its Call Notes. */
  readonly number: string;
  readonly notes: CallNotes;
};

type Script = {
  id: string;
  number: string;
  minutesAgo: number;
  spam?: true;
  details?: CallDetails;
  /** Which of the two offered times the caller picked. */
  picks?: 0 | 1;
  endReason: EndReason;
  durationMs: number;
  summary: (booked: string | null) => string;
  lines: (offered: readonly [string, string]) => [Speaker, string][];
};

const GREETING: [Speaker, string] = ["receptionist", "Thanks for calling Mangrove Air, this is Luna. How can I help?"];
const NOT_A_SERVICE_CALL: [Speaker, string] = ["receptionist", "This line is for Mangrove Air service calls. Goodbye."];

// Newest first.
const SCRIPTS: readonly Script[] = [
  {
    id: "sample-warm-air",
    number: "04126",
    minutesAgo: 38,
    details: { name: "Carla Mendez", job: "AC blowing warm air", urgency: "urgent, the house is at 84 degrees", address: "2215 Palm Shadow Lane, Miramar" },
    picks: 0,
    endReason: "receptionist-finished",
    durationMs: 118_000,
    summary: (booked) => `Carla Mendez's AC is running but blowing warm air, and the house is at 84 degrees. Booked for ${booked}.`,
    lines: (offered) => [
      GREETING,
      ["caller", "Hi, my AC is running but it's blowing warm air. It's 84 in here."],
      ["receptionist", "I'm sorry, that's no fun in this heat. Can I get your name?"],
      ["caller", "Carla Mendez."],
      ["receptionist", "Thanks, Carla. What's the address?"],
      ["caller", "2215 Palm Shadow Lane in Miramar."],
      ["receptionist", `I can send a technician ${offered[0]} or ${offered[1]}. Which works better?`],
      ["caller", "The first one, please."],
      ["receptionist", `You're booked for ${offered[0]}. You'll get a text to confirm. Stay cool, Carla.`],
    ],
  },
  {
    id: "sample-spam-warranty",
    number: "04125",
    minutesAgo: 172,
    spam: true,
    endReason: "receptionist-finished",
    durationMs: 21_000,
    summary: () => "A recorded sales message about a car warranty. Luna ended the call. Nothing was booked.",
    lines: () => [
      GREETING,
      ["caller", "This is an important message about your vehicle's extended warranty. Press one to speak to"],
      NOT_A_SERVICE_CALL,
    ],
  },
  {
    id: "sample-no-cooling",
    number: "04124",
    minutesAgo: 312,
    details: { name: "Ana Lucía Ortiz", job: "AC not cooling", urgency: "urgent, her elderly mother is at home", address: "4410 SW 92nd Court, Westchester" },
    picks: 1,
    endReason: "receptionist-finished",
    durationMs: 142_000,
    summary: (booked) => `Ana Lucía Ortiz called in Spanish: the AC is not cooling and her elderly mother is at home. Booked for ${booked}.`,
    // The caller spoke Spanish, so Luna did too. The screens stay in English.
    lines: () => [
      GREETING,
      ["caller", "Hola, ¿habla español? El aire acondicionado no enfría."],
      ["receptionist", "Claro que sí. Lo siento mucho. ¿Me dice su nombre, por favor?"],
      ["caller", "Ana Lucía Ortiz."],
      ["receptionist", "Gracias, Ana Lucía. ¿Es urgente?"],
      ["caller", "Sí, mi mamá es mayor y hace mucho calor en la casa."],
      ["receptionist", "Entiendo. ¿Cuál es la dirección?"],
      ["caller", "4410 SW 92nd Court, en Westchester."],
      ["receptionist", "Puedo enviar un técnico el próximo día disponible, a las 9 de la mañana o a las 2 de la tarde. ¿Cuál prefiere?"],
      ["caller", "A las 2, por favor."],
      ["receptionist", "Listo, quedó reservado. Le llegará un mensaje de texto para confirmar."],
    ],
  },
  {
    id: "sample-tune-up",
    number: "04123",
    minutesAgo: 1_330,
    details: { name: "Derek Lawson", job: "yearly AC tune-up", urgency: "not urgent", address: "905 Coral Ridge Drive, Coral Springs" },
    picks: 1,
    endReason: "receptionist-finished",
    durationMs: 96_000,
    summary: (booked) => `Derek Lawson wants a yearly AC tune-up. Not urgent. Booked for ${booked}.`,
    lines: (offered) => [
      GREETING,
      ["caller", "Hi, I'd like to set up a yearly tune-up for my AC."],
      ["receptionist", "Happy to help. Can I get your name?"],
      ["caller", "Derek Lawson."],
      ["receptionist", "And the address, Derek?"],
      ["caller", "905 Coral Ridge Drive, Coral Springs."],
      ["receptionist", `I have ${offered[0]} or ${offered[1]}.`],
      ["caller", "The afternoon works."],
      ["receptionist", `Done. You're booked for ${offered[1]}.`],
    ],
  },
  {
    id: "sample-spam-listing",
    number: "04122",
    minutesAgo: 1_905,
    spam: true,
    endReason: "receptionist-finished",
    durationMs: 26_000,
    summary: () => "A robocall about a business listing. Luna ended the call. Nothing was booked.",
    lines: () => [
      GREETING,
      ["caller", "Your business listing will be suspended today unless you verify it. Press one to"],
      NOT_A_SERVICE_CALL,
    ],
  },
  {
    id: "sample-thermostat-price",
    number: "04121",
    minutesAgo: 2_870,
    details: { name: "Keisha Grant", job: "price for a smart thermostat", urgency: "not urgent" },
    endReason: "caller-hung-up",
    durationMs: 74_000,
    summary: () => "Keisha Grant asked what a smart thermostat costs to install. She will call back. Nothing was booked.",
    lines: () => [
      GREETING,
      ["caller", "Hi, how much do you charge to put in a smart thermostat?"],
      ["receptionist", "Good question. The technician gives the price on site after a quick look. Can I get your name?"],
      ["caller", "Keisha Grant. I'll think about it and call back."],
      ["receptionist", "No problem, Keisha. I'll let the team know you asked. Have a good day."],
    ],
  },
  {
    id: "sample-leak",
    number: "04120",
    minutesAgo: 4_210,
    details: { name: "Tom Becker", job: "water leaking from the indoor unit", urgency: "urgent", address: "318 Banyan Isle Way, Pembroke Pines" },
    picks: 0,
    endReason: "receptionist-finished",
    durationMs: 131_000,
    summary: (booked) => `Tom Becker has water leaking from the indoor AC unit onto the floor. Luna told him to turn the system off. Booked for ${booked}.`,
    lines: (offered) => [
      GREETING,
      ["caller", "Hey, there's water dripping from my AC unit inside, onto the floor."],
      ["receptionist", "Thanks for calling right away. Turn the system off for now if you can. What's your name?"],
      ["caller", "Tom Becker."],
      ["receptionist", "And your address, Tom?"],
      ["caller", "318 Banyan Isle Way, Pembroke Pines."],
      ["receptionist", `I can get someone out ${offered[0]} or ${offered[1]}.`],
      ["caller", "The earliest, please."],
      ["receptionist", `You're booked for ${offered[0]}. You'll get a text to confirm.`],
    ],
  },
];

export function sampleCalls(now: Date): SampleCall[] {
  return SCRIPTS.map((script) => play(script, now));
}

// Every zone the Sample Business could use is a whole number of hours from UTC.
const HOUR_MS = 60 * 60_000;
const startOfHour = (now: Date) => new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS);

function play(script: Script, now: Date): SampleCall {
  const at = new Date(startOfHour(now).getTime() - script.minutesAgo * 60_000);
  const offered = openTimes(at);
  const booked = script.picks === undefined ? null : offered[script.picks];
  const lines = script.lines(offered);
  // Lines spread evenly over the call; the details and the booking land part way.
  const step = Math.round(script.durationMs / (lines.length + 1));
  const events: CallEvent[] = lines.map(([speaker, text], i) => ({ type: "line", speaker, text, atMs: step * (i + 1) }));
  for (const field of DETAIL_FIELDS) {
    const value = script.details?.[field];
    if (value) events.push({ type: "detail", field, value, atMs: step });
  }
  if (booked) events.push({ type: "booked", time: booked, atMs: step * lines.length });
  events.push({ type: "ended", reason: script.endReason, atMs: script.durationMs });

  const { notes } = tellCallStory(events, { summary: script.summary(booked) });
  // Never null: the last event is always `ended`.
  return { id: script.id, at, spam: script.spam === true, number: script.number, notes: notes! };
}
