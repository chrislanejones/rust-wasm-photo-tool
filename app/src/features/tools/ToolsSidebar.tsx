// ===== FILE: app/src/features/tools/ToolsSidebar.tsx =====
// Item 7: "effects" replaces "blur" — includes brightness, contrast, blur
import { motion } from "framer-motion";
import { slideFromLeft } from "@/lib/animations";
import type { StampSettings as StampSettingsType, ToolSettings } from "@/lib/types";
import { useToolStore } from "@/stores/useToolStore";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useAnnotationStore } from "@/stores/useAnnotationStore";
import { useUIStore } from "@/stores/useUIStore";
import { useEngine, useEngineState, useSession } from "@/app/session/SessionContext";
import { LevelsSettings } from "./settings/LevelsSettings";
import { PresetsSettings } from "./settings/PresetsSettings";
import { ToolGrid } from "./ToolGrid";
import { SubtoolRow } from "./SubtoolRow";
import { useActiveSubTool } from "./activateSubTool";
import { StampSettingsPanel } from "./settings/StampSettings";
import { PanelCloseButton } from "@/components/ui/panel-close-button";
import { TransformCropSettings } from "./settings/TransformCropSettings";
import {
  LayerSettings,
  type LayerMaskControls,
  type LayerOverlayControls,
} from "./settings/LayerSettings";
import { SelectSettings } from "./settings/SelectSettings";
import { PerspectiveSettings } from "./settings/PerspectiveSettings";
import type { SelectionControls } from "./settings/SelectSettings";
import type { PlacementCell } from "@/components/PlacementGrid";
import { ResizeSettings } from "./settings/ResizeSettings";
import { EffectsSettings } from "./settings/EffectsSettings";
import { ShapesSettings } from "./settings/ShapeSettings";
import { BatchSettings } from "./settings/BatchSettings";
import { PaintSettings } from "./settings/PaintSettings";
import { TextSettings } from "./settings/TextSettings";
import { AISettings } from "./settings/AISettings";
import type { AIResultPixels } from "@/hooks/useAIJob";
import { RulersGridsPane } from "@/components/RulersGridsPane";
import type { Preferences } from "@/lib/preferences";
import { MASTER_BAR_CONTENT_BOX } from "@/components/master-bar/constants";

export interface ToolsSidebarProps {
  /** Live preferences for the Rulers panel (Edit → Rulers). Optional so every
   *  other embedding of this sidebar keeps working without them. */
  rulersPrefs?: Preferences;
  /** Patch preferences from the Rulers panel. */
  onRulersChange?: (patch: Partial<Preferences>) => void;

  onStampSettingsChange: (s: StampSettingsType) => void;
  /** Place the selected object into one of the nine grid cells (Text / Shape). */
  onPlace?: (cell: PlacementCell) => void;
  /** The Select tool's ACTIONS (useSelectionActions). The panel's values —
   *  tolerance, kind, edge threshold, whether a mask exists — are read from
   *  useToolStore here and merged in (B2). */
  selection: Pick<
    SelectionControls,
    "onSelectAll" | "onDeselect" | "onDelete" | "onNewLayerCopy" | "onNewLayerCut" | "onRemoveObject"
  >;
  onToggleMove?: () => void;
  /** Layer stack + selection + mask controls for the Layers panel (v8.38) —
   *  the same data/handlers ReviewPanel gets, one selection driving all. */
  /** The two mask handlers that are session decisions (useMaskActions);
   *  the store-backed editing/value and the engine's remove/apply/invert are
   *  read here and merged in (B2). */
  layerMask: Pick<LayerMaskControls, "onAdd" | "onToggleEdit">;
  /** Embedded mode: render the inner content as a plain flex column (no fixed
   *  positioning / panel chrome / slide animation) so it can fill the compact
   *  master bar's content area instead of floating as its own panel. */
  embedded?: boolean;
  /** Show the hover-reveal close in the top-left corner. Wide desktop layout
   *  only — AppShell passes false whenever the dock, the narrow drawers or the
   *  compact top bar are in play, where the chrome owns open/close instead. */
  closable?: boolean;
  /** Total photos in the gallery — drives the Compress panel's count. (It used
   *  to pluralize the Download footer's label too; Export moved to the bar.) */
  /** Apply Compression & Resize (w, h, Rust resampling-filter code). */
  onResize: (newW: number, newH: number, filter: number) => void;
  /** "Apply Resize" — resample only, no re-compression. See AppShell. */
  onResizeOnly: (newW: number, newH: number, filter: number) => void;
  /** Photoshop-style Canvas Size resize (no resample) — Layer Settings tool. */
  onResizeCanvas: (w: number, h: number) => void;
  /** Deletes the artboard's Background layer outright. */
  onRemoveCanvas: () => void;
  canRemoveCanvas: boolean;
  imageWidth: number;
  imageHeight: number;
  onQualityChange: (q: number) => void;
  onQualityCommit: (q: number) => void;
  compressProgress: { completed: number; total: number };
  onToolSettingsChange: (s: ToolSettings) => void;
  /** Re-apply a color from the Color Picker history. */
  onPickColor?: (hex: string) => void;
  /** Whether the current tier may use Replicate AI (Paid only). */
  aiEnabled?: boolean;
  /** Apply a finished AI image result (decoded RGBA) back to the canvas. */
  onAIResult: (r: AIResultPixels) => void;
}

export function ToolsSidebar({
  rulersPrefs,
  onRulersChange,
  onStampSettingsChange,
  onPlace,
  selection,
  onToggleMove,
  layerMask,
  embedded,
  closable,
  onResize,
  onResizeOnly,
  onResizeCanvas,
  onRemoveCanvas,
  canRemoveCanvas,
  imageWidth,
  imageHeight,
  onQualityChange,
  onQualityCommit,
  compressProgress,
  onToolSettingsChange,
  onPickColor,
  aiEnabled,
  onAIResult,
}: ToolsSidebarProps) {
  // React Compiler opt-in (vite.config.ts, annotation mode). The most props
  // of any component, none memoized — a parent render costs the most here.
  "use memo";
  // ⚠️ No `= false` defaults in the props destructure: babel-plugin-react-compiler
  // 1.0 fails to lower them (AssignmentPattern) and silently skips the whole
  // component. Every optional boolean here reads `undefined` as false anyway.
  // reactCompiler.contract.test.ts fails if this stops compiling.
  // B1 (docs/AppShell-Refactor-Plan.md): the engine and the tool hook
  // instances come from the session context, not 23 more props. Bound to the
  // names the props had so the panel wiring below is untouched. The panels
  // themselves still take these as props — their render tests mount them
  // without a provider, and B2 is where they read stores directly.
  const {
    flipHorizontal: onFlipH,
    flipVertical: onFlipV,
    rotate90Cw: onRotate90Cw,
    adjustBrightness: onBrightness,
    adjustContrast: onContrast,
    applyGlobalBlur: onGlobalBlur,
    adjustSaturation: onSaturation,
    adjustShadows: onShadows,
    adjustHighlights: onHighlights,
    adjustSharpen: onSharpen,
    levels,
    presets,
    setActiveLayer: onSelectLayer,
    setLayerColorOverlay,
    removeLayerColorOverlay,
    applyLayerColorOverlay,
    toolRef: stampToolRef,
    flushToCanvas,
    syncState,
  } = useEngine();
  const layerOverlay: LayerOverlayControls = {
    onSet: setLayerColorOverlay,
    onRemove: removeLayerColorOverlay,
    onApply: applyLayerColorOverlay,
  };
  const { layers, undoCount, ready: imageReady } = useEngineState();
  const { drawingTools, pastePlacement } = useSession();
  const { applyCrop: onApplyCrop, setCropSelection: onSetCropSelection } = drawingTools;
  const onResizeLayer = pastePlacement.beginLayerResize;
  // B2: values that already live in a store are read here with a selector
  // each — one key, one subscription — instead of arriving as props from a
  // parent that re-rendered for some other reason. The AppShell wrappers that
  // only called `set` are deleted, not moved; the two that did more
  // (onToolSettingsChange forwards to an open text input, onQualityChange
  // also dirties the photo) are still props.
  const activeTool = useToolStore((s) => s.activeTool);
  const toolSettings = useToolStore((s) => s.toolSettings);
  const setToolSettings = useToolStore((s) => s.setToolSettings);
  const stampSettings = useToolStore((s) => s.stampSettings);
  const exportFormat = useToolStore((s) => s.exportFormat);
  const onExportFormatChange = useToolStore((s) => s.setExportFormat);
  const quality = useToolStore((s) => s.quality);
  const cropRatio = useToolStore((s) => s.cropRatio);
  const onCropRatioChange = useToolStore((s) => s.setCropRatio);
  const brushMode = useToolStore((s) => s.brushMode);
  const onBrushModeChange = useToolStore((s) => s.setBrushMode);
  const colorPickerActive = useToolStore((s) => s.colorPickerActive);
  const onSetColorPickerActive = useToolStore((s) => s.setColorPickerActive);
  const shapesMode = useToolStore((s) => s.shapesMode);
  const onShapesModeChange = useToolStore((s) => s.setShapesMode);
  const stampSubMode = useToolStore((s) => s.stampSubMode);
  const onStampSubModeChange = useToolStore((s) => s.setStampSubMode);
  const moveActive = useToolStore((s) => s.moveActive);
  const pickedColor = toolSettings.brushColor;
  const stampEmoji = toolSettings.emoji;
  const stampEmojiSize = toolSettings.emojiSize;
  const onStampEmojiChange = (e: string) => setToolSettings((prev) => ({ ...prev, emoji: e }));
  const onStampEmojiSizeChange = (n: number) => setToolSettings((prev) => ({ ...prev, emojiSize: n }));
  const photos = useGalleryStore((s) => s.photos);
  const setPhotos = useGalleryStore((s) => s.setPhotos);
  const activePhotoId = useGalleryStore((s) => s.activePhotoId);
  const activeEntry = photos.find((p) => p.id === activePhotoId);
  const currentByteSize = activeEntry?.byteSize ?? 0;
  const currentMime = activeEntry?.mimeType;
  const originalByteSize = activeEntry?.originalByteSize ?? 0;
  const selectedKind = useAnnotationStore((s) => s.selectedObject?.type ?? null);
  const setShowTools = useUIStore((s) => s.setShowTools);
  const onClose = () => setShowTools(false);
  // The Select panel's controls: the session's actions (prop) + the store's values.
  const selectionTolerance = useToolStore((s) => s.selectionTolerance);
  const setSelectionTolerance = useToolStore((s) => s.setSelectionTolerance);
  const selectionMask = useToolStore((s) => s.selectionMask);
  const selectionKind = useToolStore((s) => s.selectionKind);
  const setSelectionKind = useToolStore((s) => s.setSelectionKind);
  const edgeThreshold = useToolStore((s) => s.edgeThreshold);
  const setEdgeThreshold = useToolStore((s) => s.setEdgeThreshold);
  const selectionControls: SelectionControls = {
    ...selection,
    tolerance: selectionTolerance,
    onToleranceChange: setSelectionTolerance,
    active: selectionMask !== null,
    kind: selectionKind,
    onKindChange: setSelectionKind,
    edgeThreshold,
    onEdgeThresholdChange: setEdgeThreshold,
  };
  // The Layers panel's mask controls: session handlers (prop) + store + engine.
  const maskEditing = useToolStore((s) => s.maskEditing);
  const maskPaintValue = useToolStore((s) => s.maskPaintValue);
  const setMaskPaintValue = useToolStore((s) => s.setMaskPaintValue);
  const { removeLayerMask, applyLayerMask, invertLayerMask } = useEngine();
  const layerMaskControls: LayerMaskControls = {
    editing: maskEditing,
    value: maskPaintValue,
    onAdd: layerMask.onAdd,
    onRemove: removeLayerMask,
    onApply: applyLayerMask,
    onInvert: invertLayerMask,
    onToggleEdit: layerMask.onToggleEdit,
    onSetValue: setMaskPaintValue,
  };
  // `effects` is two tiles — Adjustments and Levels — told apart by this mode.
  const effectsMode = useToolStore((s) => s.effectsMode);
  // PHASE 2: the panel switch routes on SUB-TOOL, not on legacy tool id, for
  // the groups that absorbed several old tools. Edit is the case that needs it
  // most — Crop, Transform and Color Picker are all `crop`, so switching on the
  // tool id would render the whole panel three times over and the three tiles
  // would be indistinguishable.
  const activeSubTool = useActiveSubTool();
  const subToolId = activeSubTool?.subTool.id;

  /** Which section of TransformCropSettings the lit Edit sub-tool wants. */
  const cropSection =
    subToolId === "transform"
      ? ("transform" as const)
      : subToolId === "color-picker"
        ? ("colorPicker" as const)
        : ("crop" as const);

  /** The Rulers sub-tool shares `tool: "arrow"` with Layers and Guides, but
   *  wants its OWN panel rather than a section of LayerSettings — it edits
   *  preferences, not the document. */
  const showRulersPanel = subToolId === "rulers";

  /** Same, for LayerSettings' three sections. */
  const layerSection =
    subToolId === "guides"
      ? ("guides" as const)
      : subToolId === "canvas-size"
        ? ("canvas" as const)
        : ("layer" as const);

  return (
    <motion.div
      variants={embedded ? undefined : slideFromLeft}
      initial={embedded ? undefined : "hidden"}
      animate={embedded ? undefined : "visible"}
      exit={embedded ? undefined : "exit"}
      role="region"
      aria-label="Tool options"
      // Clicking in here operates ON the current selection — the pen's color
      // and Background controls live in this panel — so it must not count as
      // "clicked away" and end that selection. See PenOverlay's off-canvas
      // finish, which reads raw coordinates and cannot tell panel from page.
      data-pen-keep-selection=""
      className={
        embedded
          ? // Compact master-bar content box: flush below the chrome (top 56 =
            // top-2 + 48px chrome), filling to the status bar.
            MASTER_BAR_CONTENT_BOX
          : "group fixed left-3 top-3 bottom-[var(--panel-bottom)] z-[var(--z-panel)] w-[260px] rounded-xl bg-bg-secondary border border-border flex flex-col shadow-panel"
      }
    >
      {/* Hover the panel and a close appears in its top-left; the top bar's
          Tools toggle brings it back. Not in the docked master bar, whose
          tab strip already owns open/close. */}
      {closable && <PanelCloseButton label="Close Tools" onClose={onClose} />}
      {/* The clip lives HERE, not on the fixed shell: the shell must let the
          corner close button hang half outside it, and this wrapper keeps the
          rounded corners trimming the scrolling content exactly as before. */}
      {/* ⚠️ THE BOTTOM FLOOR LIVES HERE, not on the scrolling body. A scroll
          container's `padding-bottom` is not honoured at the end of its
          overflow content, and neither is an `::after` spacer — measured both:
          with 32px set, the last button's bottom and the card's bottom edge
          were 1px apart. This wrapper does not scroll, so its padding always
          renders, and the buttons get the same inset the header has. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[inherit] pb-panel">
      {/* Tool rail + the active tool's sub-tool rail. `layout` is what makes
          the body below slide rather than jump when the sub-row row-count
          changes (0 -> 1 -> 2 rows). */}
      <motion.div layout className="p-panel border-b border-border">
        <ToolGrid
          disabledGroups={{
            batch:
              photos.length <= 1
                ? "Upload another image to run a batch edit"
                : false,
          }}
        />
        <SubtoolRow disabled={!imageReady} />
      </motion.div>

      <motion.div
        layout
        // `pb-1.5`, not the full panel inset: a panel's last run of buttons
        // (Apply Compression & Resize) sits the same 6px off
        // the bottom edge that the master bar's own buttons sit off theirs, so
        // the two chrome edges agree instead of each picking a number
        // (Chris, 2026-09-11 — "follow the reference of top bar, button to
        // edge"). This reverses the older ask for MORE air down here; the
        // comment that described it named a `pb-8` that was no longer in the
        // class, and the 32px token it pointed at was never applied to
        // anything.
        className="flex-1 overflow-y-auto px-panel pt-panel pb-1.5 space-y-5 scrollbar-thin"
      >
        {activeTool === "compress" && (
          <ResizeSettings
            disabled={!imageReady}
            imageWidth={imageWidth}
            imageHeight={imageHeight}
            currentByteSize={currentByteSize}
            currentMime={currentMime}
            originalByteSize={originalByteSize}
            activePhotoId={activePhotoId}
            quality={quality}
            onQualityChange={onQualityChange}
            onQualityCommit={onQualityCommit}
            onResize={onResize}
            onResizeOnly={onResizeOnly}
            exportFormat={exportFormat}
            onExportFormatChange={onExportFormatChange ?? (() => {})}
            compressProgress={compressProgress}
          />
        )}

        {activeTool === "crop" && (
          <TransformCropSettings
            disabled={!imageReady}
            onFlipH={onFlipH}
            onFlipV={onFlipV}
            onRotate90Cw={onRotate90Cw}
            onApplyCrop={onApplyCrop}
            imageWidth={imageWidth}
            imageHeight={imageHeight}
            onSetCropSelection={onSetCropSelection}
            cropRatio={cropRatio ?? null}
            onCropRatioChange={onCropRatioChange ?? (() => {})}
            colorPickerActive={colorPickerActive}
            onSetColorPickerActive={onSetColorPickerActive}
            pickedColor={pickedColor}
            onPickColor={onPickColor}
            section={cropSection}
          />
        )}

        {activeTool === "select" && (
          <SelectSettings disabled={!imageReady} selection={selectionControls} />
        )}

        {/* Perspective takes no controls prop — it reads usePerspectiveStore
            directly, which is what let this tool land without touching
            AppShell. See the note on that store. */}
        {activeTool === "perspective" && (
          <PerspectiveSettings disabled={!imageReady} />
        )}

        {activeTool === "stamp" && (
          <StampSettingsPanel
            settings={stampSettings}
            onChange={onStampSettingsChange}
            activeMode={stampSubMode}
            onModeChange={onStampSubModeChange}
            emoji={stampEmoji}
            emojiSize={stampEmojiSize}
            onEmojiChange={onStampEmojiChange}
            onEmojiSizeChange={onStampEmojiSizeChange}
          />
        )}

        {activeTool === "effects" && effectsMode === "levels" && (
          <LevelsSettings
            // Keyed on the photo so switching photos starts fresh sliders and a
            // fresh preview on the new pixels.
            key={activePhotoId ?? "no-photo"}
            levels={levels}
            imageReady={imageReady}
          />
        )}

        {activeTool === "effects" && effectsMode === "presets" && (
          <PresetsSettings
            // Keyed on the photo so a new photo starts with no preview open.
            key={activePhotoId ?? "no-photo"}
            presets={presets}
            imageReady={imageReady}
          />
        )}

        {/* Explicitly `=== "adjust"`, not `!== "levels"`: a negated test here
            silently swallowed every mode added later, so Presets would have
            rendered the Adjustments panel. */}
        {activeTool === "effects" && effectsMode === "adjust" && (
          <EffectsSettings
            settings={toolSettings}
            onChange={onToolSettingsChange}
            onBrightness={onBrightness}
            onContrast={onContrast}
            onGlobalBlur={onGlobalBlur}
            onSaturation={onSaturation}
            onShadows={onShadows}
            onHighlights={onHighlights}
            onSharpen={onSharpen}
            imageReady={imageReady}
            undoCount={undoCount}
            activePhotoId={activePhotoId}
          />
        )}

        {activeTool === "arrow" && showRulersPanel && rulersPrefs && onRulersChange && (
          <RulersGridsPane value={rulersPrefs} onChange={onRulersChange} />
        )}

        {activeTool === "arrow" && !showRulersPanel && (
          <LayerSettings
            disabled={!imageReady}
            moveActive={moveActive ?? false}
            onToggleMove={onToggleMove ?? (() => {})}
            onResizeLayer={onResizeLayer}
            layers={layers}
            onSelectLayer={onSelectLayer}
            mask={layerMaskControls}
            overlay={layerOverlay}
            stampToolRef={stampToolRef}
            undoCount={undoCount}
            imgW={imageWidth}
            imgH={imageHeight}
            canvasWidth={imageWidth}
            canvasHeight={imageHeight}
            onResizeCanvas={onResizeCanvas}
            onRemoveCanvas={onRemoveCanvas}
            canRemoveCanvas={canRemoveCanvas}
            section={layerSection}
          />
        )}

        {activeTool === "shapes" && (
          <ShapesSettings
            settings={toolSettings}
            onChange={onToolSettingsChange}
            activeMode={shapesMode}
            onModeChange={onShapesModeChange}
            onPlace={onPlace}
            canPlace={selectedKind === "shape"}
          />
        )}

        {activeTool === "emoji" && (
          <BatchSettings
            photos={photos}
            activePhotoId={activePhotoId}
            setPhotos={setPhotos}
            stampToolRef={stampToolRef}
            flushToCanvas={flushToCanvas}
            syncState={syncState}
          />
        )}

        {activeTool === "brush" && (
          <PaintSettings
            settings={toolSettings}
            onChange={onToolSettingsChange}
            activeMode={brushMode}
            onModeChange={onBrushModeChange}
          />
        )}

        {activeTool === "text" && (
          <TextSettings
            settings={toolSettings}
            onChange={onToolSettingsChange}
            onPlace={onPlace}
            canPlace={selectedKind === "text"}
            aiEnabled={aiEnabled}
            activePhotoId={activePhotoId}
            stampToolRef={stampToolRef}
          />
        )}

        {activeTool === "ai" && (
          <AISettings
            aiEnabled={aiEnabled}
            activePhotoId={activePhotoId}
            stampToolRef={stampToolRef}
            onAIResult={onAIResult}
            settings={toolSettings}
            onChange={onToolSettingsChange}
          />
        )}
      </motion.div>

      {/* The "Download & Share {FORMAT}" footer used to live here — a
          full-width `size="large"` Button under a top border, so a 252px panel
          spent an entire row plus its padding on one action. Export is now the
          fifth item in the bar's New · Tools · Gallery · Review run, in both
          the top bar and the compact master bar, which is where the other
          whole-app actions already are. Same handler, no footer. */}
      </div>
    </motion.div>
  );
}
