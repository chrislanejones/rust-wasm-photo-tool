// Shapes › Corner Radius (Chris, 11-25-2026 — mock-up F).
//
//   Corner Radius            ↺  24px        ← the arrow squares every corner
//   ( 0 )  ( 8 )  ( 24 )  ( 64 )            ← presets …
//   ──────────●───────────────
//
// HOLD ALT (⌥ Option) with the pointer or focus on the row and the presets
// become the corners: All, then each corner with its own radius. Pick one and
// the slider and presets move THAT corner only — the label says which
// ("Corner Radius · Top Left") and the shape's edit overlay lights its dot —
// until All is picked again (Alt, All) or the arrow resets. The same move as
// Fill Color's opacity (Alt over the row shows its other form), and the panel
// spelling of the canvas's Shift-drag on one corner dot.
//
// A star rounds every point alike (one radius), so it has no corners to pick.
import { useEffect, useRef } from "react";
import { SizeSlider } from "@/components/ui/size-slider";
import { ToolButton } from "@/components/ui/tool-button";
import { useRadioGroup } from "@/components/ui/use-radio-group";
import { useAltOverRow } from "@/hooks/useAltOverRow";
import { useKeepFocusOnSwap } from "@/hooks/useKeepFocusOnSwap";
import { ModeRing } from "@/components/ui/mode-ring";
import { useCornerFocusStore } from "@/stores/useCornerFocusStore";
import { canonicalCornerRadii, cornerCount } from "@/lib/shapeSloppiness";
import type { ToolSettings } from "@/lib/types";

/** Corner radius presets, px — numbers variant like Points. Square, a soft
 *  round, a card, and a pill on most shapes (the engine clamps to what fits). */
const CORNER_RADIUS_PRESETS = [0, 8, 24, 64] as const;

/** Each shape's corners, in `cornerRadii` order (shapeSloppiness.ts). */
const CORNER_NAMES: Record<string, readonly string[]> = {
  rect: ["Top Left", "Top Right", "Bottom Right", "Bottom Left"],
  diamond: ["Top", "Right", "Bottom", "Left"],
  triangle: ["Top", "Bottom Right", "Bottom Left"],
};

/** A 16 px outline of the shape with a dot on each of `lit` vertices. */
const VERTICES: Record<string, readonly [number, number][]> = {
  rect: [[3, 3], [13, 3], [13, 13], [3, 13]],
  diamond: [[8, 2], [14, 8], [8, 14], [2, 8]],
  triangle: [[8, 2], [14, 13], [2, 13]],
};

function CornerGlyph({ shape, lit }: { shape: string; lit: readonly number[] }) {
  const v = VERTICES[shape] ?? VERTICES.rect;
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="size-4">
      <polygon
        points={v.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinejoin="round"
        opacity={0.6}
      />
      {lit.map((i) => (
        <circle key={i} cx={v[i][0]} cy={v[i][1]} r={1.9} fill="currentColor" />
      ))}
    </svg>
  );
}

const ALT_HINT_ALL = "Hold Alt (⌥) to round one corner at a time";
const ALT_HINT_ONE = "Hold Alt (⌥) and pick All to round every corner again";

interface Props {
  /** The shape whose corners these are (the reselected one, else the tile). */
  shape: string;
  settings: ToolSettings;
  onChange: (s: ToolSettings) => void;
}

export function CornerRadiusControl({ shape, settings, onChange }: Props) {
  const radii = canonicalCornerRadii(shape, settings.cornerRadii);
  const cornersUsed = cornerCount(shape);
  const names = CORNER_NAMES[shape] ?? [];
  const perCorner = cornersUsed > 1 && names.length === cornersUsed;

  const stored = useCornerFocusStore((s) => s.corner);
  const setCorner = useCornerFocusStore((s) => s.setCorner);
  const corner = perCorner && stored !== null && stored < cornersUsed ? stored : null;
  // A different shape in hand has different corners: start from All. And the
  // panel closing leaves no corner lit on the canvas.
  useEffect(() => setCorner(null), [shape, setCorner]);
  useEffect(() => () => setCorner(null), [setCorner]);

  const { alt, handlers } = useAltOverRow(perCorner);
  // The swap unmounts a focused preset (Alt down) or corner tile (Alt up):
  // hand focus to the picked corner, or back to the slider.
  const rowRef = useRef<HTMLDivElement>(null);
  useKeepFocusOnSwap(rowRef, alt, (root) =>
    alt
      ? root.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')
      : root.querySelector<HTMLElement>('input[type="range"]'),
  );

  const used = radii.slice(0, cornersUsed);
  const mixed = used.some((r) => r !== used[0]);
  const value = corner !== null ? radii[corner] : Math.max(...used);
  const set = (v: number) =>
    onChange({
      ...settings,
      cornerRadii:
        corner !== null
          ? [0, 1, 2, 3].map((i) => (i === corner ? v : radii[i])) as [number, number, number, number]
          : [v, v, v, v],
    });

  // The tiles: one radio group, like every row of tiles (UI_CONSISTENCY §7).
  const ids = ["all", ...names.map((_, i) => String(i))];
  const radio = useRadioGroup({
    ids,
    selected: corner === null ? "all" : String(corner),
    isDisabled: () => false,
    onSelect: (id) => setCorner(id === "all" ? null : Number(id)),
  });
  const tiles = alt ? (
    <div
      {...radio.groupProps}
      aria-label="Corner"
      className={`grid gap-1.5 ${cornersUsed === 4 ? "grid-cols-5" : "grid-cols-4"}`}
    >
      {ids.map((id, i) => {
        const all = id === "all";
        const name = all ? "All corners" : names[i - 1];
        const shown = all ? (mixed ? "Mixed" : String(used[0])) : String(radii[i - 1]);
        return (
          <ToolButton
            key={id}
            {...radio.itemProps(i)}
            active={all ? corner === null : corner === i - 1}
            aria-label={`${name}, ${shown === "Mixed" ? "mixed" : `${shown} px`}`}
            title={name}
            onClick={() => setCorner(all ? null : i - 1)}
            className="flex-col gap-1 px-0 py-1.5"
          >
            <CornerGlyph
              shape={shape}
              lit={all ? names.map((_, k) => k) : [i - 1]}
            />
            <span className="font-mono text-2xs font-normal">{all ? "All" : shown}</span>
          </ToolButton>
        );
      })}
    </div>
  ) : undefined;

  return (
    <div {...handlers} ref={rowRef} className="relative">
      {/* The mode ring (Compare's): Alt is showing the corners, or one
          corner is being edited on its own. */}
      {(alt || corner !== null) && <ModeRing inset={6} radius={10} thickness={2} />}
      <SizeSlider
        label={corner !== null ? `Corner Radius · ${names[corner]}` : "Corner Radius"}
        value={value}
        valueDisplay={corner === null && mixed ? "Mixed" : undefined}
        valueHint={perCorner ? (corner !== null ? ALT_HINT_ONE : ALT_HINT_ALL) : undefined}
        onChange={set}
        presets={CORNER_RADIUS_PRESETS}
        presetsSlot={tiles}
        variant="numbers"
        unit="px"
        // The reset arrow (as on Scale and Quality) squares every corner in
        // one click — the way back from a one-corner Shift-drag. No "changed
        // on this photo" dot: a shape's corners aren't per-photo.
        edited={{
          isEdited: used.some((r) => r > 0),
          onReset: () => {
            setCorner(null);
            onChange({ ...settings, cornerRadii: [0, 0, 0, 0] });
          },
          dot: false,
        }}
      />
    </div>
  );
}
