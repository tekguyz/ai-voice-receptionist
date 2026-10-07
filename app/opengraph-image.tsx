import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { PRODUCT_MARK_SVG } from "@/app/_ui/logo";
import { SITE_NAME } from "@/lib/site";

// The link preview picture, drawn by the app in its own look: the canary copy,
// the red header band, a stamp (DEMO-STANDARD.md, DESIGN.md). An image cannot
// read CSS variables, so these hex values copy the tokens in app/globals.css.
// Change both together.
const copy = "#faf08a";
const sheet = "#ffffff";
const form = "#a8221a";
const print = "#17171a";
const printSoft = "#5a4a1e";

const HEADLINE = "An AI receptionist that answers when you can't.";

export const alt = `${SITE_NAME}: an AI receptionist that answers when you can't.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Fonts are read once, from files in the repo (see app/_og/README.md).
const fontDir = join(process.cwd(), "app/_og");
const [condensed800, barlow500] = await Promise.all([
  readFile(join(fontDir, "barlow-condensed-800.ttf")),
  readFile(join(fontDir, "barlow-500.ttf")),
]);

export default function OpengraphImage() {
  const mark = `data:image/svg+xml,${encodeURIComponent(PRODUCT_MARK_SVG)}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: copy, color: print }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            padding: "28px 64px",
            background: form,
            color: sheet,
            fontFamily: "Barlow Condensed",
            fontSize: 44,
            textTransform: "uppercase",
          }}
        >
          {/* The white rule keeps the red mark visible on the red band. */}
          <img src={mark} width={72} height={72} alt="" style={{ border: `3px solid ${sheet}` }} />
          {SITE_NAME}
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "48px 64px 56px" }}>
          <div
            style={{
              display: "flex",
              maxWidth: 1000,
              fontFamily: "Barlow Condensed",
              fontSize: 88,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
            }}
          >
            {HEADLINE}
          </div>
          <div style={{ display: "flex", marginTop: 24, fontFamily: "Barlow", fontSize: 34, color: printSoft }}>
            Call it in your browser. It takes the job and books a time.
          </div>
          <div style={{ display: "flex", marginTop: "auto" }}>
            {/* The stamp's double rule, drawn as two boxes: ImageResponse has no `double` border. */}
            <div style={{ display: "flex", padding: 4, border: `3px solid ${form}`, background: sheet, transform: "rotate(-1deg)" }}>
              <div
                style={{
                  display: "flex",
                  padding: "9px 29px",
                  border: `3px solid ${form}`,
                  color: form,
                  fontFamily: "Barlow Condensed",
                  fontSize: 40,
                  letterSpacing: "0.03em",
                  textTransform: "uppercase",
                }}
              >
                Try the demo · no signup
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Barlow Condensed", data: condensed800, weight: 800, style: "normal" },
        { name: "Barlow", data: barlow500, weight: 500, style: "normal" },
      ],
    },
  );
}
