// Copy look → Paste to selected (Night 11-02, 228). Lightroom's "sync
// settings": get one photo right, then give every ticked photo the same look.
//
// WHAT A LOOK IS. The open photo's tonal edits, read from the engine's op log
// (`oplog_look`, src/look.rs): every Preset, Levels and Adjustments session
// still in its history, in the order they were applied. The order matters, the
// filters do not commute. Crops, paint, text, shapes and layers are never part
// of it: they are per photo in size or place.
//
// ABSOLUTE, NOT ADDED (ADR-091). An Adjustments step carries the panel's
// values, so pasting "Brightness +20" opens a new session at 20. It does not
// add 20 to whatever the photo had.
//
// ONE UNDO STEP on the open photo: the steps are sent back to back with
// `continue_step` between them, the way a callout's pin, label and leader are
// one step (hooks/usePinSteps). They go out in the same tick, so no recomposite
// can clear the join between them. No new op: each call records the op it
// always records (Op::TonalStack, Op::Levels, Op::Adjustments).
import type { ImageHorseTool } from "stamp_tool";

export type LookKind = "preset" | "levels" | "adjustments";

export type LookStep =
  | { kind: "preset"; values: [number, number, number, number, number] }
  | { kind: "levels"; values: [number, number, number] }
  | { kind: "adjustments"; values: [number, number, number, number, number, number, number] };

/** Every kind, in the order the Paste dialog lists them. */
const LOOK_KINDS: readonly LookKind[] = ["adjustments", "preset", "levels"];

export const LOOK_KIND_LABEL: Record<LookKind, string> = {
  adjustments: "Adjustments",
  preset: "Preset",
  levels: "Levels",
};

const WIRE: Record<number, { kind: LookKind; n: number }> = {
  1: { kind: "preset", n: 5 },
  2: { kind: "levels", n: 3 },
  3: { kind: "adjustments", n: 7 },
};

/** Decode `oplog_look()`'s flat wire: a kind code, then that kind's values.
 *  Throws on a code it does not know, rather than pasting half a look. */
export function decodeLook(wire: ArrayLike<number>): LookStep[] {
  const out: LookStep[] = [];
  let i = 0;
  while (i < wire.length) {
    const spec = WIRE[wire[i]!];
    if (!spec || i + 1 + spec.n > wire.length) {
      throw new Error(`Unknown look step at ${i} (code ${wire[i]})`);
    }
    const values = Array.from({ length: spec.n }, (_, k) => wire[i + 1 + k]!);
    out.push({ kind: spec.kind, values } as LookStep);
    i += 1 + spec.n;
  }
  return out;
}

/** The kinds a look carries, in dialog order. */
export function kindsIn(steps: readonly LookStep[]): LookKind[] {
  return LOOK_KINDS.filter((k) => steps.some((s) => s.kind === k));
}

const signed = (v: number) => (v > 0 ? `+${v}` : `${v}`);
const ADJUST_NAMES = ["Brightness", "Contrast", "Saturation", "Shadows", "Highlights", "Sharpen", "Blur"] as const;
/** The panel value that means "as is" for each Adjustments slider. */
const ADJUST_IDENTITY = [0, 100, 100, 0, 0, 0, 0] as const;

/** One line per kind for the dialog: what was copied, in words. */
export function describeKind(steps: readonly LookStep[], kind: LookKind): string {
  const mine = steps.filter((s) => s.kind === kind);
  if (kind === "adjustments") {
    const last = mine[mine.length - 1];
    if (!last) return "";
    const parts = last.values
      .map((v, i) => (v === ADJUST_IDENTITY[i] ? null : `${ADJUST_NAMES[i]} ${signed(Math.round(v - ADJUST_IDENTITY[i]!))}`))
      .filter(Boolean);
    return (mine.length > 1 ? `${mine.length} sessions, last: ` : "") + parts.join(", ");
  }
  if (kind === "levels") {
    return mine
      .map((s) => `black ${s.values[0]}, white ${s.values[1]}, gamma ${Number(s.values[2].toFixed(2))}`)
      .join("; then ");
  }
  return mine.length === 1 ? "1 preset" : `${mine.length} presets, in order`;
}

/** The steps of the kinds a person kept ticked, still in history order. */
export function pickKinds(steps: readonly LookStep[], kinds: ReadonlySet<LookKind>): LookStep[] {
  return steps.filter((s) => kinds.has(s.kind));
}

/** The calls one step makes. A tool or a worker proxy: both answer here. */
type LookTool = Pick<
  ImageHorseTool,
  "preset_apply" | "levels_apply" | "tonal_preview_begin" | "adjust_apply" | "continue_step" | "undo_count"
>;

function send(tool: LookTool, step: LookStep): void {
  switch (step.kind) {
    case "preset":
      tool.preset_apply(...step.values);
      return;
    case "levels":
      tool.levels_apply(step.values[0], step.values[1], step.values[2]);
      return;
    case "adjustments":
      // An Adjustments release needs its session open: begin it, then apply,
      // which bakes it and closes it (src/adjust.rs).
      tool.tonal_preview_begin();
      tool.adjust_apply(...step.values);
      return;
  }
}

/** Apply `steps` to the engine as ONE undo step. Every call goes out in this
 *  tick, as a statement (nothing is awaited between them), so no recomposite
 *  lands between a `continue_step` and the change it joins. One awaited read
 *  after them: the engine answers in order (one worker queue), so when it
 *  returns, every step above has run. Resolves with the new undo count. */
export async function applyLookAsOneStep(tool: LookTool, steps: readonly LookStep[]): Promise<number> {
  steps.forEach((step, i) => {
    if (i > 0) tool.continue_step();
    send(tool, step);
  });
  return await tool.undo_count();
}
