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
  it("read the address back and write names as first and last", () => {
    const prompt: string = (lunaAssistant() as any).model.messages[0].content;
    expect(prompt).toMatch(/read it back/i);
    expect(prompt).toContain("a space between first and last name");
  });

  // Issue #15, finding 1: with an endCall tool she booked and hung up in one reply, with no confirmation.
  it("end the call by her goodbye phrase, not a tool, so she cannot hang up before confirming", () => {
    const luna = lunaAssistant() as any;
    expect(luna.model.tools.some((t: any) => t.type === "endCall")).toBe(false);
    expect(luna.endCallPhrases).toEqual(["have a great day", "que tenga un buen día"]);
    expect(luna.model.messages[0].content).toContain('In English, end with exactly "Thanks for calling Mangrove Air, have a great day!"');
    expect(luna.model.messages[0].content).not.toContain("endCall");
    expect(checkLuna({ ...luna, endCallPhrases: [] })).toContain("Luna must be able to end the call.");
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

  // Issue #15: Gemini 3.5 Flash hung up without confirming and read its notes aloud.
  it("use a GPT-4.1-class mini model", () => {
    const model = (lunaAssistant() as any).model;
    expect(model.provider).toBe("openai");
    expect(model.model).toBe("gpt-4.1-mini");
  });

  // Voice call 3: she ended an English call with the Spanish goodbye.
  it("say the goodbye in the call's language only", () => {
    const prompt: string = (lunaAssistant() as any).model.messages[0].content;
    expect(prompt).toContain('Only if the call is in Spanish, end with exactly "Gracias por llamar a Mangrove Air, ¡que tenga un buen día!" instead.');
  });

  // Voice calls 1-4: "Mangrove Air, this is Luna" ran together and was heard as "Mangrover".
  it("say the business name, then stop, in the greeting", () => {
    expect((lunaAssistant() as any).firstMessage).toBe("Thanks for calling Mangrove Air. This is Luna. How can I help you today?");
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
