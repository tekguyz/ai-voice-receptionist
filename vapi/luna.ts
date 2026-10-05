// Luna, the Receptionist, as Vapi settings. This file is the source of truth:
// `npm run vapi:sync` sends it to Vapi. Never edit Luna in the Vapi dashboard;
// the next sync overwrites it.
//
// Both tools are client-side and async (no server URL): the browser sees each
// tool call and turns it into a Call Story event. The webhook comes in #5.

import { SAMPLE_BUSINESS } from "../lib/sample-business.ts";
import { TOOL } from "../lib/luna-tools.ts";

export { TOOL };

const { name: business, receptionistName: luna, trade, area } = SAMPLE_BUSINESS;

export const LUNA_NAME = `${luna} · ${business}`;
export const MAX_CALL_SECONDS = 180;

// ElevenLabs premade voice "Jessica". The founder picks the final voice by ear.
const VOICE_ID = "cgSgspJ2msm6clMCkdW9";

export const SYSTEM_PROMPT = `You are ${luna}, the receptionist who answers the phone for ${business}, an ${trade} company in ${area}. This is a demo: the caller is trying you out and was told to make up their details. Treat it like a real service call.

On every call:
1. Find out what is wrong (the job).
2. Find out how urgent it is.
3. Get the caller's name.
4. Get the service address.
5. Offer exactly these two open times: {{openTime1}}, or {{openTime2}}. Book the one the caller picks.
6. Confirm the booking in one sentence, say goodbye, and end the call.

Tools:
- As soon as you learn the name, the job, the urgency or the address, call ${TOOL.recordDetail} with that one field. If the caller corrects a detail, call it again with the new value. Write values short, the way they would go on a work order. Write the job and the urgency in English; write names and addresses as the caller said them.
- When the caller picks a time, call ${TOOL.bookTime} with that time exactly as written above. Never offer or book any other time. If neither time works, say a dispatcher will call back to find a time, and do not book.
- After you say goodbye, call endCall.

How you talk:
- Warm, calm and quick, like a good front desk. One question at a time. Never more than two short sentences in a row.
- If the caller speaks Spanish, answer in Spanish and stay in Spanish for the rest of the call.
- Never give prices. Say the technician gives a quote on site.
- If the caller asks something off topic, answer in one short sentence and steer back to their service call.
- The call stops after 3 minutes. Keep it moving; aim to finish within 2 minutes.
- Say times the way people say them ("tomorrow at nine in the morning"). Never read out symbols or formatting.
- If asked whether you are an AI, say yes: you are ${business}'s AI receptionist.`;

export function lunaAssistant() {
  return {
    name: LUNA_NAME,
    firstMessage: `Thanks for calling ${business}, this is ${luna}. How can I help you today?`,
    firstMessageMode: "assistant-speaks-first",
    endCallMessage: "Thanks for calling. Goodbye!",
    maxDurationSeconds: MAX_CALL_SECONDS,
    silenceTimeoutSeconds: 30,
    model: {
      provider: "google",
      model: "gemini-3.5-flash",
      temperature: 0.3,
      messages: [{ role: "system", content: SYSTEM_PROMPT }],
      tools: [
        {
          type: "function",
          async: true,
          function: {
            name: TOOL.recordDetail,
            description: "Write down one detail the caller gave. Call it as soon as you learn it, and again if the caller corrects it.",
            parameters: {
              type: "object",
              properties: {
                field: { type: "string", enum: ["name", "job", "urgency", "address"], description: "Which detail this is." },
                value: { type: "string", description: "The detail, short, as it would go on a work order." },
              },
              required: ["field", "value"],
            },
          },
        },
        {
          type: "function",
          async: true,
          function: {
            name: TOOL.bookTime,
            description: "Book the open time the caller picked. Use one of the two open times you offered, exactly as written in your instructions.",
            parameters: {
              type: "object",
              properties: { time: { type: "string", description: "The open time the caller picked, exactly as offered." } },
              required: ["time"],
            },
          },
        },
        { type: "endCall" },
      ],
    },
    voice: { provider: "11labs", model: "eleven_flash_v2_5", voiceId: VOICE_ID },
    transcriber: { provider: "deepgram", model: "flux-general-multi", languages: ["en", "es"] },
    artifactPlan: { recordingEnabled: false, videoRecordingEnabled: false },
    clientMessages: ["transcript", "tool-calls", "status-update"],
    serverMessages: [],
  };
}

/** What is wrong with a saved Luna, in plain words. An empty list means all good. */
export function checkLuna(saved: unknown): string[] {
  const luna = (saved ?? {}) as any;
  const problems: string[] = [];
  if (luna.artifactPlan?.recordingEnabled !== false) problems.push("Recording must be off.");
  if (luna.artifactPlan?.videoRecordingEnabled === true) problems.push("Video recording must be off.");
  if (luna.maxDurationSeconds !== MAX_CALL_SECONDS) problems.push(`Calls must stop at ${MAX_CALL_SECONDS} seconds.`);
  if (luna.server?.url) problems.push("Luna must have no server URL until #5.");
  const tools: any[] = luna.model?.tools ?? [];
  for (const name of Object.values(TOOL)) {
    const tool = tools.find((t) => t.function?.name === name);
    if (!tool || tool.async !== true || tool.server?.url) problems.push(`Tool ${name} is missing or not async.`);
  }
  if (!tools.some((t) => t.type === "endCall")) problems.push("Luna must be able to end the call.");
  const prompt: string = luna.model?.messages?.[0]?.content ?? "";
  if (!prompt.includes("{{openTime1}}") || !prompt.includes("{{openTime2}}")) problems.push("The prompt must offer {{openTime1}} and {{openTime2}}.");
  const messages: string[] = luna.clientMessages ?? [];
  for (const kind of ["transcript", "tool-calls", "status-update"]) {
    if (!messages.includes(kind)) problems.push(`The browser must get "${kind}" messages.`);
  }
  return problems;
}
