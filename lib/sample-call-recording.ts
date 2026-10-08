// The one way this app ever records a call: the founder's Sample Call
// (ADR 0004). Off unless SAMPLE_CALL_RECORDING=on in .env.local, and only on
// the laptop's dev server, never on any Vercel deploy, so no Visitor's call
// can be recorded. Vapi cannot reach the laptop, so the call's tool calls go
// to a deployed webhook (SAMPLE_CALL_WEBHOOK_ORIGIN) and the booking works.

/** process.env, or a plain object in tests. */
type Env = Readonly<Record<string, string | undefined>>;

/** "Tomorrow" never goes stale in a call that plays for months. */
export const RECORDING_OPEN_TIMES: [string, string] = ["tomorrow at 9 AM", "tomorrow at 2 PM"];

export type SampleCallRecording = { webhookOrigin: string };

export function sampleCallRecording(env: Env): SampleCallRecording | null {
  if (env.SAMPLE_CALL_RECORDING !== "on") return null;
  if (env.VERCEL_ENV || env.NODE_ENV !== "development") return null;
  const origin = env.SAMPLE_CALL_WEBHOOK_ORIGIN?.trim() ?? "";
  if (!origin.startsWith("https://")) return null;
  return { webhookOrigin: origin.replace(/\/+$/, "") };
}
