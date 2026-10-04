// The Call Story: turns a list of call events into what the screens show.
// Pure: no I/O, no React, no clock. Every call source (the Sample Call
// player now, the Vapi source later) speaks these events. Times are
// milliseconds from the start of the call.

import { SAMPLE_BUSINESS } from "@/lib/sample-business";

export type Speaker = "caller" | "receptionist";
export type DetailField = "name" | "job" | "urgency" | "address";
export type EndReason = "caller-hung-up" | "receptionist-finished" | "time-limit" | "error";

export type CallEvent =
  | { type: "line"; speaker: Speaker; text: string; atMs: number }
  | { type: "detail"; field: DetailField; value: string; atMs: number }
  | { type: "booked"; time: string; atMs: number }
  | { type: "ended"; reason: EndReason; atMs: number };

export type CallDetails = Partial<Record<DetailField, string>>;
export type TranscriptLine = { speaker: Speaker; text: string; atMs: number };

/** The live call screen: what has happened so far. */
export type CallView = {
  status: "waiting" | "live" | "ended";
  lines: TranscriptLine[];
  details: CallDetails;
  booked: string | null;
  endReason: EndReason | null;
  elapsedMs: number;
};

/** What the Owner gets once the call ends. */
export type CallNotes = {
  summary: string;
  lines: TranscriptLine[];
  details: CallDetails;
  booked: string | null;
  endReason: EndReason;
  durationMs: number;
  /** A preview only. Nothing is ever sent. */
  confirmationText: string;
};

export type CallStoryOptions = {
  /** A summary written elsewhere (Vapi's, later). Without it, one is built from the details. */
  summary?: string;
};

export function tellCallStory(
  events: readonly CallEvent[],
  options: CallStoryOptions = {},
): { view: CallView; notes: CallNotes | null } {
  const lines: TranscriptLine[] = [];
  const details: CallDetails = {};
  let booked: string | null = null;
  let endReason: EndReason | null = null;
  let elapsedMs = 0;

  for (const event of events) {
    elapsedMs = Math.max(elapsedMs, event.atMs);
    switch (event.type) {
      case "line":
        lines.push({ speaker: event.speaker, text: event.text, atMs: event.atMs });
        break;
      case "detail":
        details[event.field] = event.value;
        break;
      case "booked":
        booked = event.time;
        break;
      case "ended":
        endReason = event.reason;
        break;
    }
  }

  const status = endReason ? "ended" : events.length > 0 ? "live" : "waiting";
  const view: CallView = { status, lines, details, booked, endReason, elapsedMs };
  if (!endReason) return { view, notes: null };

  return {
    view,
    notes: {
      summary: options.summary ?? buildSummary(details, booked),
      lines,
      details,
      booked,
      endReason,
      durationMs: elapsedMs,
      confirmationText: buildConfirmationText(details, booked),
    },
  };
}

function buildSummary(details: CallDetails, booked: string | null): string {
  const { name, job, urgency, address } = details;
  const sentences: string[] = [];
  if (!name && !job && !urgency && !address) sentences.push("No details were captured.");
  if (job) sentences.push(`${name ?? "A caller"} called about ${job}.`);
  else if (name) sentences.push(`${name} called.`);
  if (urgency) sentences.push(`Urgency: ${urgency}.`);
  if (address) sentences.push(`Address: ${address}.`);
  sentences.push(booked ? `Booked for ${booked}.` : "No time was booked.");
  return sentences.join(" ");
}

function buildConfirmationText(details: CallDetails, booked: string | null): string {
  const firstName = details.name?.trim().split(/\s+/)[0];
  const greeting = `Hi${firstName ? ` ${firstName}` : ""}, this is ${SAMPLE_BUSINESS.name}.`;
  const body = booked
    ? `You're booked for ${booked}${details.address ? ` at ${details.address}` : ""}.`
    : "We got your call and will call you back soon.";
  return `${greeting} ${body} Reply here if anything changes.`;
}
