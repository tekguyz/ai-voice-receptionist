import { describe, expect, it } from "vitest";
import { callEventsFromReport, summaryOfReport } from "@/lib/call-notes-from-report";
import { tellCallStory } from "@/lib/call-story";
import { endOfCallReport } from "@/lib/__tests__/vapi-report-fixture";
import { callSeconds, firstSoundMs, hasRecording, sampleCallFile } from "../sample-call-file";

// What GET /call/{id} sends back for a recorded call, built from the report fixture.
function vapiCall() {
  const report = endOfCallReport();
  return {
    ...report.call,
    status: "ended",
    endedReason: report.endedReason,
    startedAt: "2026-10-09T15:00:00.000Z",
    endedAt: "2026-10-09T15:01:15.400Z",
    analysis: report.analysis,
    artifact: { ...report.artifact, recording: { mono: { combinedUrl: "https://storage.vapi.ai/x.mp3" } } },
  };
}

const file = () => sampleCallFile(vapiCall(), { audio: "/sample-call.mp3", audioOffsetMs: 0, recordedOn: "2026-10-09" });

describe("the Sample Call file from a recorded Vapi call", () => {
  it("reads back as the same Call Story as the call's own report", () => {
    const fromFile = tellCallStory(callEventsFromReport(file()), { summary: summaryOfReport(file()) }).notes;
    const fromReport = tellCallStory(callEventsFromReport(endOfCallReport()), { summary: summaryOfReport(endOfCallReport()) }).notes;
    expect(fromFile).toEqual(fromReport);
  });

  it("keeps no system prompt, no Visitor ID, no call ID and no recording address", () => {
    const text = JSON.stringify(file());
    expect(text).not.toContain("You are Luna");
    expect(text).not.toContain("visitorId");
    expect(text).not.toContain("call-123");
    expect(text).not.toContain("storage.vapi.ai");
    expect(text).not.toContain("tool_call_result");
  });

  it("takes the length from the call's start and end", () => {
    expect(callSeconds(vapiCall())).toBe(75.4);
    expect(callSeconds({})).toBe(0);
  });

  it("knows a recorded call", () => {
    expect(hasRecording(vapiCall())).toBe(true);
    expect(hasRecording({ artifact: { messages: [] } })).toBe(false);
    // What Vapi really sends for a call with recording off.
    expect(hasRecording({ artifact: { recording: { mono: {} } } })).toBe(false);
  });
});

describe("where the sound starts", () => {
  it("is where the first silence ends, when the file starts silent", () => {
    expect(firstSoundMs("[silencedetect] silence_start: 0\n[silencedetect] silence_end: 1.234 | silence_duration: 1.234")).toBe(1234);
  });

  it("is 0 when the sound starts at once", () => {
    expect(firstSoundMs("[silencedetect] silence_start: 4.5\n[silencedetect] silence_end: 5")).toBe(0);
    expect(firstSoundMs("")).toBe(0);
  });
});
