import { describe, expect, it } from "vitest";
import { devWebhookOrigin, isLaptopDev } from "@/lib/laptop-dev";
import { sampleCallRecording } from "@/lib/sample-call-recording";

const laptop = { NODE_ENV: "development", SAMPLE_CALL_WEBHOOK_ORIGIN: "https://ai-voice-receptionist-tekguyz.vercel.app/" };

describe("the laptop's dev server", () => {
  it("is npm run dev with no Vercel", () => {
    expect(isLaptopDev({ NODE_ENV: "development" })).toBe(true);
    expect(isLaptopDev({ NODE_ENV: "development", VERCEL_ENV: "preview" })).toBe(false);
    expect(isLaptopDev({ NODE_ENV: "production" })).toBe(false);
    expect(isLaptopDev({})).toBe(false);
  });

  it("sends a laptop call's tool calls to the deployed site, with no trailing slash", () => {
    expect(devWebhookOrigin(laptop)).toBe("https://ai-voice-receptionist-tekguyz.vercel.app");
  });

  it("gives no webhook origin on Vercel, in production, or without https", () => {
    expect(devWebhookOrigin({ ...laptop, VERCEL_ENV: "production" })).toBeNull();
    expect(devWebhookOrigin({ ...laptop, NODE_ENV: "production" })).toBeNull();
    expect(devWebhookOrigin({ ...laptop, SAMPLE_CALL_WEBHOOK_ORIGIN: "http://localhost:3000" })).toBeNull();
    expect(devWebhookOrigin({ NODE_ENV: "development" })).toBeNull();
  });

  it("never turns recording on by itself", () => {
    expect(sampleCallRecording(laptop)).toBeNull();
    expect(sampleCallRecording({ ...laptop, SAMPLE_CALL_RECORDING: "on" })).toEqual({ webhookOrigin: "https://ai-voice-receptionist-tekguyz.vercel.app" });
  });
});
