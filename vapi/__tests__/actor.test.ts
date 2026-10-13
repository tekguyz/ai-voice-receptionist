import { describe, expect, it } from "vitest";
import { ACTOR_NAME, actorAssistant, actorCallOverrides, checkActor } from "@/vapi/actor";
import { MAX_CALL_SECONDS, lunaAssistant } from "@/vapi/luna";

describe("the Caller actor's Vapi settings", () => {
  it("pass every check as written in the repo, in both languages", () => {
    expect(checkActor(actorAssistant())).toEqual([]);
    expect(checkActor(actorAssistant("es"))).toEqual([]);
  });

  it("are a caller, not a Receptionist: own name, a man's voice unlike Luna's, waits for Luna to speak", () => {
    const actor = actorAssistant() as any;
    expect(ACTOR_NAME).toBe("Caller actor · Mangrove Air");
    expect(actor.name).toBe(ACTOR_NAME);
    expect(actor.voice.voiceId).not.toBe((lunaAssistant() as any).voice.voiceId);
    expect(actor.firstMessageMode).toBe("assistant-waits-for-user");
    expect(actor).not.toHaveProperty("firstMessage");
  });

  it("play Marco Delgado, every detail made up, and let Luna end the call", () => {
    const prompt: string = (actorAssistant() as any).model.messages[0].content;
    for (const fact of ["Marco Delgado", "85 degrees", "mom", "4450 Northeast 18th Avenue", "first time she offers"]) expect(prompt).toContain(fact);
    expect(prompt).toMatch(/let her end the call/i);
  });

  // Voice call 2: read digit by digit, with pauses, the address let Luna talk over him.
  it("say the address in one smooth phrase, the way people say it", () => {
    expect((actorAssistant() as any).model.messages[0].content).toContain('"forty-four fifty Northeast Eighteenth Avenue, Miami"');
    expect((actorAssistant("es") as any).model.messages[0].content).toContain('"cuarenta y cuatro cincuenta Northeast Eighteenth Avenue, Miami"');
  });

  it("have a Spanish variant of the same persona", () => {
    const prompt: string = (actorAssistant("es") as any).model.messages[0].content;
    expect(prompt).toContain("Marco Delgado");
    expect(prompt).toContain("4450 Northeast 18th Avenue");
    expect(prompt).toMatch(/español/);
  });

  it("flag recording, tools, a server URL, a longer call or another name", () => {
    const actor = actorAssistant() as any;
    expect(checkActor({ ...actor, artifactPlan: { recordingEnabled: true } })).toContain("Recording must be off.");
    expect(checkActor({ ...actor, model: { ...actor.model, tools: [{ type: "endCall" }] } })).toContain("The actor must have no tools: Luna ends the call.");
    expect(checkActor({ ...actor, server: { url: "https://example.com" } })).toContain("The actor must have no server URL.");
    expect(checkActor({ ...actor, maxDurationSeconds: 600 })).toContain(`Calls must stop at ${MAX_CALL_SECONDS} seconds.`);
    expect(checkActor({ ...actor, name: "Luna" })).toContain(`The actor must be named "${ACTOR_NAME}".`);
  });

  it("override nothing for English and only the model for Spanish", () => {
    expect(actorCallOverrides("en")).toEqual({});
    expect((actorCallOverrides("es") as any).model.messages[0].content).toMatch(/español/);
  });
});
