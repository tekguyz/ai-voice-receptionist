import type { NotesStorage, SavedCallNotes } from "@/lib/call-notes-store";

/** In-memory NotesStorage. Expiry is recorded in `ttls`, not enforced. */
export function fakeNotesStorage({ failing = false } = {}) {
  const values = new Map<string, SavedCallNotes>();
  const ttls = new Map<string, number>();
  const sets = new Map<string, Map<string, number>>();
  let writes = 0;
  const guard = () => {
    if (failing) throw new Error("Redis is down");
  };
  const ranked = (indexKey: string) => [...(sets.get(indexKey) ?? [])].sort((a, b) => b[1] - a[1]);

  const storage: NotesStorage = {
    async setIfNew(key, value, ttlSeconds) {
      guard();
      if (values.has(key)) return false;
      writes++;
      values.set(key, structuredClone(value));
      ttls.set(key, ttlSeconds);
      return true;
    },
    async getMany(keys) {
      guard();
      return keys.map((key) => structuredClone(values.get(key) ?? null));
    },
    async indexAdd(indexKey, member, score, ttlSeconds) {
      guard();
      writes++;
      const set = sets.get(indexKey) ?? new Map<string, number>();
      set.set(member, score);
      sets.set(indexKey, set);
      ttls.set(indexKey, ttlSeconds);
    },
    async indexTrim(indexKey, keep) {
      guard();
      for (const [member] of ranked(indexKey).slice(keep)) sets.get(indexKey)!.delete(member);
    },
    async indexNewest(indexKey, count) {
      guard();
      return ranked(indexKey)
        .slice(0, count)
        .map(([member]) => member);
    },
  };
  return { storage, values, ttls, sets, get writes() { return writes; } };
}
