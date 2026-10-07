import { ImageResponse } from "next/og";
import { PRODUCT_MARK_SVG } from "@/app/_ui/logo";

// The home-screen icon, drawn from the same mark as the favicon. Never a
// hand-made PNG (DEMO-STANDARD.md). The mark fills the tile, as in the
// picked mockup (docs/design/logos.html); the phone rounds the corners.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const src = `data:image/svg+xml,${encodeURIComponent(PRODUCT_MARK_SVG)}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        <img src={src} width={180} height={180} alt="" />
      </div>
    ),
    size,
  );
}
