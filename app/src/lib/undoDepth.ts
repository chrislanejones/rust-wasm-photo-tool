// How deep undo can go right now, as a share of the History depth setting —
// the status bar's "Undo NN%" readout.
//
// This replaced a toast (ADR-052 part 2). The toast fired once per photo when
// the op log broke and said "Fewer undo steps from here", which was true and
// read like a scolding. The readout says the same thing all the time, quietly:
// it sits at 100% while the log is driving undo and drops the moment undo
// falls back to whole-image copies.
//
// THE NUMBER IS CAPACITY, NOT USE. It answers "how many steps back could I
// go", not "how many have I spent" — the engine evicts the oldest copy rather
// than refusing a new edit, so there is nothing to run out of, only a depth.

/** One whole-image copy per step, counted the way the engine counts it
 *  (`Snapshot::bytes` in src/history.rs): every layer's pixel buffer, Canvas
 *  included — the artboard fill is a full W×H×4 buffer like any other layer —
 *  plus the selection mask, 1 byte a pixel, whenever something is selected.
 *  Layer masks are NOT counted there, so they are not counted here either:
 *  the estimate has to agree with the eviction it predicts, not with the heap. */
export function snapshotBytes(
  width: number,
  height: number,
  layerCount: number,
  hasSelection = false,
): number {
  const px = Math.max(0, width) * Math.max(0, height);
  return px * 4 * Math.max(1, layerCount) + (hasSelection ? px : 0);
}

export interface UndoDepth {
  /** Steps back undo can reach, never more than `maxSteps`. */
  steps: number;
  /** The History depth setting (Settings → General). */
  maxSteps: number;
  /** `steps / maxSteps`, rounded, 1..=100. */
  percent: number;
  /** True while the op log drives undo — every step is a small recorded
   *  change, so the byte budget does not bind. */
  logDriven: boolean;
}

export interface UndoDepthInput {
  width: number;
  height: number;
  layerCount: number;
  /** A selection is live — every copy carries its W×H mask too. */
  hasSelection?: boolean;
  /** The History depth setting. */
  maxHistory: number;
  /** The engine's byte budget for whole-image copies (`history_max_bytes`). */
  maxBytes: number;
  /** Op-log undo is on AND the log is live for this document. */
  logDriven: boolean;
}

export function estimateUndoDepth(i: UndoDepthInput): UndoDepth {
  const maxSteps = Math.max(1, Math.floor(i.maxHistory));
  if (i.logDriven) {
    return { steps: maxSteps, maxSteps, percent: 100, logDriven: true };
  }
  const per = snapshotBytes(i.width, i.height, i.layerCount, i.hasSelection);
  // The engine always keeps at least one copy, even one bigger than the whole
  // budget (`History::trim`), so the floor is 1 step, not 0.
  const byBytes = per > 0 ? Math.floor(i.maxBytes / per) : maxSteps;
  const steps = Math.min(maxSteps, Math.max(1, byBytes));
  const percent = Math.max(1, Math.round((steps / maxSteps) * 100));
  return { steps, maxSteps, percent, logDriven: false };
}

/** The readout's tooltip. Plain words — "op log" and "snapshot" are engine
 *  internals the reader does not have (the #181 rule). */
export function describeUndoDepth(d: UndoDepth): string {
  if (d.logDriven) {
    return `Undo can go back the full ${d.maxSteps} steps.`;
  }
  if (d.steps >= d.maxSteps) {
    return `Undo can go back ${d.maxSteps} steps.`;
  }
  const step = d.steps === 1 ? "step" : "steps";
  return (
    `Undo can go back about ${d.steps} ${step} of ${d.maxSteps}. ` +
    "Each step keeps a whole copy of this image, and the room for copies is " +
    "fixed, so the bigger the image, the fewer fit."
  );
}

/** The engine's byte budget, read from Rust so 512 MB has one home. Not
 *  feature-gated, unlike the op-log exports. */
export async function getHistoryMaxBytes(): Promise<number> {
  const mod = await import("stamp_tool");
  await mod.default();
  return mod.history_max_bytes();
}
