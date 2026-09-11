import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import type { ToolSettings } from "@/lib/types";

/** Stroke-stabilizer strength (off → high leash). Off by default.
 *
 *  THE SINGLE COPY. This table used to be inlined in `PaintSettings`, and the
 *  multi-tool plan (`docs/Stroke-Stabilizer-Multi-Tool-Plan.md` §2) is explicit
 *  that it must not be duplicated once a second panel renders it — four
 *  independent copies of a level table is four places to forget to update. */
const STABILIZER_LEVELS = [
  { id: "off", label: "Off" },
  { id: "low", label: "Low" },
  { id: "med", label: "Med" },
  { id: "high", label: "High" },
] as const;

type Level = ToolSettings["paintStabilizer"];

interface Props {
  /** Current level. `undefined` is tolerated and reads as "off" — the setting
   *  predates several of its consumers. */
  value: Level | undefined;
  onChange: (level: Level) => void;
  /** Overrides the label. The pen stabilizes anchor/handle DRAGGING rather
   *  than a painted line, so it needs to say something different (plan §6). */
  label?: string;
}

/**
 * The Stroke Stabilizer control — a pulled-string "lazy mouse" leash that
 * smooths shaky drags.
 *
 * Presentational only: it owns the level table and nothing else. Every panel
 * that renders it reads and writes the SAME `ToolSettings` field, because a
 * person who turns stabilization on because their hand shakes wants it on
 * everywhere, not once per tool.
 */
export function StabilizerRow({ value, onChange, label = "Stroke Stabilizer" }: Props) {
  return (
    <div className="space-y-2">
      <label className="text-2xs text-theme-muted-foreground">{label}</label>
      <ToolButtonGroup
        options={STABILIZER_LEVELS}
        value={value ?? "off"}
        onChange={(id) => onChange(id as Level)}
      />
    </div>
  );
}
