// AI tool panel. Background Removal and Object Removal are wired to the
// Replicate + Convex pipeline (useAIJob). Text Extract (OCR) moved to the
// Text tool (TextSettings.tsx) — it's a text-shaped feature, not an
// image-shaped one, and it has its own dedicated useAIJob instance there now.
// 4x Upscale's Coming Soon placeholder moved to EffectsSettings.tsx.
import { useState } from "react";
import { Scissors, Eraser, Wand2, Trash2, Lock } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { SizeSlider } from "@/components/SizeSlider";
import { SectionHeader } from "@/components/ui/section-header";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import type { MutableRefObject } from "react";
import type { ImageHorseTool } from "stamp_tool";
import type { ToolSettings } from "@/lib/types";
import { useAIJob, type AIResultPixels } from "@/hooks/useAIJob";
import { useToolStore, type EraserMode } from "@/stores/useToolStore";
import { ObjectRemovalModal } from "./ObjectRemovalModal";

const OPACITY_PRESETS = [25, 50, 75, 100] as const;
const HARDNESS_PRESETS = [25, 50, 75, 100] as const;
const ERASER_SIZE_PRESETS = [8, 16, 32, 64] as const;

type LiveType = "rembg" | "inpaint";

// Deliberately NOT ToolModeToggle — that component mysteriously fails to
// re-render its render-prop body in this file's sibling TextSettings.tsx
// (root cause never pinned down after real investigation; see that file's
// history). Plain ToolButtonGroup + a switch is the proven-working pattern
// used there instead, so it's used here too rather than risk the same bug.
const ERASER_MODES: {
  id: EraserMode;
  label: string;
  icon: typeof Eraser;
  title: string;
  info: string;
}[] = [
  {
    id: "brush",
    label: "Eraser",
    icon: Eraser,
    title: "Brush",
    info: "Drag on the canvas to scrub the active layer to transparent — revealing whatever's beneath it. Lower opacity erases gradually. Local, free, no sign-in.",
  },
  {
    id: "magic",
    label: "Magic Eraser",
    icon: Wand2,
    title: "Magic Eraser",
    info: "Local object removal (PatchMatch) — free, runs on your device, no sign-in required. Coming soon.",
  },
  {
    id: "rembg",
    label: "Background Removal",
    icon: Scissors,
    title: "Background Removal",
    info: "Cuts the subject out from its background in one pass (Replicate-backed).",
  },
  {
    id: "inpaint",
    label: "Object Removal",
    icon: Trash2,
    title: "Object Removal",
    info: "Paint a mask over an unwanted object and it's removed and filled in (Replicate-backed).",
  },
];

interface AISettingsProps {
  aiEnabled?: boolean;
  activePhotoId: string | null;
  stampToolRef: MutableRefObject<ImageHorseTool | null>;
  /** Called with decoded RGBA pixels when an image model finishes. */
  onAIResult: (r: AIResultPixels) => void;
  /** Brush Eraser settings — this tool now drives the canvas eraser directly
   *  (useEffectiveTool routes `activeTool === "ai"` to eraserTool always),
   *  same size/hardness/opacity fields Paint's old Eraser sub-mode used. */
  settings: ToolSettings;
  onChange: (s: ToolSettings) => void;
}

/** Eraser tool (id "ai" — repurposed from AI). Brush eraser first (drag on
 *  canvas), then the AI-powered removal actions: Magic Eraser (local
 *  PatchMatch), Background Removal, Object Removal — Replicate-backed ->
 *  Paid tier only (see lib/tiers.ts). */
export function AISettings({
  aiEnabled = false,
  activePhotoId,
  stampToolRef,
  onAIResult,
  settings,
  onChange,
}: AISettingsProps) {
  const { run, phase, busy, error } = useAIJob(onAIResult);
  const [lastType, setLastType] = useState<LiveType | null>(null);
  const [showObjModal, setShowObjModal] = useState(false);
  const [objSource, setObjSource] = useState<Uint8Array | null>(null);
  // Lives in the shared tool store (not local state) so canvas routing
  // (useEffectiveTool) can see which sub-mode is selected — the prerequisite
  // for Magic Eraser to receive paint strokes once that routing lands.
  const mode = useToolStore((s) => s.eraserMode);
  const setMode = useToolStore((s) => s.setEraserMode);
  const activeModeInfo = ERASER_MODES.find((m) => m.id === mode)!;

  const canRun = aiEnabled && !!activePhotoId && !!stampToolRef.current;

  const runModel = (type: "rembg") => {
    const tool = stampToolRef.current;
    if (!tool || !activePhotoId) return;
    const png = new Uint8Array(tool.export_png());
    setLastType(type);
    void run(type, activePhotoId, png);
  };

  const openObjModal = () => {
    const tool = stampToolRef.current;
    if (!tool || !activePhotoId) return;
    setObjSource(new Uint8Array(tool.export_png()));
    setShowObjModal(true);
  };

  const confirmObjRemoval = (maskPng: Uint8Array) => {
    if (!activePhotoId || !objSource) return;
    setShowObjModal(false);
    setLastType("inpaint");
    void run("inpaint", activePhotoId, objSource, maskPng);
  };

  return (
    <div className="space-y-4 -mt-2">
      <ToolButtonGroup
        stacked
        columns={2}
        options={ERASER_MODES}
        value={mode}
        onChange={setMode}
      />
      <SectionHeader title={activeModeInfo.title} info={activeModeInfo.info} />

      {mode === "brush" && (
        <>
          {/* Local, free, no sign-in — useEffectiveTool routes activeTool
              "ai" straight to eraserTool regardless of this panel's mode, so
              dragging on canvas always erases even while another tile (e.g.
              Object Removal) is selected here. */}
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
      )}

      {mode === "magic" && (
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-theme-muted/40 px-2 py-0.5 text-2xs font-bold uppercase tracking-wider text-theme-foreground/70">
            Coming Soon
          </span>
        </div>
      )}

      {(mode === "rembg" || mode === "inpaint") && (
        <>
          {!aiEnabled && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
              <Lock className="h-4 w-4 shrink-0 text-warning mt-0.5" />
              <p className="text-2xs text-warning/90">
                This needs <strong>sign-in</strong> + a <strong>Paid</strong> plan.
              </p>
            </div>
          )}

          {mode === "rembg" && (
            <button
              type="button"
              onClick={() => runModel("rembg")}
              disabled={!canRun || busy}
              className="w-full flex items-center justify-center gap-2 rounded-md bg-purple-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {!aiEnabled && <Lock className="h-3.5 w-3.5" />}
              {busy && lastType === "rembg" && <Spinner size={14} />}
              {lastType === "rembg" && phase === "uploading"
                ? "Uploading..."
                : lastType === "rembg" && phase === "running"
                  ? "Removing background..."
                  : "Remove Background"}
            </button>
          )}
          {mode === "rembg" && lastType === "rembg" && error && (
            <p className="text-2xs text-destructive leading-relaxed">{error}</p>
          )}
          {mode === "rembg" && lastType === "rembg" && phase === "done" && !error && (
            <p className="text-2xs text-success">
              Background removed - applied to canvas.
            </p>
          )}

          {mode === "inpaint" && (
            <button
              type="button"
              onClick={openObjModal}
              disabled={!canRun || busy}
              className="w-full flex items-center justify-center gap-2 rounded-md bg-purple-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {!aiEnabled && <Lock className="h-3.5 w-3.5" />}
              {busy && lastType === "inpaint" && <Spinner size={14} />}
              {lastType === "inpaint" && phase === "uploading"
                ? "Uploading..."
                : lastType === "inpaint" && phase === "running"
                  ? "Removing object..."
                  : "Remove Object"}
            </button>
          )}
          {mode === "inpaint" && lastType === "inpaint" && error && (
            <p className="text-2xs text-destructive leading-relaxed">{error}</p>
          )}
          {mode === "inpaint" && lastType === "inpaint" && phase === "done" && !error && (
            <p className="text-2xs text-success">
              Object removed - applied to canvas.
            </p>
          )}
        </>
      )}

      <ObjectRemovalModal
        open={showObjModal}
        busy={busy && lastType === "inpaint"}
        sourcePng={objSource}
        onClose={() => setShowObjModal(false)}
        onConfirm={confirmObjRemoval}
      />
    </div>
  );
}
