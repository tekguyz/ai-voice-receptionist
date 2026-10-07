import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SampleWorkOrder } from "@/app/_landing/sample-work-order";
import { ProductLogo } from "@/app/_ui/logo";
import { SECTION_LABEL, STAMP_BUTTON } from "@/app/_ui/ticket";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { SAMPLE_BUSINESS } from "@/lib/sample-business";

// The front door, in the TEKGUYZ voice. The only page search engines may
// list (DEMO-STANDARD.md). No "Sign in" link: there are no accounts (ADR 0002).
export const metadata: Metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  robots: { index: true, follow: true },
  openGraph: { title: SITE_NAME, description: SITE_DESCRIPTION, type: "website", url: "/" },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: SITE_DESCRIPTION },
};

const { name: business, receptionistName: luna } = SAMPLE_BUSINESS;

export default function Home() {
  return (
    <>
      <main className="mx-auto max-w-[1200px] px-4 pt-6 pb-12 md:pt-12">
        <ProductLogo />

        <section className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-16">
          <div className="max-w-[44ch]">
            <h1 className="font-form text-[2.75rem] leading-[1.02] font-extrabold tracking-tight text-balance uppercase md:text-[3.5rem]">
              An AI receptionist that answers when you can&apos;t.
            </h1>
            <p className="mt-5 text-[1.375rem] leading-snug font-medium">
              It picks up, takes down the job, books a time and hands you the notes. Try it now in your browser: it
              answers for {business}, a made-up AC repair shop.
            </p>
            {/* Only a POST makes a Visitor, so link previews and crawlers never do. */}
            <form method="post" action="/api/visit" className="mt-8 max-w-[420px]">
              <button type="submit" className={STAMP_BUTTON}>
                Try the demo
              </button>
            </form>
            <p className="mt-3 text-sm text-print-soft">
              No signup. No phone number. Your browser asks for the microphone only when you call.
            </p>
          </div>
          <SampleWorkOrder />
        </section>

        <section aria-labelledby="how" className="mt-16 border-t-2 border-form pt-6">
          <h2 id="how" className={SECTION_LABEL}>
            How it works
          </h2>
          <ol className="mt-5 grid gap-6 md:grid-cols-3">
            <Step n={1} title="Call">
              Press Call now and talk. No phone number, no signup.
            </Step>
            <Step n={2} title="Watch it write">
              {luna} asks your name, the job, how urgent it is and the address, then offers two open times. Each detail is
              written on the work order as you say it.
            </Step>
            <Step n={3} title="Read the Owner's side">
              When you hang up, the Call Notes show a summary, the booked time and the text the caller would get. The
              Dashboard shows every call.
            </Step>
          </ol>
        </section>

        <section aria-labelledby="for" className="mt-12 border-t-2 border-form pt-6">
          <h2 id="for" className={SECTION_LABEL}>
            For shops and trades that miss calls
          </h2>
          <p className="mt-4 max-w-[60ch] text-[1.0625rem] leading-relaxed">
            You&apos;re on a roof, under a house or out on a boat. The phone rings, and the job goes to whoever picks up
            first. A receptionist like {luna} answers for your business, takes the job and books it. If the caller speaks
            Spanish, it answers in Spanish.
          </p>
        </section>

        <section aria-labelledby="know" className="mt-12 border-t-2 border-form pt-6">
          <h2 id="know" className={SECTION_LABEL}>
            Good to know
          </h2>
          <ul className="mt-4 grid max-w-[60ch] list-disc gap-2 pl-5 text-[1.0625rem] leading-relaxed marker:text-form">
            <li>{business} is made up. Nothing you book is real, and no text is sent.</li>
            <li>Make up your details. Only the words are kept, never your voice. Our copy is deleted after 7 days.</li>
            <li>
              One Test Call a day, 3 minutes at most. If calls are used up or your microphone is blocked, the Sample Call
              plays instead.
            </li>
          </ul>
        </section>
      </main>

      <footer className="border-t-2 border-form">
        <div className="mx-auto max-w-[1200px] px-4 py-6 text-sm">
          <a href="https://tekguyz.com" className="underline hover:text-form">
            Built by TEKGUYZ
          </a>
        </div>
      </footer>
    </>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="grid content-start gap-2">
      <p aria-hidden="true" className="font-form text-2xl leading-none font-extrabold text-form">
        {n}.
      </p>
      <h3 className="font-form text-2xl leading-tight font-bold uppercase">{title}</h3>
      <p className="text-[1.0625rem] leading-relaxed">{children}</p>
    </li>
  );
}
