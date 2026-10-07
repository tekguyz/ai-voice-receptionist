import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SECTION_LABEL } from "@/app/_ui/call-notes";
import { DemoBanner, FormLink } from "@/app/_ui/ticket";
import { buildDashboard, callTimeLabel, savedCallsFor, type DashboardCall } from "@/lib/dashboard";
import { SAMPLE_BUSINESS } from "@/lib/sample-business";
import { serverNotesStore } from "@/lib/server-notes-store";
import { VISITOR_COOKIE, isVisitorId } from "@/lib/visitor";
import { AnsweringSwitch } from "./answering-switch";

export const metadata: Metadata = {
  title: "Dashboard · AI Voice Receptionist",
  robots: { index: false, follow: false },
};

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default async function DashboardPage() {
  const visitorId = (await cookies()).get(VISITOR_COOKIE)?.value;
  if (!isVisitorId(visitorId)) redirect("/");

  const now = new Date();
  const saved = await savedCallsFor({ visitorId, store: serverNotesStore() });
  const { totals, calls } = buildDashboard({ saved, now });

  return (
    <>
      <DemoBanner />
      <main className="mx-auto max-w-[960px] px-4 pt-4 pb-10 md:pt-12">
        <header className="text-form">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 border-2 border-form px-5 pt-3 pb-2.5">
            <h1 className="font-form text-[2.25rem] leading-none font-extrabold tracking-tight uppercase">Dashboard</h1>
            <p className="font-form text-lg leading-none font-bold uppercase">Owner&apos;s view</p>
          </div>
          <p className="border-x-2 border-b-2 border-form px-5 py-1.5 font-form text-[0.9375rem] font-semibold tracking-wide uppercase">
            {SAMPLE_BUSINESS.name} · {SAMPLE_BUSINESS.trade} · {SAMPLE_BUSINESS.area}
          </p>
        </header>

        <p className="mt-6 max-w-[44ch] text-[1.375rem] leading-snug font-medium text-balance">
          While you worked, {SAMPLE_BUSINESS.receptionistName} answered {count(totals.answered, "call")} and booked{" "}
          {count(totals.booked, "job")}.
        </p>

        <AnsweringSwitch />

        <dl aria-label="Totals" className="mt-6 grid grid-cols-3 divide-x-2 divide-form border-2 border-form">
          <Total label="Calls answered" value={totals.answered} />
          <Total label="Jobs booked" value={totals.booked} />
          <Total label="Spam blocked" value={totals.spam} />
        </dl>

        <section aria-labelledby="recent-calls" className="mt-8">
          <h2 id="recent-calls" className={`${SECTION_LABEL} border-b-2 border-form pb-2`}>
            Recent calls
          </h2>
          <ol>
            {calls.map((call) => (
              <li key={call.id} className="border-b border-form">
                <CallRow call={call} when={callTimeLabel(call.at, now)} />
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-10 flex flex-wrap gap-3 border-t-2 border-form pt-6">
          <FormLink href="/demo">Make a Test Call</FormLink>
        </div>
      </main>
    </>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid content-start gap-1 px-3 py-3 md:px-5">
      <dt className={SECTION_LABEL}>{label}</dt>
      <dd className="font-form text-[2.25rem] leading-none font-extrabold">{value}</dd>
    </div>
  );
}

function CallRow({ call, when }: { call: DashboardCall; when: string }) {
  const caller = call.spam ? "Spam call" : (call.notes.details.name ?? "Unknown caller");
  const job = call.spam ? `Blocked by ${SAMPLE_BUSINESS.receptionistName}` : (call.notes.details.job ?? "No job captured");
  return (
    <Link href={`/demo/dashboard/${call.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 px-1 py-3 hover:bg-form/5">
      <span className="grid gap-0.5">
        <span className="text-sm text-print-soft">{when}</span>
        <span className="text-[1.0625rem] font-semibold">{caller}</span>
        <span className="text-print-soft first-letter:uppercase">{job}</span>
      </span>
      <span className="flex flex-col items-end gap-1 pt-0.5">
        {call.whose === "yours" && <Mark filled>Your call</Mark>}
        {call.notes.booked && <Mark>Booked</Mark>}
        {call.spam && <Mark>Spam</Mark>}
      </span>
    </Link>
  );
}

/** A small square mark printed beside a call. */
function Mark({ children, filled = false }: { children: string; filled?: boolean }) {
  return (
    <span
      className={`border-2 border-form px-1.5 font-form text-sm leading-tight font-bold tracking-wider whitespace-nowrap uppercase ${filled ? "bg-form text-sheet" : "text-form"}`}
    >
      {children}
    </span>
  );
}
