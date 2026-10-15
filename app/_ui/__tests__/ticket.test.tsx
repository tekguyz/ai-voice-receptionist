import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { addressLines, Field } from "@/app/_ui/ticket";

describe("an address on the work order", () => {
  it("goes on two lines like a mailed address: the street, then city, state and zip", () => {
    expect(addressLines("4450 Northeast 18th Avenue, Miami, FL 33137")).toEqual(["4450 Northeast 18th Avenue", "Miami, FL 33137"]);
  });

  it("stays on one line when there is no comma to break at", () => {
    expect(addressLines("21 Palm Way")).toEqual(["21 Palm Way"]);
  });

  it("drops the comma after the street, because the line break does its job", () => {
    const html = renderToStaticMarkup(<Field label="Address" value="4450 Northeast 18th Avenue, Miami, FL 33137" twoLines />);
    expect(html).toContain(">4450 Northeast 18th Avenue<");
    expect(html).toContain(">Miami, FL 33137<");
    expect(html).not.toContain("Avenue,");
  });
});
