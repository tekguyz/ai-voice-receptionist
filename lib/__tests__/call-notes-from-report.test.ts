import { describe, expect, it } from "vitest";
import { callNotesFromReport } from "@/lib/call-notes-from-report";
import { OPEN_TIMES, VISITOR_A, endOfCallReport } from "./vapi-report-fixture";

describe("Call Notes from Vapi's end-of-call report", () => {
  it("files the notes under the call and the Visitor named in the call's metadata", () => {
    const report = callNotesFromReport(endOfCallReport());
    expect(report?.callId).toBe("call-123");
    expect(report?.visitorId).toBe(VISITOR_A);
  });

  it("builds the transcript in order, Caller and Receptionist, with no system prompt", () => {
    const { notes } = callNotesFromReport(endOfCallReport())!;
    expect(notes.lines.map((l) => [l.speaker, l.atMs])).toEqual([
      ["receptionist", 1200],
      ["caller", 6500],
      ["caller", 14000],
      ["caller", 40000],
      ["receptionist", 46000],
    ]);
    expect(notes.lines[1].text).toBe("Hi, my AC is blowing warm air.");
  });

  it("takes the details and the booking from Luna's tool calls, with the booking as offered", () => {
    const { notes } = callNotesFromReport(endOfCallReport())!;
    expect(notes.details).toEqual({ job: "AC blowing warm air", name: "Rosa Diaz" });
    expect(notes.booked).toBe(OPEN_TIMES[0]);
  });

  it("drops a booking for a time that was not offered", () => {
    const report = endOfCallReport();
    const messages = report.artifact.messages.map((m) =>
      m.role === "tool_calls" && JSON.stringify(m).includes("bookTime")
        ? { ...m, toolCalls: [{ id: "x", type: "function", function: { name: "bookTime", arguments: '{"time":"Friday at noon"}' } }] }
        : m,
    );
    const { notes } = callNotesFromReport({ ...report, artifact: { messages } })!;
    expect(notes.booked).toBeNull();
  });

  it("uses Vapi's summary, and builds one from the details when Vapi sent none", () => {
    expect(callNotesFromReport(endOfCallReport())!.notes.summary).toBe("Rosa Diaz called about an AC that blows warm air and booked Tuesday at 9 AM.");
    const { notes } = callNotesFromReport(endOfCallReport({ analysis: {} }))!;
    expect(notes.summary).toBe(`Rosa Diaz called about AC blowing warm air. Booked for ${OPEN_TIMES[0]}.`);
  });

  it("maps the end reason and takes the duration from the report", () => {
    const { notes } = callNotesFromReport(endOfCallReport({ endedReason: "exceeded-max-duration" }))!;
    expect(notes.endReason).toBe("time-limit");
    expect(notes.durationMs).toBe(75400);
  });

  it("passes a Spanish transcript through unchanged", () => {
    const report = endOfCallReport();
    const messages = [{ role: "user", message: "Hola, mi aire acondicionado no enfría.", secondsFromStart: 5 }];
    const { notes } = callNotesFromReport({ ...report, artifact: { messages } })!;
    expect(notes.lines[0].text).toBe("Hola, mi aire acondicionado no enfría.");
  });

  it("makes notes even for an empty call", () => {
    const { notes } = callNotesFromReport(endOfCallReport({ artifact: { messages: [] }, analysis: {} }))!;
    expect(notes.lines).toEqual([]);
    expect(notes.summary).toBe("No details were captured. No time was booked.");
  });

  it("is not one of our Test Calls without a valid Visitor ID or a call ID", () => {
    expect(callNotesFromReport(endOfCallReport({}, null))).toBeNull();
    expect(callNotesFromReport(endOfCallReport({}, "not-a-visitor-id"))).toBeNull();
    expect(callNotesFromReport(endOfCallReport({ call: { assistantOverrides: { metadata: { visitorId: VISITOR_A } } } }))).toBeNull();
    expect(callNotesFromReport("garbage")).toBeNull();
    expect(callNotesFromReport(undefined)).toBeNull();
  });
});
