// The Select TOOL's panel. Was the Select sub-mode of "Adjust & Select"
// (tool-arc 2.6) until the split: two tools were wearing one id, and the
// "Click-to-select" arming toggle was the visible seam. Now picking the tool
// IS the arming, and picking a MODE decides the gesture.
//
// Six modes, ONE exclusive set (v7.47, ADR-022 superseding ADR-021). It used
// to be two axes — a 4-way kind for clicks and a 2-way shape for drags, both
// live at once — which is strictly more capable and read as two unrelated
// groups nobody could tell apart. Exclusivity costs a mode switch before a
// marquee and buys a panel you can understand at a glance.
//
// Everything that decides WHAT is selected lives here. The magic wand moved in
// from Layer Settings — it was always a selection tool, it just happened to be
// parked next to Move/Resize-Layer. All six modes end in the same place: an
// engine call returning a canvas-sized overlay, stored as the one selection
// mask. Downstream (Delete, Deselect, New Layer, the overlay blit) never
// learns which mode produced it.
//
//   Wand           — 4-connected flood fill within tolerance. Leaks through
//                    soft gradients, which is exactly what the next one fixes.
//   Edge-aware     — the same fill, walled in by the Sobel edge map
//                    (src/edges.rs). The shared core: the magnetic lasso and
//                    Smart Brush walk these same edges, so "what is an edge"
//                    stays one definition.
//   Magnetic Lasso — src/livewire.rs: click anchors, the wire path-finds along
//                    the edges between them, double-click closes. Shipped by
//                    default since the selection-tool overhaul — the
//                    `ih_smart_edge` switch now gates ONLY the Paint Smart
//                    Brush (see lib/smartEdge.ts).
//   Color Range    — every pixel within tolerance of the clicked color,
//                    anywhere in the image (Photoshop's Select → Color Range).
//                    One click takes all the sky, not just the connected patch.
//   Rectangle      — drag-swept marquee rect. Ignores clicks.
//   Ellipse        — the ellipse inscribed in that drag rect. Ignores clicks.
//
// The mode selector is the shared ToolModeToggle (the Paint panel's template):
// stacked icon tiles on top, the active mode's title + lightbulb info below,
// then that mode's settings — do not fork the layout.
//
// COMBINE IS NO LONGER HERE. The New / Add / Subtract / Intersect strip moved
// to the Review panel (Review → Combine, Alt+R). It decides how the next
// REGION meets the selection you have, which was never specific to this tool:
// a marquee, a lasso loop and — since the move — a placed shape or text box
// all go through it, and parking it here made it unreachable while you were
// holding any other tool. The store field (`selectionCombine`) and the engine
// call (`set_selection_combine`) are untouched; only the control moved, so
// every gesture path in this panel still combines exactly as it did. Each
// mode's lightbulb says where it went.
import {
  BoxSelect,
  SquareDashed,
  CircleDashed,
  Trash2,
  Wand2,
  Blend,
  Magnet,
  CopyPlus,
  Scissors,
  Sparkles,
  Grip,
  CircleDot,
  Spline,
  Feather,
  Maximize2,
  Eraser,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import {
  PanelAction,
  PanelActionBar,
} from "@/components/ui/panel-action-bar";
import { ToolButton } from "@/components/ui/tool-button";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import { useRadioGroup } from "@/components/ui/use-radio-group";
import { ToolModeToggle } from "@/components/ui/tool-mode-toggle";
import type { ToolMode } from "@/components/ui/tool-mode-toggle";
import { SectionHeader } from "@/components/ui/section-header";
import { SizeSlider } from "@/components/ui/size-slider";
import { isPatchmatchEnabled } from "@/lib/patchmatch";
import type { SelectionKind } from "@/stores/useToolStore";
import { isMarqueeKind, useToolStore } from "@/stores/useToolStore";
import { describeCoverage } from "@/lib/selectionCoverage";
import { edgeSensitivityReason, toleranceReason } from "./selectReasons";
import { isNoopRefine, type RefineSettings } from "@/lib/selectionRefine";
import { PANEL_SECTION } from "@/lib/styles";
import { Kbd } from "@/components/ui/kbd";

/** Controls for the selection tools. Shared with the parent tool panel. */
export interface SelectionControls {
  tolerance: number;
  onToleranceChange: (v: number) => void;
  onSelectAll: () => void;
  onDeselect: () => void;
  onDelete: () => void;
  /** Place the selection on a new layer above the active one, leaving the
   *  source pixels in place (Ctrl+J). */
  onNewLayerCopy: () => void;
  /** Same, but clears the selected pixels off the source layer (Ctrl+Shift+J). */
  onNewLayerCut: () => void;
  /** PatchMatch object removal — behind the `ih_patchmatch` verification
   *  switch (see lib/patchmatch.ts); the panel only renders a button for
   *  this at all when that switch is on. */
  onRemoveObject: () => void;
  /** Whether something is currently selected (enables Deselect / Delete). */
  active: boolean;
  /** Which engine call a canvas click makes. */
  kind: SelectionKind;
  onKindChange: (k: SelectionKind) => void;
  /** Edge-wall strength for the edge-aware wand (0..=255). */
  edgeThreshold: number;
  onEdgeThresholdChange: (v: number) => void;
}

/** All six selection modes, in ToolModeToggle shape. Exported because the
 *  command palette offers each one as a jump-to entry — one list, so the panel
 *  and the palette can't end up describing them differently. `info` stays a
 *  plain string (narrowed below) because the palette indexes it as a search
 *  keyword. */
export const SELECT_MODES: readonly (ToolMode<SelectionKind> & {
  info: string;
})[] = [
  {
    id: "wand",
    label: "Wand",
    icon: Wand2,
    info: "Flood-selects the connected region of similar color around your click.",
  },
  {
    id: "edge",
    label: "Edge-aware",
    icon: Blend,
    info: "The wand, but it stops at object outlines instead of leaking through soft gradients.",
  },
  {
    id: "lasso",
    label: "Magnetic Lasso",
    icon: Magnet,
    info: "Click anchors around an object; the wire snaps to the edge between them. Double-click to close, Esc to cancel.",
  },
  {
    id: "colorRange",
    label: "Color Range",
    icon: BoxSelect,
    info: "Takes every pixel of that color anywhere in the image — not just the patch you clicked.",
  },
  {
    id: "rect",
    label: "Rectangle",
    icon: SquareDashed,
    info: "Drag a rectangle. This one ignores clicks — press, drag, release.",
  },
  {
    id: "ellipse",
    label: "Ellipse",
    icon: CircleDashed,
    info: "Drag the ellipse inscribed in the box you sweep. Ignores clicks — press, drag, release.",
  },
];

/** SELECT_MODES with the panel-level how-to appended to every lightbulb (the
 *  instructions that used to live in the old "Selection Tool" header). Built
 *  once at module scope; the palette keeps consuming the pure strings above. */
const PANEL_MODES: readonly ToolMode<SelectionKind>[] = SELECT_MODES.map(
  (m) => ({
    ...m,
    info: (
      <>
        {m.info}{" "}
        {isMarqueeKind(m.id)
          ? "Press, drag and release on the canvas."
          : "Click the canvas to select."}{" "}
        <Kbd>Alt+A</Kbd> selects all, <Kbd>Alt+D</Kbd> deselects. Whether this
        replaces the selection or adds to it is Combine, in the Review panel
        (<Kbd>Alt+R</Kbd>); <Kbd>Shift</Kbd> adds and <Kbd>Alt</Kbd> subtracts
        for one gesture whatever it says.
      </>
    ),
  }),
);


/** The five refine operations, in the order the tiles show them. One tile is
 *  "open" at a time and the single slider under the grid edits that one —
 *  five sliders stacked two across was the version this replaced, and it
 *  was the ugliest part of the panel. Ranges are the engine's, unchanged. */
type RefineParam = keyof RefineSettings;
const REFINE_PARAMS: readonly {
  id: RefineParam;
  label: string;
  icon: LucideIcon;
  min: number;
  max: number;
  title: string;
}[] = [
  { id: "islands", label: "Islands", icon: Grip, min: 0, max: 200, title: "Drop specks smaller than this" },
  { id: "holes", label: "Holes", icon: CircleDot, min: 0, max: 200, title: "Fill pinholes smaller than this" },
  { id: "smooth", label: "Smooth", icon: Spline, min: 0, max: 8, title: "Round off jagged edges" },
  { id: "feather", label: "Feather", icon: Feather, min: 0, max: 8, title: "Soften the edge of a mask made from it" },
  { id: "expand", label: "Expand", icon: Maximize2, min: -10, max: 10, title: "Grow or shrink the edge" },
];
const REFINE_IDS = REFINE_PARAMS.map((r) => r.id);

export function SelectSettings({
  disabled,
  selection,
}: {
  disabled: boolean;
  selection: SelectionControls;
}) {
  const patchmatch = isPatchmatchEnabled();
  const coverage = useToolStore((s) => s.selectionCoverage);
  const refine = useToolStore((s) => s.selectionRefine);
  const setRefine = useToolStore((s) => s.setSelectionRefine);
  const requestRefine = useToolStore((s) => s.requestRefine);
  const previewing = useToolStore((s) => s.refinePreviewing);
  const setOne = (key: keyof RefineSettings) => (v: number) =>
    setRefine((r) => ({ ...r, [key]: v }));
  const canRefine = !disabled && selection.active;
  // Holes first, as in the design: it's the one people reach for after a wand
  // click leaves pinholes. Panel-local on purpose — it is only which slider is
  // showing, not a setting, and it has no business in a persisted store.
  const [param, setParam] = useState<RefineParam>("holes");
  const paramRadio = useRadioGroup({
    ids: REFINE_IDS,
    selected: param,
    isDisabled: () => !canRefine,
    onSelect: setParam,
  });
  const open = REFINE_PARAMS.find((r) => r.id === param) ?? REFINE_PARAMS[0];

  return (
    <div className="space-y-4">
      {/* ── The mode: one exclusive 3×2 grid of all six ──────────────────
          Three columns to match the Selection grid below, so the panel reads
          as two grids of the same shape rather than four unrelated clusters.
          Each mode's description lives in its lightbulb (ToolModeToggle's
          SectionHeader), never a permanent paragraph. */}
      <ToolModeToggle
        modes={PANEL_MODES}
        columns={3}
        activeMode={selection.kind}
        onModeChange={selection.onKindChange}
        disabled={disabled}
      >
        {(kind) => {
          // Both sliders are ALWAYS here; a mode that doesn't use one shows it
          // disabled with the reason underneath. They used to be hidden, which
          // made the panel change height on every mode switch.
          const tolReason = toleranceReason(kind);
          const edgeReason = edgeSensitivityReason(kind);
          return (
            <>
              {/* Live: moving it re-runs the last click from the same seed
                  (useSelectionActions → selection_retune), so you watch the
                  sky come in before the building does. */}
              <div>
                <SizeSlider
                  label="Tolerance"
                  value={selection.tolerance}
                  min={0}
                  max={120}
                  onChange={selection.onToleranceChange}
                  disabled={disabled || tolReason !== null}
                />
                {tolReason && (
                  <p className="mt-1 text-2xs text-theme-muted-foreground">{tolReason}</p>
                )}
              </div>
              <div>
                <SizeSlider
                  label="Edge sensitivity"
                  value={selection.edgeThreshold}
                  min={10}
                  max={255}
                  onChange={selection.onEdgeThresholdChange}
                  disabled={disabled || edgeReason !== null}
                />
                {edgeReason && (
                  <p className="mt-1 text-2xs text-theme-muted-foreground">{edgeReason}</p>
                )}
              </div>
            </>
          );
        }}
      </ToolModeToggle>

      {/* ── How much is selected ──────────────────────────────────────────
          Outside the mode body so it does not re-animate on a mode switch.
          Always present — "Nothing selected" rather than an absent line — so
          a click that misses reads as a miss, not as nothing happening. The
          status bar shows the same number, and only while it is non-zero. */}
      <p
        className="text-xs tabular-nums text-theme-muted-foreground"
        aria-live="polite"
        data-testid="selection-coverage"
      >
        {coverage ? describeCoverage(coverage) : "Nothing selected"}
      </p>

      {/* ── Refine ───────────────────────────────────────────────────────
          Non-modal, on this panel: Clean Up is the preset, the sliders are the
          same four operations (plus the feather a mask gets) exposed one by
          one. Sliders PREVIEW on a copy — the ants and the readout above show
          the refined result — and Apply commits it as one undo step. The
          engine work is src/selection_refine.rs; the wiring is store-driven
          (useSelectionActions answers), so AppShell gains nothing. */}
      <div className={PANEL_SECTION}>
        <SectionHeader
          title="Refine"
          info={
            <>
              Clean Up removes specks under 4 px, fills pinholes under 6 px,
              smooths the edge and pulls it in 1 px, in one step. The other
              tiles are those operations one at a time: pick one, move the
              slider to preview it, then Apply. Feather only softens a mask made from the selection
              (Layer Settings → Add mask). Apply is one undo step, and like any
              selection change it keeps a full copy of the image, so on a very
              large photo it spends one of your few undo steps — the Undo
              readout in the status bar shows when.
            </>
          }
        />
        {/* One 3×2 grid, two kinds of tile. Clean Up is an ACTION (it runs
            the preset) and the other five are a CHOICE (which operation the
            slider edits), so they cannot be one ToolButtonGroup — that would
            make a screen reader announce Clean Up as "radio, not checked, 1 of
            6". The five get a radiogroup of their own, laid out with
            `display: contents` so they still share the grid's cells. Same
            ToolButton and same useRadioGroup the group primitive is built on,
            so the look and the keyboard (one Tab stop, arrows) are its. */}
        <div className="grid grid-cols-3 gap-2 [grid-auto-rows:1fr]">
          <ToolButton
            stacked
            disabled={!canRefine}
            onClick={() => requestRefine("cleanUp")}
            title="Remove specks, fill pinholes, smooth the edge — one undo step"
          >
            <Sparkles />
            Clean Up
          </ToolButton>
          <div
            className="contents"
            {...paramRadio.groupProps}
            aria-label="Refine operation"
          >
            {REFINE_PARAMS.map((r, i) => {
              const Icon = r.icon;
              return (
                <ToolButton
                  key={r.id}
                  stacked
                  active={param === r.id}
                  {...paramRadio.itemProps(i)}
                  disabled={!canRefine}
                  title={r.title}
                  onClick={() => setParam(r.id)}
                >
                  <Icon />
                  {r.label}
                </ToolButton>
              );
            })}
          </div>
        </div>
        <SizeSlider
          label={open.label}
          unit=" px"
          value={refine[open.id]}
          min={open.min}
          max={open.max}
          onChange={setOne(open.id)}
          disabled={!canRefine}
        />
        {!selection.active && (
          <p className="text-2xs text-theme-muted-foreground">Select something to refine it.</p>
        )}
        <PanelActionBar>
          <PanelAction
            disabled={!canRefine || isNoopRefine(refine)}
            onClick={() => requestRefine("apply")}
          >
            {previewing ? "Apply refine" : "Apply"}
          </PanelAction>
        </PanelActionBar>
      </div>

      {/* ── Act on the selection: one title + bulb over all five actions ──
          Two 3-column rows out of a single 5-item grid (All/Deselect/Delete,
          then Copy/Cut/—). The old "New Layer" sub-header is gone — its copy
          lives in this bulb now, per the no-permanent-paragraphs rule.
          Outside the ToolModeToggle body: these actions are kind-independent
          and shouldn't re-animate on every kind switch. */}
      <div className={PANEL_SECTION}>
        <SectionHeader
          title="Selection"
          info={
            <>
              All selects the whole canvas (<Kbd>Alt+A</Kbd>); Deselect drops
              the selection (<Kbd>Alt+D</Kbd>); Delete clears the selected
              pixels. Copy (<Kbd>Ctrl+J</Kbd>) and Cut (
              <Kbd>Ctrl+Shift+J</Kbd>) place the selection on a new layer
              above — Cut also removes it from this one.
              {patchmatch && (
                <>
                  {" "}
                  Remove erases the selection and rebuilds it from the rest of
                  the image, on your device. Cover the whole object — a partial
                  selection lets it rebuild the object from its own leftovers —
                  and expect big areas to come out soft.
                </>
              )}
            </>
          }
        />
        {/* One ToolButtonGroup in ACTION mode (no `value`, so no tile ever
            lights) instead of five hand-rolled ToolButtons in a 3-column grid
            with a dead sixth cell. Same primitive the rest of the app's
            "row of tiles" controls use, so Selection stops being the one
            bespoke grid in this panel.

            Per-option `disabled` is what made this possible: All works with
            nothing selected, the other four do not, and before this the group
            only had a single group-wide flag. */}
        <ToolButtonGroup<"all" | "deselect" | "delete" | "copy" | "cut" | "remove">
          // THREE ACROSS, not five. Five squeezed "Deselect" and "Delete" into
          // a sidebar column that has no room for them. The sixth cell, empty
          // since 2026-09-11, is now Remove (Object) — it had its own section
          // and button below; the Select Panel design (09-27) folds it in.
          columns={3}
          stacked
          disabled={disabled}
          onChange={(id) => {
            if (id === "all") selection.onSelectAll();
            else if (id === "deselect") selection.onDeselect();
            else if (id === "delete") selection.onDelete();
            else if (id === "copy") selection.onNewLayerCopy();
            else if (id === "cut") selection.onNewLayerCut();
            else if (id === "remove") selection.onRemoveObject();
          }}
          options={[
            {
              id: "all",
              label: "All",
              icon: BoxSelect,
              title: "Select all (Alt+A)",
            },
            {
              id: "deselect",
              label: "Deselect",
              icon: SquareDashed,
              disabled: !selection.active,
              title: "Deselect (Alt+D)",
            },
            {
              id: "delete",
              label: "Delete",
              icon: Trash2,
              disabled: !selection.active,
              title: "Delete selection",
            },
            {
              id: "copy",
              label: "Copy",
              icon: CopyPlus,
              disabled: !selection.active,
              title: "Copy selection to a new layer (Ctrl+J)",
            },
            {
              id: "cut",
              label: "Cut",
              icon: Scissors,
              disabled: !selection.active,
              title: "Cut selection to a new layer (Ctrl+Shift+J)",
            },
            // Only while the PatchMatch switch is on (lib/patchmatch.ts) —
            // the same gate its old section had.
            ...(patchmatch
              ? [
                  {
                    id: "remove" as const,
                    label: "Remove",
                    icon: Eraser,
                    disabled: !selection.active,
                    title: "Remove Object — erase the selection and rebuild it from the rest of the image",
                  },
                ]
              : []),
          ]}
        />
      </div>

    </div>
  );
}
