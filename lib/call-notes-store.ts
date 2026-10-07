// The Call Notes store: what the Receptionist captured, kept per Visitor for
// 7 days (ADR 0003). One entry per call, each with its own expiry, so there is
// no cleanup job. A short per-Visitor list, newest first, points to the entries.
// Keys hold the Visitor ID, so a Visitor can only ever reach their own.

import type { CallNotes } from "@/lib/call-story";

export const NOTES_TTL_SECONDS = 7 * 24 * 60 * 60;
export const NOTES_PER_VISITOR = 10;

export type SavedCallNotes = { readonly callId: string; readonly savedAt: string; readonly notes: CallNotes };

/** The slice of Redis the store needs. Tests use an in-memory one. */
export type NotesStorage = {
  /** Stores `value` under `key` for `ttlSeconds`, only if the key is new. True when it stored. */
  setIfNew(key: string, value: SavedCallNotes, ttlSeconds: number): Promise<boolean>;
  /** The values in key order; null for a key that is missing or has expired. */
  getMany(keys: readonly string[]): Promise<(SavedCallNotes | null)[]>;
  /** Puts `member` in the ranked list (a new score replaces the old one) and sets the list's expiry. */
  indexAdd(indexKey: string, member: string, score: number, ttlSeconds: number): Promise<void>;
  /** Keeps only the `keep` highest scores. */
  indexTrim(indexKey: string, keep: number): Promise<void>;
  /** The `count` highest-scored members, highest first. */
  indexNewest(indexKey: string, count: number): Promise<string[]>;
};

export type CallNotesStore = {
  /** `saved` is false when that call was already saved: the first copy stays. */
  save(input: { visitorId: string; callId: string; notes: CallNotes; now: Date }): Promise<{ saved: boolean }>;
  get(input: { visitorId: string; callId: string }): Promise<SavedCallNotes | null>;
  /** Newest first. An entry that has expired is left out. */
  list(input: { visitorId: string }): Promise<SavedCallNotes[]>;
};

export function createCallNotesStore({ storage, prefix }: { storage: NotesStorage; prefix: string }): CallNotesStore {
  const noteKey = (visitorId: string, callId: string) => `${prefix}notes:${visitorId}:${callId}`;
  const indexKey = (visitorId: string) => `${prefix}notes-index:${visitorId}`;

  return {
    async save({ visitorId, callId, notes, now }) {
      // List first: if the entry write fails and Vapi retries, the call still ends up listed.
      await storage.indexAdd(indexKey(visitorId), callId, now.getTime(), NOTES_TTL_SECONDS);
      await storage.indexTrim(indexKey(visitorId), NOTES_PER_VISITOR);
      const saved = await storage.setIfNew(noteKey(visitorId, callId), { callId, savedAt: now.toISOString(), notes }, NOTES_TTL_SECONDS);
      return { saved };
    },

    async get({ visitorId, callId }) {
      const [found] = await storage.getMany([noteKey(visitorId, callId)]);
      return found ?? null;
    },

    async list({ visitorId }) {
      const callIds = await storage.indexNewest(indexKey(visitorId), NOTES_PER_VISITOR);
      if (callIds.length === 0) return [];
      const found = await storage.getMany(callIds.map((callId) => noteKey(visitorId, callId)));
      return found.filter((entry): entry is SavedCallNotes => entry !== null);
    },
  };
}
