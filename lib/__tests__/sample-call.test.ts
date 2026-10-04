import { describe, expect, it } from "vitest";
import { tellCallStory, type CallEvent } from "@/lib/call-story";
import { SAMPLE_CALL_EVENTS, createSampleCallPlayer } from "@/lib/sample-call";
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
});

// A scheduler the test drives by hand: nothing runs until time moves on.
function fakeScheduler() {
  let now = 0;
  let tasks: { at: number; run: () => void; cancelled: boolean }[] = [];
  return {
    schedule(run: () => void, delayMs: number) {
      const task = { at: now + delayMs, run, cancelled: false };
      tasks.push(task);
      return () => {
        task.cancelled = true;
      };
    },
    advanceTo(ms: number) {
      now = ms;
      const due = tasks.filter((t) => t.at <= ms).sort((a, b) => a.at - b.at);
      tasks = tasks.filter((t) => t.at > ms);
      for (const task of due) if (!task.cancelled) task.run();
    },
  };
}

describe("the Sample Call player", () => {
  const events: CallEvent[] = [
    { type: "line", speaker: "receptionist", text: "Hello", atMs: 0 },
    { type: "detail", field: "name", value: "Rosa", atMs: 2000 },
    { type: "ended", reason: "receptionist-finished", atMs: 5000 },
  ];

  it("emits each event when playback reaches its time", () => {
    const clock = fakeScheduler();
    const heard: CallEvent[] = [];
    createSampleCallPlayer(events, clock.schedule).start((event) => heard.push(event));

    clock.advanceTo(0);
    expect(heard).toEqual([events[0]]);
    clock.advanceTo(1999);
    expect(heard).toEqual([events[0]]);
    clock.advanceTo(5000);
    expect(heard).toEqual(events);
  });

  it("emits nothing more once stopped", () => {
    const clock = fakeScheduler();
    const heard: CallEvent[] = [];
    const call = createSampleCallPlayer(events, clock.schedule).start((event) => heard.push(event));

    clock.advanceTo(2000);
    call.stop();
    clock.advanceTo(10000);
    expect(heard).toEqual([events[0], events[1]]);
  });
});
