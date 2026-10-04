"use client";

// Plain, unstyled on purpose: step 2 of the rebuild picks the look.
// The screen takes a call source and never knows it is the Sample Call.

import { useEffect, useRef, useState } from "react";
import type { CallSource, RunningCall } from "@/lib/call-source";
import { tellCallStory, type CallDetails, type CallEvent } from "@/lib/call-story";
import { createSampleCallPlayer } from "@/lib/sample-call";
import { SAMPLE_BUSINESS } from "@/lib/sample-business";

const DETAIL_LABELS: Record<keyof CallDetails, string> = {
  name: "Name",
  job: "Job",
  urgency: "Urgency",
  address: "Address",
};

const END_REASONS = {
  "caller-hung-up": "Caller hung up",
  "receptionist-finished": "Receptionist finished",
  "time-limit": "Time limit reached",
  error: "Call failed",
} as const;

function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function SampleCallScreen() {
  const [source] = useState<CallSource>(() => createSampleCallPlayer());
  const [events, setEvents] = useState<CallEvent[]>([]);
  const call = useRef<RunningCall | null>(null);

  useEffect(() => () => call.current?.stop(), []);

  function play() {
    call.current?.stop();
    setEvents([]);
    call.current = source.start((event) => setEvents((soFar) => [...soFar, event]));
  }

  const { view, notes } = tellCallStory(events);
  const tags = (Object.keys(DETAIL_LABELS) as (keyof CallDetails)[]).filter((field) => view.details[field]);

  return (
    <main className="p-4">
      <h1>{SAMPLE_BUSINESS.name}: Sample Call</h1>
      <p>A recorded call to the Receptionist, {SAMPLE_BUSINESS.receptionistName}. Text only for now.</p>
      <button type="button" onClick={play} className="border px-2">
        {view.status === "waiting" ? "Play the Sample Call" : "Play again"}
      </button>

      {view.status !== "waiting" && (
        <section aria-label="Live call">
          <h2>Live call</h2>
          <p>
            Status: {view.status} · {formatTime(view.elapsedMs)}
          </p>
          <ul aria-label="Captured details">
            {tags.map((field) => (
              <li key={field}>
                {DETAIL_LABELS[field]}: {view.details[field]}
              </li>
            ))}
            {view.booked && <li>Booked: {view.booked}</li>}
          </ul>
          <ol aria-label="Transcript" aria-live="polite">
            {view.lines.map((line, i) => (
              <li key={i}>
                {line.speaker === "caller" ? "Caller" : "Receptionist"}: {line.text}
              </li>
            ))}
          </ol>
        </section>
      )}

      {notes && (
        <section aria-label="Call Notes">
          <h2>Call Notes</h2>
          <p>Summary: {notes.summary}</p>
          <ul>
            {(Object.keys(DETAIL_LABELS) as (keyof CallDetails)[]).map((field) => (
              <li key={field}>
                {DETAIL_LABELS[field]}: {notes.details[field] ?? "Not captured"}
              </li>
            ))}
            <li>Booked: {notes.booked ?? "Nothing booked"}</li>
            <li>
              Ended: {END_REASONS[notes.endReason]} after {formatTime(notes.durationMs)}
            </li>
          </ul>
          <h3>Confirmation text preview</h3>
          <p>{notes.confirmationText}</p>
          <p>Not available in the demo. Nothing is sent.</p>
        </section>
      )}
    </main>
  );
}
