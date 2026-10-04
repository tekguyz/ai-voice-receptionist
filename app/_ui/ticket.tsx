// The Service Ticket parts (DESIGN.md). Red is the printed form; carbon blue
// is what the Receptionist captured; black is plain print.

import type { ReactNode } from "react";
import type { TranscriptLine } from "@/lib/call-story";
import { SAMPLE_BUSINESS } from "@/lib/sample-business";

export function DemoBanner() {
  return (
    <aside aria-label="Demo" className="bg-print text-sheet">
      <div className="mx-auto flex max-w-[960px] items-center justify-between gap-4 px-4 py-2 text-sm">
        <p className="truncate">
          <span className="font-form font-bold tracking-wide uppercase">Demo</span>
          <span className="text-sheet/80"> · Made-up business</span>
        </p>
        <a href="https://tekguyz.com" className="shrink-0 underline hover:text-copy">
          Built by TEKGUYZ
        </a>
      </div>
    </aside>
  );
}

/** The printed head of the work order: title, ticket number and business. */
export function TicketHeader({ number }: { number: string }) {
  return (
    <header className="text-form">
      <div className="flex items-end justify-between gap-3 bg-form px-5 pt-3 pb-2.5 text-sheet">
        <h1 className="font-form text-[2.25rem] leading-none font-extrabold tracking-tight uppercase">Work order</h1>
        <p className="font-form text-xl leading-none font-bold">
          <span className="sr-only">Ticket number </span>No. {number}
        </p>
      </div>
      <p className="border-b-2 border-form px-5 py-1.5 font-form text-[0.9375rem] font-semibold tracking-wide uppercase">
        {SAMPLE_BUSINESS.name} · {SAMPLE_BUSINESS.trade} · {SAMPLE_BUSINESS.area}
      </p>
    </header>
  );
}

/** A printed label over a ruled line. A captured value is written onto the rule. */
export function Field({ label, value, empty }: { label: string; value?: string | null; empty?: string }) {
  return (
    <div className="grid">
      <dt className="font-form text-sm leading-tight font-bold tracking-wider text-form uppercase">{label}</dt>
      <dd className="min-h-[1.875rem] border-b border-form-rule font-hand text-2xl leading-tight text-carbon">
        {value ? (
          <span key={value} className="write-in inline-block first-letter:uppercase">
            {value}
          </span>
        ) : (
          empty && <span className="font-body text-base text-print-soft">{empty}</span>
        )}
      </dd>
    </div>
  );
}

export function Transcript({ lines, receptionistName, live }: { lines: TranscriptLine[]; receptionistName: string; live?: boolean }) {
  return (
    <ol aria-label="Transcript" aria-live={live ? "polite" : undefined} className="grid gap-3">
      {lines.map((line, i) => (
        <li key={i} className="grid grid-cols-[5.5rem_1fr] gap-x-3">
          <span
            className={`pt-0.5 font-form text-sm font-bold tracking-wider uppercase ${line.speaker === "caller" ? "text-print" : "text-form"}`}
          >
            {line.speaker === "caller" ? "Caller" : receptionistName}
          </span>
          <span className="max-w-[60ch] text-[1.0625rem] leading-relaxed">{line.text}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * The main action, set like a red rubber stamp on the form: red ink in a
 * double rule, a slight tilt. It fills solid red only while pressed.
 */
export function StampButton({ children, onClick, icon }: { children: ReactNode; onClick: () => void; icon?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-14 w-full -rotate-1 items-center justify-center gap-3 border-[6px] border-double border-form bg-sheet px-4 font-form text-[1.375rem] whitespace-nowrap font-extrabold tracking-wide text-form uppercase hover:bg-form/5 active:bg-form active:text-sheet"
    >
      {icon}
      {children}
    </button>
  );
}

/** A quieter control: printed outline, same ink. */
export function FormButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-12 items-center justify-center border-2 border-form px-5 font-form text-lg font-bold tracking-wide text-form uppercase hover:bg-form hover:text-sheet"
    >
      {children}
    </button>
  );
}

export function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 fill-current">
      <path d="M5 3.5v13l11-6.5z" />
    </svg>
  );
}

/** A small red light: the line is open. It holds still; only captured details move. */
export function OnTheLine() {
  return <span aria-hidden="true" className="inline-block size-3 rounded-full bg-form" />;
}
