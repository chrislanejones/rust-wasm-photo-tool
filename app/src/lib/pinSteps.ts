// Numbered steps: what the Pins panel needs to know about the active layer's
// pin sequence, and where the next pin goes. Pure, so it is testable without
// an engine; hooks/usePinSteps.ts drives the engine with it.
//
// One sequence per layer — numbers and letters alike, since `label_kind` only
// picks how a number is drawn (lib/pinLabel.ts). The engine keeps it whole:
// `remove_pin_annotation` closes the gap a deleted pin leaves,
// `insert_pin_annotation` moves the pins at and after a number up one, and
// `renumber_pins` closes every gap (src/annotations.rs, tests/pin_steps.rs).

/** The active layer's pins, as `get_shape_annotations` lists them. */
interface PinLike {
  kind: number;
  number: number;
}

export interface PinSequence {
  /** The highest number on the layer; 0 with no pins. */
  max: number;
  /** True when the numbers are not exactly 1, 2, 3… — Renumber would change
   *  something. */
  gaps: boolean;
}

export function pinSequence(shapes: readonly PinLike[]): PinSequence {
  const numbers = shapes.filter((s) => s.kind === 5).map((s) => s.number);
  const max = numbers.reduce((m, n) => Math.max(m, n), 0);
  const sorted = [...numbers].sort((a, b) => a - b);
  return { max, gaps: sorted.some((n, i) => n !== i + 1) };
}

/** The number the next pin takes: `requested` (the panel's Next field) kept
 *  inside 1…max + 1 so a drop never opens a gap, or max + 1 when nothing was
 *  asked for. */
export function nextPinNumber(max: number, requested: number | null): number {
  if (requested === null) return max + 1;
  return Math.min(Math.max(1, Math.round(requested)), max + 1);
}

/** What the Next field holds after a drop at `dropped`: an inserted step keeps
 *  inserting right after itself; once that reaches the end it is the default
 *  again (null — "after the last"). */
export function nextAfterDrop(dropped: number, maxAfter: number, requested: number | null): number | null {
  if (requested === null || dropped + 1 > maxAfter) return null;
  return dropped + 1;
}

/** Read the Next field: digits, or a letter label (A = 1 … Z = 26, AA = 27),
 *  the inverse of `pinLabelText`. Null for anything else. */
export function parsePinLabel(text: string): number | null {
  const t = text.trim().toUpperCase();
  if (/^\d+$/.test(t)) return Number(t) >= 1 ? Number(t) : null;
  if (!/^[A-Z]+$/.test(t)) return null;
  let n = 0;
  for (const c of t) n = n * 26 + (c.charCodeAt(0) - 64);
  return n;
}
