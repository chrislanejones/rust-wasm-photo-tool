import {
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Crop,
  Maximize,
  Pipette,
  Square,
  RectangleHorizontal,
  RectangleVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionTile } from "@/components/ui/action-tile";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import { SectionHeader } from "@/components/ui/section-header";
import { ReselectBar } from "@/components/ui/reselect-bar";
import { useToolStore } from "@/stores/useToolStore";
import { cn } from "@/lib/utils";
import type { CropSelection } from "@/hooks/useDrawingTools";

/* ── Aspect-ratio presets ─────────────────────────────────────────────
 * "free" leaves the user dragging without constraint; everything else
 * triggers a centered crop selection computed in Rust via the
 * `compute_aspect_crop` WASM export AND locks subsequent drags to that
 * ratio via `constrain_crop_to_ratio`.
 */
type RatioId =
  | "free"
  | "1:1"
  | "4:3"
  | "3:2"
  | "16:9"
  | "9:16";

const RATIO_OPTIONS: { id: RatioId; label: string; icon: typeof Square }[] = [
  { id: "free", label: "Free", icon: Maximize },
  { id: "1:1", label: "1:1", icon: Square },
  { id: "4:3", label: "4:3", icon: RectangleHorizontal },
  { id: "3:2", label: "3:2", icon: RectangleHorizontal },
  { id: "16:9", label: "16:9", icon: RectangleHorizontal },
  { id: "9:16", label: "9:16", icon: RectangleVertical },
];

const RATIO_DIMS: Record<Exclude<RatioId, "free">, [number, number]> = {
  "1:1": [1, 1],
  "4:3": [4, 3],
  "3:2": [3, 2],
  "16:9": [16, 9],
  "9:16": [9, 16],
};

function ratioIdFromLock(lock: [number, number] | null): RatioId {
  if (!lock) return "free";
  for (const [id, [w, h]] of Object.entries(RATIO_DIMS) as [
    Exclude<RatioId, "free">,
    [number, number],
  ][]) {
    if (lock[0] === w && lock[1] === h) return id;
  }
  return "free";
}

/* ── Main component ──────────────────────────────────────────────────── */

interface TransformCropSettingsProps {
  disabled: boolean;
  onFlipH: () => void;
  onFlipV: () => void;
  onRotate90Cw: () => void;
  onApplyCrop?: () => void;
  imageWidth: number;
  imageHeight: number;
  onSetCropSelection?: (sel: CropSelection | null) => void;
  /** Currently-locked aspect ratio as `[w, h]`. `null` = Free. */
  cropRatio: [number, number] | null;
  onCropRatioChange: (lock: [number, number] | null) => void;
  /** Color Picker (bottom of the panel) — Alt+Click-style eyedropper that
   *  magnifies + samples a canvas pixel into the brush/text color. */
  colorPickerActive?: boolean;
  onSetColorPickerActive?: (active: boolean) => void;
  /** Currently-selected color to preview in the swatch (falls back to a
   *  neutral color if the caller hasn't picked one yet). */
  pickedColor?: string;
  /** Which section to render. The Edit group gives Crop, Transform and Color
   *  Picker each their own sub-tool tile, so each shows ONLY its own section
   *  rather than the whole panel three times over.
   *
   *  Omitted renders all three, stacked with separators — the pre-restructure
   *  behaviour, kept so any other caller is unaffected. */
  section?: "crop" | "transform" | "colorPicker";
  /** Re-apply a colour from the picker history (sets brush + text colour, the
   *  same two fields a fresh pick writes). */
  onPickColor?: (hex: string) => void;
}

export function TransformCropSettings({
  disabled,
  onFlipH,
  onFlipV,
  onRotate90Cw,
  onApplyCrop,
  imageWidth,
  imageHeight,
  onSetCropSelection,
  cropRatio,
  onCropRatioChange,
  colorPickerActive = false,
  onSetColorPickerActive,
  pickedColor,
  section,
  onPickColor,
}: TransformCropSettingsProps) {
  const pickedColorHistory = useToolStore((s) => s.pickedColorHistory);
  const removePickedColor = useToolStore((s) => s.removePickedColor);
  const clearPickedColors = useToolStore((s) => s.clearPickedColors);
  /** Render this section? All of them when unscoped. */
  const show = (s: NonNullable<TransformCropSettingsProps["section"]>) =>
    section === undefined || section === s;
  /** The separator rule only earns its keep when sections are stacked; scoped
   *  to one section it would be a hairline above nothing. */
  const sep = section === undefined ? "pt-3 border-t border-theme-sidebar-border" : "";
  const ratio = ratioIdFromLock(cropRatio);
  const displayColor = pickedColor ?? "#000000";

  const handleRatioChange = async (id: RatioId) => {
    if (id === "free") {
      onCropRatioChange(null);
      onSetCropSelection?.(null);
      return;
    }
    const [rw, rh] = RATIO_DIMS[id];
    onCropRatioChange([rw, rh]);
    if (!imageWidth || !imageHeight || !onSetCropSelection) return;
    // Delegate the centred-crop math to Rust so it stays consistent with
    // the drag-snap math driven by `constrain_crop_to_ratio`.
    const mod = await import("stamp_tool");
    await mod.default();
    const out = mod.compute_aspect_crop(imageWidth, imageHeight, rw, rh);
    if (!out || out.length !== 4) return;
    const [x, y, w, h] = out;
    onSetCropSelection({ x, y, width: w, height: h });
  };

  // Single-mode again: the Select half split into its own tool, so the
  // ToolModeToggle wrapper (and its AdjustBody closure) went with it — this
  // is the tool's original Adjust content, returned directly.
  return (
    <div className="space-y-6">
      {/* ── Crop (first; no verbiage — just the ratio + apply) ───────────── */}
      {show("crop") && onApplyCrop && (
        <div className="space-y-3 -mt-2">
          <SectionHeader
            title="Crop"
            info={
              <>
                Pick a ratio (or Free), drag the crop box on the canvas, then
                Apply Crop to bake it in. Drags snap to the locked ratio when
                one is set.
              </>
            }
          />

          <ToolButtonGroup
            stacked
            label="Ratio"
            options={RATIO_OPTIONS}
            value={ratio}
            onChange={(id) => void handleRatioChange(id)}
            columns={3}
          />

          {ratio !== "free" && (
            <div className="flex justify-center gap-2 px-3 py-4 rounded-lg text-xs full-width-badge type-current">
              <span className="large-badge">
                Locked to {ratio} — drags snap to this ratio
              </span>
            </div>
          )}

          <Button size="large"
            className="w-full"
            disabled={disabled}
            onClick={onApplyCrop}
          >
            <Crop className="h-4 w-4" /> Apply Crop
          </Button>
        </div>
      )}

      {/* ── Transform ───────────────────────────────────────────────────── */}
      {show("transform") && (
      <div className={cn("space-y-2", sep)}>
        <SectionHeader
          title="Transform"
          info={
            <>
              Flip or rotate the active layer in place. Rotate −90° is three
              90° turns, so undo steps back one quarter-turn at a time.
            </>
          }
        />
        <div className="grid grid-cols-2 gap-2 [grid-auto-rows:1fr]">
          <ActionTile
            icon={FlipHorizontal}
            label="Flip H"
            disabled={disabled}
            onClick={onFlipH}
          />
          <ActionTile
            icon={FlipVertical}
            label="Flip V"
            disabled={disabled}
            onClick={onFlipV}
          />
          <ActionTile
            icon={RotateCw}
            label="Rotate 90°"
            disabled={disabled}
            onClick={onRotate90Cw}
          />
          <ActionTile
            icon={RotateCcw}
            label="Rotate −90°"
            disabled={disabled}
            onClick={() => {
              onRotate90Cw();
              onRotate90Cw();
              onRotate90Cw();
            }}
          />
        </div>
      </div>
      )}

      {/* ── Color Picker ────────────────────────────────────────────────── */}
      {show("colorPicker") && onSetColorPickerActive && (
        <div className={cn("space-y-3", sep)}>
          <SectionHeader
            title="Color Picker"
            info="Click the eyedropper to activate, then hover over the image to magnify pixels. Click to pick a color — it will be set as your brush and text color."
          />

          <Button size="large"
            className={cn(
              "w-full",
              colorPickerActive &&
                "bg-theme-primary text-theme-primary-foreground border-theme-primary ring-2 ring-theme-primary/40 hover:brightness-100",
            )}
            disabled={disabled}
            onClick={() => onSetColorPickerActive(!colorPickerActive)}
          >
            <Pipette className="h-4 w-4" />
            {colorPickerActive ? "Click image to pick" : "Activate Eyedropper"}
          </Button>

          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg border-2 border-theme-muted shrink-0"
              style={{ backgroundColor: displayColor }}
            />
            <div className="space-y-0.5">
              <span className="block text-sm font-mono text-theme-foreground uppercase">
                {displayColor}
              </span>
              <span className="block text-2xs text-theme-muted-foreground">
                brush &amp; text color
              </span>
            </div>
          </div>

          {colorPickerActive && (
            <div className="rounded-lg bg-theme-muted/50 px-3 py-2 text-2xs text-theme-muted-foreground leading-relaxed">
              A pixel magnifier follows your cursor over the canvas. Hover to
              preview, click to pick.
            </div>
          )}

          {/* ── Picked-colour history ──────────────────────────────────────
              Same UI vocabulary as the Guides list in LayerSettings: a
              `.history-list` of ReselectBar rows, click to re-apply, ✕ to
              forget. Reusing ReselectBar rather than rolling a swatch list
              means the two histories stay visually identical for free — its
              `label` takes a ReactNode, so the swatch rides along with the
              hex.

              SESSION-ONLY: `pickedColorHistory` is deliberately outside the
              store's persist allowlist, so this list empties on reload.
              Surviving a reload needs the dexie-migration procedure, not a
              one-line change. */}
          {pickedColorHistory.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-2xs font-semibold font-mono text-theme-muted-foreground">
                  Recent Colors
                </span>
                <button
                  type="button"
                  className="text-2xs text-theme-muted-foreground hover:text-theme-foreground underline underline-offset-2"
                  onClick={clearPickedColors}
                >
                  Clear
                </button>
              </div>
              <div className="history-list max-h-40">
                {pickedColorHistory.map((hex) => (
                  <ReselectBar
                    key={hex}
                    label={
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-3.5 w-3.5 rounded border border-theme-muted shrink-0"
                          style={{ backgroundColor: hex }}
                        />
                        <span className="font-mono uppercase">{hex}</span>
                      </span>
                    }
                    selected={hex.toUpperCase() === displayColor.toUpperCase()}
                    disabled={disabled}
                    onSelect={() => onPickColor?.(hex)}
                    onDelete={() => removePickedColor(hex)}
                    title="Re-apply this color"
                    deleteLabel="Forget this color"
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
