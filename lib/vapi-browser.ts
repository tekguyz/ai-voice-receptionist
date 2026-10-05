// The real browser behind the Vapi source: the microphone, our server, and
// the Vapi web SDK (loaded only when a Test Call starts).

import type { StartFailure } from "@/lib/call-source";
import type { StartResult, VapiLike, VapiSourceDeps } from "@/lib/vapi-source";

const FAILURE_BY_STATUS: Record<number, StartFailure> = { 429: "limit", 502: "connect-failed" };

export function browserVapiSourceDeps(): VapiSourceDeps {
  return {
    async requestMicrophone() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        for (const track of stream.getTracks()) track.stop();
        return true;
      } catch {
        return false;
      }
    },
    async startTestCall(): Promise<StartResult> {
      try {
        const response = await fetch("/api/test-call", { method: "POST" });
        if (!response.ok) return { ok: false, failure: FAILURE_BY_STATUS[response.status] ?? "unavailable" };
        const { webCallUrl, callId } = await response.json();
        return { ok: true, webCallUrl, callId };
      } catch {
        return { ok: false, failure: "connect-failed" };
      }
    },
    async createVapi() {
      const { default: Vapi } = await import("@vapi-ai/web");
      // The SDK wants a key, but joining a room the server made (reconnect)
      // never calls Vapi's API, so no key is given to the browser.
      return new Vapi("no-key-needed-for-reconnect") as unknown as VapiLike;
    },
    now: () => performance.now(),
  };
}
