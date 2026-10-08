// Server only: creates one Vapi web call for Luna. The browser then joins the
// call's room (the Vapi web SDK's reconnect) and never holds a key that can
// start calls or change Luna's settings.
import "server-only";

import { createHmac } from "node:crypto";

export type WebCall = { webCallUrl: string; callId: string };
export type CreateWebCall = (input: { visitorId: string; openTimes: [string, string] }) => Promise<WebCall>;

const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

/**
 * Vapi's /call/web takes only a public-scope key and refuses the private key.
 * So the server signs a short token with the private key (HS256, Vapi's
 * documented JWT path): public scope, locked to Luna, no transient assistant,
 * good for 60 seconds. It goes to Vapi only. The private key is never sent,
 * and the token is never given to the browser.
 */
export function signWebCallToken({
  privateKey,
  orgId,
  assistantId,
  nowMs,
}: {
  privateKey: string;
  orgId: string;
  assistantId: string;
  nowMs: number;
}): string {
  const iat = Math.floor(nowMs / 1000);
  const header = base64url({ alg: "HS256", typ: "JWT" });
  const payload = base64url({
    orgId,
    token: { tag: "public", restrictions: { enabled: true, allowedAssistantIds: [assistantId], allowTransientAssistant: false } },
    iat,
    exp: iat + 60,
  });
  const signature = createHmac("sha256", privateKey).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function webhookHeaders({ secret, protectionBypass }: { secret: string; protectionBypass?: string }) {
  return { "X-Vapi-Secret": secret, ...(protectionBypass ? { "x-vercel-protection-bypass": protectionBypass } : {}) };
}

export function vapiWebCallCreator({
  privateKey,
  orgId,
  assistantId,
  webhook,
  record = false,
  fetchImpl = fetch,
  now = Date.now,
}: {
  privateKey: string;
  orgId: string;
  assistantId: string;
  /**
   * Where Vapi sends this call's tool calls and end-of-call report, and the
   * secret it must send back. Set on each call, so a Preview deploy gets its
   * own notes. Left out when Vapi cannot reach this server (local development).
   * `protectionBypass`: Vercel's Protection Bypass for Automation secret, so
   * Vapi gets past Deployment Protection on a Preview.
   */
  webhook?: { url: string; secret: string; protectionBypass?: string };
  /** Record this call's sound. Only for the founder's Sample Call (lib/sample-call-recording.ts). */
  record?: boolean;
  fetchImpl?: typeof fetch;
  /** A clock in milliseconds. */
  now?: () => number;
}): CreateWebCall {
  return async ({ visitorId, openTimes: [openTime1, openTime2] }) => {
    const response = await fetchImpl("https://api.vapi.ai/call/web", {
      method: "POST",
      headers: { Authorization: `Bearer ${signWebCallToken({ privateKey, orgId, assistantId, nowMs: now() })}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        assistantId,
        assistantOverrides: {
          metadata: { visitorId },
          variableValues: { openTime1, openTime2 },
          ...(webhook ? { server: { url: webhook.url, headers: webhookHeaders(webhook) } } : {}),
          ...(record ? { artifactPlan: { recordingEnabled: true, recordingFormat: "mp3", videoRecordingEnabled: false } } : {}),
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Vapi refused the web call: ${response.status} ${await response.text()}`);
    const call = (await response.json()) as { id?: string; webCallUrl?: string; transport?: { callUrl?: string } };
    const webCallUrl = call.webCallUrl ?? call.transport?.callUrl;
    if (!call.id || !webCallUrl) throw new Error("Vapi's web call has no ID or room link.");
    // Only these two leave the server. Vapi's answer also holds a control
    // link that can steer the call, and the webhook secret went to Vapi only;
    // neither must ever reach the browser.
    return { webCallUrl, callId: call.id };
  };
}
