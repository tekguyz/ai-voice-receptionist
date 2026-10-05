// Server only: creates one Vapi web call for Luna with the private key. The
// browser then joins the call's room (the Vapi web SDK's reconnect) and never
// holds a key that can start calls or change Luna's settings.

export type WebCall = { webCallUrl: string; callId: string };
export type CreateWebCall = (input: { visitorId: string; openTimes: [string, string] }) => Promise<WebCall>;

export function vapiWebCallCreator({
  privateKey,
  assistantId,
  fetchImpl = fetch,
}: {
  privateKey: string;
  assistantId: string;
  fetchImpl?: typeof fetch;
}): CreateWebCall {
  return async ({ visitorId, openTimes: [openTime1, openTime2] }) => {
    const response = await fetchImpl("https://api.vapi.ai/call/web", {
      method: "POST",
      headers: { Authorization: `Bearer ${privateKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        assistantId,
        assistantOverrides: { metadata: { visitorId }, variableValues: { openTime1, openTime2 } },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Vapi refused the web call: ${response.status} ${await response.text()}`);
    const call = (await response.json()) as { id?: string; webCallUrl?: string; transport?: { callUrl?: string } };
    const webCallUrl = call.webCallUrl ?? call.transport?.callUrl;
    if (!call.id || !webCallUrl) throw new Error("Vapi's web call has no ID or room link.");
    // Only these two leave the server. Vapi's answer also holds a control
    // link that can steer the call; it must never reach the browser.
    return { webCallUrl, callId: call.id };
  };
}
