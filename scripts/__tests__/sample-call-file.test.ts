import { describe, expect, it } from "vitest";
import { callEventsFromReport, summaryOfReport } from "@/lib/call-notes-from-report";
import { tellCallStory } from "@/lib/call-story";
import { endOfCallReport } from "@/lib/__tests__/vapi-report-fixture";
import { alignUntimedLines, callSeconds, firstSoundMs, hasRecording, sampleCallFile, speechStarts } from "../sample-call-file";

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

  it("says the call was made by the AI actor, every detail made up", () => {
    expect(file().about).toBe(
      "A real call to Luna by an AI actor that plays the caller, 2026-10-09. Pulled by `npm run sample-call:pull` (issue #8). Every caller detail is made up.",
    );
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

describe("lines Vapi logged with no timing", () => {
  it("reads where speech starts on one side, from ffmpeg's silencedetect", () => {
    expect(speechStarts("silence_start: 0\nsilence_end: 0.75 | x\nsilence_start: 3.9\nsilence_end: 11.74")).toEqual([0.75, 11.74]);
    expect(speechStarts("silence_start: 2.5\nsilence_end: 4")).toEqual([0, 4]);
    expect(speechStarts("")).toEqual([0]);
  });

  // From the keeper call, 2026-10-13: Vapi put Luna's confirmation at 76.49 s with no length; she started at 66.99 s.
  const call = {
    artifact: {
      messages: [
        { role: "bot", message: "Thanks for calling Mangrove Air.", secondsFromStart: 1.09, duration: 2916 },
        { role: "bot", message: "One moment.", secondsFromStart: 65.6, duration: 722 },
        { role: "user", message: "Okay.", secondsFromStart: 74, duration: 0 },
        { role: "bot", message: "You're all set for tomorrow at nine.", secondsFromStart: 76.49, duration: 0 },
        { role: "tool_calls", toolCalls: [], secondsFromStart: 66.5 },
      ],
    },
  };
  const starts = { user: [6.31, 68.64], bot: [0.76, 65.44, 66.99, 71.9] };
  const aligned = (offsetMs = 0) => (alignUntimedLines(call, starts, offsetMs) as typeof call).artifact.messages;

  it("moves such a line to the first speech start on its side after that side's last line ended", () => {
    const at = Object.fromEntries(aligned().map((m) => [("message" in m && m.message) || m.role, m.secondsFromStart]));
    expect(at["You're all set for tomorrow at nine."]).toBe(66.99);
    expect(at["Okay."]).toBe(68.64);
  });

  it("leaves lines Vapi timed alone, and keeps the list in time order", () => {
    const messages = aligned();
    expect(messages.map((m) => m.secondsFromStart)).toEqual([1.09, 65.6, 66.5, 66.99, 68.64]);
  });

  it("works in the call's clock: the recording runs offsetMs ahead of it", () => {
    const line = aligned(-230).find((m) => "message" in m && m.message?.startsWith("You're all set"));
    expect(line?.secondsFromStart).toBeCloseTo(67.22, 5);
  });

  it("never moves a line later than Vapi logged it", () => {
    const late = alignUntimedLines(call, { user: [], bot: [] }, 0) as typeof call;
    expect(late.artifact.messages.find((m) => "message" in m && m.message === "Okay.")?.secondsFromStart).toBe(74);
  });
});
