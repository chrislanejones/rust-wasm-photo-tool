// The client's list of synced documents and the server's write allowlist are
// two copies of one fact, in two languages, in two directories.
//
// They can only disagree at RUNTIME, for signed-in users, as a document that
// silently never syncs (a key the client sends and the server rejects) or a
// row nothing ever reads (the reverse). Neither shows up in a typecheck, a
// lint pass, or any test that exercises one side alone. So this reads the
// Convex file as text and asserts the two lists match.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SYNC_KEYS } from "@/lib/sync/keys";

const CONVEX_SYNC = fileURLToPath(new URL("../../../../convex/sync.ts", import.meta.url));

describe("SYNC_KEYS", () => {
  it("matches the allowlist in convex/sync.ts, in the same order", () => {
    const source = readFileSync(CONVEX_SYNC, "utf8");
    const match = source.match(/const SYNC_KEYS = \[([^\]]*)\] as const;/);
    expect(match, "convex/sync.ts no longer declares SYNC_KEYS the way this test reads it").not.toBeNull();

    const serverKeys = [...match![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(serverKeys).toEqual([...SYNC_KEYS]);
  });

  it("has no duplicates — a key is one document", () => {
    expect(new Set(SYNC_KEYS).size).toBe(SYNC_KEYS.length);
  });
});
