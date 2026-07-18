import { useState } from "react";
import { Brush, Droplets, PenTool, Blend } from "lucide-react";
import type { ToolSettings } from "@/lib/types";
import type { BrushMode } from "@/stores/useToolStore";
import { useToolStore } from "@/stores/useToolStore";
import { TEXT_COLORS } from "@/lib/colors";
import { isSmartEdgeEnabled } from "@/lib/smartEdge";
import { SizeSlider } from "@/components/SizeSlider";
import { ColorSwatchGrid } from "@/components/ColorSwatchGrid";
import { ToolButton } from "@/components/ui/tool-button";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import { ToolModeToggle } from "@/components/ui/tool-mode-toggle";
import type { ToolMode } from "@/components/ui/tool-mode-toggle";

const BRUSH_SIZE_PRESETS = [4, 8, 16, 32] as const;
const OPACITY_PRESETS = [25, 50, 75, 100] as const;
const HARDNESS_PRESETS = [25, 50, 75, 100] as const;
const BLUR_SIZE_PRESETS = [8, 16, 32, 64] as const;
const PIXEL_SIZE_PRESETS = [8, 16, 32, 48] as const;
const ERASER_SIZE_PRESETS = [8, 16, 32, 64] as const;

// Blur-brush modes — gaussian (soften), pixelate (mosaic), solid (redact).
const BLUR_MODES = [
  { id: "gaussian", label: "Blur" },
  { id: "pixelate", label: "Pixelate" },
  { id: "solid", label: "Solid" },
] as const;

// Stroke-stabilizer strength (off → high leash). Off by default.
const STABILIZER_LEVELS = [
  { id: "off",  label: "Off"  },
  { id: "low",  label: "Low"  },
  { id: "med",  label: "Med"  },
  { id: "high", label: "High" },
] as const;

const PEN_WIDTH_PRESETS = [2, 4, 8, 16] as const;

/** Paint's sub-mode union — the store (`useToolStore.BrushMode`) is the
 *  canonical definition; this alias keeps the panel's public prop names. */
export type PaintMode = BrushMode;

/** Paint's sub-modes for the shared ToolModeToggle (icon tiles + per-mode
 *  SectionHeader title/info). Also consumed by the tool registry
 *  (features/tools/toolModules.ts) as the Paint module's `modes`. */
export const PAINT_MODES: readonly ToolMode<PaintMode>[] = [
  {
    id: "paint",
    label: "Paint",
    icon: Brush,
    info: (
      <>
        Freehand-paints the active layer in the selected color.{" "}
        <kbd>Ctrl+]</kbd>/<kbd>Ctrl+[</kbd> grows/shrinks the brush.
        Stroke Stabilizer smooths shaky drags.
      </>
    ),
  },
  {
    id: "blur",
    label: "Blur",
    icon: Droplets,
    info: (
      <>
        Softens (Blur), mosaics (Pixelate), or fully redacts
        (Solid) whatever you drag over on the active layer.{" "}
        <kbd>Ctrl+]</kbd>/<kbd>Ctrl+[</kbd> grows/shrinks the brush.
      </>
    ),
  },
  {
    id: "pen",
    label: "Pen",
    icon: PenTool,
    info: (
      <>
        Click to drop points, drag to pull Bézier handles.{" "}
        <kbd>Enter</kbd> closes the path, <kbd>Esc</kbd> finishes it
        open, <kbd>Backspace</kbd> undoes a point.
      </>
    ),
  },
];
// Eraser moved out of Paint's toggle row (now Paint/Blur/Pen, 1×3) — the
// tool formerly at the "ai" slot is now "Eraser": PatchMatch/Magic Eraser +
// Background Removal + Object Removal (AISettings.tsx). The brush-eraser
// case below stays intact in the switch body — dormant, not deleted — in
// case any surviving code path (a shortcut, persisted store state) still
// sets mode to "erase"; it just no longer has a tile in this row.

interface PaintSettingsProps {
  settings: ToolSettings;
  onChange: (s: ToolSettings) => void;
  activeMode?: PaintMode;
  onModeChange?: (mode: PaintMode) => void;
}

export function PaintSettings({ settings, onChange, activeMode, onModeChange }: PaintSettingsProps) {
  const [internalMode, setInternalMode] = useState<PaintMode>("paint");
  const mode = activeMode ?? internalMode;

  // Smart Brush lives in the tool store (like the selection kind), not in
  // ToolSettings — it's a mode, not a brush dimension, and ToolSettings is a
  // persisted shape I'd rather not widen for a flagged-off feature.
  const smartEdge = isSmartEdgeEnabled();
  const smartBrush = useToolStore((s) => s.smartBrush);
  const setSmartBrush = useToolStore((s) => s.setSmartBrush);
  const smartBrushStrength = useToolStore((s) => s.smartBrushStrength);
  const setSmartBrushStrength = useToolStore((s) => s.setSmartBrushStrength);

  const handleModeChange = (m: PaintMode) => {
    setInternalMode(m);
    onModeChange?.(m);
  };

  return (
    <ToolModeToggle
      modes={PAINT_MODES}
      columns={3}
      activeMode={mode}
      onModeChange={handleModeChange}
    >
      {(m) => {
        switch (m) {
          case "paint":
            return (
              <>
                {/* Brush Size */}
                <SizeSlider
                  label="Brush Size"
                  value={settings.brushSize}
                  min={1}
                  max={50}
                  onChange={(v) => onChange({ ...settings, brushSize: v })}
                  presets={BRUSH_SIZE_PRESETS}
                />

                {/* Opacity — preset dots (numbers variant) to match Brush Size. */}
                <SizeSlider
                  label="Opacity"
                  value={settings.brushOpacity}
                  onChange={(v) => onChange({ ...settings, brushOpacity: v })}
                  presets={OPACITY_PRESETS}
                  variant="numbers"
                  unit="%"
                />

                {/* Hardness — edge softness of the brush dab (100% = crisp). */}
                <SizeSlider
                  label="Hardness"
                  value={settings.brushHardness}
                  min={0}
                  max={100}
                  onChange={(v) => onChange({ ...settings, brushHardness: v })}
                  presets={HARDNESS_PRESETS}
                  variant="numbers"
                  unit="%"
                />

                {/* Color */}
                <ColorSwatchGrid
                  colors={TEXT_COLORS}
                  value={settings.brushColor}
                  onChange={(color) => onChange({ ...settings, brushColor: color })}
                />

                {/* Stroke Stabilizer — pulled-string "lazy mouse" smoothing. Off by
                    default; Low/Med/High set the leash (smoothing strength). */}
                <div className="space-y-2">
                  <label className="text-2xs text-theme-muted-foreground">
                    Stroke Stabilizer
                  </label>
                  <ToolButtonGroup
                    options={STABILIZER_LEVELS}
                    value={settings.paintStabilizer ?? "off"}
                    onChange={(id) =>
                      onChange({
                        ...settings,
                        paintStabilizer: id as ToolSettings["paintStabilizer"],
                      })
                    }
                  />
                </div>

                {/* ── Smart Brush (behind ih_smart_edge; see lib/smartEdge.ts) ──
                    The second consumer of the edge core that already powers the
                    edge-aware wand: the stroke is walled in by strong edges, so
                    it can't bleed across an object's outline. Absent entirely
                    when the switch is off — with it off the engine takes its
                    original brush path and paints byte-for-byte what it did
                    before. */}
                {smartEdge && (
                  <div className="space-y-2 border-t border-theme-sidebar-border pt-3">
                    <ToolButton
                      active={smartBrush}
                      onClick={() => setSmartBrush(!smartBrush)}
                      className="w-full"
                      title="Stop the brush bleeding across object edges"
                    >
                      <Blend />{" "}
                      {smartBrush ? "Smart Brush: on" : "Smart Brush"}
                    </ToolButton>
                    <p className="px-0.5 text-2xs leading-relaxed text-theme-muted-foreground">
                      The stroke stops at strong edges instead of spilling across
                      them — same edge detection the Edge-aware wand uses.
                    </p>
                    {smartBrush && (
                      <SizeSlider
                        label="Edge strength"
                        value={smartBrushStrength}
                        min={10}
                        max={255}
                        onChange={setSmartBrushStrength}
                      />
                    )}
                  </div>
                )}
              </>
            );

          case "blur":
            return (
              <>
                {/* Mode: Gaussian blur / Pixelate / Solid redaction */}
                <ToolButtonGroup
                  columns={3}
                  options={BLUR_MODES}
                  value={settings.blurMode ?? "gaussian"}
                  onChange={(id) =>
                    onChange({ ...settings, blurMode: id as ToolSettings["blurMode"] })
                  }
                />

                {/* Brush footprint — shared by every mode */}
                <SizeSlider
                  label="Brush Size"
                  value={settings.blurSize}
                  min={4}
                  max={128}
                  onChange={(v) => onChange({ ...settings, blurSize: v })}
                  presets={BLUR_SIZE_PRESETS}
                  blurredDots
                />

                {(settings.blurMode ?? "gaussian") === "gaussian" && (
                  <SizeSlider
                    label="Blur Intensity"
                    value={settings.blurIntensity}
                    onChange={(v) => onChange({ ...settings, blurIntensity: v })}
                    min={1}
                    max={20}
                    unit="px"
                  />
                )}

                {settings.blurMode === "pixelate" && (
                  <SizeSlider
                    label="Block Size"
                    value={settings.pixelSize ?? 16}
                    onChange={(v) => onChange({ ...settings, pixelSize: v })}
                    min={4}
                    max={64}
                    unit="px"
                    presets={PIXEL_SIZE_PRESETS}
                  />
                )}

                {settings.blurMode === "solid" && (
                  <ColorSwatchGrid
                    colors={TEXT_COLORS}
                    value={settings.redactColor ?? "#000000"}
                    onChange={(color) => onChange({ ...settings, redactColor: color })}
                  />
                )}
              </>
            );

          case "pen":
            return (
              <>
                <SizeSlider
                  label="Stroke Width"
                  value={settings.strokeWidth}
                  min={1}
                  max={40}
                  onChange={(v) => onChange({ ...settings, strokeWidth: v })}
                  presets={PEN_WIDTH_PRESETS}
                />

                <ColorSwatchGrid
                  colors={TEXT_COLORS}
                  value={settings.strokeColor}
                  onChange={(color) => onChange({ ...settings, strokeColor: color })}
                />

                {/* Background — fills the closed path's interior (under the stroke). */}
                <div className="space-y-2">
                  <label className="text-2xs text-theme-muted-foreground">
                    Background
                  </label>
                  <ToolButtonGroup
                    options={[
                      { id: "none", label: "None" },
                      { id: "solid", label: "Solid" },
                    ]}
                    value={settings.fillMode === "none" ? "none" : "solid"}
                    onChange={(id) =>
                      onChange({ ...settings, fillMode: id as ToolSettings["fillMode"] })
                    }
                  />
                  {settings.fillMode !== "none" && (
                    <ColorSwatchGrid
                      colors={TEXT_COLORS}
                      value={settings.fillColor}
                      onChange={(color) => onChange({ ...settings, fillColor: color })}
                    />
                  )}
                </div>
              </>
            );

          case "erase":
            return (
              <>
                <SizeSlider
                  label="Brush Size"
                  value={settings.eraserSize}
                  min={1}
                  max={100}
                  onChange={(v) => onChange({ ...settings, eraserSize: v })}
                  presets={ERASER_SIZE_PRESETS}
                />

                <SizeSlider
                  label="Opacity"
                  value={settings.eraserOpacity}
                  onChange={(v) => onChange({ ...settings, eraserOpacity: v })}
                  presets={OPACITY_PRESETS}
                  variant="numbers"
                  unit="%"
                />

                <SizeSlider
                  label="Hardness"
                  value={settings.eraserHardness}
                  onChange={(v) => onChange({ ...settings, eraserHardness: v })}
                  presets={HARDNESS_PRESETS}
                  variant="numbers"
                  unit="%"
                />
              </>
            );
        }
      }}
    </ToolModeToggle>
  );
}
