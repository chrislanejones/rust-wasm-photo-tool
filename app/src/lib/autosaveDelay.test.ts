// v8.35 — the autosave debounce length is a DATA-SAFETY decision, not a tuning
// knob. Unrecorded edits (clone stamp, emoji, Magic Eraser, anything on a
// retired-log document) have no op-log replay and no working unload flush
// behind the worker, so the idle archive is their only persistence. Measured
// before the fix: stamp → refresh inside the debounce → the stroke is gone.
import { describe, it, expect } from "vitest";
import { autosaveDelayMs } from "@/app/session/useImageSession";
import type { OplogStats } from "@/lib/resourceMonitor";

const base: OplogStats = {
  supported: true, active: true, broken: false, ops: 3, cursor: 3,
  keyframes: 1, undoEnabled: true, status: "recording",
  activeLayer: "Background", layers: 2, contentLayers: 1,
};

describe("autosaveDelayMs", () => {
  it("waits politely while the op log COVERS the document", () => {
    expect(autosaveDelayMs(base, 3)).toBe(2500);
    expect(autosaveDelayMs({ ...base, ops: 5 }, 3), "log ahead of undo is fine").toBe(2500);
  });

  it("archives almost immediately when the log is NOT the safety net", () => {
    // Every row here is a document whose edits exist ONLY in the archive.
    expect(autosaveDelayMs({ ...base, active: false }, 3), "retired log").toBe(300);
    expect(autosaveDelayMs({ ...base, broken: true }, 3), "broken log").toBe(300);
    expect(autosaveDelayMs({ ...base, supported: false }, 3), "old wasm").toBe(300);
    expect(autosaveDelayMs(null, 3), "no stats yet — fail toward saving").toBe(300);
  });

  it("an ACTIVE log that MISSES edits is not a safety net — the clone-stamp case", () => {
    // The exact measured state that beat the first cut of this policy:
    // undo 1, ops 0, oplog_active true — the stroke existed only in the
    // engine, and a fast refresh lost it while the policy trusted the log.
    expect(autosaveDelayMs({ ...base, ops: 0 }, 1)).toBe(300);
    expect(autosaveDelayMs({ ...base, ops: 2 }, 3), "one unrecorded edit among recorded ones").toBe(300);
  });
});
