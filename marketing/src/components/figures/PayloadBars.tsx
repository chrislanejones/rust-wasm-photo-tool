/* What a frame costs against what a message can afford.
 *
 * Flat, not WebGL. This figure is a magnitude comparison on one axis and 3D
 * would cost it precision for nothing — the two bars that matter are the ones
 * that run off the end of the budget, and a perspective camera makes "runs off
 * the end" ambiguous.
 *
 * ── the scale is computed, not drawn ──────────────────────────────────────
 * Every bar width comes out of `position()` below, from the byte count beside
 * it. The alternative — a hand-written width per row — is a chart that can
 * disagree with its own labels after one edit, and the whole point of this
 * figure is that the numbers are checkable.
 *
 * The log scale is not a flourish either. On a linear axis the 10 KiB budget is
 * 0.015% of a 64 MiB layer: the three rows the reader has to compare would be
 * one invisible line against two full-width bars. Log2 is the axis that lets
 * "810 times over" and "6,554 times over" both be legible in the same picture,
 * and it is labelled as such in the header — an unlabelled log axis is a lie.
 */

const KIB = 1024;
const MIB = 1024 * KIB;

/* The axis: one octave per 1/16th of the width. */
const SCALE_MIN = KIB; // 2^10
const SCALE_MAX = 64 * MIB; // 2^26

/** The per-frame structured-clone budget, from the RAIL 16 ms frame. Every
 *  "× over" multiple on this chart is against this number. */
const FRAME_BUDGET = 10 * KIB;

/** Where `bytes` sits along the log2 axis, 0–1.
 *
 * Floored at 0.02 rather than 0: a pointer event is far below the bottom of the
 * scale, and a zero-width bar reads as missing data instead of as "too small to
 * see", which is the thing this row exists to say. */
const position = (bytes: number): number => {
  const span = Math.log2(SCALE_MAX) - Math.log2(SCALE_MIN);
  const u = (Math.log2(bytes) - Math.log2(SCALE_MIN)) / span;
  return Math.min(1, Math.max(0.02, u));
};

/** "7.9 MiB", "64 MiB", "100 KiB", "~60 B" — the unit a reader would use, and a
 *  decimal only where it carries information. */
const formatBytes = (bytes: number): string => {
  if (bytes < KIB) return `~${bytes} B`;
  const [value, unit] = bytes < MIB ? [bytes / KIB, "KiB"] : [bytes / MIB, "MiB"];
  return `${Number.isInteger(value) ? value : value.toFixed(1)} ${unit}`;
};

/** How many times over the per-frame budget. Rendered only for the rows that
 *  are over it — for the budgets themselves the multiple is 1 and saying so
 *  would be noise. */
const overBudget = (bytes: number): string => `${Math.round(bytes / FRAME_BUDGET).toLocaleString("en-US")}× over`;

/* `tone` is a three-state status encoding, not series identity: what a message
 * costs, what a frame can afford, and what will not fit. It is never the only
 * carrier — every row prints its own value, and the two over-budget rows print
 * the multiple as well — so a reader who cannot separate the amber from the red
 * loses nothing. */
type Tone = "neutral" | "budget" | "over";

interface Row {
  label: string;
  /** The parenthetical: what the payload is, or which budget this is. */
  note?: string;
  bytes: number;
  tone: Tone;
}

const ROWS: Row[] = [
  { label: "Pointer event", note: "{ tool, x, y, pressure }", bytes: 60, tone: "neutral" },
  { label: "Frame budget", note: "16 ms", bytes: FRAME_BUDGET, tone: "budget" },
  { label: "Interaction budget", note: "100 ms", bytes: 100 * KIB, tone: "budget" },
  { label: "1920×1080 RGBA frame", bytes: 1920 * 1080 * 4, tone: "over" },
  { label: "4096×4096 RGBA layer", bytes: 4096 * 4096 * 4, tone: "over" },
];

export default function PayloadBars() {
  return (
    <div className="fig-bars">
      <p className="fig-bars__axis">
        <span>Bytes per postMessage, log scale</span>
        <span>
          {formatBytes(SCALE_MIN)} → {formatBytes(SCALE_MAX)}
        </span>
      </p>

      {/* A description list, not a table: this is one measure per named thing,
          which is what a <dl> is, and it keeps the row order meaningful to a
          screen reader without inventing column headers for a single column. */}
      <dl className="fig-bars__rows">
        {ROWS.map((row) => (
          <div className="fig-bars__row" key={row.label} data-tone={row.tone}>
            <dt className="fig-bars__label">
              {row.label}
              {row.note && <span className="fig-bars__note"> {row.note}</span>}
            </dt>

            <div className="fig-bars__track" aria-hidden="true">
              <div className="fig-bars__fill" style={{ inlineSize: `${position(row.bytes) * 100}%` }} />
              {/* The budget marker, on the rows that blow through it. Recessive
                  and dashed — it is a reference, not data. */}
              {row.tone === "over" && (
                <div className="fig-bars__marker" style={{ insetInlineStart: `${position(FRAME_BUDGET) * 100}%` }} />
              )}
            </div>

            <dd className="fig-bars__value">
              {formatBytes(row.bytes)}
              {row.tone === "over" && <> · {overBudget(row.bytes)}</>}
            </dd>
          </div>
        ))}
      </dl>

      <p className="fig-bars__foot">
        Dashed line: the {formatBytes(FRAME_BUDGET)} per-frame budget. Every bar to its right is a frame you drop.
      </p>
    </div>
  );
}
