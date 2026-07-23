import { Frame, Image as ImageIcon } from "lucide-react";
import { SizeSlider } from "@/components/SizeSlider";
import { ColorSwatchGrid } from "@/components/ColorSwatchGrid";
import { ToggleButtonGroup } from "@/components/ui/toggle-button-group";
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
 *   done in Rust (`set_artboard_border`); this only picks the color.
 * - Canvas background on export and copy to clipboard
 *   (`exportCanvasBackground`) — whether the backing canvas is baked into
 *   downloads/shares/copies, or left out (the default). The crop-to-content
 *   compositing is Rust-side (`get_image_data_excluding_background`);
 *   selection copies use `copy_region_composited`, which takes the same flag
 *   without tight-cropping (its rect is in document coordinates).
 */
interface LayersCanvasPaneProps {
  /** The draft being edited (owned by the Settings modal). */
  value: Preferences;
  /** Patch the draft; the Settings footer's Apply commits it. */
  onChange: (patch: Partial<Preferences>) => void;
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
}: LayersCanvasPaneProps) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Importing: Canvas on every new image or background
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

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Exporting: Export Canvas as a background (copy canvas to clipboard)
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            The backing canvas above (“Canvas + photo”) is a compositional
            guide. “Photo only” leaves it out of downloads, shares, and
            copies — the default. “Include canvas” bakes the full padded
            backing into the exported image too. This applies to copying a
            selection as well as the whole canvas.
          </p>
        </div>
        <ToggleButtonGroup
          fill
          items={[
            {
              key: "photo-only",
              icon: ImageIcon,
              label: "Photo only",
              active: !value.exportCanvasBackground,
              onToggle: () => onChange({ exportCanvasBackground: false }),
            },
            {
              key: "with-canvas",
              icon: Frame,
              label: "Include canvas",
              active: value.exportCanvasBackground,
              onToggle: () => onChange({ exportCanvasBackground: true }),
            },
          ]}
        />
      </section>
    </div>
  );
}
