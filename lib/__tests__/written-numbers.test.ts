import { describe, expect, it } from "vitest";
import { writtenNumbers } from "@/lib/written-numbers";

// Luna says numbers as words so the voice reads them right. The transcript
// shows them the way the work order writes them.
describe("numbers in the transcript", () => {
  it("writes a street number and a zip code said digit by digit as digits", () => {
    expect(writtenNumbers("Four four five zero Northeast eighteenth Avenue, Deerfield Beach, Florida three three zero six three.")).toBe(
      "4450 Northeast 18th Avenue, Deerfield Beach, FL 33063.",
    );
  });

  it("writes a date and times the way the booked time is written", () => {
    expect(writtenNumbers("I have Wednesday, October twenty eighth at nine AM, or Wednesday, October twenty-eighth at two PM.")).toBe(
      "I have Wednesday, October 28 at 9 AM, or Wednesday, October 28 at 2 PM.",
    );
  });

  it("writes a time of day said in words with AM or PM", () => {
    expect(writtenNumbers("Tomorrow at nine in the morning or two in the afternoon?")).toBe("Tomorrow at 9 AM or 2 PM?");
    expect(writtenNumbers("How about nine thirty a.m.?")).toBe("How about 9:30 AM?");
  });

  it("joins digits said with commas or dashes", () => {
    expect(writtenNumbers("It's three, three, one, three, seven.")).toBe("It's 33137.");
    expect(writtenNumbers("three-three-one-three-seven")).toBe("33137");
  });

  it("leaves ordinary counting words alone", () => {
    const line = "I have two open times. One moment, it is eighty five degrees in the first room.";
    expect(writtenNumbers(line)).toBe(line);
  });

  it("leaves digits as they are", () => {
    const line = "4450 Northeast 18th Avenue, Miami, FL 33137, Tuesday, October 6 at 9 AM.";
    expect(writtenNumbers(line)).toBe(line);
  });
});

describe("street numbers said in pairs", () => {
  it("writes them as one number before the direction", () => {
    expect(writtenNumbers("Forty four fifty Northeast 18th Avenue, Miami.")).toBe("4450 Northeast 18th Avenue, Miami.");
    expect(writtenNumbers("twelve oh five Southwest eighth Street")).toBe("1205 Southwest 8th Street");
  });
});
