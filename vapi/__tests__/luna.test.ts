import { describe, expect, it } from "vitest";
import { LUNA_NAME, MAX_CALL_SECONDS, TOOL, checkLuna, lunaAssistant } from "@/vapi/luna";
import { SAMPLE_BUSINESS } from "@/lib/sample-business";

describe("Luna's Vapi settings", () => {
  it("pass every safety check as written in the repo", () => {
    expect(checkLuna(lunaAssistant())).toEqual([]);
  });

  it("answer as the Sample Business and offer only the two open times", () => {
    const luna = lunaAssistant() as any;
    expect(LUNA_NAME).toContain(SAMPLE_BUSINESS.receptionistName);
    expect(luna.firstMessage).toContain(SAMPLE_BUSINESS.name);
    const prompt: string = luna.model.messages[0].content;
    expect(prompt).toContain("{{openTime1}}");
    expect(prompt).toContain("{{openTime2}}");
    expect(prompt).toMatch(/Spanish/);
    expect(prompt).not.toMatch(/Sarah|Viora/);
  });

  it("flag recording, a longer call, a server URL or a missing tool", () => {
    const luna = lunaAssistant() as any;
    expect(checkLuna({ ...luna, artifactPlan: { recordingEnabled: true } })).toContain("Recording must be off.");
    expect(checkLuna({ ...luna, maxDurationSeconds: 600 })).toContain(`Calls must stop at ${MAX_CALL_SECONDS} seconds.`);
    expect(checkLuna({ ...luna, server: { url: "https://example.com" } })).toContain("Luna must have no server URL until #5.");
    const noBooking = { ...luna, model: { ...luna.model, tools: luna.model.tools.filter((t: any) => t.function?.name !== TOOL.bookTime) } };
    expect(checkLuna(noBooking)).toContain(`Tool ${TOOL.bookTime} is missing or not async.`);
  });
});
