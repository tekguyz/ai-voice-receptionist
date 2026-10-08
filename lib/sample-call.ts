// The Sample Call: one Test Call the founder recorded on purpose (ADR 0004),
// and the player that emits its Call Story events in step with its sound.
//
// lib/sample-call.json keeps the shape of the call's Vapi report, so the same
// code that reads a Test Call's report reads it. `npm run sample-call:pull`
// writes it and the sound (public/). Until then it is a text-only placeholder
// with no sound, played on a silent clock. Every caller detail is made up.

import type { CallHandlers, RunningCall } from "@/lib/call-source";
import { callEventsFromReport, summaryOfReport } from "@/lib/call-notes-from-report";
import type { CallEvent } from "@/lib/call-story";
import recorded from "@/lib/sample-call.json";

/** How much later each event comes in the sound than Vapi's clock says. */
const offsetMs: number = recorded.audioOffsetMs;

export const SAMPLE_CALL_EVENTS: readonly CallEvent[] = callEventsFromReport(recorded).map((event) => ({
  ...event,
  atMs: Math.max(0, event.atMs + offsetMs),
}));

/** Vapi's summary of the call, shown on its Call Notes like the Dashboard's sample calls. */
export const SAMPLE_CALL_SUMMARY: string = summaryOfReport(recorded) ?? "";

/** The sound's address in public/, or null while the Sample Call has none. */
export const SAMPLE_CALL_AUDIO: string | null = recorded.audio;

/** What the player plays against: the recording, or a silent clock. */
export type Playback = {
  /** Starts from the beginning. `onTick` runs often while it plays; `onEnd` once, at the end. */
  start(onTick: () => void, onEnd: () => void): void;
  pause(): void;
  resume(): void;
  /** Stops for good. */
  stop(): void;
  /** How far it has played, in milliseconds. */
  positionMs(): number;
};

export type RunningSampleCall = RunningCall & { pause(): void; resume(): void; positionMs(): number };
export type SampleCallSource = { start(handlers: CallHandlers): RunningSampleCall };

/** Plays a timed event list: each event is emitted when the playback reaches its time. */
export function createSampleCallPlayer(
  events: readonly CallEvent[] = SAMPLE_CALL_EVENTS,
  makePlayback: () => Playback = () => soundPlayback(SAMPLE_CALL_AUDIO, events.at(-1)?.atMs ?? 0),
): SampleCallSource {
  return {
    start({ onEvent }) {
      const playback = makePlayback();
      let next = 0;
      let lastAtMs = 0;
      let ended = false;
      const emit = (event: CallEvent) => {
        if (ended) return;
        lastAtMs = event.atMs;
        if (event.type === "ended") ended = true;
        onEvent(event);
      };
      const catchUp = (toMs: number) => {
        while (!ended && next < events.length && events[next].atMs <= toMs) emit(events[next++]);
        if (ended) playback.stop();
      };
      playback.start(
        () => catchUp(playback.positionMs()),
        () => catchUp(Infinity),
      );
      return {
        stop() {
          playback.stop();
          emit({ type: "ended", reason: "caller-hung-up", atMs: lastAtMs });
        },
        pause: () => playback.pause(),
        resume: () => playback.resume(),
        positionMs: () => playback.positionMs(),
      };
    },
  };
}

/** The parts of an <audio> element the playback uses. */
export type AudioLike = Pick<HTMLAudioElement, "currentTime" | "play" | "pause" | "removeAttribute" | "load"> & {
  addEventListener(type: "ended" | "error", listener: () => void): void;
};

export type PlaybackDeps = {
  now(): number;
  /** Runs `run` every `ms` and returns a way to stop it. */
  every(run: () => void, ms: number): () => void;
  makeAudio(src: string): AudioLike;
};

const browserDeps: PlaybackDeps = {
  now: () => performance.now(),
  every(run, ms) {
    const id = setInterval(run, ms);
    return () => clearInterval(id);
  },
  makeAudio: (src) => new Audio(src),
};

/**
 * Plays the sound and follows its own clock, so the words and tags stay in
 * step even when it buffers. With no sound, or when the sound fails, it goes
 * on in silence on a clock from where it was, so the call still plays out.
 * The sound is fetched only when the Visitor presses play.
 */
export function soundPlayback(src: string | null, durationMs: number, deps: PlaybackDeps = browserDeps): Playback {
  let audio: AudioLike | null = null;
  // The silent clock: its position when it last started, and when that was (null while paused).
  let clockFromMs = 0;
  let clockStartedAt: number | null = null;
  let paused = false;
  let done = false;
  let stopTicks = () => {};
  let ending = () => {};

  const clockMs = () => (clockStartedAt === null ? clockFromMs : clockFromMs + deps.now() - clockStartedAt);
  const position = () => (audio ? audio.currentTime * 1000 : Math.min(clockMs(), durationMs));

  const finish = () => {
    if (done) return;
    stop();
    ending();
  };
  const fallBack = () => {
    if (done || !audio) return;
    clockFromMs = audio.currentTime * 1000;
    clockStartedAt = paused ? null : deps.now();
    release();
  };
  // A pause before play() starts rejects it with AbortError: that is not a failure.
  const playAudio = (sound: AudioLike) =>
    sound.play().catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) fallBack();
    });
  // Lets go of the sound, so the browser stops fetching it.
  const release = () => {
    if (!audio) return;
    const sound = audio;
    audio = null;
    sound.pause();
    sound.removeAttribute("src");
    sound.load();
  };
  function stop() {
    if (done) return;
    done = true;
    stopTicks();
    release();
  }

  return {
    start(onTick, onEnd) {
      ending = onEnd;
      if (src) {
        const sound = deps.makeAudio(src);
        audio = sound;
        sound.addEventListener("ended", finish);
        sound.addEventListener("error", fallBack);
        void playAudio(sound);
      } else {
        clockStartedAt = deps.now();
      }
      stopTicks = deps.every(() => {
        if (done) return;
        onTick();
        if (!audio && clockMs() >= durationMs) finish();
      }, 100);
    },
    pause() {
      if (done || paused) return;
      paused = true;
      if (audio) audio.pause();
      clockFromMs = clockMs();
      clockStartedAt = null;
    },
    resume() {
      if (done || !paused) return;
      paused = false;
      if (audio) void playAudio(audio);
      else clockStartedAt = deps.now();
    },
    stop,
    positionMs: position,
  };
}
