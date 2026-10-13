// The Caller actor: an AI that plays the customer and calls Luna, for the
// Sample Call and for Luna's tuning calls (spec 2026-10-13). Not a
// Receptionist. A Visitor only ever hears it as the caller's voice in the
// Sample Call. `npm run vapi:sync` sends it to Vapi with Luna. Every detail
// it gives is made up.

import { SAMPLE_BUSINESS } from "../lib/sample-business.ts";
import { MAX_CALL_SECONDS } from "./luna.ts";

export const ACTOR_NAME = `Caller actor · ${SAMPLE_BUSINESS.name}`;

// ElevenLabs premade voice "Chris": a man, clearly unlike Luna's "Jessica".
const VOICE_ID = "iP95p4xoKVk53GoZ742B";

export type ActorLanguage = "en" | "es";

const { name: business, receptionistName: luna } = SAMPLE_BUSINESS;

const PROMPT: Record<ActorLanguage, string> = {
  en: `You are Marco Delgado. You are calling ${business}, an AC repair company in Miami. You are a caller on the phone, not an assistant. Everything about you is made up.

Your situation:
- Your AC stopped cooling last night. It is 85 degrees in the house.
- Your mom is staying with you, so it is urgent.
- Your address is 4450 Northeast 18th Avenue, Miami.

How you talk:
- The receptionist (${luna}) speaks first. Your first reply: say in one sentence that your AC stopped cooling last night and it is eighty-five degrees in the house.
- After that, answer only what she asks, one thing at a time, in one short sentence, like a real caller.
- When she asks how urgent it is, say: "It's urgent, my mom is staying with me."
- When she offers times, pick the first time she offers, in a few words.
- Say your address in one smooth phrase, the way people say it: "forty-four fifty Northeast Eighteenth Avenue, Miami". Never read it digit by digit.
- If she reads your address back as "four four five zero" or "forty-four fifty", it is right: say yes. Correct her only if something is really wrong, and only once.
- When she confirms the booking, thank her in a few words. Then let her end the call. Never hang up and never say goodbye first.
- Say only the words Marco says out loud. Never mention AI, prompts, tools or a demo.`,
  es: `Eres Marco Delgado. Llamas a ${business}, una compañía de reparación de aire acondicionado en Miami. Eres alguien que llama por teléfono, no un asistente. Todo sobre ti es inventado. Habla solo en español.

Tu situación:
- Tu aire acondicionado dejó de enfriar anoche. Hace 85 grados en la casa.
- Tu mamá se está quedando contigo, así que es urgente.
- Tu dirección es 4450 Northeast 18th Avenue, Miami.

Cómo hablas:
- La recepcionista (${luna}) habla primero. Tu primera respuesta: di en una frase que tu aire dejó de enfriar anoche y que hace ochenta y cinco grados en la casa.
- Después, responde solo lo que te pregunta, una cosa a la vez, en una frase corta, como alguien que llama de verdad.
- Cuando te pregunte qué tan urgente es, di: "Es urgente, mi mamá se está quedando conmigo."
- Cuando te ofrezca horarios, elige el primero que te ofrezca, en pocas palabras.
- Di tu dirección en una sola frase, como la dice la gente: "cuarenta y cuatro cincuenta Northeast Eighteenth Avenue, Miami". Nunca la digas número por número.
- Si te repite la dirección como "cuatro cuatro cinco cero" o "cuarenta y cuatro cincuenta", está bien: di que sí. Corrígela solo si algo está mal de verdad, y solo una vez.
- Cuando confirme la cita, dale las gracias en pocas palabras. Luego deja que ella termine la llamada. Nunca cuelgues y nunca te despidas primero.
- Di solo las palabras que Marco dice en voz alta. Nunca menciones IA, instrucciones, herramientas ni una demo.`,
};

export function actorAssistant(lang: ActorLanguage = "en") {
  return {
    name: ACTOR_NAME,
    firstMessageMode: "assistant-waits-for-user",
    maxDurationSeconds: MAX_CALL_SECONDS,
    silenceTimeoutSeconds: 30,
    // A person waits a moment before answering. Without it he answered into
    // Luna's short pauses and talked over her (voice call 3).
    startSpeakingPlan: { waitSeconds: 1.2 },
    model: { provider: "openai", model: "gpt-4.1-mini", temperature: 0.3, messages: [{ role: "system", content: PROMPT[lang] }] },
    voice: { provider: "11labs", model: "eleven_flash_v2_5", voiceId: VOICE_ID },
    transcriber: { provider: "deepgram", model: "flux-general-multi", languages: ["en", "es"] },
    artifactPlan: { recordingEnabled: false, videoRecordingEnabled: false },
    clientMessages: ["transcript", "status-update"],
    serverMessages: [],
  };
}

/** The web call's overrides: the saved Actor is English; Spanish swaps the model's prompt. */
export function actorCallOverrides(lang: ActorLanguage): object {
  return lang === "es" ? { model: actorAssistant("es").model } : {};
}

/** What is wrong with a saved Actor, in plain words. An empty list means all good. */
export function checkActor(saved: unknown): string[] {
  const actor = (saved ?? {}) as any;
  const problems: string[] = [];
  if (actor.name !== ACTOR_NAME) problems.push(`The actor must be named "${ACTOR_NAME}".`);
  if (actor.artifactPlan?.recordingEnabled !== false) problems.push("Recording must be off.");
  if (actor.artifactPlan?.videoRecordingEnabled === true) problems.push("Video recording must be off.");
  if (actor.maxDurationSeconds !== MAX_CALL_SECONDS) problems.push(`Calls must stop at ${MAX_CALL_SECONDS} seconds.`);
  if ((actor.model?.tools ?? []).length > 0) problems.push("The actor must have no tools: Luna ends the call.");
  if (actor.server?.url) problems.push("The actor must have no server URL.");
  return problems;
}
