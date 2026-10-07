"use client";

// The Call Notes: the yellow Owner's copy (DESIGN.md). The call screen shows
// it when a call ends; the Dashboard shows it for any call in its list.

import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { BusinessLine, DETAIL_LABELS, Field, SECTION_LABEL, Transcript, formatTime } from "@/app/_ui/ticket";
import { DETAIL_FIELDS, type CallNotes } from "@/lib/call-story";
import { SAMPLE_BUSINESS } from "@/lib/sample-business";

const END_REASONS = {
  "caller-hung-up": "Caller hung up",
  "receptionist-finished": `${SAMPLE_BUSINESS.receptionistName} ended the call`,
  "time-limit": "Time limit reached",
  error: "Call failed",
} as const;

/**
 * `sample`: notes shown whole at once (the Sample Call, a Dashboard sample
 * call). A Test Call's notes start as `waiting` (the browser's own copy, the
 * summary still being written), become `saved` when the server's copy
 * arrives, or `late` if it never does.
 */
export type NotesState = "sample" | "waiting" | "late" | "saved";

export function CallNotesSheet({
  notes,
  state,
  number,
  spam = false,
  when,
  actions,
}: {
  notes: CallNotes;
  state: NotesState;
  /** The ticket number printed in the header. */
  number: string;
  /** A spam call: no text to the caller, nothing for the calendar. */
  spam?: boolean;
  /** When the call came in, for example "Today · 11:22 AM". */
  when?: string;
  actions: ReactNode;
}) {
  const title = useRef<HTMLHeadingElement>(null);
  const [summaryId, textId, talkId] = [useId(), useId(), useId()];

  // The white sheet comes off from the top: start the Owner's copy there,
  // and move focus to its title so the change is announced. Before paint, so
  // the copy never shows at the old scroll position.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0 });
    title.current?.focus({ preventScroll: true });
  }, []);

  return (
    <article aria-label="Call Notes" className="copy-still mx-auto max-w-[960px]">
      <div className="perforation mb-4" />
      <header className="text-form">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 border-2 border-form px-5 pt-3 pb-2.5">
          <h1 ref={title} tabIndex={-1} className="font-form text-[2.25rem] leading-none font-extrabold tracking-tight uppercase">
            Call Notes
          </h1>
          <p className="font-form text-lg leading-none font-bold uppercase">
            Owner’s copy · No. {number}
          </p>
        </div>
        <p className="border-x-2 border-b-2 border-form px-5 py-1.5 font-form text-[0.9375rem] font-semibold tracking-wide uppercase">
          <BusinessLine />
        </p>
      </header>

      <div className="grid gap-x-12 gap-y-8 pt-6 md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="grid content-start gap-8">
          <section aria-labelledby={summaryId}>
            <h2 id={summaryId} className={SECTION_LABEL}>
              Summary
            </h2>
            <p className="mt-2 max-w-[44ch] text-[1.375rem] leading-snug font-medium text-balance">
              {state === "waiting"
                ? "Finishing the summary…"
                : state === "late"
                  ? "The summary did not arrive. The details below are from the call."
                  : notes.summary}
            </p>
            <p className="mt-3 text-print-soft">
              {when && `${when}. `}
              {END_REASONS[notes.endReason]} after {formatTime(notes.durationMs)}.
            </p>
            {state === "saved" && <p className="mt-1 text-print-soft">Saved. Our copy is deleted after 7 days.</p>}
          </section>

          <dl className="grid gap-4 [&_dd]:border-form">
            {/* A spam call has nothing to capture: a column of empty rules would read as a failure. */}
            {!spam &&
              DETAIL_FIELDS.map((field) => (
                <Field key={field} label={DETAIL_LABELS[field]} value={notes.details[field]} empty="Not captured" />
              ))}
            {!spam && <Field label="Booked" value={notes.booked} empty="Nothing booked" />}
            <Field label="Taken by" value={`${SAMPLE_BUSINESS.receptionistName}, Receptionist`} />
          </dl>
          {!spam && <p className="text-print-soft">In a real setup, the booking lands in the business’s calendar.</p>}
        </div>

        <div className="grid content-start gap-8">
          {spam ? (
            <section aria-labelledby={textId} className="border-2 border-form p-5">
              <h2 id={textId} className={SECTION_LABEL}>
                Spam blocked
              </h2>
              <p className="mt-2 text-[1.0625rem] leading-relaxed">
                No text goes to a spam caller.
              </p>
            </section>
          ) : (
            <section aria-labelledby={textId} className="border-2 border-form p-5">
              <h2 id={textId} className={SECTION_LABEL}>
                Text to the caller · preview
              </h2>
              <p className="mt-2 text-[1.0625rem] leading-relaxed">{notes.confirmationText}</p>
              <p className="mt-4 border-t border-form pt-3 text-sm text-print-soft">Not available in the demo. Nothing is sent.</p>
            </section>
          )}

          <section aria-labelledby={talkId}>
            <h2 id={talkId} className={`${SECTION_LABEL} mb-4`}>
              What was said
            </h2>
            <Transcript lines={notes.lines} receptionistName={SAMPLE_BUSINESS.receptionistName} />
          </section>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap gap-3 border-t-2 border-form pt-6">{actions}</div>
    </article>
  );
}
