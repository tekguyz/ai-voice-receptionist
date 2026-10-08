import { describe, expect, it } from "vitest";
import { RECORDING_OPEN_TIMES, sampleCallRecording } from "@/lib/sample-call-recording";

const ON = { SAMPLE_CALL_RECORDING: "on", NODE_ENV: "development", SAMPLE_CALL_WEBHOOK_ORIGIN: "https://demo.example" };

describe("the Sample Call recording switch", () => {
  it("is on only on the laptop, in development, when switched on, with a webhook address", () => {
    expect(sampleCallRecording(ON)).toEqual({ webhookOrigin: "https://demo.example" });
  });

  it("is off by default", () => {
    expect(sampleCallRecording({ NODE_ENV: "development" })).toBeNull();
    expect(sampleCallRecording({ ...ON, SAMPLE_CALL_RECORDING: "true" })).toBeNull();
  });

  it("is never on for a Visitor: not on any Vercel deploy, not in a production build", () => {
    expect(sampleCallRecording({ ...ON, VERCEL_ENV: "production" })).toBeNull();
    expect(sampleCallRecording({ ...ON, VERCEL_ENV: "preview" })).toBeNull();
    expect(sampleCallRecording({ ...ON, VERCEL_ENV: "development" })).toBeNull();
    expect(sampleCallRecording({ ...ON, NODE_ENV: "production" })).toBeNull();
  });

  it("stays off without an https webhook address, because the booking needs the webhook", () => {
    expect(sampleCallRecording({ ...ON, SAMPLE_CALL_WEBHOOK_ORIGIN: undefined })).toBeNull();
    expect(sampleCallRecording({ ...ON, SAMPLE_CALL_WEBHOOK_ORIGIN: "http://localhost:3000" })).toBeNull();
  });

  it("drops a trailing slash from the webhook address", () => {
    expect(sampleCallRecording({ ...ON, SAMPLE_CALL_WEBHOOK_ORIGIN: "https://demo.example/" })?.webhookOrigin).toBe("https://demo.example");
  });

  it("offers times that never go stale in the recording", () => {
    expect(RECORDING_OPEN_TIMES).toEqual(["tomorrow at 9 AM", "tomorrow at 2 PM"]);
  });
});
