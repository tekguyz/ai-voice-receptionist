import { describe, expect, it } from "vitest";
import { tellCallStory, type CallEvent } from "@/lib/call-story";
import { SAMPLE_BUSINESS } from "@/lib/sample-business";

describe("Call Story", () => {
  it("captures every detail even when they arrive out of order", () => {
    const events: CallEvent[] = [
      { type: "detail", field: "address", value: "12 Palm Way, Hialeah", atMs: 4000 },
      { type: "detail", field: "urgency", value: "Today", atMs: 5000 },
      { type: "detail", field: "name", value: "Rosa Diaz", atMs: 6000 },
      { type: "detail", field: "job", value: "AC blowing warm air", atMs: 7000 },
    ];

    const { view } = tellCallStory(events);

    expect(view.details).toEqual({
      name: "Rosa Diaz",
      job: "AC blowing warm air",
      urgency: "Today",
      address: "12 Palm Way, Hialeah",
    });
    expect(view.status).toBe("live");
    expect(view.elapsedMs).toBe(7000);
  });

  it("lets a corrected detail replace the earlier one", () => {
    const events: CallEvent[] = [
      { type: "detail", field: "address", value: "12 Palm Way", atMs: 3000 },
      { type: "line", speaker: "caller", text: "Sorry, it's 21 Palm Way.", atMs: 4000 },
      { type: "detail", field: "address", value: "21 Palm Way", atMs: 4500 },
    ];

    const { view } = tellCallStory(events);

    expect(view.details).toEqual({ address: "21 Palm Way" });
  });

  it("writes Call Notes for a booking with no details", () => {
    const events: CallEvent[] = [
      { type: "booked", time: "Tuesday 9:00 AM", atMs: 8000 },
      { type: "ended", reason: "receptionist-finished", atMs: 9000 },
    ];

    const { view, notes } = tellCallStory(events);

    expect(view.status).toBe("ended");
    expect(view.booked).toBe("Tuesday 9:00 AM");
    expect(notes).not.toBeNull();
    expect(notes?.details).toEqual({});
    expect(notes?.booked).toBe("Tuesday 9:00 AM");
    expect(notes?.endReason).toBe("receptionist-finished");
    expect(notes?.durationMs).toBe(9000);
    expect(notes?.summary).toBe("No details were captured. Booked for Tuesday 9:00 AM.");
    expect(notes?.confirmationText).toBe(
      `Hi, this is ${SAMPLE_BUSINESS.name}. You're booked for Tuesday 9:00 AM. Reply here if anything changes.`,
    );
  });

  it("has no Call Notes while the call is still live", () => {
    const { notes } = tellCallStory([
      { type: "line", speaker: "receptionist", text: "Hello?", atMs: 0 },
    ]);

    expect(notes).toBeNull();
  });

  it("writes Call Notes from what it had when the time limit ends the call", () => {
    const events: CallEvent[] = [
      { type: "line", speaker: "receptionist", text: "What's the problem with the AC?", atMs: 1000 },
      { type: "line", speaker: "caller", text: "It's leaking water everywhere.", atMs: 4000 },
      { type: "detail", field: "job", value: "AC leaking water", atMs: 4200 },
      { type: "detail", field: "name", value: "Tom Reyes", atMs: 9000 },
      { type: "ended", reason: "time-limit", atMs: 180000 },
    ];

    const { view, notes } = tellCallStory(events);

    expect(view.status).toBe("ended");
    expect(view.endReason).toBe("time-limit");
    expect(notes?.endReason).toBe("time-limit");
    expect(notes?.durationMs).toBe(180000);
    expect(notes?.booked).toBeNull();
    expect(notes?.summary).toBe("Tom Reyes called about AC leaking water. No time was booked.");
    expect(notes?.confirmationText).toBe(
      `Hi Tom, this is ${SAMPLE_BUSINESS.name}. We got your call and will call you back soon. Reply here if anything changes.`,
    );
  });

  it("shows an empty call as waiting, with nothing captured", () => {
    const { view, notes } = tellCallStory([]);

    expect(view).toEqual({
      status: "waiting",
      lines: [],
      details: {},
      booked: null,
      endReason: null,
      elapsedMs: 0,
    });
    expect(notes).toBeNull();
  });

  it("writes plain Call Notes for a call that ends before anything is said", () => {
    const { notes } = tellCallStory([{ type: "ended", reason: "caller-hung-up", atMs: 1500 }]);

    expect(notes?.lines).toEqual([]);
    expect(notes?.details).toEqual({});
    expect(notes?.summary).toBe("No details were captured. No time was booked.");
  });

  it("passes a Spanish transcript through unchanged", () => {
    const events: CallEvent[] = [
      { type: "line", speaker: "receptionist", text: "¡Hola! ¿En qué le puedo ayudar?", atMs: 0 },
      { type: "line", speaker: "caller", text: "Mi aire acondicionado no enfría y hace mucho calor.", atMs: 3000 },
      { type: "detail", field: "job", value: "El aire no enfría", atMs: 3500 },
      { type: "line", speaker: "receptionist", text: "Lo siento mucho. ¿Cuál es su dirección?", atMs: 5000 },
      { type: "ended", reason: "receptionist-finished", atMs: 9000 },
    ];

    const { view, notes } = tellCallStory(events);

    const expected = [
      { speaker: "receptionist", text: "¡Hola! ¿En qué le puedo ayudar?", atMs: 0 },
      { speaker: "caller", text: "Mi aire acondicionado no enfría y hace mucho calor.", atMs: 3000 },
      { speaker: "receptionist", text: "Lo siento mucho. ¿Cuál es su dirección?", atMs: 5000 },
    ];
    expect(view.lines).toEqual(expected);
    expect(notes?.lines).toEqual(expected);
    expect(notes?.details.job).toBe("El aire no enfría");
  });

  it("uses a summary passed in instead of building one", () => {
    const { notes } = tellCallStory(
      [
        { type: "detail", field: "name", value: "Ana Cruz", atMs: 1000 },
        { type: "ended", reason: "receptionist-finished", atMs: 2000 },
      ],
      { summary: "Ana wants a tune-up next week." },
    );

    expect(notes?.summary).toBe("Ana wants a tune-up next week.");
  });
});

describe("after the call ends", () => {
  it("keeps a late final line, but the duration and reason come from the first end", () => {
    const { view, notes } = tellCallStory([
      { type: "line", speaker: "receptionist", text: "Hello", atMs: 0 },
      { type: "ended", reason: "caller-hung-up", atMs: 4000 },
      { type: "line", speaker: "caller", text: "Bye", atMs: 4600 },
      { type: "ended", reason: "error", atMs: 5000 },
    ]);
    expect(view.lines.map((l) => l.text)).toEqual(["Hello", "Bye"]);
    expect(notes!.endReason).toBe("caller-hung-up");
    expect(notes!.durationMs).toBe(4000);
  });
});

describe("a corrected detail", () => {
  it("takes the value that arrived last, whatever its time stamp", () => {
    const { view } = tellCallStory([
      { type: "detail", field: "name", value: "Rosa", atMs: 6000 },
      { type: "detail", field: "name", value: "Rose", atMs: 5000 },
    ]);
    expect(view.details.name).toBe("Rose");
  });
});
