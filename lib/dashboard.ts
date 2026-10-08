// The Dashboard's data (spec module 9): the sample calls plus the Visitor's
// own saved Call Notes, newest first, and the three totals counted from that
// mix. "Calls answered" leaves spam out, so the totals do not overlap.
// "Spam blocked" comes from sample calls only: a Test Call is never spam.

import { isCallId, type CallNotesStore, type SavedCallNotes } from "@/lib/call-notes-store";
import type { CallNotes } from "@/lib/call-story";
import { TIME_ZONE, localDate } from "@/lib/calendar-day";
import { TEST_CALL_TICKET } from "@/lib/sample-business";
import { sampleCalls, type SampleCall } from "@/lib/sample-calls";

export type DashboardCall = {
  readonly id: string;
  readonly at: Date;
  readonly whose: "sample" | "yours";
  readonly spam: boolean;
  /** The ticket number printed on its Call Notes. */
  readonly number: string;
  readonly notes: CallNotes;
};

export type Totals = { readonly answered: number; readonly booked: number; readonly spam: number };

const fromSample = (call: SampleCall): DashboardCall => ({ ...call, whose: "sample" });

const fromSaved = (saved: SavedCallNotes): DashboardCall => ({
  id: saved.callId,
  at: new Date(saved.savedAt),
  whose: "yours",
  spam: false,
  number: TEST_CALL_TICKET,
  notes: saved.notes,
});

export function buildDashboard({ saved, now }: { saved: readonly SavedCallNotes[]; now: Date }): { totals: Totals; calls: DashboardCall[] } {
  const calls = [...saved.map(fromSaved), ...sampleCalls(now).map(fromSample)].sort((a, b) => b.at.getTime() - a.at.getTime());
  const real = calls.filter((call) => !call.spam);
  return {
    totals: { answered: real.length, booked: real.filter((call) => call.notes.booked).length, spam: calls.length - real.length },
    calls,
  };
}

const clock = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" });
const weekday = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "short" });
const monthDay = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, month: "short", day: "numeric" });

/** The day in Miami, as a whole number of days. */
function dayNumber(date: Date): number {
  const { year, month, day } = localDate(date);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

/** "Today · 11:22 AM", "Yesterday · 4:15 PM", "Sat · 9:03 AM", "Sep 29 · 2:10 PM". Days are Miami days. */
export function callTimeLabel(at: Date, now: Date): string {
  const daysAgo = dayNumber(now) - dayNumber(at);
  const day = daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : daysAgo < 6 ? weekday.format(at) : monthDay.format(at);
  // Intl may put a narrow no-break space before AM/PM: make it a plain space.
  return `${day} · ${clock.format(at).replace(/\s/g, " ")}`;
}

/** The Visitor's saved Call Notes, newest first. None when Redis is not set up or is down. */
export async function savedCallsFor({ visitorId, store }: { visitorId: string; store: CallNotesStore | null }): Promise<SavedCallNotes[]> {
  if (!store) return [];
  try {
    return await store.list({ visitorId });
  } catch (error) {
    console.error("Dashboard: could not read the Visitor's calls.", error instanceof Error ? error.message : error);
    return [];
  }
}

/** One call on the Dashboard: any sample call, or one of the Visitor's own. Null otherwise. */
export async function findDashboardCall({
  callId,
  visitorId,
  now,
  store,
}: {
  callId: string;
  visitorId: string;
  now: Date;
  store: CallNotesStore | null;
}): Promise<DashboardCall | null> {
  const sample = sampleCalls(now).find((call) => call.id === callId);
  if (sample) return fromSample(sample);
  if (!store || !isCallId(callId)) return null;
  try {
    const saved = await store.get({ visitorId, callId });
    return saved ? fromSaved(saved) : null;
  } catch (error) {
    console.error("Dashboard: could not read a call.", error instanceof Error ? error.message : error);
    return null;
  }
}
