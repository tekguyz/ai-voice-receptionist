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
  stop(): void | Promise<void>;
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
  // A Visitor who only listens is not a failed call.
  if (endedReason === "customer-ended-call" || endedReason === "silence-timed-out") return "caller-hung-up";
  if (endedReason?.startsWith("assistant-")) return "receptionist-finished";
  if (sawError || endedReason) return "error";
  return "receptionist-finished";
}

// The SDK emits 'error' for audio-processing (Krisp) and optional-feature
// setup problems while the call carries on. Every other error, Daily call
// errors included, is fatal.
const NON_FATAL_ERROR_TYPES = new Set([
  "audio-processing-setup-error",
  "audio-processor-recovery-error",
  "audio-observer-setup-error",
  "video-recording-setup-error",
]);

function isFatalError(error: unknown): boolean {
  const type = (error as { type?: unknown } | null)?.type;
  return !(typeof type === "string" && NON_FATAL_ERROR_TYPES.has(type));
}

function argumentsOf(raw: unknown): Record<string, unknown> {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function createVapiSource(deps: VapiSourceDeps): CallSource {
  return {
    start({ onEvent, onFailed }: CallHandlers) {
      let stopped = false;
      let vapi: VapiLike | null = null;
      let startedAt = 0;
      // True at the first message from the room or when the join resolves,
      // whichever comes first (the SDK can deliver Luna's greeting before
      // `reconnect` resolves). Until then no `ended` is ever emitted.
      let started = false;
      let ended = false;
      let endedReason: string | undefined;
      let sawError = false;

      const markStarted = () => {
        // A call stopped before it started never starts: it has no end to report.
        if (started || stopped) return;
        started = true;
        startedAt = deps.now();
      };
      const at = () => (started ? Math.max(0, deps.now() - startedAt) : 0);
      const end = (reason: EndReason) => {
        if (ended) return;
        ended = true;
        onEvent({ type: "ended", reason, atMs: at() });
      };

      const onMessage = (raw: unknown) => {
        markStarted();
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
          vapi.on("error", (error) => {
            if (isFatalError(error)) sawError = true;
          });
          vapi.on("call-end", () => {
            if (started) end(endReasonFrom(endedReason, sawError));
          });
          await vapi.reconnect({ webCallUrl: result.webCallUrl, id: result.callId });
          if (stopped) return;
          markStarted();
        } catch {
          if (stopped) return;
          // A call a message already started has to end; one that never started failed.
          if (started) end("error");
          else {
            vapi = null;
            // The server already started the call; only the join failed.
            onFailed("join-failed");
          }
        }
      })();

      return {
        stop() {
          if (stopped) return;
          stopped = true;
          if (!vapi) return;
          // Only a call that started has an end to report. Say it first, so a
          // throw from the SDK's stop() cannot skip it.
          if (started) end("caller-hung-up");
          try {
            Promise.resolve(vapi.stop()).catch(() => {});
          } catch {
            // The call is over for the caller either way.
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
