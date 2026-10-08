// Makes the founder's recorded Test Call the Sample Call (issue #8, ADR 0004).
//
//   npm run sample-call:pull                         the newest recorded call
//   npm run sample-call:pull -- <callId>             that call
//   npm run sample-call:pull -- <callId> --offset-ms 300
//                                                    shifts the words and tags 300 ms later in the sound
//   npm run sample-call:pull -- --delete <callId>    deletes that call, and its recording, from Vapi
//
// Pull writes public/sample-call.mp3 (mono, 40 kbps: about 300 KB a minute)
// and lib/sample-call.json. It never deletes. Delete only after the new Sample
// Call is checked and committed. Needs ffmpeg. Reads VAPI_PRIVATE_KEY and
// VAPI_ASSISTANT_ID from .env.local. Never prints a key.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { RECORDING_OPEN_TIMES } from "../lib/sample-call-recording.ts";
import { firstSoundMs, hasRecording, sampleCallFile } from "./sample-call-file.ts";

const API = "https://api.vapi.ai";
const ROOT = path.resolve(import.meta.dirname, "..");
const AUDIO = "/sample-call.mp3";
const AUDIO_FILE = path.join(ROOT, "public", AUDIO);
const JSON_FILE = path.join(ROOT, "lib", "sample-call.json");

const key = process.env.VAPI_PRIVATE_KEY;

async function vapi(urlPath: string, method = "GET") {
  const response = await fetch(`${API}${urlPath}`, { method, headers: { Authorization: `Bearer ${key}` } });
  const text = await response.text();
  if (!response.ok) throw new Error(`Vapi ${method} ${urlPath} answered ${response.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

// No process.exit() after a fetch: on Windows it can crash Node while the connection closes.
process.exitCode = await main();

async function main(): Promise<number> {
  if (!key) {
    console.error("VAPI_PRIVATE_KEY is missing. Add it to .env.local.");
    return 1;
  }
  const args = process.argv.slice(2);
  const flag = (name: string) => {
    const at = args.indexOf(name);
    return at === -1 ? undefined : args.splice(at, 2)[1];
  };

  const toDelete = flag("--delete");
  if (toDelete) {
    const saved = JSON.parse(readFileSync(JSON_FILE, "utf8"));
    if (!saved.audio || !existsSync(AUDIO_FILE)) {
      console.error("The Sample Call has no saved sound yet. Pull it first; delete after.");
      return 1;
    }
    await vapi(`/call/${encodeURIComponent(toDelete)}`, "DELETE");
    console.log(`Deleted call ${toDelete} from Vapi, with its recording.`);
    return 0;
  }

  const offsetMs = Number(flag("--offset-ms") ?? 0);
  let callId = args[0];
  if (!callId) {
    const assistantId = process.env.VAPI_ASSISTANT_ID;
    if (!assistantId) throw new Error("VAPI_ASSISTANT_ID is missing. Add it to .env.local, or pass the call ID.");
    const calls: any[] = await vapi(`/call?assistantId=${encodeURIComponent(assistantId)}&limit=50`);
    const recorded = calls.filter((c) => c.status === "ended" && hasRecording(c)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    if (recorded.length === 0) {
      console.error("No recorded call found. Make the Test Call with SAMPLE_CALL_RECORDING=on first (README, \"Record the Sample Call\").");
      return 1;
    }
    callId = recorded[0].id;
    console.log(`Newest recorded call: ${callId} (${recorded[0].createdAt}).`);
  }

  const call = await vapi(`/call/${encodeURIComponent(callId)}`);
  if (!hasRecording(call)) throw new Error(`Call ${callId} has no recording.`);
  const values = call.assistantOverrides?.variableValues ?? {};
  if (values.openTime1 !== RECORDING_OPEN_TIMES[0] || values.openTime2 !== RECORDING_OPEN_TIMES[1]) {
    console.warn(`Warning: this call offered "${values.openTime1}" and "${values.openTime2}", not "tomorrow". Was the recording switch on?`);
  }

  // The recording: Vapi answers with a redirect to a short-lived signed link.
  const work = mkdtempSync(path.join(tmpdir(), "sample-call-"));
  try {
    const response = await fetch(`${API}/call/${encodeURIComponent(callId)}/mono-recording`, { headers: { Authorization: `Bearer ${key}` } });
    if (!response.ok) throw new Error(`Vapi did not send the recording: ${response.status}`);
    const raw = path.join(work, "recording");
    writeFileSync(raw, Buffer.from(await response.arrayBuffer()));

    // Mono, 40 kbps, 22 kHz: clear speech, small enough for a phone on mobile data.
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-ac", "1", "-ar", "22050", "-c:a", "libmp3lame", "-b:a", "40k", AUDIO_FILE]);
    const seconds = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", AUDIO_FILE]).toString().trim());
    const silence = spawnSync("ffmpeg", ["-i", AUDIO_FILE, "-af", "silencedetect=noise=-40dB:d=0.3", "-f", "null", "-"], { encoding: "utf8" }).stderr;

    const file = sampleCallFile(call, { audio: AUDIO, audioOffsetMs: offsetMs, recordedOn: String(call.createdAt ?? "").slice(0, 10) });
    writeFileSync(JSON_FILE, `${JSON.stringify(file, null, 2)}\n`);

    const firstLine = file.artifact.messages.find((m: any) => m.role !== "tool_calls") as { secondsFromStart?: number } | undefined;
    console.log(`Saved ${path.relative(ROOT, AUDIO_FILE)}: ${Math.round(statSync(AUDIO_FILE).size / 1024)} KB, ${seconds.toFixed(1)} s.`);
    console.log(`Saved ${path.relative(ROOT, JSON_FILE)}: ${file.artifact.messages.length} messages, ended "${file.endedReason}".`);
    console.log(
      `Timing check: the sound starts at ${firstSoundMs(silence)} ms; Vapi puts the first line at ${Math.round((firstLine?.secondsFromStart ?? 0) * 1000)} ms. ` +
        "If they are far apart, pull again with --offset-ms <the difference>.",
    );
    console.log("Next: npx vitest run lib/__tests__/sample-call.test.ts, then play it on /demo. Delete from Vapi only after that.");
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  return 0;
}
