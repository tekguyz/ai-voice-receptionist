import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { tellCallStory, type CallEvent } from "@/lib/call-story";
import {
  SAMPLE_CALL_AUDIO,
  SAMPLE_CALL_EVENTS,
  SAMPLE_CALL_SUMMARY,
  createSampleCallPlayer,
  soundPlayback,
  type Playback,
} from "@/lib/sample-call";
import { SAMPLE_BUSINESS } from "@/lib/sample-business";

describe("the Sample Call", () => {
  it("tells a whole Call Story: all four details, a booked time, finished by the Receptionist", () => {
    const { view, notes } = tellCallStory(SAMPLE_CALL_EVENTS);

    expect(view.status).toBe("ended");
    expect(notes).not.toBeNull();
    expect(Object.keys(notes!.details).sort()).toEqual(["address", "job", "name", "urgency"]);
    expect(notes!.booked).toBeTruthy();
    expect(notes!.endReason).toBe("receptionist-finished");
    expect(notes!.lines.length).toBeGreaterThan(4);
    expect(notes!.lines[0].speaker).toBe("receptionist");
    expect(notes!.lines[0].text).toContain(SAMPLE_BUSINESS.name);
    expect(notes!.confirmationText).toContain(notes!.booked!);
  });

  it("keeps its events in time order and ends on the last one", () => {
    const times = SAMPLE_CALL_EVENTS.map((event) => event.atMs);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(SAMPLE_CALL_EVENTS.at(-1)?.type).toBe("ended");
  });

  it("has a summary", () => {
    expect(SAMPLE_CALL_SUMMARY.length).toBeGreaterThan(20);
  });

  it.skipIf(SAMPLE_CALL_AUDIO === null)("has its sound in public/, small enough for a phone on mobile data", () => {
    expect(SAMPLE_CALL_AUDIO).toMatch(/^\/[\w.-]+\.mp3$/);
    const file = path.join(import.meta.dirname, "../../public", SAMPLE_CALL_AUDIO!);
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeLessThan(1_000_000);
  });
});

// A playback the test moves by hand.
function fakePlayback() {
  let position = 0;
  let tick = () => {};
  let end = () => {};
  const playback = {
    paused: false,
    stopped: false,
    start(onTick: () => void, onEnd: () => void) {
      tick = onTick;
      end = onEnd;
    },
    pause() {
      playback.paused = true;
    },
    resume() {
      playback.paused = false;
    },
    stop() {
      playback.stopped = true;
    },
    positionMs: () => position,
    moveTo(ms: number) {
      position = ms;
      tick();
    },
    end: () => end(),
  };
  return playback;
}

describe("the Sample Call player", () => {
  const events: CallEvent[] = [
    { type: "line", speaker: "receptionist", text: "Hello", atMs: 0 },
    { type: "detail", field: "name", value: "Rosa", atMs: 2000 },
    { type: "ended", reason: "receptionist-finished", atMs: 5000 },
  ];

  function play() {
    const playback = fakePlayback();
    const heard: CallEvent[] = [];
    const call = createSampleCallPlayer(events, (): Playback => playback).start({ onEvent: (event) => heard.push(event), onFailed: () => {} });
    return { playback, heard, call };
  }

  it("emits each event when the playback reaches its time", () => {
    const { playback, heard } = play();
    playback.moveTo(0);
    expect(heard).toEqual([events[0]]);
    playback.moveTo(1999);
    expect(heard).toEqual([events[0]]);
    playback.moveTo(5000);
    expect(heard).toEqual(events);
    expect(playback.stopped).toBe(true);
  });

  it("emits the rest when the playback ends first", () => {
    const { playback, heard } = play();
    playback.moveTo(100);
    playback.end();
    expect(heard).toEqual(events);
  });

  it("pauses and resumes the playback, and tells where it is", () => {
    const { playback, call } = play();
    playback.moveTo(1500);
    call.pause();
    expect(playback.paused).toBe(true);
    expect(call.positionMs()).toBe(1500);
    call.resume();
    expect(playback.paused).toBe(false);
  });

  it("ends with the caller hanging up when stopped, then emits nothing more", () => {
    const { playback, heard, call } = play();
    playback.moveTo(2000);
    call.stop();
    call.stop();
    playback.moveTo(10000);
    expect(playback.stopped).toBe(true);
    expect(heard).toEqual([events[0], events[1], { type: "ended", reason: "caller-hung-up", atMs: 2000 }]);
  });

  it("does nothing when stopped after it ended", () => {
    const { playback, heard, call } = play();
    playback.moveTo(5000);
    call.stop();
    expect(heard).toEqual(events);
  });
});

// An <audio> stand-in the test drives by hand.
class FakeAudio {
  currentTime = 0;
  playing = false;
  failPlay = false;
  private listeners: Record<string, (() => void)[]> = {};
  constructor(public src: string) {}
  play() {
    if (this.failPlay) return Promise.reject(new DOMException("blocked", "NotAllowedError"));
    this.playing = true;
    return Promise.resolve();
  }
  pause() {
    this.playing = false;
  }
  removeAttribute() {}
  load() {}
  addEventListener(type: string, listener: () => void) {
    (this.listeners[type] ??= []).push(listener);
  }
  emit(type: string) {
    for (const listener of this.listeners[type] ?? []) listener();
  }
}

// A clock the test drives by hand, and the audio it made.
function fakeDeps() {
  let now = 0;
  let ticks: (() => void)[] = [];
  const audios: FakeAudio[] = [];
  return {
    audios,
    deps: {
      now: () => now,
      every(run: () => void) {
        ticks.push(run);
        return () => {
          ticks = ticks.filter((t) => t !== run);
        };
      },
      makeAudio(src: string) {
        const audio = new FakeAudio(src);
        audios.push(audio);
        return audio;
      },
    },
    advance(ms: number) {
      now += ms;
      for (const tick of [...ticks]) tick();
    },
    ticking: () => ticks.length > 0,
  };
}

describe("the Sample Call's playback", () => {
  it("with no sound, plays on a silent clock: pauses, resumes and ends at the call's length", () => {
    const clock = fakeDeps();
    const playback = soundPlayback(null, 5000, clock.deps);
    let ended = 0;
    playback.start(() => {}, () => ended++);
    clock.advance(2000);
    expect(playback.positionMs()).toBe(2000);
    playback.pause();
    clock.advance(3000);
    expect(playback.positionMs()).toBe(2000);
    playback.resume();
    clock.advance(2999);
    expect(ended).toBe(0);
    clock.advance(1);
    expect(ended).toBe(1);
    expect(clock.ticking()).toBe(false);
    expect(clock.audios).toEqual([]);
  });

  it("with sound, follows the recording's own clock and ends when it ends", () => {
    const clock = fakeDeps();
    const playback = soundPlayback("/sample-call.mp3", 5000, clock.deps);
    let ended = 0;
    playback.start(() => {}, () => ended++);
    const [audio] = clock.audios;
    expect(audio.src).toBe("/sample-call.mp3");
    expect(audio.playing).toBe(true);
    audio.currentTime = 1.25;
    clock.advance(9000);
    expect(playback.positionMs()).toBe(1250);
    expect(ended).toBe(0);
    playback.pause();
    expect(audio.playing).toBe(false);
    playback.resume();
    expect(audio.playing).toBe(true);
    audio.emit("ended");
    expect(ended).toBe(1);
  });

  it("goes on in silence, from where the sound was, when the sound fails", () => {
    const clock = fakeDeps();
    const playback = soundPlayback("/sample-call.mp3", 5000, clock.deps);
    playback.start(() => {}, () => {});
    const [audio] = clock.audios;
    audio.currentTime = 1;
    audio.emit("error");
    clock.advance(500);
    expect(playback.positionMs()).toBe(1500);
  });

  it("goes on in silence when the browser will not play the sound", async () => {
    const clock = fakeDeps();
    const audio = new FakeAudio("/sample-call.mp3");
    audio.failPlay = true;
    const playback = soundPlayback("/sample-call.mp3", 5000, { ...clock.deps, makeAudio: () => audio });
    playback.start(() => {}, () => {});
    await Promise.resolve();
    clock.advance(700);
    expect(playback.positionMs()).toBe(700);
  });

  it("stops for good: no more ticks, the sound is paused", () => {
    const clock = fakeDeps();
    const playback = soundPlayback("/sample-call.mp3", 5000, clock.deps);
    let ticks = 0;
    playback.start(() => ticks++, () => {});
    clock.advance(100);
    playback.stop();
    clock.advance(100);
    expect(ticks).toBe(1);
    expect(clock.audios[0].playing).toBe(false);
  });
});
