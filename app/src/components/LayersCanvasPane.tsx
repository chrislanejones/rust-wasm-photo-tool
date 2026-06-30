import { Frame, Image as ImageIcon } from "lucide-react";
import { SizeSlider } from "@/components/SizeSlider";
import { ColorSwatchGrid } from "@/components/ColorSwatchGrid";
import { ToggleButtonGroup } from "@/components/ui/toggle-button-group";
import { CanvasResize } from "@/components/CanvasResize";
import type { Preferences } from "@/lib/preferences";

/**
 * Settings → Layers and Canvas pane. Controls how a freshly-imported photo lands
 * on the document, persisted via `lib/preferences.ts` (`usePreferences`,
 * localStorage key `image-horse-prefs`):
 * - Canvas on import — "Canvas + photo" (Photoshop-style two-layer artboard,
 *   `canvasArtboard`) vs. "Photo only" (classic single full-bleed layer).
 * - Canvas border — the per-side padding (`canvasPadding`) added around the
 *   photo when the artboard is on.
 * - Backing canvas color — the Background layer's fill (`canvasBgColor`); the
 *   first swatch is the transparent/checkerboard default. The fill itself is
 *   done in Rust (`load_image_artboard`); this only picks the color.
 */
interface LayersCanvasPaneProps {
  /** The draft being edited (owned by the Settings modal). */
  value: Preferences;
  /** Patch the draft; the Settings footer's Apply commits it. */
  onChange: (patch: Partial<Preferences>) => void;
  /** Current canvas (image) dimensions for the W×H Canvas Size control. */
  canvasWidth?: number;
  canvasHeight?: number;
  /** Photoshop-style Canvas Size apply (Rust `resize_canvas`, non-resampling).
   *  Applies immediately (not part of the Settings draft/Apply cycle). When
   *  omitted (no image loaded), the Canvas Size control is hidden. */
  onResizeCanvas?: (w: number, h: number) => void;
}

// First entry is the transparent/checkerboard backing (the default), followed by
// a few neutral solid fills. `ColorSwatchGrid` renders these and tracks the
// active one against `value.canvasBgColor`.
const BACKING_COLORS: string[] = [
  "transparent",
  "#ffffff",
  "#d4d4d4",
  "#737373",
  "#000000",
];

export function LayersCanvasPane({
  value,
  onChange,
  canvasWidth,
  canvasHeight,
  onResizeCanvas,
}: LayersCanvasPaneProps) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Canvas on import
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            How a freshly-opened photo lands. “Canvas + photo” places the image
            on a slightly larger backing canvas as two layers (a Background and
            the Photo on top), Photoshop-style. “Photo only” keeps the classic
            single full-bleed layer at the exact photo size. Applies to new
            imports.
          </p>
        </div>
        <ToggleButtonGroup
          fill
          items={[
            {
              key: "artboard",
              icon: Frame,
              label: "Canvas + photo",
              active: value.canvasArtboard,
              onToggle: () => onChange({ canvasArtboard: true }),
            },
            {
              key: "photo",
              icon: ImageIcon,
              label: "Photo only",
              active: !value.canvasArtboard,
              onToggle: () => onChange({ canvasArtboard: false }),
            },
          ]}
        />
        {value.canvasArtboard && (
          <>
            <SizeSlider
              label="Canvas border"
              value={value.canvasPadding}
              onChange={(n) => onChange({ canvasPadding: n })}
              min={0}
              max={200}
              step={5}
              unit=" px"
            />
            <ColorSwatchGrid
              label="Backing canvas"
              colors={BACKING_COLORS}
              value={value.canvasBgColor}
              onChange={(canvasBgColor) => onChange({ canvasBgColor })}
              allowCustom={false}
            />
            <p className="text-2xs text-text-muted leading-relaxed">
              The Background layer’s fill. “Transparent” shows the checkerboard
              through the border.
            </p>
          </>
        )}
      </section>

      {/* ── Canvas size (the backing document) ───────────────────────────────
          Unlike the rest of this pane (which edits the Settings draft and
          commits on Apply), this applies immediately via Rust `resize_canvas`
          (non-resampling). Hidden until a photo is loaded. */}
      {onResizeCanvas && canvasWidth != null && canvasHeight != null && (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Canvas size
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              Resize the backing document of the current photo. Applies right
              away — it does not wait for the Apply button below.
            </p>
          </div>
          <CanvasResize
            width={canvasWidth}
            height={canvasHeight}
            onApply={onResizeCanvas}
          />
        </section>
      )}
    </div>
  );
}
