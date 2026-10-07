# Step 6: Logo, Landing Page, Link Preview and Banner Way Out — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A link to the app opens an indexed landing page that sells the demo on a phone, shows a real link preview card, and every demo screen has a banner with a way out and the "Built by TEKGUYZ" credit.

**Architecture:** The founder first picks a logo from a static mockup page. The pick becomes two SVG marks in one file (`app/_ui/logo.tsx`) that the favicon, the home-screen icon, the link preview image, the landing page and the work order header all draw from. The landing page is a server component built from the existing Service Ticket parts; the sample work order on it is filled by running the stored Sample Call events through the Call Story. Search rules live in Next.js metadata files (`robots.ts`, `sitemap.ts`, per-page `robots`).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind 4, Vitest 5, `next/og` `ImageResponse`, Playwright (CI only).

**Spec:** `docs/superpowers/specs/2026-10-07-landing-page-design.md`. Issue #7, parent #1 (stories 1–11, module 10).

## Global Constraints

- Branch `voice-demo-batch-6`, in `C:/Projects/ai-voice-receptionist`. No worktree.
- Words follow `CONTEXT.md`: Visitor, Sample Business, Receptionist, Test Call, Sample Call, Call Notes, Owner, Dashboard.
- Never TEKGUYZ as the app's name or logo. TEKGUYZ appears only as "Built by TEKGUYZ" linking to `https://tekguyz.com`.
- Never "Sarah", "Viora" or a real business name.
- No made-up numbers, quotes, results or customer names anywhere.
- No "Sign in" link (ADR 0002).
- Only a POST makes a Visitor. "Try the demo" is a `<form method="post" action="/api/visit">` submit button. No GET writes.
- Look: `DESIGN.md`. Three inks (Form Red `#a8221a`, Carbon Blue `#1b3a8c`, Print Black `#17171a`) on canary `#faf08a` and white `#ffffff`. Square corners. One shadow (the top sheet). No purple, no gradient, no glow. Two motions only (write-in, sheet lift).
- A server component never imports a plain value from a `"use client"` file (it gets a function stub).
- Tests: while working `npx vitest run <file>`; before each commit `npm run test:unit`. Never `npm test`. Playwright runs in CI only.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Screens are checked in the browser pane (`preview_start` name `dev`), with screenshots sent to the founder. Never ask the founder to open a page.
- The design pass (Impeccable critique, polish, web-design-guidelines) is NOT part of this plan. It runs later in a fresh window.

## Review Focus

1. A phone at 375 px: the banner with three items must show every word (wrap, never cut). Pinned in Task 5, Step 3 (browser check at 375 px).
2. A link previewer or crawler fetching `/` must never create a Visitor. Pinned by the existing `app/api/visit` route test (POST only) and Task 6 (the landing page has a POST form, no link into `/demo`).
3. A Visitor who presses "Leave the demo" and comes back must keep their cookie and calls. Pinned in Task 5, Step 2 (the link is a plain `href="/"`, the visit route keeps an existing cookie — existing test `app/api/visit/__tests__/route.test.ts`).
4. The preview image URL must be absolute and match the live address, or WhatsApp shows no picture. Pinned in Task 3 (`siteUrl` unit test) and Task 7 (check the tags on the Vercel Preview).
5. A demo route must never say `index`. Pinned in Task 6 (Playwright checks `/demo` has `noindex`, `/` has `index`).

---

### Task 1: Logo mockup page — founder picks (GATE)

**Files:**
- Create: `docs/design/logos.html`

**Interfaces:**
- Produces: the founder's pick (A, B or C), written into `DESIGN.md` in Task 2.

- [ ] **Step 1: Write `docs/design/logos.html`**

A single static HTML file, no build. Load Barlow Condensed (600/700/800), Barlow (400/500) and Kalam from Google Fonts. Page ground canary `#faf08a`. Three sections, one per option, each with the same five rows:

1. Product logo (mark + "AI Voice Receptionist" in Barlow Condensed 800 caps) on canary and on Print Black `#17171a`.
2. A fake browser tab (grey tab strip, tab title "AI Voice Receptionist") with the favicon at 16 px, and again at 32 px. Use the real SVG at those sizes, not a scaled screenshot.
3. The home-screen icon at 180 × 180, on a fake phone grid next to two grey placeholder icons.
4. The link preview card as WhatsApp draws it: the 1200 × 630 picture scaled to 360 px wide, then title "AI Voice Receptionist", the description line from Task 3, and `ai-voice-receptionist-tekguyz.vercel.app`.
5. The Mangrove Air mark on the work order header: red band "WORK ORDER · No. 04127", then the business line with the mark before "MANGROVE AIR · AC REPAIR · SOUTH FLORIDA".

The three concepts (all square, three inks only):

- **A — Stamp.** Product mark: a square red double-rule box (like the Stamp Button) holding a white-on-red phone handset. Mangrove Air mark: the same square double rule holding "MA" in Barlow Condensed 800.
- **B — Ticket band.** Product mark: a red square with a white handset and a white ruled line under it (a filled-in field). Mangrove Air mark: a small red square with three mangrove roots drawn as white strokes.
- **C — On the line.** Product mark: the round red on-the-line lamp with a white handset inside, on a canary square (the lamp is the one circle the look allows). Mangrove Air mark: a red-outlined square with a carbon-blue handwritten "M" in Kalam.

Every mark is inline SVG with a `viewBox="0 0 32 32"`, so the same markup can be copied into code in Task 2.

- [ ] **Step 2: Look at it in the browser pane**

`preview_start` with `url` = `file:///C:/Projects/ai-voice-receptionist/docs/design/logos.html`. Screenshot each option. Check the 16 px favicon is still readable as a shape.

- [ ] **Step 3: Commit**

```bash
git add docs/design/logos.html
git commit -m "Logo options for the founder to pick: product logo, favicon, icon, link preview and Mangrove Air mark (#7)"
```

- [ ] **Step 4: STOP. Send the screenshots. Ask the founder to pick A, B or C.** Do not start Task 2 until the founder answers.

---

### Task 2: Ship the picked logo as code

**Files:**
- Create: `app/_ui/logo.tsx`, `app/icon.svg`, `app/apple-icon.tsx`
- Modify: `DESIGN.md` (new "Logo and icons" part under Components), `app/_ui/ticket.tsx`, `app/demo/dashboard/page.tsx`, `app/_ui/call-notes.tsx`

**Interfaces:**
- Consumes: the picked option's two SVGs from `docs/design/logos.html`.
- Produces:
  - `ProductMark({ className }: { className?: string })` — inline SVG, `viewBox="0 0 32 32"`, `aria-hidden`.
  - `ProductLogo()` — the mark plus "AI Voice Receptionist" as one unit, for the landing page.
  - `BusinessMark({ className }: { className?: string })` — the Mangrove Air mark, `aria-hidden`.
  - `PRODUCT_MARK_SVG: string` — the product mark's raw SVG markup, for `ImageResponse` (as an `<img src="data:image/svg+xml,...">`).
  - In `app/_ui/ticket.tsx`: `BusinessLine({ className }: { className?: string })` — the mark plus "Mangrove Air · AC repair · South Florida", used by every header.

- [ ] **Step 1: Write `app/_ui/logo.tsx`.** No `"use client"`. Copy the picked option's SVG paths exactly. Colours as hex with a comment: "Copies the tokens in app/globals.css; change both together."

- [ ] **Step 2: Write `app/icon.svg`** — the product mark alone, same markup, `xmlns` set. Delete nothing else (there is no `favicon.ico` in `app/`; check with `ls app`).

- [ ] **Step 3: Write `app/apple-icon.tsx`**

```tsx
import { ImageResponse } from "next/og";
import { PRODUCT_MARK_SVG } from "@/app/_ui/logo";

// The home-screen icon, drawn from the same mark as the favicon. Never a
// hand-made PNG (DEMO-STANDARD.md).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const src = `data:image/svg+xml,${encodeURIComponent(PRODUCT_MARK_SVG)}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#faf08a" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={140} height={140} alt="" />
      </div>
    ),
    size,
  );
}
```

- [ ] **Step 4: Add `BusinessLine` to `app/_ui/ticket.tsx`** and use it in `TicketHeader` in place of the plain business-line text. Keep the existing classes (`border-b-2 border-form px-5 py-1.5 font-form text-[0.9375rem] font-semibold tracking-wide uppercase`) on the caller; `BusinessLine` renders `<span className="inline-flex items-center gap-2"><BusinessMark className="size-5 shrink-0" />{name} · {trade} · {area}</span>`.

- [ ] **Step 5: Use `BusinessLine`** in the Dashboard header (`app/demo/dashboard/page.tsx`) and the Call Notes header (`app/_ui/call-notes.tsx`) where they print `{SAMPLE_BUSINESS.name} · {SAMPLE_BUSINESS.trade} · {SAMPLE_BUSINESS.area}`. `BusinessLine` is a component, so importing it into the client file is fine.

- [ ] **Step 6: Write the pick into `DESIGN.md`**: option letter, what each mark is, sizes (favicon 32 viewBox, header mark 20 px), and the rule that every icon and image draws from `app/_ui/logo.tsx`. Remove "Never TEKGUYZ" confusion: say the product logo names the product only.

- [ ] **Step 7: Check in the browser pane.** `preview_start` name `dev`. Open `/icon.svg`, `/apple-icon`, then press Try the demo and see the mark on the work order. Screenshot.

- [ ] **Step 8: Typecheck, unit tests, commit**

Run: `npm run typecheck && npm run test:unit`
Expected: no type errors; all tests pass.

```bash
git add app/_ui/logo.tsx app/icon.svg app/apple-icon.tsx app/_ui/ticket.tsx app/_ui/call-notes.tsx app/demo/dashboard/page.tsx DESIGN.md
git commit -m "The picked logo ships: favicon, home-screen icon and the Mangrove Air mark on every header (#7)"
```

---

### Task 3: Site address, robots, sitemap and the link preview image

**Files:**
- Create: `lib/site.ts`, `lib/__tests__/site.test.ts`, `app/robots.ts`, `app/sitemap.ts`, `app/opengraph-image.tsx`, `app/_og/README.md`, `app/_og/barlow-condensed-800.ttf`, `app/_og/barlow-500.ttf`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `PRODUCT_MARK_SVG` from Task 2.
- Produces: `siteUrl(): URL`, `SITE_NAME`, `SITE_DESCRIPTION` in `lib/site.ts`.

- [ ] **Step 1: Write the failing test `lib/__tests__/site.test.ts`**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { siteUrl } from "@/lib/site";

afterEach(() => vi.unstubAllEnvs());

describe("the site address", () => {
  it("is the production address on Vercel, so preview images are absolute", () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "ai-voice-receptionist-tekguyz.vercel.app");
    expect(siteUrl().href).toBe("https://ai-voice-receptionist-tekguyz.vercel.app/");
  });

  it("is localhost off Vercel", () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(siteUrl().href).toBe("http://localhost:3000/");
  });
});

describe("search engines", () => {
  it("list only the landing page in the sitemap", () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "ai-voice-receptionist-tekguyz.vercel.app");
    expect(sitemap().map((entry) => entry.url)).toEqual(["https://ai-voice-receptionist-tekguyz.vercel.app/"]);
  });

  it("may crawl every page, so they can read each demo page's noindex", () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "ai-voice-receptionist-tekguyz.vercel.app");
    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/" },
      sitemap: "https://ai-voice-receptionist-tekguyz.vercel.app/sitemap.xml",
    });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run lib/__tests__/site.test.ts`
Expected: FAIL, cannot resolve `@/app/robots`.

- [ ] **Step 3: Write `lib/site.ts`, `app/robots.ts`, `app/sitemap.ts`**

```ts
// lib/site.ts
// The app's public address and the words every link preview uses.

export const SITE_NAME = "AI Voice Receptionist";
export const SITE_DESCRIPTION =
  "Call an AI receptionist in your browser. It answers for a made-up AC repair shop, takes the job and books a time. No signup.";

/**
 * The address search engines and link previews use: the project's production
 * domain on Vercel (also on a Preview, so a shared Preview link still shows the
 * live picture), localhost on the laptop.
 */
export function siteUrl(): URL {
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return new URL(production ? `https://${production}` : "http://localhost:3000");
}
```

```ts
// app/robots.ts
import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Crawlers may fetch every page. Demo screens stay out of search by their own
// `noindex` tag, not here: a crawler blocked by robots.txt never sees the tag.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: new URL("/sitemap.xml", siteUrl()).href,
  };
}
```

```ts
// app/sitemap.ts
import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Only the landing page. Demo screens never go in the sitemap (spec #1, story 5).
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: siteUrl().href, changeFrequency: "monthly", priority: 1 }];
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run lib/__tests__/site.test.ts`
Expected: 4 passed.

- [ ] **Step 5: `metadataBase` in `app/layout.tsx`.** Add `metadataBase: siteUrl()` and use `SITE_NAME` / `SITE_DESCRIPTION` for `title` and `description`. Keep `robots: { index: false, follow: false }` as the default.

- [ ] **Step 6: Font files for the drawn image.** Get Barlow Condensed ExtraBold (800) and Barlow Medium (500) as TTF from the Google Fonts repo (`github.com/google/fonts`, `ofl/barlowcondensed/BarlowCondensed-ExtraBold.ttf`, `ofl/barlow/Barlow-Medium.ttf`). Ask the founder before downloading: name the two files, the source and the size. Save as `app/_og/barlow-condensed-800.ttf` and `app/_og/barlow-500.ttf`. Write `app/_og/README.md`: where they came from, the licence (SIL Open Font License 1.1), and that `ImageResponse` cannot use `next/font` or WOFF2.

- [ ] **Step 7: Write `app/opengraph-image.tsx`**, 1200 × 630, in the work order look: canary ground; a red band across the top with the product mark (from `PRODUCT_MARK_SVG`) and "AI VOICE RECEPTIONIST" in white Barlow Condensed 800; the headline "An AI receptionist that answers when you can't." in Print Black Barlow Condensed 800 at about 84 px; one line in Print Soft Barlow 500 ("Call it in your browser. It takes the job and books a time."); at bottom left a red double-rule stamp box "TRY THE DEMO · NO SIGNUP", tilted -1deg. Export `alt = "AI Voice Receptionist: an AI receptionist that answers when you can't."`, `size`, `contentType = "image/png"`. Read the two fonts once at module level with `readFile(join(process.cwd(), "app/_og", ...))`, as FancyFam does (`C:/Projects/fancyfam/app/opengraph-image.tsx`). Comment: "Hex values copy the tokens in app/globals.css. Change both together."

- [ ] **Step 8: Check in the browser pane.** Open `/opengraph-image`, `/robots.txt`, `/sitemap.xml`. Screenshot the image. Run `npm run build` once: the image routes must build.

- [ ] **Step 9: Unit tests and commit**

Run: `npm run test:unit`
Expected: all pass.

```bash
git add lib/site.ts lib/__tests__/site.test.ts app/robots.ts app/sitemap.ts app/opengraph-image.tsx app/_og app/layout.tsx
git commit -m "Link preview picture in the work order look; robots, sitemap and the site address (#7)"
```

---

### Task 4: The landing page

**Files:**
- Modify: `app/page.tsx` (replace the placeholder), `app/_ui/ticket.tsx`, `app/_ui/call-notes.tsx`, `app/demo/call-screen.tsx`
- Create: `app/_landing/sample-work-order.tsx`

**Interfaces:**
- Consumes: `ProductLogo` (Task 2), `SITE_NAME`, `SITE_DESCRIPTION` (Task 3), `tellCallStory` and `DETAIL_FIELDS` from `lib/call-story.ts`, `SAMPLE_CALL_EVENTS` from `lib/sample-call.ts`, `TicketHeader`, `Field`, `Transcript`, `SECTION_LABEL` from `app/_ui/ticket.tsx`.
- Produces: `DETAIL_LABELS` and `formatTime` now live in `app/_ui/ticket.tsx` (a plain module). `app/_ui/call-notes.tsx` and `app/demo/call-screen.tsx` import them from there.

- [ ] **Step 1: Move `DETAIL_LABELS` and `formatTime`** from `app/_ui/call-notes.tsx` to `app/_ui/ticket.tsx`, unchanged. Update the imports in `call-notes.tsx` and `call-screen.tsx`. Reason: a server page (the landing page) needs `DETAIL_LABELS`, and a plain value from a `"use client"` file reaches a server page as a stub.

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 2: Write `app/_landing/sample-work-order.tsx`** (no `"use client"`)

```tsx
import { DETAIL_LABELS, Field, SECTION_LABEL, TicketHeader, Transcript } from "@/app/_ui/ticket";
import { DETAIL_FIELDS, tellCallStory } from "@/lib/call-story";
import { SAMPLE_CALL_EVENTS } from "@/lib/sample-call";
import { SAMPLE_BUSINESS, TEST_CALL_TICKET } from "@/lib/sample-business";

// A picture of the app on the landing page: the Sample Call's work order,
// filled in. Built from the stored Sample Call events, so it always matches
// the call a Visitor can play.
export function SampleWorkOrder() {
  const { view } = tellCallStory(SAMPLE_CALL_EVENTS);
  return (
    <figure className="mx-auto w-full max-w-[420px]">
      <figcaption className={`${SECTION_LABEL} mb-2`}>A sample call</figcaption>
      <div className="bg-sheet [filter:drop-shadow(0_2px_2px_rgb(90_74_30/0.16))_drop-shadow(0_14px_24px_rgb(90_74_30/0.22))]">
        <TicketHeader number={TEST_CALL_TICKET} />
        <dl className="grid gap-1.5 px-5 pt-4 pb-5">
          {DETAIL_FIELDS.map((field) => (
            <Field key={field} label={DETAIL_LABELS[field]} value={view.details[field]} />
          ))}
          <Field label="Booked" value={view.booked} />
        </dl>
        <div className="border-t border-form-rule px-5 pt-5 pb-6">
          <p className={`${SECTION_LABEL} mb-4`}>What was said</p>
          <Transcript lines={view.lines.slice(0, 4)} receptionistName={SAMPLE_BUSINESS.receptionistName} />
        </div>
      </div>
    </figure>
  );
}
```

Note: `TicketHeader` renders an `<h1>` ("Work order"). The landing page must have one `h1`. Add an optional `as?: "h1" | "p"` prop to `TicketHeader` (default `"h1"`) and pass `as="p"` here.

- [ ] **Step 3: Replace `app/page.tsx`**

```tsx
import type { Metadata } from "next";
import { SampleWorkOrder } from "@/app/_landing/sample-work-order";
import { ProductLogo } from "@/app/_ui/logo";
import { SECTION_LABEL } from "@/app/_ui/ticket";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { SAMPLE_BUSINESS } from "@/lib/sample-business";

// The front door. The only page search engines may list (DEMO-STANDARD.md).
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
            <form method="post" action="/api/visit" className="mt-8 max-w-[420px]">
              <button
                type="submit"
                className="inline-flex min-h-14 w-full -rotate-1 items-center justify-center border-[6px] border-double border-form bg-sheet px-4 font-form text-[1.375rem] font-extrabold tracking-wide whitespace-nowrap text-form uppercase hover:bg-form/5 active:bg-form active:text-sheet"
              >
                Try the demo
              </button>
            </form>
            <p className="mt-3 text-sm text-print-soft">No signup. No phone number. Your browser asks for the microphone only when you call.</p>
          </div>
          <SampleWorkOrder />
        </section>

        <section aria-labelledby="how" className="mt-16 border-t-2 border-form pt-6">
          <h2 id="how" className={SECTION_LABEL}>How it works</h2>
          <ol className="mt-5 grid gap-6 md:grid-cols-3">
            <Step n={1} title="Call">Press Call now and talk. No phone number, no signup.</Step>
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
          <h2 id="for" className={SECTION_LABEL}>For shops and trades that miss calls</h2>
          <p className="mt-4 max-w-[60ch] text-[1.0625rem] leading-relaxed">
            You&apos;re on a roof, under a house or out on a boat. The phone rings, and the job goes to whoever picks up
            first. A receptionist like {luna} answers for your business, takes the job and books it. If the caller speaks
            Spanish, it answers in Spanish.
          </p>
        </section>

        <section aria-labelledby="know" className="mt-12 border-t-2 border-form pt-6">
          <h2 id="know" className={SECTION_LABEL}>Good to know</h2>
          <ul className="mt-4 grid max-w-[60ch] list-disc gap-2 pl-5 text-[1.0625rem] leading-relaxed marker:text-form">
            <li>{business} is made up. Nothing you book is real, and no text is sent.</li>
            <li>Make up your details. Only the words are kept, never your voice. Our copy is deleted after 7 days.</li>
            <li>One Test Call a day, 3 minutes at most. If calls are used up or your microphone is blocked, the Sample Call plays instead.</li>
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

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="grid content-start gap-2">
      <p className="font-form text-2xl leading-none font-extrabold text-form">{n}.</p>
      <h3 className="font-form text-2xl leading-tight font-bold uppercase">{title}</h3>
      <p className="text-[1.0625rem] leading-relaxed">{children}</p>
    </li>
  );
}
```

Check before finishing: "One Test Call a day" — confirm against `lib/call-gate.ts` limits (per Visitor 1 a day). If the code says otherwise, the page says what the code does.

- [ ] **Step 4: Check in the browser pane** at desktop (1440 wide) and phone (`resize_window` preset `mobile`). Read the page text, check one `h1`, no "Sign in", the form posts (press it: lands on `/demo`). Screenshot both widths and send them. Reset with preset `desktop`.

- [ ] **Step 5: Unit tests, commit**

Run: `npm run typecheck && npm run test:unit`
Expected: clean; all pass.

```bash
git add app/page.tsx app/_landing app/_ui/ticket.tsx app/_ui/call-notes.tsx app/demo/call-screen.tsx
git commit -m "The landing page: what it does, a filled-in sample work order, and one Try the demo button (#7)"
```

---

### Task 5: Banner way out and the Dashboard link

**Files:**
- Modify: `app/_ui/ticket.tsx` (`DemoBanner`), `app/demo/call-screen.tsx` (ready state)

- [ ] **Step 1: `DemoBanner`**

```tsx
export function DemoBanner() {
  return (
    <aside aria-label="Demo" className="bg-print text-sheet">
      <div className="mx-auto flex max-w-[960px] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 text-sm">
        <p>
          <span className="font-form font-bold tracking-wide uppercase">Demo</span>
          <span className="text-sheet/80"> · Made-up business</span>
        </p>
        <p className="flex gap-4">
          {/* A plain link: the Visitor cookie stays, so their calls are there if they come back. */}
          <Link href="/" className="underline hover:text-copy focus-visible:outline-copy">
            Leave the demo
          </Link>
          <a href="https://tekguyz.com" className="underline hover:text-copy focus-visible:outline-copy">
            Built by TEKGUYZ
          </a>
        </p>
      </div>
    </aside>
  );
}
```

(`truncate` is removed on purpose: nothing may be cut off.)

- [ ] **Step 2: Dashboard link on the ready Test Call screen.** In `app/demo/call-screen.tsx`, case `"ready"`, change the last block to:

```tsx
<div className="mt-5 flex flex-wrap gap-3">
  <FormButton onClick={() => begin("sample")} autoFocus={phase.focus === "sample"}>
    Play the Sample Call
  </FormButton>
  <FormLink href="/demo/dashboard">Open the Dashboard</FormLink>
</div>
```

- [ ] **Step 3: Check in the browser pane at 375 px** (`resize_window` width 375, height 812): the banner on `/demo` and `/demo/dashboard` shows every word; press "Leave the demo" (lands on `/`), press Try the demo (back on `/demo`, same cookie: `document.cookie` cannot read it, so check the Dashboard still shows any earlier "Your call"). Screenshot the banner at 375 px and at desktop. Reset to `desktop`.

- [ ] **Step 4: Commit**

Run: `npm run typecheck && npm run test:unit`

```bash
git add app/_ui/ticket.tsx app/demo/call-screen.tsx
git commit -m "Banner gets a way out of the demo; the Test Call screen links to the Dashboard (#7)"
```

---

### Task 6: One Playwright file in CI

**Files:**
- Create: `playwright.config.ts`, `e2e/landing-to-call-notes.spec.ts`
- Modify: `package.json` (dev dependency, `test:e2e` script), `.github/workflows/ci.yml`, `.gitignore`, `tsconfig.json` if `e2e/` needs including

- [ ] **Step 1: Install** — `npm install --save-dev @playwright/test` (do not run `npx playwright install` on the laptop). Add script `"test:e2e": "playwright test"`. Add `/test-results`, `/playwright-report` to `.gitignore`. Vitest already only includes `**/__tests__/**`, so `e2e/` is ignored.

- [ ] **Step 2: `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

// CI only (global rule): one end-to-end file, against the built app.
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: { baseURL: "http://localhost:3000" },
  projects: [{ name: "phone", use: { ...devices["Pixel 7"] } }],
  webServer: { command: "npm run start", url: "http://localhost:3000", reuseExistingServer: false, timeout: 120_000 },
});
```

- [ ] **Step 3: `e2e/landing-to-call-notes.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

test("a Visitor goes from the landing page to the Sample Call's Call Notes", async ({ page }) => {
  await page.clock.install();

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("answers when you can");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /^index, follow/);
  await expect(page.getByRole("link", { name: /sign in/i })).toHaveCount(0);

  await page.getByRole("button", { name: "Try the demo" }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const banner = page.getByRole("complementary", { name: "Demo" });
  await expect(banner.getByRole("link", { name: "Leave the demo" })).toHaveAttribute("href", "/");
  await expect(banner.getByRole("link", { name: "Built by TEKGUYZ" })).toHaveAttribute("href", "https://tekguyz.com");

  await page.getByRole("button", { name: "Play the Sample Call" }).click();
  await page.clock.runFor(35_000);
  await expect(page.getByRole("heading", { name: "Call Notes" })).toBeVisible();
});
```

- [ ] **Step 4: CI job.** Add to `.github/workflows/ci.yml`:

```yaml
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      # The landing page, Try the demo and the Sample Call to Call Notes.
      # No Vapi and no Redis: the Sample Call needs neither.
      - run: npm run test:e2e
```

- [ ] **Step 5: Typecheck and commit.** `npm run typecheck`. The e2e run is proved in CI on the PR, not on the laptop.

```bash
git add playwright.config.ts e2e package.json package-lock.json .github/workflows/ci.yml .gitignore
git commit -m "One Playwright check in CI: landing page, Try the demo, Sample Call to Call Notes (#7)"
```

---

### Task 7: Verify, README, push, PR, review

- [ ] **Step 1:** `npm run test:unit`, `npm run typecheck`, `npm run build`. All must pass.
- [ ] **Step 2:** Browser pane: `/` at 375 px and 1440 px; `/demo`, `/demo/dashboard`, a call's Call Notes; `view-source` tags on `/` (title, description, `og:image` absolute, `twitter:card`, `robots index`) and `/demo` (`noindex`). Send screenshots.
- [ ] **Step 3:** README status table: Shipped adds #6, Next is #7's design pass in a fresh window.
- [ ] **Step 4:** Push the branch (a Vercel Preview, not live; `main` is production). Open the PR, "Part of #7" (not "Closes": the design pass is still open on #7). Bind it with `ccd_pr` tools. On the Preview, check the tags and `/opengraph-image` again.
- [ ] **Step 5:** One final whole-branch review (`superpowers:requesting-code-review`), fix what it finds.
- [ ] **Step 6:** New issue for the step 5 leftovers (list in the spec's "Out of scope"; `DETAIL_LABELS`/`formatTime` is fixed in Task 4, leave it off).
- [ ] **Step 7:** Comment the driver state on #1. Tell the founder: the PR, the issue numbers, and that the design pass runs next in a fresh window after `/clear`.
