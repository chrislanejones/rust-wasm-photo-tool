// The stroke stabilizer's leash, for JS-side consumers.
//
// The LENGTHS live in Rust (`stabilizer_leash` in `src/stabilizer.rs`) so the
// table has one home — the `gaussian_kernel` precedent: a constant two
// languages must agree on crosses the boundary rather than being written down
// twice. The pen has no dabs to lag, so it cannot use the engine's stroke
// engines; it needs the number itself.

/** Off, used until the wasm module resolves. Zero = no smoothing, which is
 *  also the setting's default, so nothing changes for anyone who never turns
 *  it on. */
export const NO_LEASH = 0;

export async function getStrokeLeash(level: string): Promise<number> {
  const mod = await import("stamp_tool");
  await mod.default();
  return mod.stabilizer_leash(level);
}

/**
 * Trailing-tip filter, the JS twin of `src/stabilizer.rs`.
 *
 * ⚠️ THE LEASH IS MEASURED FROM THE TIP, NOT FROM THE LAST CURSOR. After a
 * pull from 100 to 150 with leash 36 the tip sits at 114, so the leash still
 * reaches all the way to 150 — a "10px move" from 150 is 46 from the tip and
 * DOES move. Two Rust test files got this backwards before catching it; it is
 * written here so a third does not.
 *
 * ⚠️ `flush` takes the RAW cursor, never the tip. Handing it the tip compares a
 * point against itself, returns nothing, and silently drops the last
 * leash-length of the gesture. That exact bug appeared twice in the engine
 * (`effect_last`, `end_stroke`) in one night.
 */
export class StrokeLeash {
  private tip: { x: number; y: number } | null = null;

  constructor(private leash: number) {}

  get isOn(): boolean {
    return this.leash > 0;
  }

  begin(x: number, y: number): void {
    this.tip = { x, y };
  }

  /** Advance toward the cursor. `null` = still inside the leash, draw nothing. */
  advance(rawX: number, rawY: number): { x: number; y: number } | null {
    if (!this.tip) {
      this.tip = { x: rawX, y: rawY };
      return null;
    }
    const dx = rawX - this.tip.x;
    const dy = rawY - this.tip.y;
    const dist = Math.hypot(dx, dy);
    if (dist > this.leash && dist > 0) {
      const k = 1 - this.leash / dist;
      this.tip = { x: this.tip.x + dx * k, y: this.tip.y + dy * k };
      return { ...this.tip };
    }
    return null;
  }

  /** Catch up to the TRUE cursor and clear. `null` when there was no slack. */
  flush(rawX: number, rawY: number): { x: number; y: number } | null {
    const t = this.tip;
    this.tip = null;
    if (!t) return null;
    // Same 0.001 epsilon the engine uses.
    if (Math.abs(t.x - rawX) > 0.001 || Math.abs(t.y - rawY) > 0.001) {
      return { x: rawX, y: rawY };
    }
    return null;
  }

  cancel(): void {
    this.tip = null;
  }
}
