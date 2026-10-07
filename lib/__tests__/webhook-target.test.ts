import { describe, expect, it } from "vitest";
import { webhookTarget } from "@/lib/webhook-target";

const ORIGIN = "https://demo.example";

describe("where Vapi sends this call's webhook", () => {
  it("points Vapi at this deploy's webhook, with the secret", () => {
    expect(webhookTarget(ORIGIN, { VAPI_WEBHOOK_SECRET: "s", VERCEL_ENV: "production" })).toEqual({
      url: "https://demo.example/api/vapi/webhook",
      secret: "s",
    });
  });

  it("gives Vapi the protection bypass on a Preview only", () => {
    const env = { VAPI_WEBHOOK_SECRET: "s", VERCEL_AUTOMATION_BYPASS_SECRET: "b" };
    expect(webhookTarget(ORIGIN, { ...env, VERCEL_ENV: "preview" })?.protectionBypass).toBe("b");
    expect(webhookTarget(ORIGIN, { ...env, VERCEL_ENV: "production" })).not.toHaveProperty("protectionBypass");
    expect(webhookTarget(ORIGIN, env)).not.toHaveProperty("protectionBypass");
  });

  it("sends no webhook without the secret, or to an address Vapi cannot reach", () => {
    expect(webhookTarget(ORIGIN, {})).toBeUndefined();
    expect(webhookTarget("http://localhost:3000", { VAPI_WEBHOOK_SECRET: "s" })).toBeUndefined();
  });
});
