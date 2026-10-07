import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRODUCT_MARK_SVG } from "@/app/_ui/logo";

describe("the product mark", () => {
  it("is the same picture in the favicon file and in the code that draws the icons", async () => {
    const favicon = await readFile(join(process.cwd(), "app/icon.svg"), "utf8");
    expect(favicon.trim()).toBe(PRODUCT_MARK_SVG);
  });
});
