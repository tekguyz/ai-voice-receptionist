import { describe, expect, it } from "vitest";
import { formatLunaReport, lunaFailures, lunaReport, narrationIn } from "../luna-check";
import { goodMessages, lunaCall } from "./luna-call-fixture";

const withoutConfirmation = () => goodMessages().filter((m) => !String(m.message ?? "").startsWith("You're all set"));

describe("luna:report", () => {
  it("passes a good call: four details, a booking, the confirmation, quick turns", () => {
    const report = lunaReport(lunaCall());
    expect(report.details).toEqual({ name: "Marco Delgado", job: "AC not cooling", urgency: "Urgent, elderly mother at home", address: "4450 NE 18th Ave, Miami, FL 33137" });
    expect(report.booked).toBe("tomorrow at 9 AM");
    expect(report.confirmed).toBe(true);
    expect(report.confirmation).toBe("You're all set for tomorrow at nine in the morning at forty-four fifty Northeast Eighteenth Avenue, Miami, three three one three seven.");
    expect(report.narration).toEqual([]);
    expect(report.averageTurnMs).toBe(1620);
    expect(report.slowestTurnMs).toBe(1900);
    expect(report.seconds).toBe(40.5);
    expect(report.cost).toBe(0.21);
    expect(lunaFailures(report)).toEqual([]);
    expect(formatLunaReport(report)).toMatch(/PASS$/);
  });

  it("fails a call where Luna books and hangs up with only a goodbye (finding 1)", () => {
    const report = lunaReport(lunaCall({ messages: withoutConfirmation() }));
    expect(report.confirmed).toBe(false);
    expect(lunaFailures(report)).toContain("She did not speak the confirmation before the call ended.");
  });

  it("an offer of the times before booking is not a confirmation", () => {
    // The offer names "nine in the morning" too, but it comes before the booking.
    expect(lunaReport(lunaCall({ messages: withoutConfirmation() })).confirmation).toBeNull();
  });

  it("fails a confirmation said before the booking ran (#25 item 6)", () => {
    // Same reply as bookTime: she says it, then the tool runs.
    const messages = goodMessages().map((m) => (String(m.message ?? "").startsWith("You're all set") ? { ...m, secondsFromStart: 31.2 } : m));
    const report = lunaReport(lunaCall({ messages }));
    expect(report.confirmation).toBeNull();
    expect(lunaFailures(report)).toContain("She did not speak the confirmation before the call ended.");
  });

  it("needs a word from the street name in the confirmation", () => {
    const messages = goodMessages().map((m) =>
      String(m.message ?? "").startsWith("You're all set") ? { ...m, message: "You're all set for tomorrow at nine in the morning, see you then." } : m,
    );
    expect(lunaReport(lunaCall({ messages })).confirmation).toBeNull();
  });

  // Issue #29: addresses ended at the city.
  it("fails an address written down with no zip code", () => {
    const messages = goodMessages().map((m) =>
      m.role === "tool_calls" && JSON.stringify(m).includes("33137") ? { ...m, toolCalls: [{ id: "t4", type: "function", function: { name: "recordDetail", arguments: JSON.stringify({ field: "address", value: "4450 NE 18th Ave, Miami" }) } }] } : m,
    );
    expect(lunaFailures(lunaReport(lunaCall({ messages })))).toContain("The address has no zip code.");
  });

  it("needs the zip code in the confirmation, as digits or said digit by digit", () => {
    const confirm = (message: string) =>
      lunaReport(lunaCall({ messages: goodMessages().map((m) => (String(m.message ?? "").startsWith("You're all set") ? { ...m, message } : m)) })).confirmation;
    expect(confirm("You're all set for tomorrow at nine in the morning at forty-four fifty Northeast Eighteenth Avenue.")).toBeNull();
    expect(confirm("You're all set for tomorrow at nine in the morning at 4450 Northeast 18th Avenue, Miami, 33137.")).not.toBeNull();
    expect(confirm("You're all set for tomorrow at nine in the morning at forty-four fifty Northeast Eighteenth Avenue, three-three-one-three-seven.")).not.toBeNull();
  });

  // Issue #32: the actor prompt allows "thirty-three one thirty-seven".
  it("hears the zip code said in groups, the way people say it", () => {
    const confirm = (message: string) =>
      lunaReport(lunaCall({ messages: goodMessages().map((m) => (String(m.message ?? "").startsWith("You're all set") ? { ...m, message } : m)) })).confirmation;
    expect(confirm("You're all set for tomorrow at nine in the morning at forty-four fifty Northeast Eighteenth Avenue, Miami, thirty-three one thirty-seven.")).not.toBeNull();
    expect(confirm("You're all set for tomorrow at nine in the morning at forty-four fifty Northeast Eighteenth Avenue, Miami, thirty three one thirty seven.")).not.toBeNull();
    expect(confirm("You're all set for tomorrow at nine in the morning at forty-four fifty Northeast Eighteenth Avenue, Miami, thirty-three one forty-seven.")).toBeNull();
  });

  it("is not confirmed when the caller hung up, even after a confirmation", () => {
    expect(lunaReport(lunaCall({ endedReason: "customer-ended-call" })).confirmed).toBe(false);
  });

  it("hears the hour in Spanish too", () => {
    const messages = goodMessages().map((m) =>
      String(m.message ?? "").startsWith("You're all set") ? { ...m, message: "Listo, queda agendado para mañana a las nueve de la mañana en el 4450 Northeast 18th Avenue, Miami, tres tres uno tres siete." } : m,
    );
    expect(lunaReport(lunaCall({ messages })).confirmed).toBe(true);
  });

  it("flags tool narration in English and Spanish (finding 2)", () => {
    expect(narrationIn("Based on the user's input, I will record their name as Marco Delgado.")).toBe(true);
    expect(narrationIn("Let's call the record detail tool.")).toBe(true);
    expect(narrationIn("Voy a usar la herramienta para guardar su nombre.")).toBe(true);
    expect(narrationIn("Thanks, Marco. What's the service address?")).toBe(false);
    const messages = [...goodMessages(), { role: "bot", message: "Let's call the record detail tool.", secondsFromStart: 38 }];
    expect(lunaFailures(lunaReport(lunaCall({ messages })))).toContain('Tool narration: "Let\'s call the record detail tool."');
  });

  it("fails slow turns (finding 3), and can skip the turn check for text rehearsal", () => {
    const report = lunaReport(lunaCall({ turnLatencies: [2500, 3100] }));
    expect(report.averageTurnMs).toBe(2800);
    expect(lunaFailures(report)).toContain("Average turn 2800 ms; the bar is under 2000 ms.");
    expect(lunaFailures(report, { checkTurns: false })).toEqual([]);
  });

  it("does not count a refused booking as booked", () => {
    const messages = goodMessages().map((m) => (m.toolCallId === "t5" ? { ...m, result: "That time was not offered. Offer only these two: x or y." } : m));
    const report = lunaReport(lunaCall({ messages }));
    expect(report.booked).toBeNull();
    expect(lunaFailures(report)).toContain("No time was booked.");
  });

  it("reads an empty call without throwing", () => {
    const report = lunaReport({});
    expect(report.details).toEqual({ name: null, job: null, urgency: null, address: null });
    expect(report.averageTurnMs).toBeNull();
    expect(lunaFailures(report)).toContain("Missing: name, job, urgency, address.");
  });
});
