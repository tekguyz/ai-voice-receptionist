// The Service Ticket parts (DESIGN.md). Red is the printed form; carbon blue
// is what the Receptionist captured; black is plain print.

import Link from "next/link";
import type { ReactNode } from "react";
import { BusinessMark } from "@/app/_ui/logo";
import type { CallDetails, TranscriptLine } from "@/lib/call-story";
import { SAMPLE_BUSINESS } from "@/lib/sample-business";

// Plain values live here, not in a "use client" file: a server page that
// imports a plain value from a client file gets a stub.
export const DETAIL_LABELS: Record<keyof CallDetails, string> = {
  name: "Name",
  job: "Job",
  urgency: "Urgency",
  address: "Address",
};

/** A call's length as m:ss. */
export function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function DemoBanner() {
  return (
    <aside aria-label="Demo" className="bg-print text-sheet">
      <div className="mx-auto flex max-w-[960px] items-center justify-between gap-4 px-4 py-2 text-sm">
        <p className="truncate">
          <span className="font-form font-bold tracking-wide uppercase">Demo</span>
          <span className="text-sheet/80"> · Made-up business</span>
        </p>
        <a href="https://tekguyz.com" className="shrink-0 underline hover:text-copy focus-visible:outline-copy">
          Built by TEKGUYZ
        </a>
      </div>
    </aside>
  );
}

/**
 * The printed head of the work order: title, ticket number and business.
 * `as="p"` where the page has its own h1 (the landing page's sample).
 */
export function TicketHeader({ number, as: Title = "h1" }: { number: string; as?: "h1" | "p" }) {
  return (
    <header className="text-form">
      <div className="flex items-end justify-between gap-3 bg-form px-5 pt-3 pb-2.5 text-sheet">
        <Title className="font-form text-[2.25rem] leading-none font-extrabold tracking-tight uppercase">Work order</Title>
        <p className="font-form text-xl leading-none font-bold">
          <span className="sr-only">Ticket number </span>No. {number}
        </p>
      </div>
      <p className="border-b-2 border-form px-5 py-1.5 font-form text-[0.9375rem] font-semibold tracking-wide uppercase">
        <BusinessLine />
      </p>
    </header>
  );
}

/** The Sample Business's mark and name, printed under every header. */
export function BusinessLine() {
  return (
    <span className="inline-flex items-center gap-2">
      <BusinessMark className="size-5 shrink-0" />
      {SAMPLE_BUSINESS.name} · {SAMPLE_BUSINESS.trade} · {SAMPLE_BUSINESS.area}
    </span>
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

export function Transcript({ lines, receptionistName, live }: { lines: readonly TranscriptLine[]; receptionistName: string; live?: boolean }) {
  return (
    <ol aria-live={live ? "polite" : undefined} className="grid gap-3">
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

/** The stamp's look, also used by the landing page's submit button. */
export const STAMP_BUTTON =
  "inline-flex min-h-14 w-full -rotate-1 items-center justify-center gap-3 border-[6px] border-double border-form bg-sheet px-4 font-form text-[1.375rem] whitespace-nowrap font-extrabold tracking-wide text-form uppercase hover:bg-form/5 active:bg-form active:text-sheet";

/**
 * The main action, set like a red rubber stamp on the form: red ink in a
 * double rule, a slight tilt. It fills solid red only while pressed.
 */
export function StampButton({
  children,
  onClick,
  icon,
  autoFocus,
}: {
  children: ReactNode;
  onClick: () => void;
  icon?: ReactNode;
  autoFocus?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      autoFocus={autoFocus}
      className={STAMP_BUTTON}
    >
      {icon}
      {children}
    </button>
  );
}

/** Printed section headings and labels: red Label caps. */
export const SECTION_LABEL = "font-form text-sm leading-tight font-bold tracking-wider text-form uppercase";

const FORM_BUTTON =
  "inline-flex min-h-12 items-center justify-center border-2 border-form px-5 font-form text-lg font-bold tracking-wide text-form uppercase hover:bg-form hover:text-sheet";

/** A quieter control: printed outline, same ink. */
export function FormButton({ children, onClick, autoFocus }: { children: ReactNode; onClick: () => void; autoFocus?: boolean }) {
  return (
    <button type="button" onClick={onClick} autoFocus={autoFocus} className={FORM_BUTTON}>
      {children}
    </button>
  );
}

/** A link to another screen. It looks exactly like a Form Button. */
export function FormLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={FORM_BUTTON}>
      {children}
    </Link>
  );
}

/** Ends a Test Call: solid Form Red, square, white Form caps. No glow, no pulse (DESIGN.md). */
export function EndCallButton({ onClick, autoFocus }: { onClick: () => void; autoFocus?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      autoFocus={autoFocus}
      className="inline-flex min-h-14 w-full items-center justify-center gap-3 bg-form px-4 font-form text-[1.375rem] font-extrabold tracking-wide text-sheet uppercase hover:bg-form-deep"
    >
      <PhoneIcon />
      End call
    </button>
  );
}

export function PhoneIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 fill-current">
      <path d="M6.6 2.2 4.4 2c-.9 0-2 .9-1.9 2.2.4 6.6 6.7 12.9 13.3 13.3 1.3.1 2.2-1 2.2-1.9l-.2-2.2c0-.5-.4-.9-.9-1l-3-.7c-.4-.1-.9.1-1.1.5l-.9 1.5c-2-1-3.9-2.9-4.9-4.9l1.5-.9c.4-.2.6-.7.5-1.1l-.7-3c-.1-.5-.5-.9-1-.9Z" />
    </svg>
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
