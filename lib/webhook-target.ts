// Where Vapi sends a Test Call's tool calls and end-of-call report. Vapi can
// only reach a public https address, so a local server gets no webhook (and
// saves no Call Notes). Vapi keeps these headers in its call record, so the
// Vercel protection bypass goes only to a Preview, never to Production.

/** process.env, or a plain object in tests. Reads VAPI_WEBHOOK_SECRET, VERCEL_ENV and VERCEL_AUTOMATION_BYPASS_SECRET. */
type Env = Readonly<Record<string, string | undefined>>;

export type WebhookTarget = { url: string; secret: string; protectionBypass?: string };

export function webhookTarget(origin: string, env: Env): WebhookTarget | undefined {
  const secret = env.VAPI_WEBHOOK_SECRET;
  if (!secret || !origin.startsWith("https://")) return undefined;
  const protectionBypass = env.VERCEL_ENV === "preview" ? env.VERCEL_AUTOMATION_BYPASS_SECRET : undefined;
  return { url: `${origin}/api/vapi/webhook`, secret, ...(protectionBypass ? { protectionBypass } : {}) };
}
