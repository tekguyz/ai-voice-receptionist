import { describe, expect, it } from "vitest";
import { matchOfferedTime } from "@/lib/open-times";

const OFFERED = ["Tuesday, October 6 at 9 AM", "Tuesday, October 6 at 2 PM"];

describe("matching a booking to the offered open times", () => {
  it("accepts an offered time", () => {
    expect(matchOfferedTime("Tuesday, October 6 at 2 PM", OFFERED)).toBe("Tuesday, October 6 at 2 PM");
  });

  it("ignores capital letters and extra spaces, and answers with the offered spelling", () => {
    expect(matchOfferedTime("  tuesday, october 6  at 9 am ", OFFERED)).toBe("Tuesday, October 6 at 9 AM");
  });

  it("refuses a time that was not offered", () => {
    expect(matchOfferedTime("Tuesday, October 6 at 11 AM", OFFERED)).toBeNull();
    expect(matchOfferedTime("", OFFERED)).toBeNull();
  });

  it("refuses everything when nothing was offered", () => {
    expect(matchOfferedTime("Tuesday, October 6 at 9 AM", [])).toBeNull();
  });
});
