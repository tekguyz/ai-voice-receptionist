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
    about: `A real call to Luna by an AI actor that plays the caller, ${recordedOn}. Pulled by \`npm run sample-call:pull\` (issue #8). Every caller detail is made up.`,
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

/** Where speech starts on one side of the recording, in seconds, from ffmpeg's `silencedetect` output for that channel. */
export function speechStarts(silencedetectLog: string): number[] {
  const firstSilence = silencedetectLog.match(/silence_start: ([\d.]+)/);
  const starts = [...silencedetectLog.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  return !firstSilence || Number(firstSilence[1]) > 0.05 ? [0, ...starts] : starts;
}

/**
 * Vapi logs some lines with no length (`duration: 0`) and a time seconds too
 * late, after the line was spoken. Each such line moves to the first speech
 * start on its own side of the recording after that side's last line ended
 * and after the last line Vapi did time; never later than Vapi logged it.
 * `starts` are in the recording's clock, which runs `offsetMs` ahead of the
 * call's (the same offset as `--offset-ms`). Lines stay in time order.
 */
export function alignUntimedLines(call: unknown, starts: { user: number[]; bot: number[] }, offsetMs: number): unknown {
  const c = record(call);
  const artifact = record(c.artifact);
  const messages = (Array.isArray(artifact.messages) ? artifact.messages : []).map((m: unknown) => ({ ...record(m) }));
  const sideOf = (role: unknown) => (role === "user" ? "user" : role === "bot" || role === "assistant" ? "bot" : null);
  const lastEnd = { user: -Infinity, bot: -Infinity };
  let lastTimedStart = -Infinity;
  for (const m of messages) {
    const side = sideOf(m.role);
    if (!side || typeof m.secondsFromStart !== "number") continue;
    if (m.duration === 0) {
      const after = Math.max(lastEnd[side], lastTimedStart);
      const start = starts[side].map((s) => s - offsetMs / 1000).find((s) => s > after);
      if (start !== undefined && start < m.secondsFromStart) m.secondsFromStart = Math.round(start * 1000) / 1000;
    } else if (typeof m.duration === "number") {
      lastTimedStart = m.secondsFromStart;
    }
    lastEnd[side] = m.secondsFromStart + (typeof m.duration === "number" ? m.duration / 1000 : 0);
  }
  const at = (m: Record<string, any>) => (typeof m.secondsFromStart === "number" ? m.secondsFromStart : 0);
  const ordered = messages.map((m, i) => ({ m, i })).sort((a, b) => at(a.m) - at(b.m) || a.i - b.i).map(({ m }) => m);
  return { ...c, artifact: { ...artifact, messages: ordered } };
}
