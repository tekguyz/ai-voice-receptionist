"use client";

// The call screen on the Service Ticket look (DESIGN.md). One screen serves
// both call sources: the Test Call (Vapi) and the Sample Call, its fallback.
// The sheets below read only the Call Story's view and notes, not the source
// behind them.

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  DemoBanner,
  EndCallButton,
  Field,
  FormButton,
  OnTheLine,
  PhoneIcon,
  PlayIcon,
  StampButton,
  TicketHeader,
  Transcript,
} from "@/app/_ui/ticket";
import type { CallSource, RunningCall, StartFailure } from "@/lib/call-source";
import { DETAIL_FIELDS, tellCallStory, type CallDetails, type CallEvent, type CallNotes, type CallView } from "@/lib/call-story";
import { createSampleCallPlayer } from "@/lib/sample-call";
import { SAMPLE_BUSINESS } from "@/lib/sample-business";
import { browserVapiSourceDeps } from "@/lib/vapi-browser";
import { createVapiSource } from "@/lib/vapi-source";

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

const FAILURE_NOTICES: Record<StartFailure, string> = {
  "microphone-blocked": "Your microphone is blocked, so the call can't start. You can still hear how it works.",
  limit: "The Test Calls for today are used up. You can still hear how it works.",
  unavailable: "The call couldn't connect. You can still hear how it works.",
  "connect-failed": "The call couldn't connect. You can still hear how it works.",
};

// Decoration on a made-up work order; not a real record.
const TICKET_NUMBER = "04127";

const SECTION_LABEL = "font-form text-sm leading-tight font-bold tracking-wider text-form uppercase";
const CALL_STATUS = "flex items-center gap-3 font-form text-2xl font-bold uppercase";
const WAITING_LINE = "font-form text-[1.875rem] leading-tight font-bold text-balance";

function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

type Mode = "test" | "sample";
type Phase =
  // `focus`: after Cancel or Stop, focus goes back to the button that starts that call again.
  | { kind: "ready"; focus?: Mode }
  | { kind: "connecting" }
  | { kind: "failed"; failure: StartFailure }
  | { kind: "running"; mode: Mode };

export function CallScreen() {
  const [testCall] = useState<CallSource>(() => createVapiSource(browserVapiSourceDeps()));
  const [sampleCall] = useState<CallSource>(() => createSampleCallPlayer());
  const [phase, setPhase] = useState<Phase>({ kind: "ready" });
  const [events, setEvents] = useState<CallEvent[]>([]);
  // When the call's clock started, on the performance.now() clock.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  // After the call ends, the white sheet is pulled off; then it is gone.
  const [sheetGone, setSheetGone] = useState(false);
  const call = useRef<RunningCall | null>(null);
  // Each call gets a number. Anything a call says after it is no longer the
  // current one (stopped, failed or replaced) is ignored.
  const callNumber = useRef(0);

  useEffect(
    () => () => {
      callNumber.current += 1;
      call.current?.stop();
    },
    [],
  );

  const { view, notes } = tellCallStory(events);
  const ticking = phase.kind === "running" && !notes;

  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(timer);
  }, [ticking]);

  // Called straight from a click: the Test Call asks for the microphone inside start().
  function begin(next: Mode) {
    const number = ++callNumber.current;
    call.current?.stop();
    setEvents([]);
    setStartedAt(null);
    setSheetGone(false);
    setPhase(next === "test" ? { kind: "connecting" } : { kind: "running", mode: next });
    call.current = (next === "test" ? testCall : sampleCall).start({
      onEvent: (event) => {
        if (number !== callNumber.current) return;
        const arrived = performance.now();
        setStartedAt((at) => at ?? arrived - event.atMs);
        setPhase({ kind: "running", mode: next });
        setEvents((soFar) => [...soFar, event]);
      },
      onFailed: (failure) => {
        if (number !== callNumber.current) return;
        callNumber.current += 1;
        call.current = null;
        setPhase({ kind: "failed", failure });
      },
    });
  }

  function endTestCall() {
    call.current?.stop(); // the source emits `ended` (caller-hung-up): Call Notes open
    call.current = null;
  }

  function cancelOrStopSample(mode: Mode) {
    callNumber.current += 1; // the stopped call's last `ended` is not wanted
    call.current?.stop();
    call.current = null;
    setEvents([]);
    setStartedAt(null);
    setPhase({ kind: "ready", focus: mode });
  }

  const elapsedMs = ticking && startedAt !== null ? Math.max(view.elapsedMs, now - startedAt) : view.elapsedMs;
  const mode: Mode = phase.kind === "running" ? phase.mode : "test";

  if (notes) {
    return (
      <Page>
        <div className="relative">
          <OwnersCopy
            notes={notes}
            againLabel={mode === "test" ? "Make another Test Call" : "Play the Sample Call again"}
            onAgain={() => begin(mode)}
          />
          {!sheetGone && (
            // Reduced motion hides this at once (globals.css); otherwise it
            // lifts away and is removed when its own lift ends.
            <div
              aria-hidden="true"
              inert
              className="sheet-away absolute inset-x-0 top-0"
              onAnimationEnd={(e) => {
                if (e.target === e.currentTarget) setSheetGone(true);
              }}
            >
              <TopSheet
                view={view}
                status={
                  <p className={CALL_STATUS}>
                    Call ended
                    <span className="ml-auto text-form">{formatTime(view.elapsedMs)}</span>
                  </p>
                }
              />
            </div>
          )}
        </div>
      </Page>
    );
  }

  let status: ReactNode;
  let controls: ReactNode;
  switch (phase.kind) {
    case "ready":
      status = <p className={WAITING_LINE}>Your receptionist is standing by</p>;
      controls = (
        <>
          <StampButton onClick={() => begin("test")} icon={<PhoneIcon />} autoFocus={phase.focus === "test"}>
            Call now
          </StampButton>
          <p className="mt-3 text-sm text-print-muted">Make up your details. Don&apos;t give your real name or address.</p>
          <p className="mt-1 text-sm text-print-muted">Only the words are kept, for 7 days. Never your voice.</p>
          <div className="mt-5">
            <FormButton onClick={() => begin("sample")} autoFocus={phase.focus === "sample"}>
              Play the Sample Call
            </FormButton>
          </div>
        </>
      );
      break;
    case "connecting":
      status = <p className={CALL_STATUS}>Calling…</p>;
      controls = (
        <FormButton onClick={() => cancelOrStopSample("test")} autoFocus>
          Cancel
        </FormButton>
      );
      break;
    case "failed":
      status = (
        <>
          <p className={WAITING_LINE}>Your receptionist is standing by</p>
          <p role="alert" className="mt-2 text-print-muted">
            {FAILURE_NOTICES[phase.failure]}
          </p>
        </>
      );
      controls = (
        <>
          <StampButton onClick={() => begin("sample")} icon={<PlayIcon />} autoFocus>
            Play the Sample Call
          </StampButton>
          {phase.failure === "connect-failed" && (
            <div className="mt-5">
              <FormButton onClick={() => begin("test")}>Try calling again</FormButton>
            </div>
          )}
        </>
      );
      break;
    case "running":
      status = (
        <p className={CALL_STATUS}>
          <OnTheLine />
          On the line
          <span className="ml-auto text-form">{formatTime(elapsedMs)}</span>
        </p>
      );
      controls =
        phase.mode === "test" ? (
          <EndCallButton onClick={endTestCall} autoFocus />
        ) : (
          <FormButton onClick={() => cancelOrStopSample("sample")} autoFocus>
            Stop the Sample Call
          </FormButton>
        );
      break;
  }

  return (
    <Page>
      <TopSheet view={view} status={status} controls={controls} />
    </Page>
  );
}

function Page({ children }: { children: ReactNode }) {
  return (
    <>
      <DemoBanner />
      <main className="mx-auto max-w-[1200px] px-4 pt-4 pb-10 md:pt-12">{children}</main>
    </>
  );
}

/**
 * The white top sheet: the call as it happens. On a phone it is one sheet.
 * From md the job details sit beside it on their own sheet; from lg the call
 * column sits in the middle of the screen at phone width.
 */
function TopSheet({ view, status, controls }: { view: CallView; status: ReactNode; controls?: ReactNode }) {
  const talkId = useId();
  return (
    <article
      aria-label="Work order"
      className="mx-auto grid max-w-[420px] [filter:drop-shadow(0_2px_2px_rgb(90_74_30/0.16))_drop-shadow(0_14px_24px_rgb(90_74_30/0.22))] [grid-template-areas:'head''status''fields''controls''talk'] md:max-w-none md:grid-cols-[minmax(0,420px)_minmax(0,22rem)] md:justify-center md:gap-x-8 md:[grid-template-areas:'head_fields''status_fields''controls_fields''talk_fields'] lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)_minmax(0,1fr)] lg:[grid-template-areas:'._head_fields''._status_fields''._controls_fields''._talk_fields']"
    >
      <div className="bg-sheet [grid-area:head]">
        <TicketHeader number={TICKET_NUMBER} />
      </div>

      <div className="-mt-px bg-sheet px-5 pt-4 [grid-area:status]">{status}</div>

      <section
        aria-label="Job details"
        className="-mt-px bg-sheet px-5 pt-3 pb-1 [grid-area:fields] md:mt-0 md:max-w-[22rem] md:self-start md:pt-5 md:pb-6"
      >
        <h2 className={`${SECTION_LABEL} mb-3 hidden border-b-2 border-form pb-2 md:block`}>Job details · No. {TICKET_NUMBER}</h2>
        <dl className="grid gap-1.5 md:gap-4">
          {DETAIL_FIELDS.map((field) => (
            <Field key={field} label={DETAIL_LABELS[field]} value={view.details[field]} />
          ))}
          <Field label="Booked" value={view.booked} />
        </dl>
      </section>

      <div className="-mt-px bg-sheet px-5 pt-5 pb-5 [grid-area:controls]">{controls}</div>

      {/* Always in the page, even empty, so a screen reader hears the first line too. */}
      <section
        aria-labelledby={view.lines.length > 0 ? talkId : undefined}
        className={`-mt-px bg-sheet [grid-area:talk] ${view.lines.length > 0 ? "border-t border-form-rule px-5 pt-5 pb-8" : ""}`}
      >
        {view.lines.length > 0 && (
          <h2 id={talkId} className={`${SECTION_LABEL} mb-4`}>
            What was said
          </h2>
        )}
        <Transcript lines={view.lines} receptionistName={SAMPLE_BUSINESS.receptionistName} live />
      </section>
    </article>
  );
}

/** The yellow copy under the white sheet. It stays with the Owner: the Call Notes. */
function OwnersCopy({ notes, againLabel, onAgain }: { notes: CallNotes; againLabel: string; onAgain: () => void }) {
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
            Owner&apos;s copy · No. {TICKET_NUMBER}
          </p>
        </div>
        <p className="border-x-2 border-b-2 border-form px-5 py-1.5 font-form text-[0.9375rem] font-semibold tracking-wide uppercase">
          {SAMPLE_BUSINESS.name} · {SAMPLE_BUSINESS.trade} · {SAMPLE_BUSINESS.area}
        </p>
      </header>

      <div className="grid gap-x-12 gap-y-8 pt-6 md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="grid content-start gap-8">
          <section aria-labelledby={summaryId}>
            <h2 id={summaryId} className={SECTION_LABEL}>
              Summary
            </h2>
            <p className="mt-2 max-w-[44ch] text-[1.375rem] leading-snug font-medium text-balance">{notes.summary}</p>
            <p className="mt-3 text-print-soft">
              {END_REASONS[notes.endReason]} after {formatTime(notes.durationMs)}.
            </p>
          </section>

          <dl className="grid gap-4 [&_dd]:border-form">
            {DETAIL_FIELDS.map((field) => (
              <Field key={field} label={DETAIL_LABELS[field]} value={notes.details[field]} empty="Not captured" />
            ))}
            <Field label="Booked" value={notes.booked} empty="Nothing booked" />
            <Field label="Taken by" value={`${SAMPLE_BUSINESS.receptionistName}, Receptionist`} />
          </dl>
          <p className="text-print-soft">In a real setup, the booking lands in the business&apos;s calendar.</p>
        </div>

        <div className="grid content-start gap-8">
          <section aria-labelledby={textId} className="border-2 border-form p-5">
            <h2 id={textId} className={SECTION_LABEL}>
              Text to the caller · preview
            </h2>
            <p className="mt-2 text-[1.0625rem] leading-relaxed">{notes.confirmationText}</p>
            <p className="mt-4 border-t border-form pt-3 text-sm text-print-soft">Not available in the demo. Nothing is sent.</p>
          </section>

          <section aria-labelledby={talkId}>
            <h2 id={talkId} className={`${SECTION_LABEL} mb-4`}>
              What was said
            </h2>
            <Transcript lines={notes.lines} receptionistName={SAMPLE_BUSINESS.receptionistName} />
          </section>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap gap-3 border-t-2 border-form pt-6">
        <FormButton onClick={onAgain}>{againLabel}</FormButton>
      </div>
    </article>
  );
}
