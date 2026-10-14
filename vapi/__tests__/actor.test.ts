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
  // Issue #29: the zip is part of it, said digit by digit, the way people say a zip.
  it("say the address in one smooth phrase, the way people say it, zip code included", () => {
    expect((actorAssistant() as any).model.messages[0].content).toContain('"forty-four fifty Northeast Eighteenth Avenue, Miami, three three one three seven"');
    expect((actorAssistant("es") as any).model.messages[0].content).toContain(
      '"cuarenta y cuatro cincuenta Northeast Eighteenth Avenue, Miami, tres tres uno tres siete"',
    );
  });

  it("have a zip code in his address, in both languages", () => {
    for (const lang of ["en", "es"] as const) {
      expect((actorAssistant(lang) as any).model.messages[0].content).toContain("4450 Northeast 18th Avenue, Miami, FL 33137");
    }
  });

  // Voice call 3: he answered into Luna's short pauses and talked over her time offer.
  it("wait a moment before answering, like a person on the phone", () => {
    expect((actorAssistant() as any).startSpeakingPlan.waitSeconds).toBeGreaterThanOrEqual(1);
  });

  // Voice call 4: he said "eighty degrees", left out his mom, and said "No" to a right read-back.
  it("keep to the script: 85 degrees, his mom as the reason, yes to a right read-back", () => {
    const actor = actorAssistant() as any;
    expect(actor.model.temperature).toBeLessThanOrEqual(0.3);
    const prompt: string = actor.model.messages[0].content;
    expect(prompt).toContain(`When she asks how urgent it is, say: "It's urgent, my mom is staying with me."`);
    expect(prompt).toContain("four four five zero");
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
