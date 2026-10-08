// The pure half of `npm run sample-call:pull`: turns the call Vapi sends back
// (GET /call/{id}) into lib/sample-call.json. Plain relative imports only, so
// Node can run it without the app's "@/" paths.

export type SampleCallFile = {
  about: string;
  audio: string | null;
  audioOffsetMs: number;
  endedReason: string;
  durationSeconds: number;
  analysis: { summary: string };
  call: { assistantOverrides: { variableValues: { openTime1: string; openTime2: string } } };
  artifact: { messages: unknown[] };
};

const record = (value: unknown): Record<string, any> => (value && typeof value === "object" ? (value as Record<string, any>) : {});

/** Keeps only what the Sample Call plays: the spoken lines and Luna's tool calls. No system prompt, no IDs, no Visitor. */
function keptMessages(messages: unknown): unknown[] {
  const kept: unknown[] = [];
  for (const raw of Array.isArray(messages) ? messages : []) {
    const item = record(raw);
    const at = { secondsFromStart: item.secondsFromStart };
    if (["user", "bot", "assistant"].includes(item.role) && typeof item.message === "string") {
      kept.push({ role: item.role, message: item.message, ...at });
    } else if (item.role === "tool_calls") {
      const toolCalls = (Array.isArray(item.toolCalls) ? item.toolCalls : []).map((call: unknown) => {
        const fn = record(record(call).function);
        return { function: { name: fn.name, arguments: fn.arguments } };
      });
      kept.push({ role: "tool_calls", toolCalls, ...at });
    }
  }
  return kept;
}

/** The call's length in seconds, from its start and end times. */
export function callSeconds(call: unknown): number {
  const { startedAt, endedAt } = record(call);
  const ms = Date.parse(endedAt) - Date.parse(startedAt);
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 100) / 10 : 0;
}

export function sampleCallFile(call: unknown, { audio, audioOffsetMs, recordedOn }: { audio: string; audioOffsetMs: number; recordedOn: string }): SampleCallFile {
  const c = record(call);
  const values = record(record(c.assistantOverrides).variableValues);
  return {
    about: `The founder's recorded Test Call, ${recordedOn}. Pulled by \`npm run sample-call:pull\` (issue #8). Every caller detail is made up.`,
    audio,
    audioOffsetMs,
    endedReason: typeof c.endedReason === "string" ? c.endedReason : "",
    durationSeconds: callSeconds(call),
    analysis: { summary: typeof record(c.analysis).summary === "string" ? c.analysis.summary.trim() : "" },
    call: { assistantOverrides: { variableValues: { openTime1: String(values.openTime1 ?? ""), openTime2: String(values.openTime2 ?? "") } } },
    artifact: { messages: keptMessages(record(c.artifact).messages ?? c.messages) },
  };
}

/** Where sound first starts, in ms, from ffmpeg's `silencedetect` output. 0 when the sound starts at once. */
export function firstSoundMs(silencedetectLog: string): number {
  const start = silencedetectLog.match(/silence_start: ([\d.]+)/);
  if (!start || Number(start[1]) > 0.05) return 0;
  const end = silencedetectLog.match(/silence_end: ([\d.]+)/);
  return end ? Math.round(Number(end[1]) * 1000) : 0;
}

/** True when Vapi kept a recording of the call. An unrecorded call still has `recording: { mono: {} }`. */
export function hasRecording(call: unknown): boolean {
  const artifact = record(record(call).artifact);
  return Boolean(record(record(artifact.recording).mono).combinedUrl || artifact.recordingUrl || record(call).recordingUrl);
}
