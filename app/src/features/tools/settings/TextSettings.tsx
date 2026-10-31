import { useState } from "react";
import type { MutableRefObject } from "react";
import { Type, PaintBucket, ScanText, Lock, Copy } from "lucide-react";
import type { ImageHorseTool } from "stamp_tool";
import type { ToolSettings } from "@/lib/types";
import { TEXT_COLORS } from "@/lib/colors";
import { SizeSlider } from "@/components/ui/size-slider";
import { ColorSwatchGrid } from "@/components/ColorSwatchGrid";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import type { ToolMode } from "@/components/ui/tool-mode-toggle";
import { SectionHeader } from "@/components/ui/section-header";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { PlacementGrid, type PlacementCell } from "@/components/PlacementGrid";
import { Spinner } from "@/components/ui/spinner";
import { useAIJob } from "@/hooks/useAIJob";
import { useToolStore } from "@/stores/useToolStore";
import type { TextMode } from "@/stores/useToolStore";
import { faceCss } from "@/lib/engineFonts";
import { useEngineFaces } from "@/hooks/useEngineFaces";
import { useUIStore } from "@/stores/useUIStore";
import { OnlineFeaturesOffNotice } from "@/components/OnlineFeaturesOffNotice";
import { SelectField } from "@/components/ui/select-field";
import { ErrorNote } from "@/components/ui/status-note";
import { Button } from "@/components/ui/button";
import { ControlRow } from "@/components/ui/control-row";
import { ToolPanel } from "@/components/ui/tool-panel";

/**
 * ⚠️ THIS LIST IS ONLY EVER THE FACES THE ENGINE CAN ACTUALLY RENDER.
 *
 * The twelve-entry list this replaces — Georgia, Impact, Comic Sans… — was
 * inert for the whole of its life: text is rasterised inside the engine
 * (`src/text.rs`, ab_glyph), `render_text` took no font parameter, and picking
 * a family changed the textarea's glyphs and nothing else. On commit the text
 * snapped back to Liberation Sans. #113 cut it to one entry rather than leave a
 * control that teaches people a feature works when it does not.
 *
 * The engine takes a `font_id` now, so the list is real again — and it is built
 * from `has_font`, not from a hardcoded array, so it can only ever offer a face
 * whose bytes the engine has. That is the rule that keeps this honest: a face
 * that failed to load is absent rather than broken, and there is no state in
 * which picking an entry here does not move the pixels.
 *
 * It is also why the list is loaded in an effect rather than rendered from
 * `ENGINE_FACES` directly — see `ensureEngineFonts` on why measuring a face
 * before it is registered poisons the metrics cache.
 */

const FONT_SIZE_PRESETS = [16, 32, 48, 72] as const;

const SHADOW_MODE_OPTIONS = [
  { id: "off", label: "Off" },
  { id: "box", label: "Box" },
  { id: "text", label: "Text" },
  { id: "both", label: "Both" },
] as const;

// Text stroke width, px. The engine clamps to the same 20
// (`annotations::MAX_TEXT_STROKE_WIDTH`), so the slider can't ask for more
// than gets drawn.
// A plain slider rather than the preset steps Shape's Stroke Width uses: a
// preset track cannot reach 0, and 0 is how the stroke is turned off.
const TEXT_STROKE_MAX = 20;

const BG_KIND_OPTIONS = [
  { id: "none", label: "None" },
  { id: "rect", label: "Text BG" },
  { id: "bubble", label: "Bubble" },
] as const;

// Corner style as three presets instead of a free slider. Discrete radii keep
// the bubble-tail geometry simple/flush (see Rust `build_annotation_tile`):
// Square = sharp, Rounded = fixed radius, Circle = pill (Rust/CSS clamp the
// large value to half the shorter side).
type CornerId = "circle" | "rounded" | "square";
const BG_CORNER_OPTIONS = [
  { id: "circle", label: "Circle" },
  { id: "rounded", label: "Rounded" },
  { id: "square", label: "Square" },
] as const;
const CORNER_RADIUS: Record<CornerId, number> = {
  square: 0,
  rounded: 16,
  circle: 999, // pill sentinel — clamped to min(w,h)/2 when rendered
};
const cornerIdFromRadius = (r: number): CornerId =>
  r <= 0 ? "square" : r >= 200 ? "circle" : "rounded";

export interface TextMemory {
  id: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: "normal" | "bold";
  textColor: string;
}

/** The mode tiles the hoisted SubtoolRow renders for this tool. Kept here (not
 *  moved to toolModes.ts) because the `info` strings are this panel's
 *  lightbulb copy; toolModes.ts LEGACY_SUBMODES carries the palette's own
 *  thin projection of the same three ids. */
const MODE_OPTIONS: readonly ToolMode<TextMode>[] = [
  {
    id: "text",
    label: "Text",
    icon: Type,
    info: "Font, weight and color for the text itself.",
  },
  {
    id: "background",
    label: "Background",
    icon: PaintBucket,
    info: "A fill behind the text — plain box or speech bubble, with padding and corners — plus a stroke around the letters and a drop shadow.",
  },
  {
    id: "ocr",
    label: "OCR",
    icon: ScanText,
    info: "Read the text out of the photo (Replicate-backed) — extract, then copy it.",
  },
];

interface TextSettingsProps {
  settings: ToolSettings;
  onChange: (s: ToolSettings) => void;
  /** Place the selected text into one of the nine grid cells. */
  onPlace?: (cell: PlacementCell) => void;
  /** A text is selected (created & selected / clicked / Reselect) → grid enabled. */
  canPlace?: boolean;
  /** OCR tab — same Replicate + Convex pipeline as the AI tool's Background
   *  Removal / Object Removal, just its own dedicated job instance (moved
   *  from AISettings.tsx: OCR is text-shaped, not image-shaped). */
  aiEnabled?: boolean;
  activePhotoId: string | null;
  stampToolRef: MutableRefObject<ImageHorseTool | null>;
}

export function TextSettings({
  settings,
  onChange,
  onPlace,
  canPlace = false,
  aiEnabled = false,
  activePhotoId,
  stampToolRef,
}: TextSettingsProps) {
  // Only faces the ENGINE reports it can render — never `ENGINE_FACES`
  // directly. `useEngineFaces` has the two reasons why.
  const faces = useEngineFaces(stampToolRef);

  // Store-backed, not local state: the hoisted SubtoolRow, the command palette
  // and hash routing all read this mode through toolModes.ts. While it was a
  // `useState` here none of the three could see it.
  const mode = useToolStore((s) => s.textMode);

  // OCR's own job instance — never runs an image model, so onImageResult is
  // genuinely a no-op here (useAIJob only calls it for rembg/upscale/inpaint;
  // text models surface solely through the returned textResult).
  const { run: runOcr, phase: ocrPhase, busy: ocrBusy, error: ocrError, textResult: ocrText } =
    useAIJob(() => {});
  // The photo the last OCR ran on. The panel stays mounted across photo
  // switches, so without this the next photo showed the last one's text.
  const [ocrPhotoId, setOcrPhotoId] = useState<string | null>(null);
  const textResult = ocrPhotoId === activePhotoId ? ocrText : null;
  const [copied, setCopied] = useState(false);
  // OCR uploads the image — not offered while "Everything in your browser" is
  // on (useAIJob refuses it too).
  const onlineFeaturesEnabled = useUIStore((s) => s.onlineFeaturesEnabled);
  // Signed in, tier not answered yet: say nothing about plans until it is
  // (app/session/useUserMode.ts). The button stays off — not yet, not "no".
  const tierPending = useUIStore((s) => s.tierPending);
  const canRunOcr =
    aiEnabled && onlineFeaturesEnabled && !!activePhotoId && !!stampToolRef.current;

  const runOcrJob = async () => {
    const tool = stampToolRef.current;
    if (!tool || !activePhotoId) return;
    const png = new Uint8Array(await tool.export_png());
    setCopied(false);
    setOcrPhotoId(activePhotoId);
    void runOcr("ocr", activePhotoId, png);
  };

  const copyOcrText = async () => {
    if (!textResult) return;
    try {
      await navigator.clipboard.writeText(textResult);
      setCopied(true);
    } catch {
      /* clipboard blocked - no-op */
    }
  };

  const activeModeInfo = MODE_OPTIONS.find((opt) => opt.id === mode);
  const shadowMode =
    settings.shadowBox && settings.shadowText
      ? "both"
      : settings.shadowBox
        ? "box"
        : settings.shadowText
          ? "text"
          : "off";

  return (
    // The mode tiles moved to the ToolsSidebar header (SubtoolRow); `-mt-2`
    // went with them — it only existed to tuck that row under the panel's top
    // padding, and without it the title would ride too high.
    <ToolPanel data-text-panel>
    {activeModeInfo && (
      <SectionHeader title={activeModeInfo.label} info={activeModeInfo.info} />
    )}
    {(() => {
      const m = mode;
      return (
        <>
        {m === "text" && (
          <div className="space-y-4">
            {/* Font Size */}
            <SizeSlider
              label="Font Size"
              value={settings.fontSize}
              min={8}
              max={120}
              onChange={(v) => onChange({ ...settings, fontSize: v })}
              presets={FONT_SIZE_PRESETS}
              variant="numbers"
            />

            {/* Font Family — real, and only as long as the list is. See above. */}
            <ControlRow
              label="Font Family"
              info={
                <>
                  Text is drawn by the engine, not the browser. These faces
                  ship with the app and are handed to the engine as font
                  files, so what you type is what gets committed — the
                  preview, the box it sits in and the exported pixels are
                  all the same typeface. Nothing is fetched from Google.
                </>
              }
            >
              {({ labelId }) => (
                <SelectField
                  aria-labelledby={labelId}
                  value={settings.textFontId ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...settings,
                      textFontId: e.target.value,
                      // `fontFamily` follows the id rather than being picked
                      // independently — one of the three surfaces ADR-051
                      // found disagreeing was exactly this one drifting.
                      fontFamily: faceCss(e.target.value),
                    })
                  }
                  style={{ fontFamily: faceCss(settings.textFontId ?? "") }}
                >
                  {faces.map((f) => (
                    <option key={f.id} value={f.id} style={{ fontFamily: f.css }}>
                      {f.label}
                    </option>
                  ))}
                </SelectField>
              )}
            </ControlRow>

            {/* Font Weight */}
            <ControlRow label="Font Weight">
              {({ labelId }) => (
                <ToolButtonGroup
                  aria-labelledby={labelId}
                  options={[
                    { id: "normal", label: "Normal" },
                    { id: "bold", label: "Bold" },
                  ] as const}
                  value={settings.fontWeight ?? "normal"}
                  onChange={(id) => onChange({ ...settings, fontWeight: id })}
                />
              )}
            </ControlRow>

            {/* Color */}
            <ColorSwatchGrid
              colors={TEXT_COLORS}
              value={settings.textColor}
              onChange={(color) => onChange({ ...settings, textColor: color })}
            />
          </div>
        )}

        {/* Background, stroke and drop shadow — each its own dropdown.
            Rendered for the TEXT mode too, immediately after the Color swatch
            above — the plate behind a caption is part of styling that caption,
            and hiding it behind a second mode meant you had to leave the text
            you were editing to reach it. `background` keeps its own mode so the
            existing toggle, route and palette entry all still land somewhere.

            Collapsed by default in the Text mode (Chris, 10-31-2026: "it's
            just so much stuff on here"), open in the Background mode, where
            they are the whole point. `key={m}` re-mounts them on a mode
            switch so that default actually applies. The summary on the right
            of each header keeps a setting that is ON visible while shut. */}
        {(m === "text" || m === "background") && (
          <>
            <CollapsibleSection
              key={`bg-${m}`}
              label="Background"
              defaultOpen={m === "background"}
              summary={BG_KIND_OPTIONS.find((o) => o.id === settings.bgKind)?.label}
              info="A fill behind the text — a plain box or a speech bubble, with its own color, padding, corners and opacity."
            >
              {/* Style toggle */}
              <ControlRow label="Style">
                {({ labelId }) => (
                  <ToolButtonGroup
                    aria-labelledby={labelId}
                    options={BG_KIND_OPTIONS}
                    value={settings.bgKind}
                    onChange={(id) => onChange({ ...settings, bgKind: id })}
                    columns={3}
                  />
                )}
              </ControlRow>

              {settings.bgKind !== "none" && (
                <>
                  {/* Background color */}
                  <ColorSwatchGrid
                    label="Background Color"
                    colors={TEXT_COLORS}
                    value={settings.bgColor}
                    onChange={(color) => onChange({ ...settings, bgColor: color })}
                  />

                  {/* Padding */}
                  <SizeSlider
                    label="Padding"
                    value={settings.bgPadding}
                    min={0}
                    max={40}
                    unit="px"
                    onChange={(v) => onChange({ ...settings, bgPadding: v })}
                  />

                  {/* Corner style — three presets, for both Text BG and Bubble. */}
                  <ControlRow label="Corners">
                    {({ labelId }) => (
                      <ToolButtonGroup
                        aria-labelledby={labelId}
                        options={BG_CORNER_OPTIONS}
                        value={cornerIdFromRadius(settings.bgCornerRadius)}
                        onChange={(id) =>
                          onChange({ ...settings, bgCornerRadius: CORNER_RADIUS[id] })
                        }
                        columns={3}
                      />
                    )}
                  </ControlRow>

                  {/* Tail direction — bubble only. Angle in degrees (0-359):
                      the slider sweeps the tail all the way around the bubble. */}
                  {settings.bgKind === "bubble" && (
                    <SizeSlider
                      label="Tail Direction"
                      value={settings.bgTail}
                      min={0}
                      max={359}
                      unit="°"
                      onChange={(v) => onChange({ ...settings, bgTail: v })}
                    />
                  )}

                  {/* Opacity */}
                  <SizeSlider
                    label="Opacity"
                    value={settings.bgOpacity}
                    min={0}
                    max={100}
                    unit="%"
                    onChange={(v) => onChange({ ...settings, bgOpacity: v })}
                  />
                </>
              )}
            </CollapsibleSection>

            {/* Stroke — an outline around the letters, the text twin of a
                shape's stroke. Engine-drawn OUTSIDE the glyphs (so it never
                thins the type) by `outline_glyphs` in src/layer.rs. Width 0
                is off; that is the default and what every older text means. */}
            <CollapsibleSection
              key={`stroke-${m}`}
              label="Stroke"
              defaultOpen={m === "background"}
              summary={settings.textStrokeWidth > 0 ? `${settings.textStrokeWidth} px` : "Off"}
              info="An outline around the letters themselves. Drawn outside the glyphs, so a thick stroke never makes the type thinner."
            >
              <SizeSlider
                label="Stroke Width"
                value={settings.textStrokeWidth}
                min={0}
                max={TEXT_STROKE_MAX}
                unit="px"
                onChange={(v) => onChange({ ...settings, textStrokeWidth: v })}
              />
              {settings.textStrokeWidth > 0 && (
                <>
                  <ColorSwatchGrid
                    label="Stroke Color"
                    colors={TEXT_COLORS}
                    value={settings.textStrokeColor}
                    onChange={(color) => onChange({ ...settings, textStrokeColor: color })}
                  />
                  <SizeSlider
                    label="Stroke Opacity"
                    value={settings.textStrokeOpacity}
                    min={0}
                    max={100}
                    unit="%"
                    onChange={(v) => onChange({ ...settings, textStrokeOpacity: v })}
                  />
                </>
              )}
            </CollapsibleSection>

            {/* Drop shadow — soft, Rust-rendered. With a background, "Box" casts
                from the box/bubble and "Text" from the glyphs. With Background =
                None there's no box, so any shadow (Box/Text/Both) casts from the
                text silhouette — "Box" still produces a visible shadow. */}
            <CollapsibleSection
              key={`shadow-${m}`}
              label="Drop Shadow"
              defaultOpen={m === "background"}
              summary={SHADOW_MODE_OPTIONS.find((o) => o.id === shadowMode)?.label}
              info="A soft shadow cast from the box, the text, or both — with its own color, opacity, offset and blur."
            >
              <ControlRow label="Cast From">
                {({ labelId }) => (
                  <ToolButtonGroup
                    aria-labelledby={labelId}
                    options={SHADOW_MODE_OPTIONS}
                    value={shadowMode}
                    onChange={(id) =>
                      onChange({
                        ...settings,
                        shadowBox: id === "box" || id === "both",
                        shadowText: id === "text" || id === "both",
                      })
                    }
                    columns={4}
                  />
                )}
              </ControlRow>

              {(settings.shadowBox || settings.shadowText) && (
                <>
                  <ColorSwatchGrid
                    label="Shadow Color"
                    colors={TEXT_COLORS}
                    value={settings.shadowColor}
                    onChange={(color) =>
                      onChange({ ...settings, shadowColor: color })
                    }
                  />
                  <SizeSlider
                    label="Shadow Opacity"
                    value={settings.shadowOpacity}
                    min={0}
                    max={100}
                    unit="%"
                    onChange={(v) => onChange({ ...settings, shadowOpacity: v })}
                  />
                  <SizeSlider
                    label="Offset X"
                    value={settings.shadowOffsetX}
                    min={-20}
                    max={20}
                    unit="px"
                    onChange={(v) => onChange({ ...settings, shadowOffsetX: v })}
                  />
                  <SizeSlider
                    label="Offset Y"
                    value={settings.shadowOffsetY}
                    min={-20}
                    max={20}
                    unit="px"
                    onChange={(v) => onChange({ ...settings, shadowOffsetY: v })}
                  />
                  <SizeSlider
                    label="Blur"
                    value={settings.shadowBlur}
                    min={0}
                    max={30}
                    unit="px"
                    onChange={(v) => onChange({ ...settings, shadowBlur: v })}
                  />
                </>
              )}
            </CollapsibleSection>
          </>
        )}

        {m === "ocr" && (
          <div className="space-y-4">
            {!onlineFeaturesEnabled && (
              <OnlineFeaturesOffNotice what="OCR sends the image to a server to read the text." />
            )}
            {onlineFeaturesEnabled && !aiEnabled && !tierPending && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
                <Lock className="h-4 w-4 shrink-0 text-warning mt-0.5" />
                <p className="text-2xs text-warning/90">
                  OCR needs <strong>sign-in</strong> + a <strong>Paid</strong> plan.
                </p>
              </div>
            )}
            {/* ui/button, not the purple hand-rolled one it was: purple is in
                no theme token, and AISettings retired the same pair for the
                same reason (they "read as a different app"). */}
            <Button
              size="large"
              onClick={runOcrJob}
              disabled={!canRunOcr || ocrBusy}
              className="w-full"
            >
              {!aiEnabled && !tierPending && <Lock className="h-3.5 w-3.5" />}
              {ocrBusy && <Spinner size={14} />}
              {ocrPhase === "uploading"
                ? "Uploading..."
                : ocrPhase === "running"
                  ? "Reading text..."
                  : "Extract Text"}
            </Button>
            {ocrError && (
              <ErrorNote>{ocrError}</ErrorNote>
            )}
            {ocrPhase === "done" && !ocrError && (
              <div>
                {textResult && textResult.trim() ? (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-2xs text-theme-muted-foreground">
                        Extracted text
                      </span>
                      <Button
                        variant="ghost"
                        onClick={copyOcrText}
                        className="gap-1 px-1 py-0 text-2xs"
                      >
                        <Copy className="h-3 w-3" />
                        {copied ? "Copied" : "Copy"}
                      </Button>
                      {/* Always mounted, so the change is what gets announced:
                          the label flip alone is not heard after the click. */}
                      <span role="status" className="sr-only">
                        {copied ? "Copied to clipboard" : ""}
                      </span>
                    </div>
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-black/20 border border-theme-sidebar-border p-2 text-2xs text-theme-foreground leading-relaxed">
                      {textResult}
                    </pre>
                  </>
                ) : (
                  <p className="text-2xs text-theme-muted-foreground">No text detected.</p>
                )}
              </div>
            )}
          </div>
        )}
        </>
      );
    })()}

    {/* Placement only applies to the Text mode — Background/OCR aren't
        placing a new object on the canvas. Collapsed under "Placement" since
        09-30-2026; see the note in ShapeSettings. */}
    {mode === "text" && onPlace && (
      <CollapsibleSection
        label="Placement"
        info={
            canPlace
              ? "Numpad 1-9 also work, spatially matched to the grid."
              : "Select a text to place it on the canvas."
        }
      >
        <PlacementGrid
          disabled={!canPlace}
          numpadKeys={canPlace}
          onChange={onPlace}
        />
      </CollapsibleSection>
    )}
    </ToolPanel>
  );
}
