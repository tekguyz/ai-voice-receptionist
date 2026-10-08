import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PRODUCT_MARK_SVG, ProductMark } from "@/app/_ui/logo";

describe("the product mark", () => {
  it("draws the same shapes on the page as in the SVG text", () => {
    const onPage = renderToStaticMarkup(<ProductMark className="size-10" />);
    // Only the outer tag differs: the page copy is hidden from screen readers and takes a class.
    const shapes = (svg: string) => svg.slice(svg.indexOf(">") + 1);
    expect(shapes(onPage)).toBe(shapes(PRODUCT_MARK_SVG));
  });
});
