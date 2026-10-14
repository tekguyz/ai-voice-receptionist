// The pure half of `npm run luna:report`: reads one Vapi call (GET /call/{id})
// and checks it against Luna's pass bar (spec 2026-10-13). Also scores the
// text rehearsal. Plain relative imports only, so Node can run it.
//
// Vapi's call log stores every tool result as "Success.", and Luna's lines
// say numbers as words ("four twenty six"). So a booking counts unless its
// result says it was refused. The confirmation is a line said after the
// booking's result (not in the same reply, before it ran) that names the
// booked hour and a word from the street.

import { TOOL } from "../lib/luna-tools.ts";
import { callSeconds } from "./sample-call-file.ts";

const FIELDS = ["name", "job", "urgency", "address"] as const;
type Field = (typeof FIELDS)[number];
export const MAX_AVERAGE_TURN_MS = 2000;

export type LunaReport = {
  details: Record<Field, string | null>;
  booked: string | null;
  /** Luna's line that confirms the booking, or null. */
  confirmation: string | null;
  /** A confirmation, and Luna (not the caller) ended the call. */
  confirmed: boolean;
  endedReason: string;
  narration: string[];
  averageTurnMs: number | null;
  slowestTurnMs: number | null;
  seconds: number;
  cost: number | null;
};

const record = (value: unknown): Record<string, any> => (value && typeof value === "object" ? (value as Record<string, any>) : {});
const list = (value: unknown): Record<string, any>[] => (Array.isArray(value) ? value.map(record) : []);
function argsOf(raw: unknown): Record<string, any> {
  if (typeof raw !== "string") return record(raw);
  try {
    return record(JSON.parse(raw));
  } catch {
    return {};
  }
}

// Luna reading her tools or notes aloud (finding 2 in #15).
const NARRATION = /\b(record ?detail|book ?time|end ?call|tool|function|herramienta|funci[oó]n|the user's input|based on the user)\b/i;

export function narrationIn(text: string): boolean {
  return NARRATION.test(text);
}

const HOUR_WORDS: Record<number, string[]> = {
  1: ["one", "una"], 2: ["two", "dos"], 3: ["three", "tres"], 4: ["four", "cuatro"], 5: ["five", "cinco"], 6: ["six", "seis"],
  7: ["seven", "siete"], 8: ["eight", "ocho"], 9: ["nine", "nueve"], 10: ["ten", "diez"], 11: ["eleven", "once"], 12: ["twelve", "doce"],
};

/** Matches the booked hour as a digit or a word, English or Spanish. "tomorrow at 9 AM" → 9. */
function hourPattern(booked: string): RegExp | null {
  const hour = Number(booked.match(/\b(\d{1,2})(?::\d\d)?\s*(?:AM|PM)\b/i)?.[1]);
  if (!HOUR_WORDS[hour]) return null;
  return new RegExp(`\\b(${[String(hour), ...HOUR_WORDS[hour]].join("|")})\\b`, "i");
}

const CONFIRMATION_MIN_WORDS = 8;

const STREET_WORDS: Record<string, string> = {
  n: "north", s: "south", e: "east", w: "west", ne: "northeast", nw: "northwest", se: "southeast", sw: "southwest",
  st: "street", ave: "avenue", av: "avenue", rd: "road", blvd: "boulevard", dr: "drive", ct: "court", ln: "lane",
  pl: "place", ter: "terrace", cir: "circle", hwy: "highway", pkwy: "parkway",
};

/** Words of the street name, spelled out: "4450 NE 18th Ave, Miami" → northeast, avenue. Numbers are left out. */
function streetWords(address: string | null): string[] {
  const street = (address ?? "").split(",")[0].toLowerCase();
  return street
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\d]/gu, ""))
    .filter((w) => w && !/\d/.test(w))
    .map((w) => STREET_WORDS[w] ?? w);
}

export function lunaReport(call: unknown): LunaReport {
  const c = record(call);
  const messages = list(record(c.artifact).messages ?? c.messages);
  const details: Record<Field, string | null> = { name: null, job: null, urgency: null, address: null };
  const spoken: { text: string; at: number }[] = [];
  type Booking = { time: string; at: number; doneAt: number | null };
  const bookings = new Map<string, Booking>();
  let booking: Booking | null = null;

  for (const m of messages) {
    const at = typeof m.secondsFromStart === "number" ? m.secondsFromStart : 0;
    if ((m.role === "bot" || m.role === "assistant") && typeof m.message === "string" && m.message.trim()) spoken.push({ text: m.message.trim(), at });
    if (m.role === "tool_calls") {
      for (const toolCall of list(m.toolCalls)) {
        const fn = record(toolCall.function);
        const args = argsOf(fn.arguments);
        if (fn.name === TOOL.recordDetail && FIELDS.includes(args.field) && typeof args.value === "string") details[args.field as Field] = args.value;
        if (fn.name === TOOL.bookTime && typeof args.time === "string") {
          booking = { time: args.time, at, doneAt: null };
          bookings.set(String(toolCall.id ?? ""), booking);
        }
      }
    }
    if (m.role === "tool_call_result" && booking && bookings.get(String(m.toolCallId ?? "")) === booking) {
      if (/not offered/i.test(String(m.result ?? ""))) booking = null;
      else booking.doneAt = at;
    }
  }

  const endedReason = typeof c.endedReason === "string" ? c.endedReason : "";
  const hour = booking ? hourPattern(booking.time) : null;
  const after = booking ? (booking.doneAt ?? booking.at) : 0;
  const street = streetWords(details.address);
  const namesStreet = (text: string) => !street.length || street.some((w) => new RegExp(`\\b${w}\\b`, "iu").test(text));
  const confirmation =
    booking && hour
      ? (spoken.find((s) => s.at > after && s.text.split(/\s+/).length >= CONFIRMATION_MIN_WORDS && hour.test(s.text) && namesStreet(s.text))?.text ?? null)
      : null;

  const turns = list(record(record(c.artifact).performanceMetrics).turnLatencies)
    .map((t) => t.turnLatency)
    .filter((ms): ms is number => typeof ms === "number" && ms > 0);

  return {
    details,
    booked: booking?.time ?? null,
    confirmation,
    confirmed: confirmation !== null && endedReason.startsWith("assistant-"),
    endedReason,
    narration: spoken.map((s) => s.text).filter(narrationIn),
    averageTurnMs: turns.length ? Math.round(turns.reduce((a, b) => a + b, 0) / turns.length) : null,
    slowestTurnMs: turns.length ? Math.max(...turns) : null,
    seconds: callSeconds(call),
    cost: typeof c.cost === "number" ? c.cost : null,
  };
}

/** Why the call misses the pass bar. Empty means it passes. */
export function lunaFailures(report: LunaReport, { checkTurns = true }: { checkTurns?: boolean } = {}): string[] {
  const failures: string[] = [];
  const missing = FIELDS.filter((f) => !report.details[f]);
  if (missing.length) failures.push(`Missing: ${missing.join(", ")}.`);
  if (!report.booked) failures.push("No time was booked.");
  if (!report.confirmed) failures.push("She did not speak the confirmation before the call ended.");
  for (const line of report.narration) failures.push(`Tool narration: "${line}"`);
  if (checkTurns) {
    if (report.averageTurnMs === null) failures.push("No turn times in the call log.");
    else if (report.averageTurnMs >= MAX_AVERAGE_TURN_MS) failures.push(`Average turn ${report.averageTurnMs} ms; the bar is under ${MAX_AVERAGE_TURN_MS} ms.`);
  }
  return failures;
}

export function formatLunaReport(report: LunaReport, options: { checkTurns?: boolean } = {}): string {
  const failures = lunaFailures(report, options);
  const yes = (ok: boolean) => (ok ? "yes" : "no");
  return [
    `Details: ${FIELDS.map((f) => `${f} ${report.details[f] ? `"${report.details[f]}"` : "MISSING"}`).join("; ")}`,
    `All four details: ${yes(FIELDS.every((f) => report.details[f]))}`,
    `Booked: ${report.booked ?? "no"}`,
    `Confirmation before the end: ${yes(report.confirmed)} (ended: ${report.endedReason || "?"})`,
    `Confirmation line: ${report.confirmation ? `"${report.confirmation}"` : "none"}`,
    `Tool narration: ${report.narration.length ? report.narration.map((l) => `"${l}"`).join(" | ") : "none"}`,
    `Turns: average ${report.averageTurnMs ?? "?"} ms, slowest ${report.slowestTurnMs ?? "?"} ms`,
    `Length: ${report.seconds} s${report.cost === null ? "" : `, cost $${report.cost.toFixed(2)}`}`,
    failures.length ? `FAIL\n- ${failures.join("\n- ")}` : "PASS",
  ].join("\n");
}
