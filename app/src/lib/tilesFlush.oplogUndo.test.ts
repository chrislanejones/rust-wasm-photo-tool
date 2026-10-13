// The op-log replay switch (ih_oplog_undo): the device key reaches a fresh
// engine, OFF stays off, and nothing throws on an engine without the export.
// Mirrors historyForks.test.ts, because the two switches are the same shape —
// and this one went unpushed for a whole release because only the Diagnostics
// sampler pushed it (PARKING_LOT "undo of ANY recorded edit breaks the op log").
import { describe, it, expect, afterEach, vi } from "vitest";

const store = new Map<string, string>();
vi.stubGlobal("window", {
  localStorage: { getItem: (k: string) => store.get(k) ?? null },
});

const { applyOplogUndo, isOplogUndoEnabled, withOplogUndo } = await import("./tilesFlush");

afterEach(() => store.clear());

/** A stand-in engine that records what it was told. */
function engine() {
  const told: boolean[] = [];
  return { told, set_oplog_undo: (on: boolean) => void told.push(on) };
}

describe("op-log replay switch", () => {
  it("is on unless the key is exactly '0'", () => {
    expect(isOplogUndoEnabled()).toBe(true);
    store.set("ih_oplog_undo", "1");
    expect(isOplogUndoEnabled()).toBe(true);
    store.set("ih_oplog_undo", "0");
    expect(isOplogUndoEnabled()).toBe(false);
  });

  it("tells the engine ON by default and OFF under the kill switch", async () => {
    const e = engine();
    await applyOplogUndo(e);
    store.set("ih_oplog_undo", "0");
    await applyOplogUndo(e);
    expect(e.told).toEqual([true, false]);
  });

  it("hands the same engine back, so it chains onto createLiveEngine", async () => {
    const e = engine();
    await expect(withOplogUndo(e)).resolves.toBe(e);
    expect(e.told).toEqual([true]);
  });

  it("is a no-op on no engine or a build without the op log", async () => {
    await expect(applyOplogUndo(null)).resolves.toBeUndefined();
    await expect(withOplogUndo({})).resolves.toEqual({});
  });

  it("does not throw when the engine call rejects", async () => {
    const e = { set_oplog_undo: () => Promise.reject(new Error("engine document replaced")) };
    await expect(applyOplogUndo(e)).resolves.toBeUndefined();
  });
});
