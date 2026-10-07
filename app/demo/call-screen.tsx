"use client";

// The call screen on the Service Ticket look (DESIGN.md). One screen serves
// both call sources: the Test Call (Vapi) and the Sample Call, its fallback.
// The sheets below read only the Call Story's view and notes, not the source
// behind them.

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  DemoBanner,
  DemoClosing,
  DETAIL_LABELS,
  EndCallButton,
  Field,
  FormButton,
  FormLink,
  OnTheLine,
  PhoneIcon,
  PlayIcon,
  SECTION_LABEL,
  StampButton,
  TicketHeader,
  Transcript,
  formatTime,
} from "@/app/_ui/ticket";
import { CallNotesSheet } from "@/app/_ui/call-notes";
import type { CallSource, RunningCall, StartFailure } from "@/lib/call-source";
import { DETAIL_FIELDS, tellCallStory, type CallEvent, type CallNotes, type CallView } from "@/lib/call-story";
import { SAMPLE_CALL_SUMMARY, createSampleCallPlayer } from "@/lib/sample-call";
import { fetchSavedNotes, watchSavedNotes } from "@/lib/saved-notes";
import { SAMPLE_BUSINESS, TEST_CALL_TICKET } from "@/lib/sample-business";
import { SITE_NAME } from "@/lib/site";
import { browserVapiSourceDeps } from "@/lib/vapi-browser";
import { createVapiSource } from "@/lib/vapi-source";

const FAILURE_NOTICES: Record<StartFailure, string> = {
  "microphone-blocked": "Your microphone is blocked, so the call can't start. You can still see how it works.",
  limit: "The Test Calls for today are used up. You can still see how it works.",
  unavailable: "The call couldn't connect. You can still see how it works.",
  "connect-failed": "The call couldn't connect. You can still see how it works.",
  // The day's Test Call is already used, so there is no retry for this one.
  "join-failed": "The call couldn't connect. You can still see how it works.",
};

const CALL_STATUS = "flex items-center gap-3 font-form text-2xl font-bold uppercase";
const WAITING_LINE = "font-form text-[1.875rem] leading-tight font-bold text-balance";

type Mode = "test" | "sample";
type Phase =
  // `focus`: after Cancel or Stop, focus goes back to the button that starts that call again.
  | { kind: "ready"; focus?: Mode }
  | { kind: "connecting" }
  | { kind: "failed"; failure: StartFailure }
  | { kind: "running"; mode: Mode };

// What the screen knows about the saved copy of a Test Call's notes.
type Saved = { kind: "waiting" } | { kind: "ready"; notes: CallNotes } | { kind: "late" };

export function CallScreen() {
  const [testCall] = useState<CallSource>(() => createVapiSource(browserVapiSourceDeps()));
  const [sampleCall] = useState<CallSource>(() => createSampleCallPlayer());
  const [phase, setPhase] = useState<Phase>({ kind: "ready" });
  const [events, setEvents] = useState<CallEvent[]>([]);
  // The server's ID for the Test Call, and whether its notes are saved yet.
  const [callId, setCallId] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved>({ kind: "waiting" });
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

  const mode: Mode = phase.kind === "running" ? phase.mode : "test";
  // The Sample Call carries its own written summary, like the Dashboard's calls.
  const { view, notes } = tellCallStory(events, mode === "sample" ? { summary: SAMPLE_CALL_SUMMARY } : {});
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
    setCallId(null);
    setSaved({ kind: "waiting" });
    setPhase(next === "test" ? { kind: "connecting" } : { kind: "running", mode: next });
    call.current = (next === "test" ? testCall : sampleCall).start({
      onEvent: (event) => {
        if (number !== callNumber.current) return;
        const arrived = performance.now();
        setStartedAt((at) => at ?? arrived - event.atMs);
        setPhase({ kind: "running", mode: next });
        setEvents((soFar) => [...soFar, event]);
      },
      onCallId: (id) => {
        if (number !== callNumber.current) return;
        setCallId(id);
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

  const ended = notes !== null;
  // A Test Call's notes are saved by the server a moment after the call ends: ask until they are there.
  useEffect(() => {
    if (!ended || mode !== "test") return;
    if (!callId) {
      setSaved({ kind: "late" });
      return;
    }
    const stop = new AbortController();
    watchSavedNotes({
      fetchOnce: () => fetchSavedNotes(callId),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      now: () => performance.now(),
      signal: stop.signal,
      onReady: (found) => setSaved({ kind: "ready", notes: found }),
      onGiveUp: () => setSaved({ kind: "late" }),
    });
    return () => stop.abort();
  }, [ended, mode, callId]);

  // The phase word for screen readers; never the ticking timer.
  const endedWord =
    mode === "sample"
      ? "Call ended"
      : saved.kind === "ready"
        ? "Call Notes ready"
        : saved.kind === "late"
          ? "Call ended. The summary did not arrive."
          : "Call ended. Finishing the notes.";
  const runningWord = mode === "sample" ? "Sample Call playing" : "On the line";
  const announcement = notes ? endedWord : phase.kind === "connecting" ? "Calling…" : phase.kind === "running" ? runningWord : "";

  // The tab says which screen this is: the page's own title says "Test Call".
  const tabTitle = notes ? "Call Notes" : mode === "sample" ? "Sample Call" : "Test Call";
  useEffect(() => {
    document.title = `${tabTitle} · ${SITE_NAME}`;
  }, [tabTitle]);

  if (notes) {
    return (
      <Page announcement={announcement} closing>
        <div className="relative">
          <CallNotesSheet
            notes={saved.kind === "ready" ? saved.notes : notes}
            state={mode === "sample" ? "sample" : saved.kind === "ready" ? "saved" : saved.kind}
            number={TEST_CALL_TICKET}
            actions={
              <>
                <FormButton onClick={() => begin(mode)}>{mode === "test" ? "Make another Test Call" : "Play the Sample Call again"}</FormButton>
                {/* Not while the server is still saving the Test Call: the Dashboard would not list it yet. */}
                {(mode === "sample" || saved.kind !== "waiting") && <FormLink href="/demo/dashboard">Open the Dashboard</FormLink>}
              </>
            }
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
          <p className="mt-3 text-sm text-print-muted">
            One Test Call a day, 3 minutes at most. Make up your details. Don’t give your real name or address.
          </p>
          <p className="mt-1 text-sm text-print-muted">Only the words are kept, never your voice. Our copy is deleted after 7 days.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <FormButton onClick={() => begin("sample")} autoFocus={phase.focus === "sample"}>
              Play the Sample Call
            </FormButton>
            <FormLink href="/demo/dashboard">Open the Dashboard</FormLink>
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
          {/* Only a failure the server reports can be retried: after join-failed the day's call is used. */}
          {phase.failure === "connect-failed" && (
            <div className="mt-5">
              <FormButton onClick={() => begin("test")}>Try calling again</FormButton>
            </div>
          )}
        </>
      );
      break;
    case "running":
      // The Sample Call is a playback, not an open line: no lamp.
      status = (
        <p className={CALL_STATUS}>
          {phase.mode === "test" ? <OnTheLine /> : <PlayIcon />}
          {phase.mode === "test" ? "On the line" : "Sample Call"}
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
    <Page announcement={announcement}>
      <TopSheet view={view} status={status} controls={controls} />
    </Page>
  );
}

function Page({ children, announcement, closing = false }: { children: ReactNode; announcement: string; closing?: boolean }) {
  return (
    <>
      <DemoBanner />
      {/* Always in the page, so a screen reader hears each change of phase. */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <main className="mx-auto max-w-[1200px] px-4 pt-4 pb-10 md:pt-12">{children}</main>
      {closing && <DemoClosing />}
    </>
  );
}

/**
 * The white top sheet: the call as it happens. On a phone it is one sheet.
 * From md the job details sit beside it on their own sheet, and the two are
 * centred together; from lg the gap between them widens.
 */
function TopSheet({ view, status, controls }: { view: CallView; status: ReactNode; controls?: ReactNode }) {
  const talkId = useId();
  const talk = useRef<HTMLElement>(null);
  // Only the live sheet has controls; the lifting copy has none.
  const live = controls !== undefined;
  const lineCount = view.lines.length;
  // On a phone, keep the newest line on screen. The transcript there holds
  // only the newest lines, so the page moves a little at most.
  useEffect(() => {
    if (!live || lineCount === 0 || !window.matchMedia("(max-width: 767px)").matches) return;
    talk.current?.scrollIntoView({ block: "nearest" });
  }, [live, lineCount]);
  return (
    <article
      aria-label="Work order"
      className="mx-auto grid max-w-[420px] [filter:drop-shadow(0_2px_2px_rgb(90_74_30/0.16))_drop-shadow(0_14px_24px_rgb(90_74_30/0.22))] [grid-template-areas:'head''status''fields''controls''talk'] md:max-w-none md:grid-cols-[minmax(0,420px)_minmax(0,22rem)] md:justify-center md:gap-x-8 md:[grid-template-areas:'head_fields''status_fields''controls_fields''talk_fields'] lg:gap-x-12"
    >
      <div className="bg-sheet [grid-area:head]">
        <TicketHeader number={TEST_CALL_TICKET} />
      </div>

      <div className="-mt-px bg-sheet px-5 pt-4 [grid-area:status]">{status}</div>

      <section
        aria-label="Job details"
        className="-mt-px bg-sheet px-5 pt-3 pb-1 [grid-area:fields] md:mt-0 md:max-w-[22rem] md:self-start md:pt-5 md:pb-6"
      >
        <h2 className={`${SECTION_LABEL} mb-3 hidden border-b-2 border-form pb-2 md:block`}>Job details · No. {TEST_CALL_TICKET}</h2>
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
        ref={talk}
        aria-labelledby={view.lines.length > 0 ? talkId : undefined}
        className={`-mt-px bg-sheet [grid-area:talk] ${view.lines.length > 0 ? "border-t border-form-rule px-5 pt-5 pb-8" : ""}`}
      >
        {view.lines.length > 0 && (
          <h2 id={talkId} className={`${SECTION_LABEL} mb-4`}>
            What was said
          </h2>
        )}
        <Transcript lines={view.lines} receptionistName={SAMPLE_BUSINESS.receptionistName} live latest={2} />
      </section>
    </article>
  );
}
