// The set of documents the sync layer replicates. One list, two consumers:
// this file (the client) and SYNC_KEYS in convex/sync.ts (the server's write
// allowlist). `keys.test.ts` reads the Convex file and asserts the two agree,
// because a key that exists on one side only fails at RUNTIME, for signed-in
// users, as a document that silently never syncs.
//
// WHAT BELONGS HERE. User-level state that should look the same everywhere:
// preferences, remembered UI choices, remembered tool modes. Anything keyed
// by a photo does not belong — see the note in `index.ts` about the archive.
export const SYNC_KEYS = ["prefs", "ui", "tools"] as const;

export type SyncKey = (typeof SYNC_KEYS)[number];

export function isSyncKey(k: string): k is SyncKey {
  return (SYNC_KEYS as readonly string[]).includes(k);
}
