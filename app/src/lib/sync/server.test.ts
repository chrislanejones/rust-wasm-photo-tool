// convex/sync.ts — the real handlers, against an in-memory db.
//
// The server half is small on purpose, but two of its rules are what keep a
// user's settings from being overwritten or resurrected, and neither can be
// seen from the client alone:
//
//   • push is a COMPARE-AND-SET on the revision the change was based on. Convex
//     queues mutations while a device is offline and replays them on
//     reconnect; without the check, the replay lands on top of everything
//     another device did in the meantime (finding 7).
//   • clear leaves FORGOTTEN rows, not deleted ones, and clears the legacy
//     `users.settings` blob, so "Forget the synced copy" is not undone by the
//     next device to come online (finding 2).
import { describe, it, expect, beforeEach } from "vitest";
import { checkPush, decidePush } from "../../../../convex/sync";
import { createFakeConvex, type FakeConvex } from "./fakeConvex.testkit";

let server: FakeConvex;
let account: string;

beforeEach(async () => {
  server = createFakeConvex();
  account = await server.signIn("user_a");
});

describe("sync:push — compare-and-set", () => {
  it("creates a row at rev 1 from base 0", async () => {
    const r = await server.push({ key: "prefs", value: "A", format: 1, baseRev: 0 });
    expect(r).toMatchObject({ status: "stored", rev: 1 });
    expect(server.row("prefs")).toMatchObject({ value: "A", rev: 1, format: 1 });
  });

  it("refuses a write based on a revision the row has moved past, and says what is there", async () => {
    await server.push({ key: "prefs", value: "A", format: 1, baseRev: 0 }); // rev 1
    await server.push({ key: "prefs", value: "PHONE", format: 1, baseRev: 1 }); // rev 2

    // The laptop's change, queued offline while it knew rev 1, replayed now.
    const replay = await server.push({ key: "prefs", value: "LAPTOP", format: 1, baseRev: 1 });
    expect(replay).toEqual({
      status: "conflict",
      current: { value: "PHONE", rev: 2, updatedAt: expect.any(Number), format: 1 },
    });
    expect(server.row("prefs")).toMatchObject({ value: "PHONE", rev: 2 });
  });

  it("refuses base 0 when a row already exists (two devices creating it at once)", async () => {
    await server.push({ key: "ui", value: "FIRST", format: 1, baseRev: 0 });
    const second = await server.push({ key: "ui", value: "SECOND", format: 1, baseRev: 0 });
    expect(second.status).toBe("conflict");
  });

  it("is never a conflict to send the value the row already holds", async () => {
    await server.push({ key: "prefs", value: "A", format: 1, baseRev: 0 });
    const again = await server.push({ key: "prefs", value: "A", format: 1, baseRev: 0 });
    expect(again).toMatchObject({ status: "unchanged", rev: 1 });
  });

  it("never lets an older format write over a newer one", () => {
    const newer = { value: "B", rev: 4, updatedAt: 0, format: 2 };
    expect(decidePush(newer, { value: "A", format: 1, baseRev: 4 })).toEqual({ kind: "conflict" });
    expect(decidePush(newer, { value: "A", format: 2, baseRev: 4 })).toEqual({
      kind: "write",
      rev: 5,
    });
  });

  it("answers a permanent problem with a rejection the client can read, not a throw", async () => {
    await expect(server.push({ key: "gallery", value: "x", format: 1, baseRev: 0 })).resolves.toEqual(
      { status: "rejected", reason: "unknown-key" },
    );
    await expect(
      server.push({ key: "prefs", value: "x".repeat(64 * 1024 + 1), format: 1, baseRev: 0 }),
    ).resolves.toEqual({ status: "rejected", reason: "too-large" });
    expect(checkPush({ key: "prefs", value: "x", format: 0, baseRev: 0 })).toBe("bad-format");
    expect(checkPush({ key: "prefs", value: "x", format: 1.5, baseRev: 0 })).toBe("bad-format");

    server.signOut();
    await expect(server.push({ key: "prefs", value: "x", format: 1, baseRev: 0 })).resolves.toEqual({
      status: "rejected",
      reason: "signed-out",
    });
  });

  it("uploads no device identifier", async () => {
    await server.push({ key: "prefs", value: "A", format: 1, baseRev: 0 });
    expect(Object.keys(server.row("prefs")!).sort()).toEqual(
      ["_creationTime", "_id", "format", "key", "rev", "updatedAt", "userId", "value"].sort(),
    );
  });
});

describe("sync:clear — Forget stays forgotten", () => {
  it("leaves forgotten rows for EVERY key, including ones the account never had", async () => {
    await server.push({ key: "prefs", value: "A", format: 1, baseRev: 0 }); // rev 1
    await server.clear();

    expect(server.row("prefs")).toMatchObject({ value: null, rev: 2, format: 0 });
    // ui and tools had no row. A missing row reads to every device as "never
    // had one" — the state a pending change creates a row from — so they get
    // a forgotten marker too.
    expect(server.row("ui")).toMatchObject({ value: null, rev: 1 });
    expect(server.row("tools")).toMatchObject({ value: null, rev: 1 });
  });

  it("clears the legacy settings blob, and pull stops offering it", async () => {
    const legacy = await server.signIn("user_legacy", '{"theme":"light"}');
    expect((await server.pull())!.legacySettings).toBe('{"theme":"light"}');

    await server.clear();

    expect(server.user("user_legacy")!.settings).toBeUndefined();
    expect(server.user("user_legacy")!.settingsHash).toBeUndefined();
    const after = (await server.pull())!;
    expect(after.account).toBe(legacy);
    expect(after.legacySettings).toBeNull();
  });

  it("stops offering the legacy blob once the account has a prefs row, even if the blob is somehow back", async () => {
    // An older build still in the wild writes `users.settings` through the
    // pre-ADR-061 mutation. The forgotten `prefs` row alone keeps it dead.
    await server.signIn("user_old", '{"theme":"light"}');
    await server.push({ key: "prefs", value: "A", format: 1, baseRev: 0 });
    expect((await server.pull())!.legacySettings).toBeNull();
  });

  it("lets a change made after the forget bring that one document back", async () => {
    await server.push({ key: "prefs", value: "A", format: 1, baseRev: 0 });
    await server.clear(); // prefs rev 2, forgotten
    const r = await server.push({ key: "prefs", value: "B", format: 1, baseRev: 2 });
    expect(r).toMatchObject({ status: "stored", rev: 3 });
    expect(server.row("ui")).toMatchObject({ value: null });
  });
});

describe("sync:pull", () => {
  it("reports the account, and every row including forgotten ones", async () => {
    await server.push({ key: "tools", value: "T", format: 1, baseRev: 0 });
    const p = (await server.pull())!;
    expect(p.account).toBe(account);
    expect(p.docs).toEqual([{ key: "tools", value: "T", rev: 1, updatedAt: expect.any(Number), format: 1 }]);
  });

  it("is null when signed out", async () => {
    server.signOut();
    expect(await server.pull()).toBeNull();
  });
});
