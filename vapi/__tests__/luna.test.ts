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

  // From the founder's test calls on 2026-10-05.
  it("read the address back, write names as first and last, and confirm before hanging up", () => {
    const prompt: string = (lunaAssistant() as any).model.messages[0].content;
    expect(prompt).toMatch(/read it back/i);
    expect(prompt).toContain("a space between first and last name");
    expect(prompt).toMatch(/Never call endCall in the same reply as/);
  });

  it("flag recording, a longer call, a server URL or a missing tool", () => {
    const luna = lunaAssistant() as any;
    expect(checkLuna({ ...luna, artifactPlan: { recordingEnabled: true } })).toContain("Recording must be off.");
    expect(checkLuna({ ...luna, maxDurationSeconds: 600 })).toContain(`Calls must stop at ${MAX_CALL_SECONDS} seconds.`);
    expect(checkLuna({ ...luna, server: { url: "https://example.com" } })).toContain(
      "Luna must have no saved server URL: the server gives each call its own webhook address.",
    );
    const noBooking = { ...luna, model: { ...luna.model, tools: luna.model.tools.filter((t: any) => t.function?.name !== TOOL.bookTime) } };
    expect(checkLuna(noBooking)).toContain(`Tool ${TOOL.bookTime} is missing.`);
  });

  it("say goodbye once: Luna does it herself, so Vapi adds no end-of-call message", () => {
    const luna = lunaAssistant() as any;
    expect(luna).not.toHaveProperty("endCallMessage");
    expect(checkLuna({ ...luna, endCallMessage: "Goodbye!" })).toContain("Luna must not have an endCallMessage (she says goodbye herself).");
  });

  it("tell Luna the call limit from MAX_CALL_SECONDS", () => {
    const prompt: string = (lunaAssistant() as any).model.messages[0].content;
    expect(prompt).toContain(`The call stops after ${MAX_CALL_SECONDS / 60} minutes.`);
  });

  it("let recordDetail run without waiting, and make bookTime wait for the server's answer", () => {
    const luna = lunaAssistant() as any;
    const withTools = (edit: (tool: any) => any) => ({
      ...luna,
      model: { ...luna.model, tools: luna.model.tools.map((t: any) => (t.function?.name ? edit(t) : t)) },
    });
    expect(luna.model.tools.find((t: any) => t.function?.name === TOOL.recordDetail).async).toBe(true);
    expect(luna.model.tools.find((t: any) => t.function?.name === TOOL.bookTime).async).not.toBe(true);
    expect(checkLuna(withTools((t) => ({ ...t, async: true })))).toContain(`Tool ${TOOL.bookTime} must wait for the server's answer (not async).`);
    expect(checkLuna(withTools((t) => ({ ...t, async: false })))).toContain(`Tool ${TOOL.recordDetail} must be async.`);
    expect(checkLuna(withTools((t) => ({ ...t, server: { url: "https://example.com" } })))).toContain(`Tool ${TOOL.bookTime} must have no server URL of its own.`);
  });

  it("send tool calls and the end-of-call report to the server", () => {
    const luna = lunaAssistant() as any;
    expect(luna.serverMessages).toEqual(["tool-calls", "end-of-call-report"]);
    expect(checkLuna({ ...luna, serverMessages: [] })).toContain('The server must get "end-of-call-report" messages.');
  });

  it("tell Luna what to do when a booking is refused", () => {
    const prompt: string = (lunaAssistant() as any).model.messages[0].content;
    expect(prompt).toContain("answers that the time was not offered, offer the two open times again");
  });
});
