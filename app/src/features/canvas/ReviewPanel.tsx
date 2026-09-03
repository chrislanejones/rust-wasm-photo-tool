import { useState } from "react";
import { motion } from "framer-motion";
import {
  Aperture,
  ChartArea,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  History,
  Layers,
  Layers2,
  MousePointerSquareDashed,
  Plus,
  Settings,
  Redo2,
  Undo2,
  X,
} from "lucide-react";
import { HistogramView } from "./HistogramView";
// Cross-feature import with precedent (CanvasArea, routing do the same):
// `activateSubTool` is deliberately callable from anywhere — "the rail, the
// router and the command palette" — and now this gear.
import { activateSubTool } from "@/features/tools/activateSubTool";
import { subToolByKey } from "@/features/tools/toolGroups";
import { slideFromRight } from "@/lib/animations";
import { Button } from "@/components/ui/button";
import { TinyNumberBox } from "@/components/ui/tiny-number-box";
import { ReselectBar } from "@/components/ui/reselect-bar";
import { ToggleButtonGroup } from "@/components/ui/toggle-button-group";
import { useLayerSwapFlash } from "@/hooks/useLayerSwapFlash";
import { TIERS } from "@/lib/tiers";
import type { UserMode } from "@/components/StatusBar";
import type { HistoryEntry, LayerInfo } from "@/hooks/useCloneStamp";

/** One placed object shown in the Reselect list (text or shape annotation). */
export interface ReselectObject {
  /** Stable React key, e.g. `t12` / `s7`. */
  key: string;
  type: "text" | "shape";
  /** Annotation id within its own (text vs shape) id-space. */
  id: number;
  /** Display name, e.g. "Text #1", "Square #1", "Line #2". */
  label: string;
}

/** The toggleable body sections of the Review panel. */
type SectionKey = "history" | "reselect" | "layers" | "histogram";

interface Props {
  history: HistoryEntry[];
  onJump: (index: number) => void;
  onDelete: (index: number) => void;
  onClose: () => void;
  /** Undo / redo buttons in the History section header. */
  onUndo: () => void;
  canUndo: boolean;
  onRedo: () => void;
  canRedo: boolean;
  /** Live placed objects (text + shapes) for the Reselect list. */
  objects: ReselectObject[];
  /** Click an object → load it into the canvas edit overlay to move/resize. */
  onSelectObject: (o: ReselectObject) => void;
  /** Hover-X → delete that object. */
  onDeleteObject: (o: ReselectObject) => void;
  /** Current effective tier — drives the Layers section's allowance. */
  userMode: UserMode;
  // ── Layers ──
  /** Layer stack, bottom → top (rendered reversed so the top layer is first). */
  layers: LayerInfo[];
  onAddLayer: () => void;
  onDuplicateLayer: (id: number) => void;
  onDeleteLayer: (id: number) => void;
  onSelectLayer: (id: number) => void;
  onToggleLayerVisible: (id: number, visible: boolean) => void;
  onSetLayerOpacity: (id: number, opacity: number) => void;
  onRenameLayer: (id: number, name: string) => void;
  /** Move a layer to a new stack index (0 = bottom). */
  onMoveLayer: (id: number, newIndex: number) => void;
  onMergeDown: (id: number) => void;
  onFlattenAll: () => void;
  // ── Histogram ──
  /** Pulls the per-channel histogram from Rust (no canvas sampling). */
  getHistogram: () => Promise<Uint32Array | null>;
  /** Changes when the active image content changes → triggers a resample. */
  histogramSignature: string;
  /** Active photo id — when it changes the histogram bars fall down, then rise
   *  back up once the newly-selected photo has composited. */
  histogramPhotoKey: string;
  /** Embedded mode: render as a plain flex column (no fixed `.review-panel`
   *  chrome / slide animation) so it can fill the compact master bar. */
  embedded?: boolean;
}

const DeleteGlyph = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 2l8 8M10 2l-8 8" />
  </svg>
);

const TOGGLES: {
  key: SectionKey;
  icon: typeof History;
  label: string;
  tooltip: { label: string };
}[] = [
  { key: "history", icon: History, label: "History", tooltip: { label: "History" } },
  { key: "layers", icon: Layers, label: "Layers", tooltip: { label: "Layers" } },
  {
    key: "reselect",
    icon: MousePointerSquareDashed,
    label: "Reselect",
    tooltip: { label: "Reselect" },
  },
  { key: "histogram", icon: ChartArea, label: "Histogram", tooltip: { label: "Histogram" } },
];

export function ReviewPanel({
  history,
  onJump,
  onDelete,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  objects,
  onSelectObject,
  onDeleteObject,
  userMode,
  layers,
  onAddLayer,
  onDuplicateLayer,
  onDeleteLayer,
  onSelectLayer,
  onToggleLayerVisible,
  onSetLayerOpacity,
  onRenameLayer,
  onMoveLayer,
  onMergeDown,
  onFlattenAll,
  getHistogram,
  histogramSignature,
  histogramPhotoKey,
  embedded = false,
}: Props) {
  // Which body sections are open. The body splits its height evenly among the
  // open sections (1 → full, 2 → halves, 3 → thirds), each with its own header
  // and scroll area. All three start open.
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    history: true,
    layers: true,
    reselect: true,
    histogram: false, // starts closed to keep the panel roomy
  });
  // At most three sections open at once. Closing is always allowed. Opening a
  // fourth evicts one to make room: Reselect yields first (so clicking Histogram
  // bumps Reselect), but if you've manually closed a different section there's a
  // free slot and Histogram just fills it — nothing gets bumped.
  const toggle = (k: SectionKey) =>
    setOpen((prev) => {
      if (prev[k]) return { ...prev, [k]: false };
      const openKeys = TOGGLES.map((t) => t.key).filter((key) => prev[key]);
      if (openKeys.length < 3) return { ...prev, [k]: true };
      const victim: SectionKey =
        k !== "reselect" && prev.reselect
          ? "reselect"
          : (openKeys.find((key) => key !== k) as SectionKey);
      return { ...prev, [victim]: false, [k]: true };
    });
  const openCount = TOGGLES.filter((t) => open[t.key]).length;

  // Inline-rename state for the Layers list (null = not renaming).
  // #57 — undo/redo restores the active layer from the SNAPSHOT, so a
  // selection made after an op is silently discarded. Flash the row that
  // moved; see hooks/useLayerSwapFlash.ts for why the swap itself is deferred.
  const { flashingId, markUserSelection } = useLayerSwapFlash(
    layers.find((l) => l.active)?.id,
  );

  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  // Per-tier layer allowance. 0 → feature locked (must log in / upgrade).
  const layerLimit = TIERS[userMode].layersPerImage;
  const layersUnlocked = layerLimit > 0;
  const canAddLayer = layersUnlocked && layers.length < layerLimit;
  // Render top → bottom (the array is bottom → top), the way every editor shows it.
  const layersTopDown = [...layers].reverse();

  const commitRename = (id: number) => {
    const name = renameDraft.trim();
    if (name) onRenameLayer(id, name);
    setRenamingId(null);
  };

  return (
    <motion.aside
      variants={embedded ? undefined : slideFromRight}
      initial={embedded ? undefined : "hidden"}
      animate={embedded ? undefined : "visible"}
      exit={embedded ? undefined : "exit"}
      aria-label="Review"
      className={
        embedded
          ? // Compact master-bar content box: flush below the 48px chrome.
            "fixed left-2 top-[58px] bottom-[var(--panel-bottom)] z-[var(--z-panel)] w-[252px] rounded-b-xl border border-t-0 border-border bg-bg-secondary flex flex-col overflow-hidden"
          : "review-panel"
      }
    >
      {/* No title/close — the four section toggles below are the header. */}

      {/* ── Section toggles — same multi-select button group the top bar
          uses for Upload / Tools / Gallery. ───────────────────────────── */}
      <div className="review-toggles">
        <ToggleButtonGroup
          fill
          compact
          items={TOGGLES.map(({ key, icon, label, tooltip }) => ({
            key,
            icon,
            label,
            tooltip,
            active: open[key],
            onToggle: () => toggle(key),
          }))}
        />
      </div>

      {/* ── Body: open sections share the height; each scrolls ──────────── */}
      <div className="review-body">
        {openCount === 0 && (
          <div className="review-empty">
            <span className="large-badge">Toggle a section above</span>
          </div>
        )}

        {open.history && (
          <section className="review-section">
            <div className="review-section-head">
              <History className="h-3.5 w-3.5" />
              <span className="review-section-name">History</span>
              <div className="ml-auto flex items-center gap-1.5">
                <Button size="tiny" onClick={onUndo} disabled={!canUndo} title="Undo">
                  <Undo2 className="h-3.5 w-3.5" />
                </Button>
                <Button size="tiny" onClick={onRedo} disabled={!canRedo} title="Redo">
                  <Redo2 className="h-3.5 w-3.5" />
                </Button>
                <TinyNumberBox>{history.length}</TinyNumberBox>
              </div>
            </div>
            <div className="history-list">
              {history.length === 0 && (
                <div className="history-empty">
                  <span className="large-badge">No history yet</span>
                </div>
              )}
              {history.map((entry, listIdx) => (
                // FIX: compound key so identical entry.index values across
                // re-renders never collide (seen when redo stack rebuilds).
                <ReselectBar
                  key={`${entry.type}-${entry.index}-${listIdx}`}
                  type={entry.type}
                  index={entry.index}
                  label={entry.label}
                  onSelect={() => onJump(entry.index)}
                  onDelete={
                    entry.type === "undo"
                      ? () => onDelete(entry.index)
                      : undefined
                  }
                  deleteLabel="Delete entry"
                  title={
                    entry.type === "current"
                      ? "Current state"
                      : `Jump to: ${entry.label}`
                  }
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Reselect: live placed objects (text + shapes) ───────────────
            Click a row to load it back into the canvas edit overlay (move /
            resize / re-angle); hover the X to delete it. */}
        {open.reselect && (
          <section className="review-section">
            <div className="review-section-head">
              <MousePointerSquareDashed className="h-3.5 w-3.5" />
              <span className="review-section-name">Reselect</span>
              <div className="ml-auto flex items-center gap-1.5">
                <TinyNumberBox>{objects.length}</TinyNumberBox>
                <Button size="tiny"
                  onClick={() => toggle("reselect")}
                  title="Close section"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="history-list reselect-list">
              {objects.length === 0 && (
                <div className="history-empty">
                  <span className="large-badge">
                    Add text or a shape to reselect it
                  </span>
                </div>
              )}
              {objects.map((o) => (
                <ReselectBar
                  key={o.key}
                  label={o.label}
                  onSelect={() => onSelectObject(o)}
                  onDelete={() => onDeleteObject(o)}
                  title={`Reselect ${o.label}`}
                  deleteLabel={`Delete ${o.label}`}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Layers: Photoshop-style stack (top → bottom). ───────────────── */}
        {open.layers && (
          <section className="review-section">
            <div className="review-section-head">
              <Layers className="h-3.5 w-3.5" />
              <span className="review-section-name">Layers</span>
              <div className="ml-auto flex items-center gap-1.5">
                {/* Actual layer count (consistent with History/Reselect counts);
                    the per-tier allowance lives in the tooltip. */}
                <TinyNumberBox
                  title={`${layers.length} layer${layers.length === 1 ? "" : "s"} · limit ${TIERS[userMode].layersLabel}`}
                >
                  {layers.length}
                </TinyNumberBox>
                {/* v8.38 — the signpost to where the mask buttons went: the
                    Layers tool (Edit → Layers). Same store-driven activation
                    the rail and command palette use; hand-built route strings
                    bounce. */}
                <Button size="tiny"
                  onClick={() => {
                    // Keys are namespaced `group/id` — the bare id is a
                    // silent undefined (caught in the browser, 2026-08-14).
                    const t = subToolByKey("edit/resize-layer");
                    if (t) activateSubTool(t);
                  }}
                  title="Open the Layers tool (move, resize, mask)"
                >
                  <Settings className="h-3.5 w-3.5" />
                </Button>
                <Button size="tiny"
                  onClick={onAddLayer}
                  disabled={!canAddLayer}
                  title={
                    !layersUnlocked
                      ? "Layers require a logged-in or paid account"
                      : canAddLayer
                        ? "Add layer"
                        : `Layer limit reached (${TIERS[userMode].layersLabel})`
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button size="tiny"
                  onClick={onFlattenAll}
                  disabled={!layersUnlocked || layers.length < 2}
                  title="Flatten all layers"
                >
                  <Layers2 className="h-3.5 w-3.5" />
                </Button>
                <Button size="tiny"
                  onClick={() => toggle("layers")}
                  title="Close section"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {!layersUnlocked ? (
              <div className="review-coming-soon">
                <span className="large-badge">
                  Log in to unlock layers
                </span>
              </div>
            ) : (
              // role="group", not the implicit `list`: every row below carries
              // a button role, so a `list` here would claim listitem children
              // it does not have. A real listbox/option pair would be the
              // richer answer, but it demands roving tabindex + arrow keys AND
              // options with no interactive descendants — these rows carry six
              // buttons each. Filed, not faked.
              //
              // (Prose deliberately avoids the literal attribute spelling:
              //  scripts/guardrails.sh greps that attribute on lines lacking
              //  an aria-label, and it cannot tell a comment from code — this
              //  comment failed the ratchet on its first push.)
              <ul className="history-list layers-list" role="group" aria-label="Layers">
                {layersTopDown.map((layer) => {
                  // Stack index in the bottom→top array (for reorder math).
                  const idx = layers.findIndex((l) => l.id === layer.id);
                  const isTop = idx === layers.length - 1;
                  const isBottom = idx === 0;
                  return (
                    <li
                      key={layer.id}
                      className={`full-width-badge layer-row ${
                        layer.active ? "layer-active" : ""
                      } ${layer.id === flashingId ? "layer-swapped" : ""}`}
                      role="button"
                      tabIndex={0}
                      // #10: which layer is active was carried ONLY by the
                      // `layer-active` class — visible, and announced to
                      // nobody. `aria-current` rather than `aria-pressed`
                      // because a layer cannot be un-selected: clicking one
                      // moves the selection, it does not toggle this row off.
                      aria-current={layer.active ? "true" : undefined}
                      // #57: mark the pick BEFORE delegating, so the swap
                      // this causes is recognised as the user's own and stays
                      // quiet. Only a selection nobody asked for flashes.
                      onClick={() => {
                        markUserSelection(layer.id);
                        onSelectLayer(layer.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          markUserSelection(layer.id);
                          onSelectLayer(layer.id);
                        }
                      }}
                      title={`Select ${layer.name}`}
                    >
                      <Button
                        size="xs"
                        title={layer.visible ? "Hide layer" : "Show layer"}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLayerVisible(layer.id, !layer.visible);
                        }}
                      >
                        {/* Icon swap stays here (out of the button component) so
                            it isn't baked in as a one-off variant. */}
                        {layer.visible ? <Eye /> : <EyeOff className="opacity-40" />}
                      </Button>

                      {renamingId === layer.id ? (
                        <input
                          className="layer-rename-input"
                          autoFocus
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={() => commitRename(layer.id)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Enter") commitRename(layer.id);
                            else if (e.key === "Escape") setRenamingId(null);
                          }}
                        />
                      ) : (
                        <span
                          className="large-badge layer-name"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setRenameDraft(layer.name);
                            setRenamingId(layer.id);
                          }}
                          title="Double-click to rename"
                        >
                          {layer.name}
                        </span>
                      )}

                      <div className="layer-row-actions">
                        <Button
                          size="xs"
                          title="Move up"
                          disabled={isTop}
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveLayer(layer.id, idx + 1);
                          }}
                        >
                          <ChevronUp />
                        </Button>
                        <Button
                          size="xs"
                          title="Move down"
                          disabled={isBottom}
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveLayer(layer.id, idx - 1);
                          }}
                        >
                          <ChevronDown />
                        </Button>
                        <Button
                          size="xs"
                          title="Merge down"
                          disabled={isBottom}
                          onClick={(e) => {
                            e.stopPropagation();
                            onMergeDown(layer.id);
                          }}
                        >
                          <Layers2 />
                        </Button>
                        {/* v8.38 — the per-row mask button moved to the Layers
                            tool panel (Edit → Layers), one set of controls
                            acting on the selected layer. A masked layer still
                            announces itself here without offering a control. */}
                        {layer.hasMask && (
                          <span
                            className="text-theme-muted-foreground"
                            title="Has a layer mask — edit it in the Layers tool (gear above)"
                          >
                            <Aperture className="h-3.5 w-3.5" />
                          </span>
                        )}
                        <Button
                          size="xs"
                          title="Duplicate layer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicateLayer(layer.id);
                          }}
                        >
                          <Copy />
                        </Button>
                        <Button
                          size="xs"
                          title="Delete layer"
                          disabled={layers.length <= 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteLayer(layer.id);
                          }}
                        >
                          <DeleteGlyph />
                        </Button>
                      </div>

                      {/* Opacity slider for the active layer. */}
                      {layer.active && (
                        <div
                          className="layer-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round(layer.opacity * 100)}
                            onChange={(e) =>
                              onSetLayerOpacity(
                                layer.id,
                                Number(e.target.value) / 100,
                              )
                            }
                          />
                          <span className="layer-opacity-val">
                            {Math.round(layer.opacity * 100)}%
                          </span>
                        </div>
                      )}

                      {/* The mask-control bar that lived here moved to the
                          Layers tool panel in v8.38 — same handlers, one
                          home, acting on the selected layer (the gear in the
                          section head is the signpost). */}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {/* ── Histogram: live RGB / luminance distribution of the canvas.
            The chart itself is the standalone, self-styled HistogramView; this
            section just gives it a height-constrained flex slot. ──────────── */}
        {open.histogram && (
          <section className="review-section">
            <div className="review-section-head">
              <ChartArea className="h-3.5 w-3.5" />
              <span className="review-section-name">Histogram</span>
              <div className="ml-auto flex items-center gap-1.5">
                <Button size="tiny"
                  onClick={() => toggle("histogram")}
                  title="Close section"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <HistogramView
              getHistogram={getHistogram}
              signature={histogramSignature}
              photoKey={histogramPhotoKey}
              active={open.histogram}
            />
          </section>
        )}
      </div>
    </motion.aside>
  );
}
