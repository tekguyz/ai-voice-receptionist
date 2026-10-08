// The logo, option B "Ticket band" (picked 2026-10-07, DESIGN.md). Every icon
// and picture draws from here: the favicon (app/icon.svg), the home-screen
// icon, the link preview, the landing page and the work order header.
// Hex values copy the tokens in app/globals.css; change both together.

const FORM_RED = "#a8221a";
const WHITE = "#ffffff";

// The phone handset, the same shape as PhoneIcon in ticket.tsx (20 x 20).
const HANDSET =
  "M6.6 2.2 4.4 2c-.9 0-2 .9-1.9 2.2.4 6.6 6.7 12.9 13.3 13.3 1.3.1 2.2-1 2.2-1.9l-.2-2.2c0-.5-.4-.9-.9-1l-3-.7c-.4-.1-.9.1-1.1.5l-.9 1.5c-2-1-3.9-2.9-4.9-4.9l1.5-.9c.4-.2.6-.7.5-1.1l-.7-3c-.1-.5-.5-.9-1-.9Z";

// The mangrove: a crown, a trunk, four roots and the waterline.
const MANGROVE = [
  "M8 11 Q16 3 24 11",
  "M16 8 V17",
  "M16 16 C12 18 9.5 21 8 25",
  "M16 16 C14.5 19.5 13.5 22 13 25",
  "M16 16 C17.5 19.5 18.5 22 19 25",
  "M16 16 C20 18 22.5 21 24 25",
  "M5 26.5 H27",
];

// The mark's shapes, written once as SVG text. The favicon file and the icon
// pictures use them whole; the page draws the same text inside its own <svg>.
const PRODUCT_MARK_SHAPES =
  `<rect width="32" height="32" fill="${FORM_RED}"/>` +
  `<path transform="translate(8 4) scale(.8)" fill="${WHITE}" d="${HANDSET}"/>` +
  `<rect x="6" y="24" width="20" height="2.5" fill="${WHITE}"/>`;

/**
 * The product mark as SVG text: the favicon file, and the picture
 * ImageResponse draws (it cannot render a React SVG component).
 */
export const PRODUCT_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${PRODUCT_MARK_SHAPES}</svg>`;

/** "AI Voice Receptionist": a red square, the handset over a ruled line (a field filled in). */
export function ProductMark({ className }: { className?: string }) {
  // The shapes are our own constant text, never user input.
  return <svg aria-hidden="true" viewBox="0 0 32 32" className={className} dangerouslySetInnerHTML={{ __html: PRODUCT_MARK_SHAPES }} />;
}

/** The mark and the name, as one unit, for the landing page. */
export function ProductLogo() {
  return (
    <p className="inline-flex items-center gap-3">
      <ProductMark className="size-10 shrink-0" />
      <span translate="no" className="font-form text-[1.75rem] leading-none font-extrabold tracking-tight uppercase">AI Voice Receptionist</span>
    </p>
  );
}

/** "Mangrove Air": a red square with a mangrove tree, its roots in the water. */
export function BusinessMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className={className}>
      <rect width="32" height="32" fill={FORM_RED} />
      <g fill="none" stroke={WHITE} strokeWidth="2" strokeLinecap="square">
        {MANGROVE.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
