---
name: AI Voice Receptionist
description: A carbon-copy work order that fills itself in while the caller talks.
colors:
  copy: "#faf08a"
  copy-deep: "#e8dc5a"
  sheet: "#ffffff"
  form: "#a8221a"
  form-deep: "#8a1b14"
  form-rule: "#e9a8a2"
  carbon: "#1b3a8c"
  print: "#17171a"
  print-muted: "#4e4e57"
  print-soft: "#5a4a1e"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.33
  stamp:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 800
    letterSpacing: "0.025em"
  form-line:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    letterSpacing: "0.025em"
  label:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0.05em"
  hand:
    fontFamily: "Kalam, Segoe Print, cursive"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.25
  body-lead:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 500
    lineHeight: 1.375
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.625
    fontFeature: "\"tnum\""
  small:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
rounded:
  none: "0px"
  lamp: "9999px"
spacing:
  hair: "6px"
  sm: "12px"
  md: "16px"
  sheet-inset: "20px"
  lg: "32px"
  xl: "48px"
components:
  demo-banner:
    backgroundColor: "{colors.print}"
    textColor: "{colors.sheet}"
    typography: "{typography.small}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
  ticket-header:
    backgroundColor: "{colors.form}"
    textColor: "{colors.sheet}"
    typography: "{typography.display}"
    rounded: "{rounded.none}"
    padding: "12px 20px 10px"
  top-sheet:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.print}"
    rounded: "{rounded.none}"
    padding: "{spacing.sheet-inset}"
    width: "420px"
  field-label:
    textColor: "{colors.form}"
    typography: "{typography.label}"
  field-value:
    textColor: "{colors.carbon}"
    typography: "{typography.hand}"
    height: "1.875rem"
  transcript-speaker-receptionist:
    textColor: "{colors.form}"
    typography: "{typography.label}"
    width: "5.5rem"
  transcript-speaker-caller:
    textColor: "{colors.print}"
    typography: "{typography.label}"
    width: "5.5rem"
  transcript-line:
    textColor: "{colors.print}"
    typography: "{typography.body}"
  stamp-button:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.form}"
    typography: "{typography.stamp}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "56px"
  stamp-button-active:
    backgroundColor: "{colors.form}"
    textColor: "{colors.sheet}"
  form-button:
    backgroundColor: "transparent"
    textColor: "{colors.form}"
    rounded: "{rounded.none}"
    padding: "0 20px"
    height: "48px"
  form-button-hover:
    backgroundColor: "{colors.form}"
    textColor: "{colors.sheet}"
  on-the-line-lamp:
    backgroundColor: "{colors.form}"
    rounded: "{rounded.lamp}"
    size: "12px"
---

# Design System: AI Voice Receptionist

## Overview

**Creative North Star: "The Service Ticket"**

The screen is a carbon-copy work order from a trade shop's counter pad. The page ground is the canary-yellow copy; the white top sheet lies on it. While the caller talks, the Receptionist writes each captured detail onto its ruled line in carbon-blue ballpoint. When the call ends, the white sheet is pulled off and the yellow copy underneath is the Owner's Call Notes.

Three inks do all the work. Red form ink is everything printed on the pad: the header band, field labels, rules, the ticket number, the stamp. Carbon blue is only what the Receptionist captured. Black is plain print: the transcript, the summary, body copy. The world refuses the category default of a dark screen, a glowing orb and soft chat bubbles. Density is a working form's density: tight ruled fields, condensed caps, nothing ornamental.

Motion has exactly two moves. A captured value is written onto its rule left to right, like a pen. At the end of the call the top sheet lifts off and away. Nothing else moves.

**Key Characteristics:**
- Canary copy ground, white top sheet, three inks (red form, carbon blue, black print).
- Square corners, ruled lines, a perforated tear line; no cards.
- Condensed industrial caps for the form, a workhorse sans for reading, one ballpoint hand for captured values.
- One shadow only: the sheet lying on the copy.
- Two motions only: the write-in and the sheet lift. Both stand down under reduced motion.

## Colors

A printed counter pad: two papers and three inks, with no accent outside them.

### Primary
- **Form Red** (#a8221a): the printed form. Header band fill, field labels, ruled borders on the copy, the ticket number, section headings, the Receptionist's speaker name, the stamp and form buttons, the on-the-line lamp, the perforation dots. 7.22:1 on the sheet, 6.15:1 on the copy; white on it 7.22:1.
- **Form Red, Deep** (#8a1b14): the End button's hover. Nothing else uses it.

### Secondary
- **Carbon Blue** (#1b3a8c): what the Receptionist captured, and nothing else. Handwritten field values, the focus ring, text selection. 10.34:1 on the sheet, 8.81:1 on the copy.

### Neutral
- **Canary Copy** (#faf08a): the page ground and the Owner's copy. Also the browser theme colour.
- **Canary Copy, Deep** (#e8dc5a): defined in the theme; no component uses it yet. Treat as unassigned until a build needs it.
- **Top Sheet White** (#ffffff): the white top sheet the call is written on; also text on the red band and the black banner.
- **Faint Form Rule** (#e9a8a2): the field rules and dividers on the white sheet. Decorative lines, never text.
- **Print Black** (#17171a): transcript, summary and body text; the demo banner strip. 17.89:1 on the sheet, 15.24:1 on the copy.
- **Print Muted** (#4e4e57): secondary notes on the white sheet (the line under the stamp). Well above 4.5:1 on white.
- **Print Soft** (#5a4a1e): secondary notes on the yellow copy (end reason, "Not captured", the demo disclaimer). 7.36:1 on the copy. A warm brown so it reads as print on yellow paper.

### Named Rules
**The Three Inks Rule.** Every mark is red form ink, carbon blue or black print. A new component (the live sound wave, the red end button, the banner's way out) picks one of these three; it never brings a fourth.

**The Carbon Means Captured Rule.** Carbon blue marks what the Receptionist wrote down, plus the focus ring and selection. Never use it for labels, buttons or decoration. One exception: on the black banner strip the focus ring is canary (`outline-copy`), because carbon on black is only 1.73:1.

**The No Purple Rule.** No purple anywhere, in any tint. A product commitment, not a taste.

## Typography

**Form Font:** Barlow Condensed 600/700/800 (with Arial Narrow, sans-serif)
**Body Font:** Barlow 400/500/600 (with system-ui, sans-serif)
**Hand Font:** Kalam 400 (with Segoe Print, cursive)

**Character:** The condensed caps are the printed form, industrial and tight. Barlow is the plain print the transcript is read in. Kalam is the single ballpoint hand, used only for captured values. Numbers use tabular figures everywhere, so the timer and ticket number hold still.

### Hierarchy
- **Display** (Form, 800, 2.25rem, line-height 1, tracking -0.025em, uppercase): the document title on the red band ("Work order", "Call Notes").
- **Headline** (Form, 700, 1.875rem, 1.25, balanced): the waiting line "Your receptionist is standing by". Sentence case.
- **Title** (Form, 700, 1.5rem, uppercase): call status ("On the line", "Call ended") with the timer in red at its right end. The ticket number on the band sits at 1.25rem, 700.
- **Stamp** (Form, 800, 1.375rem, tracking 0.025em, uppercase): the stamp button's words. Form buttons use 700 at 1.125rem.
- **Form line** (Form, 600, 0.9375rem, tracking 0.025em, uppercase): the business line under the header band.
- **Label** (Form, 700, 0.875rem, tracking 0.05em, uppercase): field labels, section headings, transcript speaker names.
- **Hand** (Kalam, 400, 1.5rem, 1.25): captured values on field rules. Displayed with a capital first letter (`first-letter:uppercase`); the stored value may stay lowercase so it reads naturally in sentences.
- **Body Lead** (Barlow, 500, 1.375rem, 1.375, max 44ch): the Call Notes summary.
- **Body** (Barlow, 400, 1.0625rem, 1.625, max 60ch): transcript lines and preview text.
- **Small** (Barlow, 400, 0.875rem): notes under controls, the demo banner.

**Summary, still being finished.** When a Test Call ends, the Owner's copy opens at once with the details and the transcript from the call. The Summary slot says "Finishing the summary…" in the same Body Lead type: no spinner, no new motion. The real summary replaces it by itself. If it has not come after 60 seconds, the slot says "The summary did not arrive. The details below are from the call." Once the server's copy is saved, a line in Print Soft under the end reason says "Saved. Our copy is deleted after 7 days." The Sample Call shows its notes whole, with no such line.

### Named Rules
**The One Hand Rule.** Kalam appears only on a field rule, for a value the Receptionist captured. Not for headings, not for flourish.

**The Printed Caps Rule.** Everything the form prints is Barlow Condensed in uppercase; everything spoken is Barlow in sentence case.

## Layout

Phone first. On a phone the top sheet is one column, max 420px, centred, in this order: header, status, fields, controls, transcript. The page holds a 16px side margin and starts 16px below the banner (48px from 768px up).

From 768px the job details move beside the call column (`420px | 22rem`, centred, 32px gap). From 1024px the sheet becomes a three-column grid (`1fr | 420px | 1fr`, 32px gaps) inside a 1200px page. The call column (header, status, controls, transcript) sits in the middle at phone width; the job details are their own white sheet in the right column, max 22rem, top-aligned, headed "Job details · No." with a red rule under it. The left column stays empty paper.

The Owner's copy is a 960px document: perforation, an outlined header, then two columns from 768px (`1fr | 24rem`, 48px column gap, 32px row gap): summary and fields on the left, the text preview and transcript on the right. A red rule closes it above the actions.

Rhythm: 20px is the sheet's inner inset everywhere. Fields stack 6px apart on the phone sheet and 16px apart on the desktop details sheet and the copy; transcript lines 12px; sections on the copy 32px. The transcript is a two-column row: a 5.5rem speaker column and the line.

## Elevation & Depth

Flat paper with one exception. The white top sheet lies on the copy and casts a low, warm paper shadow, tinted from Print Soft so it reads as yellow paper in shade, not grey. It is applied as a filter on the whole sheet, so the desktop's two sheets cast it together. Nothing else has a shadow. Depth beyond that comes from the papers themselves: white on yellow.

### Shadow Vocabulary
- **Sheet on copy** (`filter: drop-shadow(0 2px 2px rgb(90 74 30 / 0.16)) drop-shadow(0 14px 24px rgb(90 74 30 / 0.22))`): the top sheet only.

### Named Rules
**The One Shadow Rule.** Only the top sheet casts a shadow. No cards, no lifted buttons, no floating panels.

## Shapes

Square corners throughout (0px): the band, the sheets, buttons, the outlined preview box. Form is made with rules: a 2px red rule under the header and around the copy's boxes, a 1px faint rule under each field on the white sheet, a 1px solid red rule under each field on the copy. The stub edge is a perforation, a row of red dots (3px tall, 9px pitch). The one round thing on the page is the on-the-line lamp, a 12px red dot, because a lamp is round. The stamp is the one tilted thing (-1deg), because a stamp is pressed by hand.

## Components

### Demo Banner
A black print strip across the top of every demo screen. Print Black ground, white text, 8px by 16px, content max 960px. "Demo" in Form caps bold, then "· Made-up business" in white at 80%. "Built by TEKGUYZ" links to tekguyz.com, underlined, turning canary on hover. When it gains a way out of the demo (landing-page step), that control lives inside the same black strip, in white or canary, square.

### Logo and icons
Option B, "Ticket band", picked by the founder on 2026-10-07 from `docs/design/logos.html`. Both marks are a Form Red square with white drawing, square corners, on a 32 × 32 grid.
- **Product mark ("AI Voice Receptionist"):** the phone handset over a white ruled line, a field filled in. With the name in Form caps 800, it is the product logo on the landing page. It is the favicon (`app/icon.svg`), the home-screen icon (`app/apple-icon.tsx`, the mark fills the 180 px tile) and the mark on the link preview picture.
- **Business mark ("Mangrove Air"):** a mangrove tree in white strokes, its roots in the water. It sits at 20 px before the business line on every header: the work order, the Owner's copy and the Dashboard.
- **One source:** both marks live in `app/_ui/logo.tsx`. Every icon and picture draws from there; a test keeps `app/icon.svg` the same as the code. The product logo names the product only, never TEKGUYZ.

### Ticket Header (top of the phone frame)
- **Band:** Form Red fill, white Display title left, the ticket number right ("No. 04127", 1.25rem bold), 12px 20px 10px.
- **Business line:** Form line type in red, under the band, closed by a 2px red rule.
- **On the copy:** the same header outlined in 2px red instead of filled, with "Owner's copy · No." at right.

### Call Column (the phone frame)
The white top sheet, 420px wide. Status reads "Your receptionist is standing by" while waiting; once live, the red lamp, "On the line" and the timer in red. Controls sit within thumb reach below the fields. The transcript section is divided off by a faint rule and headed "What was said".

### Fields (captured-detail tags)
- **Style:** a red Label over a ruled line, min-height 1.875rem. No box, no fill, no chip.
- **Captured value:** carbon-blue Hand, capital first letter, written in with the write-in.
- **Empty:** on the sheet, a bare rule. On the copy, "Not captured" / "Nothing booked" in Body, Print Soft.
- **Order:** Name, Job, Urgency, Address, Booked; the copy adds "Taken by".

### Transcript Lines
An ordered list, 12px apart. Speaker in Label caps in a 5.5rem column: the Receptionist in red, the caller in black. The line in Body, black, max 60ch. Live transcripts announce politely to screen readers.

### Buttons (call controls)
- **Stamp Button (primary):** a red rubber stamp. White ground, red 6px double border, red Stamp caps, tilted -1deg, min-height 56px, full width in the call column. Hover tints the ground with 5% red; pressed fills it solid red with white words. An optional 20px inline SVG icon sits before the words.
- **Form Button (secondary):** a printed outline. 2px red border, red Form caps 1.125rem bold, min-height 48px, 20px sides. Hover fills solid red with white words.
- **Form Link:** a link to another screen ("Open the Dashboard", "Make a Test Call"). It looks exactly like a Form Button.
- **Focus:** every control shows a 3px carbon-blue outline offset 3px.
- **End button (Test Call):** solid Form Red, white Form caps, square, min-height 56px, full width in the call column, phone icon. No glow, no pulse.

### On-the-Line Lamp
A 12px solid red dot before "On the line". It holds still.

### Sound Wave (Test Call, not yet built)
Drawn in Form Red only, square-ended, inside the call column. It moves only with the voice, never decoratively, and under reduced motion it holds a calm, still state.

### Perforation
A tear line of red dots at the top of the Owner's copy, marking where the white sheet came off.

### Dashboard (the Owner's view)
The yellow copy as a 960px page with no white sheet: the Owner reads it; nothing is being written. The outlined header says "Dashboard" with "Owner's view" at right, over the business line. One Body Lead line says what the Receptionist handled. The answering row sits between two 2px red rules: the lamp (solid red while answering, a red ring when not), the status in Title caps, and a square switch at right (2px red frame and a square knob; filled red when on). A Small line in Print Soft says the switch changes only this screen. The three totals are one outlined box split in three by 2px red rules: a red Label over a Form 800 number at 2.25rem in Print Black. Recent calls are rows ruled in 1px solid red, each a link: the time in Small Print Soft, the caller in Body 600, the job in Print Soft, and square marks at right in red Label caps ("Booked", "Spam" outlined; "Your call" filled red with white caps). Hover tints a row with 5% red. A call opens on its own page as the Owner's copy, with its time before the end reason. A spam call's copy shows "Spam blocked" where the text preview would be.

### Motion
- **Write-in:** a captured value is revealed left to right with `clip-path`, 700ms, `cubic-bezier(0.16, 1, 0.3, 1)`. One per captured detail.
- **Sheet lift:** at call end the white sheet rises and turns away (`translateY(calc(-100% - 10vh)) rotate(-5deg)`, its own height plus a margin so a long sheet clears the screen, 900ms, accelerating ease) and is removed when its own animation ends; the copy underneath never moves, and neither the lifting sheet nor the copy replays its write-ins.
- **Reduced motion:** the write-in shows the value at once; the sheet is simply gone and the copy shows at once.

## Do's and Don'ts

### Do:
- **Do** put every printed part of the form in Form Red (#a8221a) and every captured value in Carbon Blue (#1b3a8c) Kalam on a rule.
- **Do** keep text at WCAG 2.2 AA: use Print Muted on the white sheet and Print Soft on the copy for secondary text, never the reverse untested.
- **Do** keep corners square (0px); the lamp is the only circle.
- **Do** give new live-call parts (sound wave, end button) the three inks, square corners and no motion beyond the write-in and the sheet lift.
- **Do** show a captured value with a capital first letter by display rule, leaving the stored value as spoken.
- **Do** honour reduced motion: no write-in, no lift, a still sound wave.

### Don't:
- **Don't** use purple, in any tint.
- **Don't** add a fourth ink, a gradient, a glow, a dark screen, an orb or chat bubbles.
- **Don't** put a shadow on anything but the top sheet; no cards.
- **Don't** use Carbon Blue or Kalam for anything the form prints.
- **Don't** set Faint Form Rule (#e9a8a2) as text; it is a line colour only.
- **Don't** add motion beyond one write-in per captured detail and the sheet lift: no pulsing lamp, no hover animation, no scroll effects.

### Open items
The yellow Call Notes copy does not yet reprint the top sheet's field positions, so the lift reveals a rearranged document rather than the same work order in carbon. Not yet resolved; do not treat the current copy layout as the finished carbon.

The live sound wave (story 28) is not built yet.
