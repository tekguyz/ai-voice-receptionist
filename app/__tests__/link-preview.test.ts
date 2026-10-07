import { describe, expect, it } from "vitest";
import OpengraphImage, { size } from "@/app/opengraph-image";
import AppleIcon from "@/app/apple-icon";

// PNG files start with these 8 bytes; the width and height follow at 16–23.
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

async function png(response: Response) {
  const bytes = new Uint8Array(await response.arrayBuffer());
  const view = new DataView(bytes.buffer);
  return { signature: [...bytes.slice(0, 8)], width: view.getUint32(16), height: view.getUint32(20) };
}

describe("the pictures the app draws", () => {
  it("draws the link preview as a 1200 x 630 PNG", async () => {
    const picture = await png(OpengraphImage());
    expect(picture).toEqual({ signature: PNG_SIGNATURE, width: size.width, height: size.height });
    expect(size).toEqual({ width: 1200, height: 630 });
  });

  it("draws the home-screen icon as a 180 x 180 PNG", async () => {
    const picture = await png(AppleIcon());
    expect(picture).toEqual({ signature: PNG_SIGNATURE, width: 180, height: 180 });
  });
});
