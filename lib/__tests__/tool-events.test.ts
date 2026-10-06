import { describe, expect, it } from "vitest";
import { eventFromToolCall } from "@/lib/tool-events";

const OFFERED = ["Tuesday, October 6 at 9 AM", "Tuesday, October 6 at 2 PM"];

describe("Luna's tool calls as Call Story events", () => {
  it("turns recordDetail into a detail, from an object or a JSON string", () => {
    expect(eventFromToolCall("recordDetail", { field: "job", value: " AC not cooling " }, 5, OFFERED)).toEqual({
      type: "detail",
      field: "job",
      value: "AC not cooling",
      atMs: 5,
    });
    expect(eventFromToolCall("recordDetail", '{"field":"name","value":"Rosa Diaz"}', 7, OFFERED)).toEqual({
      type: "detail",
      field: "name",
      value: "Rosa Diaz",
      atMs: 7,
    });
  });

  it("ignores a detail with an unknown field, no value, or arguments that are not an object", () => {
    expect(eventFromToolCall("recordDetail", { field: "shoe size", value: "9" }, 0, OFFERED)).toBeNull();
    expect(eventFromToolCall("recordDetail", { field: "job", value: "  " }, 0, OFFERED)).toBeNull();
    expect(eventFromToolCall("recordDetail", "null", 0, OFFERED)).toBeNull();
    expect(eventFromToolCall("recordDetail", "{not json", 0, OFFERED)).toBeNull();
  });

  it("turns a booking of an offered time into a booking, written as offered", () => {
    expect(eventFromToolCall("bookTime", { time: "tuesday, october 6 at 2 pm" }, 9, OFFERED)).toEqual({
      type: "booked",
      time: "Tuesday, October 6 at 2 PM",
      atMs: 9,
    });
  });

  it("ignores a booking of a time that was not offered, or when nothing was offered", () => {
    expect(eventFromToolCall("bookTime", { time: "Friday at noon" }, 0, OFFERED)).toBeNull();
    expect(eventFromToolCall("bookTime", { time: "Tuesday, October 6 at 9 AM" }, 0, [])).toBeNull();
  });

  it("ignores any other tool", () => {
    expect(eventFromToolCall("endCall", {}, 0, OFFERED)).toBeNull();
    expect(eventFromToolCall(undefined, {}, 0, OFFERED)).toBeNull();
  });
});
