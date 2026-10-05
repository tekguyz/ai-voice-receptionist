// The Vapi source: a Test Call as Call Story events. It asks for the
// microphone, asks our server to start the call, joins the room the server
// made, and turns Vapi's messages into events. The Vapi web SDK and the
// browser are injected (VapiSourceDeps) so tests play Vapi's side by hand.

import type { CallHandlers, CallSource, StartFailure } from "@/lib/call-source";
import { DETAIL_FIELDS, type CallEvent, type DetailField, type EndReason } from "@/lib/call-story";
import { TOOL } from "@/lib/luna-tools";

export type VapiLike = {
  on(event: "message", listener: (message: unknown) => void): void;
  on(event: "call-end", listener: () => void): void;
  on(event: "error", listener: (error: unknown) => void): void;
  reconnect(call: { webCallUrl: string; id?: string }): Promise<void>;
  stop(): void;
};

export type StartResult = { ok: true; webCallUrl: string; callId: string } | { ok: false; failure: StartFailure };

export type VapiSourceDeps = {
  /** Asks for the microphone, then lets it go again. True when allowed. */
  requestMicrophone(): Promise<boolean>;
  /** POSTs to /api/test-call. */
  startTestCall(): Promise<StartResult>;
  createVapi(): Promise<VapiLike>;
  /** A clock in milliseconds. */
  now(): number;
};

type Message = {
  type?: string;
  transcriptType?: string;
  role?: string;
  transcript?: string;
  status?: string;
  endedReason?: string;
  toolCallList?: { function?: { name?: string; arguments?: unknown } }[];
};

function endReasonFrom(endedReason: string | undefined, sawError: boolean): EndReason {
  if (endedReason === "exceeded-max-duration") return "time-limit";
  if (endedReason === "customer-ended-call") return "caller-hung-up";
  if (endedReason?.startsWith("assistant-")) return "receptionist-finished";
  if (sawError || endedReason) return "error";
  return "receptionist-finished";
}

function argumentsOf(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

export function createVapiSource(deps: VapiSourceDeps): CallSource {
  return {
    start({ onEvent, onFailed }: CallHandlers) {
      let stopped = false;
      let vapi: VapiLike | null = null;
      let startedAt = 0;
      let ended = false;
      let endedReason: string | undefined;
      let sawError = false;

      const at = () => Math.max(0, deps.now() - startedAt);
      const end = (reason: EndReason) => {
        if (ended) return;
        ended = true;
        onEvent({ type: "ended", reason, atMs: at() });
      };

      const onMessage = (raw: unknown) => {
        const message = (raw ?? {}) as Message;
        const type = message.type ?? "";
        if (type.startsWith("transcript")) {
          const final = message.transcriptType === "final" || type.includes('"final"');
          const text = message.transcript?.trim();
          if (final && text) {
            onEvent({ type: "line", speaker: message.role === "user" ? "caller" : "receptionist", text, atMs: at() });
          }
        } else if (type === "tool-calls") {
          for (const call of message.toolCallList ?? []) {
            const args = argumentsOf(call.function?.arguments);
            const event = toEvent(call.function?.name, args, at());
            if (event) onEvent(event);
          }
        } else if (type === "status-update" && message.status === "ended") {
          endedReason = message.endedReason;
        }
      };

      (async () => {
        if (!(await deps.requestMicrophone())) return stopped || onFailed("microphone-blocked");
        if (stopped) return;
        const result = await deps.startTestCall();
        if (stopped) return;
        if (!result.ok) return onFailed(result.failure);
        try {
          vapi = await deps.createVapi();
          if (stopped) return;
          vapi.on("message", onMessage);
          vapi.on("error", () => {
            sawError = true;
          });
          vapi.on("call-end", () => end(endReasonFrom(endedReason, sawError)));
          await vapi.reconnect({ webCallUrl: result.webCallUrl, id: result.callId });
          startedAt = deps.now();
        } catch {
          vapi = null;
          if (!stopped) onFailed("connect-failed");
        }
      })();

      return {
        stop() {
          if (stopped) return;
          stopped = true;
          if (vapi) {
            vapi.stop();
            end("caller-hung-up");
          }
        },
      };
    },
  };
}

function toEvent(name: string | undefined, args: Record<string, unknown>, atMs: number): CallEvent | null {
  if (name === TOOL.recordDetail) {
    const field = args.field as DetailField;
    const value = typeof args.value === "string" ? args.value.trim() : "";
    return DETAIL_FIELDS.includes(field) && value ? { type: "detail", field, value, atMs } : null;
  }
  if (name === TOOL.bookTime) {
    const time = typeof args.time === "string" ? args.time.trim() : "";
    return time ? { type: "booked", time, atMs } : null;
  }
  return null;
}
