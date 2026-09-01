import { useEffect } from "react";
import {
  Move,
  Scaling,
  Trash2,
  Minus,
  Lock,
  LockOpen,
  ChevronDown,
  Aperture,
  Contrast,
  Check,
  X,
} from "lucide-react";
import { ToolButton } from "@/components/ui/tool-button";
import { ActionTile } from "@/components/ui/action-tile";
import { ReselectBar } from "@/components/ui/reselect-bar";
import { SectionHeader } from "@/components/ui/section-header";
import { CanvasResize } from "@/components/CanvasResize";
import { ColorSwatchGrid } from "@/components/ColorSwatchGrid";
import {
  GUIDE_COLORS,
  OVERLAY_COLORS,
  DEFAULT_OVERLAY_OPACITY,
} from "@/lib/colors";
import { useGuidesStore } from "@/stores/useGuidesStore";
import { cn } from "@/lib/utils";
import type { LayerInfo } from "@/hooks/useEngineCore";

/** The house section separator (Select / Paint / Shapes all use this exact
 *  rule + padding above a SectionHeader). Named rather than inlined so the
 *  three sections below cannot drift apart from each other. */
const SECTION_SEP = "border-t border-theme-sidebar-border pt-3";
/** Mask sits INSIDE the Move/Resize section (same selected layer), so it takes
 *  the separator without the section-level `sep` gate — it is always stacked
 *  under something. */
const MASK_SECTION_SEP = SECTION_SEP;

/** The mask's brush-value choice (Hide/Reveal) lives in PaintSettings, not
 *  here — see the Paint mask tile below for why it cannot render on this
 *  panel at all. */

/** Mask handlers — the SAME shape ReviewPanel takes, because these are the
 *  same handlers: v8.38 moved the mask controls here (once, acting on the
 *  selected layer) instead of repeating them on every layer row. */
export interface LayerMaskControls {
  /** Whether brush strokes currently paint the active layer's mask. */
  editing: boolean;
  /** Grey laid down while painting the mask: 0 = hide, 255 = reveal. */
  value: number;
  onAdd: (id: number) => void;
  onRemove: (id: number) => void;
  onApply: (id: number) => void;
  onInvert: (id: number) => void;
  onToggleEdit: (id: number) => void;
  onSetValue: (v: number) => void;
}

/** Color Overlay handlers for the SELECTED layer — Photoshop's Color Overlay
 *  layer style. Same one-set-per-panel shape as {@link LayerMaskControls}: the
 *  layer dropdown above chooses what these act on, so there is nothing
 *  per-row. */
export interface LayerOverlayControls {
  /** Set OR adjust the overlay — one entry point for both, because the swatch
   *  grid and the opacity slider are the same engine call. The engine snaps
   *  history only on the first set, so a slider drag is one undo step. */
  onSet: (id: number, color: string, opacity: number) => void;
  /** Discard the style; the layer's true colours come back untouched. */
  onRemove: (id: number) => void;
  /** Bake the tint into the layer's pixels permanently. */
  onApply: (id: number) => void;
}

interface LayerSettingsProps {
  disabled: boolean;
  /** Move-layer toggle — while on, canvas drags reposition the active layer. */
  moveActive: boolean;
  onToggleMove: () => void;
  /** "Resize Layer" — opens a movable/resizable bounding box (same overlay as
   *  paste placement) around the active layer's own content; drag the handles
   *  then Enter/click-away to bake the scale, Escape to cancel. */
  onResizeLayer?: () => void;
  /** Layer stack, bottom → top (same array ReviewPanel gets). Optional so the
   *  guides/canvas sections can render without layer wiring. */
  layers?: LayerInfo[];
  /** Selects the layer every control in this panel then acts on — drives the
   *  engine's `active_layer_id`, nothing else (verified pure, 2026-08-14). */
  onSelectLayer?: (id: number) => void;
  /** Mask controls for the SELECTED layer — one set, not per-row. */
  mask?: LayerMaskControls;
  /** Color Overlay controls for the SELECTED layer — same one-set rule. */
  overlay?: LayerOverlayControls;
  /** Live canvas (image) dimensions — used to evenly distribute new guides. */
  imgW: number;
  imgH: number;
  /** Canvas (image) dimensions + W×H resize apply — the backdrop is the canvas,
   *  so its one-off Canvas Size resizer lives here. */
  canvasWidth: number;
  canvasHeight: number;
  onResizeCanvas: (w: number, h: number) => void;
  /** Deletes the artboard's Background layer outright. */
  onRemoveCanvas: () => void;
  canRemoveCanvas: boolean;
  /** Which section to render. Edit gives Resize Layer, Guides and Canvas Size
   *  each their own sub-tool tile, so each shows ONLY its own section rather
   *  than the whole panel three times over. Omitted renders all three with
   *  separators — the pre-restructure behaviour. Mirrors the same prop on
   *  TransformCropSettings. */
  section?: "layer" | "guides" | "canvas";
}

/**
 * Layer Settings tool (the renamed Move/arrow slot). Two mutually-exclusive
 * canvas modes as toggle buttons: Move (drag the active layer, also Ctrl+M) and
 * the Selection Marker (magic-wand flood-select). Only one is active at a time —
 * the parent enforces that. Plus draggable image **Guides** (non-destructive
 * overlay lines; the W×H Canvas Size control now lives in Settings → Layers and
 * Canvas).
 */
export function LayerSettings({
  disabled,
  moveActive,
  onToggleMove,
  onResizeLayer,
  layers,
  onSelectLayer,
  mask,
  overlay,
  imgW,
  imgH,
  canvasWidth,
  canvasHeight,
  onResizeCanvas,
  onRemoveCanvas,
  canRemoveCanvas,
  section,
}: LayerSettingsProps) {
  const activeLayer = layers?.find((l) => l.active);
  // Guide state lives in the dedicated Zustand slice (shared with the canvas
  // overlay), so we read it directly rather than prop-drilling.
  const guides = useGuidesStore((s) => s.guides);
  const guidesLocked = useGuidesStore((s) => s.guidesLocked);
  const selectedGuideId = useGuidesStore((s) => s.selectedGuideId);
  const addGuide = useGuidesStore((s) => s.addGuide);
  const removeGuide = useGuidesStore((s) => s.removeGuide);
  const clearGuides = useGuidesStore((s) => s.clearGuides);
  const selectGuide = useGuidesStore((s) => s.selectGuide);
  const toggleGuidesLock = useGuidesStore((s) => s.toggleGuidesLock);
  const guideColor = useGuidesStore((s) => s.guideColor);
  const setGuideColor = useGuidesStore((s) => s.setGuideColor);

  // Delete / Backspace removes the selected guide — but only when a guide is
  // selected AND the user isn't typing in a field (don't hijack the key).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const t = e.target;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        (t instanceof HTMLElement && t.isContentEditable)
      ) {
        return;
      }
      const id = useGuidesStore.getState().selectedGuideId;
      if (!id) return;
      e.preventDefault();
      removeGuide(id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [removeGuide]);

  const show = (v: NonNullable<LayerSettingsProps["section"]>) =>
    section === undefined || section === v;
  /** The separator rule only earns its keep when sections are stacked. */
  const sep = section === undefined ? SECTION_SEP : "";

  return (
    <div className="space-y-6 -mt-2">
      {/* ── Move or Resize the active layer ──────────────────────────────── */}
      {show("layer") && (
      <div className="space-y-2">
        <SectionHeader
          title="Move or Resize Layer"
          info={
            <>
              Pick a layer, then every control below acts on it.{" "}
              <strong className="font-semibold text-theme-foreground">
                Move
              </strong>{" "}
              drags its content on the canvas.{" "}
              <strong className="font-semibold text-theme-foreground">
                Resize
              </strong>{" "}
              opens a draggable bounding box to scale/reposition it, then
              Enter or click away to bake it in (Escape cancels). Both are
              non-destructive until committed. <kbd>Ctrl+M</kbd> toggles Move.
            </>
          }
        />
        {/* Layer dropdown — ONE selection, every control to the right/below
            reads it (v8.38). Drives the engine's active_layer_id through the
            same setActiveLayer the Review panel rows use; there is no
            per-control layer picker anywhere. Options listed top→bottom to
            match the visual stack. */}
        {layers && layers.length > 0 && onSelectLayer && (
          <div className="space-y-2">
            <label className="text-2xs text-theme-muted-foreground">
              Layer
            </label>
            <div className="relative">
            <select
              value={activeLayer?.id ?? ""}
              disabled={disabled}
              onChange={(e) => onSelectLayer(Number(e.target.value))}
              className="w-full appearance-none rounded-lg bg-theme-muted px-3 py-2 pr-8 text-xs text-theme-foreground border border-transparent focus:outline-none focus:border-theme-ring cursor-pointer"
              title="Layer these controls act on"
            >
              {[...layers].reverse().map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                  {l.visible ? "" : " (hidden)"}
                  {l.hasMask ? " · masked" : ""}
                  {l.overlay ? " · tinted" : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-muted-foreground" />
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 [grid-auto-rows:1fr]">
          <ToolButton
            stacked
            active={moveActive}
            disabled={disabled}
            onClick={onToggleMove}
          >
            <Move /> <span>{moveActive ? "Move: on" : "Move"}</span>
          </ToolButton>
          <ActionTile
            icon={Scaling}
            label="Resize"
            disabled={disabled || !onResizeLayer}
            onClick={onResizeLayer}
          />
        </div>

        {/* ── Layer mask — ONE set of controls, for the selected layer.
            Moved here from the per-row buttons in Review → Layers (v8.38,
            "none of those mask buttons will be on each layer"): same
            handlers, new home, wired to the dropdown's selection. */}
        {mask && activeLayer && (
          <div className={cn("space-y-2", MASK_SECTION_SEP)}>
            <SectionHeader
              title="Layer Mask"
              info={
                <>
                  Non-destructive hide/reveal for the selected layer. Adding a
                  mask switches you straight to the Paint brush and starts
                  editing it — black hides, white reveals. Apply bakes it in
                  permanently; Remove discards it.
                </>
              }
            />
            {/* Primitive choice follows the button-variant SSOT, not what
                each control happens to look like: TOGGLES are `ToolButton
                stacked` / `ToolButtonGroup stacked` and carry `active`;
                one-shot ACTIONS are `ActionTile`, which never does. The
                first cut of this section used plain ToolButtons for the
                actions, which read as four permanently-unlit toggles. */}
            {!activeLayer.hasMask ? (
              <div className="grid gap-2 [grid-auto-rows:1fr]">
                {/* Announces the tool switch the same way "Paint mask" below
                    does: `onAdd` creates the mask AND enters mask editing on
                    the Paint brush, which unmounts this panel. It was the only
                    tile in this section changing the active tool without
                    saying so. */}
                <ActionTile
                  icon={Aperture}
                  label="Add mask"
                  disabled={disabled}
                  onClick={() => mask.onAdd(activeLayer.id)}
                  title="Add a mask and start painting it with the brush"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 [grid-auto-rows:1fr]">
                {/* One-shot, NOT a toggle — it starts an activity that lives
                    on another panel. `onToggleEdit` switches the app to the
                    Paint brush, which unmounts this panel and (by AppShell's
                    own effect) clears `mask.editing`, so an `active` state
                    here could never light and the Hide/Reveal pair could
                    never render. Those live in the Paint panel now; this tile
                    is the way in. */}
                <ActionTile
                  icon={Aperture}
                  label="Paint mask"
                  disabled={disabled}
                  onClick={() => mask.onToggleEdit(activeLayer.id)}
                  title="Paint this layer's mask with the brush"
                />
                <ActionTile
                  icon={Contrast}
                  label="Invert"
                  disabled={disabled}
                  onClick={() => mask.onInvert(activeLayer.id)}
                  title="Invert mask"
                />
                <ActionTile
                  icon={Check}
                  label="Apply"
                  disabled={disabled}
                  onClick={() => mask.onApply(activeLayer.id)}
                  title="Apply mask (bake in, permanent)"
                />
                <ActionTile
                  icon={X}
                  label="Remove"
                  disabled={disabled}
                  onClick={() => mask.onRemove(activeLayer.id)}
                  title="Remove mask"
                />
              </div>
            )}
          </div>
        )}

        {/* ── Color Overlay — Photoshop's Color Overlay layer style ────────
            Sits directly under Layer Mask because it is the same KIND of
            thing: a non-destructive style on the selected layer, reversible
            until Applied. The engine tints at composite time, clipped to the
            layer's own alpha and applied UNDER the mask — so masking a
            tinted layer hides the tint with it, as Photoshop does. */}
        {overlay && activeLayer && (
          <div className={cn("space-y-2", MASK_SECTION_SEP)}>
            <SectionHeader
              title="Color Overlay"
              info={
                <>
                  Tints the selected layer with a solid colour — clipped to
                  what the layer actually contains, so transparent areas stay
                  transparent. Pick a colour to switch it on, drag{" "}
                  <strong className="font-semibold text-theme-foreground">
                    Strength
                  </strong>{" "}
                  to blend it back toward the true colours.{" "}
                  <strong className="font-semibold text-theme-foreground">
                    Apply
                  </strong>{" "}
                  bakes it into the pixels permanently;{" "}
                  <strong className="font-semibold text-theme-foreground">
                    Remove
                  </strong>{" "}
                  discards it. Undo reverses the whole overlay in one step.
                </>
              }
            />
            {/* The swatch grid IS the on-switch — no separate "Add" tile.
                Picking a colour with no overlay yet creates one at full
                strength (Photoshop's default); picking another recolours the
                existing one. `value` is "" when unset so no circle reads as
                selected, which is what makes "pick one to start" legible. */}
            <ColorSwatchGrid
              label="Overlay Color"
              colors={OVERLAY_COLORS}
              value={overlayColorOf(activeLayer)}
              onChange={(color) =>
                overlay.onSet(
                  activeLayer.id,
                  color,
                  activeLayer.overlay?.opacity ?? DEFAULT_OVERLAY_OPACITY,
                )
              }
            />

            {/* Strength + the two one-shot actions only exist once there IS
                an overlay — a slider for a style that isn't on would be a
                dead control. */}
            {activeLayer.overlay && (
              <>
                <label className="text-2xs text-theme-muted-foreground">
                  Strength
                </label>
                <div className="layer-opacity">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(activeLayer.overlay.opacity * 100)}
                    disabled={disabled}
                    aria-label="Color overlay strength"
                    onChange={(e) =>
                      overlay.onSet(
                        activeLayer.id,
                        activeLayer.overlay?.color ?? OVERLAY_COLORS[0],
                        Number(e.target.value) / 100,
                      )
                    }
                  />
                  <span className="layer-opacity-val">
                    {Math.round(activeLayer.overlay.opacity * 100)}%
                  </span>
                </div>
                {/* One-shot ACTIONS → ActionTile, never `active` (the
                    button-variant SSOT the mask block above spells out). */}
                <div className="grid grid-cols-2 gap-2 [grid-auto-rows:1fr]">
                  <ActionTile
                    icon={Check}
                    label="Apply"
                    disabled={disabled}
                    onClick={() => overlay.onApply(activeLayer.id)}
                    title="Apply color overlay (bake in, permanent)"
                  />
                  <ActionTile
                    icon={X}
                    label="Remove"
                    disabled={disabled}
                    onClick={() => overlay.onRemove(activeLayer.id)}
                    title="Remove color overlay"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>
      )}

      {/* The Selection Marker used to live here. It moved to Adjust & Select →
          Select in the tool-arc 2.6 session — it was always a selection tool,
          just parked next to Move/Resize-Layer. */}

      {/* ── Guides (non-destructive draggable overlay lines) ─────────────── */}
      {show("guides") && (
      <div className={cn("space-y-2", sep)}>
        <SectionHeader
          title="Horizontal and Vertical Guides"
          info={
            <>
              Add evenly-spaced horizontal/vertical guides, then drag them on
              the canvas to reposition. Lock prevents moving;{" "}
              <kbd>Delete</kbd>/<kbd>Backspace</kbd> removes the selected
              guide.
            </>
          }
        />
        <div className="grid grid-cols-2 gap-2 [grid-auto-rows:1fr]">
          <ToolButton
            disabled={disabled}
            onClick={() => addGuide("h", imgW, imgH)}
            title="Add horizontal guide"
          >
            <Minus /> H
          </ToolButton>
          <ToolButton
            disabled={disabled}
            onClick={() => addGuide("v", imgW, imgH)}
            title="Add vertical guide"
          >
            <Minus className="rotate-90" /> V
          </ToolButton>
          <ToolButton
            disabled={disabled || guides.length === 0}
            onClick={clearGuides}
            title="Remove all guides"
          >
            <Trash2 /> Clear
          </ToolButton>
          <ToolButton
            active={guidesLocked}
            disabled={disabled}
            onClick={toggleGuidesLock}
            title="Prevent guides from being moved"
          >
            {guidesLocked ? <Lock /> : <LockOpen />} Lock
          </ToolButton>
        </div>

        <ColorSwatchGrid
          label="Guide Color"
          colors={GUIDE_COLORS}
          value={guideColor}
          onChange={setGuideColor}
        />

        {guides.length > 0 && (
          <>
            <span className="text-2xs font-semibold font-mono text-theme-muted-foreground">
              Guides
            </span>
            <div className="history-list max-h-40">
            {guides.map((g) => (
              <ReselectBar
                key={g.id}
                label={`${g.axis === "h" ? "H" : "V"} · ${Math.round(g.pos)}px`}
                selected={g.id === selectedGuideId}
                onSelect={() => selectGuide(g.id)}
                onDelete={() => removeGuide(g.id)}
                title="Reselect guide"
                deleteLabel="Delete guide"
              />
            ))}
            </div>
          </>
        )}
      </div>
      )}

      {/* ── Canvas size (the checkerboard backdrop is the canvas) ─────────── */}
      {show("canvas") && (
      <div className={cn("space-y-3", sep)}>
        <SectionHeader
          title="Background Canvas Size"
          info="Resizes the backing canvas, not the photo — content keeps its native resolution, centred; new area uses the backing color."
        />
        <CanvasResize
          width={canvasWidth}
          height={canvasHeight}
          disabled={disabled}
          onApply={onResizeCanvas}
          onRemove={onRemoveCanvas}
          canRemove={canRemoveCanvas}
        />
      </div>
      )}
    </div>
  );
}

/** The swatch grid's `value`: the layer's overlay colour, or `""` when it has
 *  none so NO circle renders as selected. Returning a default colour instead
 *  would ring a swatch for a style that isn't applied — the control would look
 *  on while the layer is untinted. */
function overlayColorOf(layer: LayerInfo): string {
  return layer.overlay?.color ?? "";
}
