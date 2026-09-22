// AI tool panel. Background Removal and Object Removal are wired to the
// Replicate + Convex pipeline (useAIJob). Text Extract (OCR) moved to the
// Text tool (TextSettings.tsx) — it's a text-shaped feature, not an
// image-shaped one, and it has its own dedicated useAIJob instance there now.
// 4x Upscale has NO placeholder anywhere any more: its grayed tile lived in
// the Quick Adjust grid, and that grid was retired when Enhance › Presets
// landed. There is no surface for it in the editor until it is built.
//
// Object Removal paints its mask ON THE CANVAS (ObjectRemovalOverlay), not in
// a popup. The old ObjectRemovalModal re-drew the frame onto a private canvas
// inside a portal and asked the user to paint there, at a third scale, beside
// the image they were actually editing. The mask bytes are unchanged — same
// strokes, same rasterizer, same black/white PNG at native resolution — only
// the surface moved. This panel keeps the controls (brush size, undo, clear,
// cancel, confirm) and the store holds the paint.
import { useEffect, useRef, useState } from "react";
import { Scissors, Eraser, BroomSparkles, Trash2, Lock, Undo2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { StabilizerRow } from "./StabilizerRow";
import { SizeSlider } from "@/components/SizeSlider";
import { SectionHeader } from "@/components/ui/section-header";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import type { MutableRefObject } from "react";
import type { ImageHorseTool } from "stamp_tool";
import type { ToolSettings } from "@/lib/types";
import { useAIJob, type AIResultPixels } from "@/hooks/useAIJob";
import { useToolStore, type EraserMode } from "@/stores/useToolStore";
import { isPatchmatchEnabled } from "@/lib/patchmatch";
import {
  buildObjectRemovalMaskPng,
  hasMaskPaint,
  pngDimensions,
} from "@/lib/objectRemovalMask";
import { useUIStore } from "@/stores/useUIStore";
import { OnlineFeaturesOffNotice } from "@/components/OnlineFeaturesOffNotice";

const OPACITY_PRESETS = [25, 50, 75, 100] as const;
const HARDNESS_PRESETS = [25, 50, 75, 100] as const;
const ERASER_SIZE_PRESETS = [8, 16, 32, 64] as const;
/** Object Removal's mask brush, in IMAGE pixels. Spans the popup's old 8-120
 *  range so a mask painted before this change would be painted the same way
 *  now. */
const MASK_BRUSH_PRESETS = [8, 40, 80, 120] as const;

type LiveType = "rembg" | "inpaint";

// Deliberately NOT ToolModeToggle — that component mysteriously fails to
// re-render its render-prop body in this file's sibling TextSettings.tsx
// (root cause never pinned down after real investigation; see that file's
// history). A plain SectionHeader + a switch on `mode` is the proven-working
// pattern used there instead, so it's used here too rather than risk the bug.
//
// This array outlived the hoist: the TILES it fed now render in the header
// (SubtoolRow, via toolModes.ts LEGACY_SUBMODES.ai), but the per-mode
// title/info below is still resolved from here.
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
    // Header reads "Eraser", matching the sub-tool tile. It said "Brush",
    // which named the implement rather than the tool and sat directly above
    // a "Brush Size" field, so the panel opened on the same word twice.
    title: "Eraser",
    info: "Drag on the canvas to scrub the active layer to transparent — revealing whatever's beneath it. Lower opacity erases gradually. Stroke Stabilizer smooths shaky drags. Local, free, no sign-in.",
  },
  {
    id: "magic",
    label: "Magic Eraser",
    icon: BroomSparkles,
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
  /** Brush Eraser settings — this tool drives the canvas eraser directly
   *  (useEffectiveTool routes `activeTool === "ai"` to eraserTool in Brush
   *  mode, magicEraserTool in Magic Eraser mode), same size/hardness/opacity
   *  fields Paint's old Eraser sub-mode used (Magic Eraser reuses size +
   *  hardness only — see the `mode === "magic"` branch below). */
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
  // Object Removal's mask lives in the tool store, because the surface it is
  // painted on (the canvas) is in a different subtree from these controls.
  const masking = useToolStore((s) => s.objectRemovalMasking);
  const setMasking = useToolStore((s) => s.setObjectRemovalMasking);
  const strokes = useToolStore((s) => s.objectRemovalStrokes);
  const maskBrush = useToolStore((s) => s.objectRemovalBrush);
  const setMaskBrush = useToolStore((s) => s.setObjectRemovalBrush);
  const undoStroke = useToolStore((s) => s.undoObjectRemovalStroke);
  const clearStrokes = useToolStore((s) => s.clearObjectRemovalStrokes);
  const setMaskBusy = useToolStore((s) => s.setObjectRemovalBusy);
  // Lives in the shared tool store (not local state) so canvas routing
  // (useEffectiveTool) can see which sub-mode is selected — the prerequisite
  // for Magic Eraser to receive paint strokes once that routing lands.
  const mode = useToolStore((s) => s.eraserMode);
  const activeModeInfo = ERASER_MODES.find((m) => m.id === mode)!;
  // Magic Eraser — SHIPPED ON since v7.46; `ih_patchmatch` is a "0" kill
  // switch (see lib/patchmatch.ts), and this mode calls the same
  // remove_object that SelectSettings' Remove Object button does, on
  // release. With the switch killed (or on a wasm build without the export)
  // the tile falls back to ERASER_MODES' static "Coming soon" text below.
  const patchmatchEnabled = isPatchmatchEnabled();
  const headerInfo =
    mode === "magic" && patchmatchEnabled
      ? "Brush over the whole unwanted object and release — it's selected and removed in one stroke, on your device, no sign-in. Cover all of it: a partial stroke lets the fill rebuild the object from its own leftovers. Big areas can come out soft."
      : activeModeInfo.info;

  /** The two Replicate-backed actions. They are ONE sub-tool (Enhance › AI)
   *  and both render together.
   *
   *  They used to be two exclusive modes picked from this panel's own tile row
   *  — but that row moved into the sub-tool header, and the five-group
   *  restructure then gave the header the GROUP's sub-tools instead of this
   *  tool's modes. Enhance › AI pins `eraserMode` to "rembg", and nothing was
   *  left that could set "inpaint", so Object Removal became unreachable.
   *  Rendering both buttons removes the dependence on a mode picker that no
   *  longer exists — and they were never really exclusive: they are two
   *  buttons, not two states. */
  const isReplicate = mode === "rembg" || mode === "inpaint";

  // Background and object removal upload the image — not offered while the
  // "Everything in your browser" switch is on (useAIJob refuses them too).
  const onlineFeaturesEnabled = useUIStore((s) => s.onlineFeaturesEnabled);
  const canRun =
    aiEnabled && onlineFeaturesEnabled && !!activePhotoId && !!stampToolRef.current;

  const runModel = async (type: "rembg") => {
    const tool = stampToolRef.current;
    if (!tool || !activePhotoId) return;
    const png = new Uint8Array(await tool.export_png());
    setLastType(type);
    void run(type, activePhotoId, png);
  };

  /** Put the canvas into mask-painting mode. Nothing is exported here: the
   *  popup had to capture the frame up front because it drew its own copy of
   *  it, and capturing early is what made its mask describe a document state
   *  that could already have moved on. The real canvas needs no copy, so the
   *  ONE engine read happens at confirm time instead — see below. */
  const startMasking = () => {
    if (!stampToolRef.current || !activePhotoId) return;
    // Deliberately touches NO job state — `lastType` is set at confirm, the
    // way the popup's own confirm did. Setting it here instead looked
    // harmless and was not: `lastType` + `phase` are read together, so
    // entering the mode after ANY finished job made the pair read
    // ("inpaint", "done") and the exit effect below fired on the spot. The
    // brush was unreachable for the rest of the session.
    setMasking(true);
  };

  const cancelMasking = () => setMasking(false);

  const confirmObjRemoval = async () => {
    const tool = stampToolRef.current;
    if (!tool || !activePhotoId || !hasMaskPaint(strokes)) return;
    // ATOMIC CAPTURE. One engine call, one document state: the source PNG is
    // read once, and the mask is rasterized to THAT PNG's own dimensions. The
    // mask therefore cannot be sized to a frame the source is not — which is
    // the failure mode a display-sized or separately-measured mask has, and
    // it is silent (the model erases the wrong region rather than erroring).
    const png = new Uint8Array(await tool.export_png());
    const { width, height } = await pngDimensions(png);
    const maskPng = await buildObjectRemovalMaskPng(strokes, width, height);
    setLastType("inpaint");
    // Masking stays ON while the model runs, so the painted region is still
    // visible over the object it is removing; the overlay stops taking the
    // pointer. The effect below drops both when the job lands.
    setMaskBusy(true);
    void run("inpaint", activePhotoId, png, maskPng);
  };

  const inpaintBusy = busy && lastType === "inpaint";
  /** At least one stroke exists — the same gate the popup's `hasMask` state
   *  was, derived from the strokes rather than tracked alongside them. */
  const painted = hasMaskPaint(strokes);

  // Leave mask mode when the inpaint job finishes, fails, or this panel goes
  // away (tool switch, sign-out, the AI sub-tool losing its Replicate mode).
  // A live overlay whose panel is gone would take every canvas click with no
  // way to confirm or cancel — the one way this mode could strand a user.
  const replicateAvailable = isReplicate && aiEnabled && onlineFeaturesEnabled;
  useEffect(() => {
    if (!replicateAvailable) setMasking(false);
  }, [replicateAvailable, setMasking]);

  // Watches the TRANSITION out of busy, not the value of `phase`. `phase` is
  // sticky — it sits on "done"/"error" until the next job starts — so a rule
  // written against it fires on state left over from the last run rather than
  // on this run ending. This arms only once a mask job is actually in flight
  // and fires only when that job stops being in flight.
  const inpaintRanRef = useRef(false);
  useEffect(() => {
    if (!masking) return;
    if (inpaintBusy) {
      inpaintRanRef.current = true;
      return;
    }
    if (inpaintRanRef.current) {
      inpaintRanRef.current = false;
      setMasking(false);
    }
  }, [masking, inpaintBusy, setMasking]);

  useEffect(() => () => setMasking(false), [setMasking]);

  return (
    // The four mode tiles moved to the ToolsSidebar header (SubtoolRow), which
    // reads/writes this same `eraserMode` via toolModes.ts. `-mt-2` went with
    // them — it only existed to tuck that row under the panel's top padding.
    <div className="space-y-4">
      {/* The AI sub-tool owns BOTH Replicate actions, so its header names the
          sub-tool rather than whichever mode happens to be set. Brush and
          Magic Eraser are their own Create sub-tools and keep their own. */}
      {isReplicate ? (
        <SectionHeader
          title="AI"
          info="Runs on Replicate, so it needs sign-in and a Paid plan. Background Removal cuts the subject out; Object Removal hands the canvas a brush, you paint over what should go, and the model fills it back in."
        />
      ) : (
        <SectionHeader title={activeModeInfo.title} info={headerInfo} />
      )}

      {mode === "brush" && (
        <>
          {/* Local, free, no sign-in — useEffectiveTool routes activeTool
              "ai" to eraserTool while this panel is in Brush mode (magic
              mode below routes to magicEraserTool instead). */}
          <SizeSlider
            label="Eraser Size"
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
          {/* The engine has ALWAYS honoured this on the eraser — `erase_down`
              takes `settings.paintStabilizer` (usePaintTool.ts:91-98) and
              `types.ts:39` already documents the setting as "shared by the
              Paint brush and the Eraser". There was simply no control, so a
              working feature was unreachable from this panel. */}
          <StabilizerRow
            value={settings.paintStabilizer}
            onChange={(paintStabilizer) => onChange({ ...settings, paintStabilizer })}
          />
        </>
      )}

      {mode === "magic" &&
        (patchmatchEnabled ? (
          <>
            {/* Local, free, no sign-in — drag over the object, release, it's
                gone. No opacity control: the brush paints a binary
                selection mask (hard-edge day-1, see the Rust doc comment on
                `paint_selection_mask`), not alpha-blended pixels, so an
                opacity slider would promise a gradient this mode doesn't
                have. Same size/hardness fields Brush Eraser uses above —
                one physical brush, two different jobs. */}
            <SizeSlider
              label="Brush Size"
              value={settings.eraserSize}
              min={1}
              max={100}
              onChange={(v) => onChange({ ...settings, eraserSize: v })}
              presets={ERASER_SIZE_PRESETS}
            />
            <SizeSlider
              label="Hardness"
              value={settings.eraserHardness}
              onChange={(v) => onChange({ ...settings, eraserHardness: v })}
              presets={HARDNESS_PRESETS}
              variant="numbers"
              unit="%"
            />
            {/* Last in the row, matching Brush Eraser above. The mask drag is
                the same paint stroke engine, so the same leash applies. */}
            <StabilizerRow
              value={settings.paintStabilizer}
              onChange={(paintStabilizer) => onChange({ ...settings, paintStabilizer })}
            />
          </>
        ) : (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-theme-muted/40 px-2 py-0.5 text-2xs font-bold uppercase tracking-wider text-theme-foreground/70">
              Coming Soon
            </span>
          </div>
        ))}

      {isReplicate && (
        <>
          {!onlineFeaturesEnabled && (
            <OnlineFeaturesOffNotice what="Remove Background and Remove Object send the image to a server." />
          )}
          {onlineFeaturesEnabled && !aiEnabled && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
              <Lock className="h-4 w-4 shrink-0 text-warning mt-0.5" />
              <p className="text-2xs text-warning/90">
                This needs <strong>sign-in</strong> + a <strong>Paid</strong> plan.
              </p>
            </div>
          )}

          {/* The same stacked tile group Select → Wand's Selection row uses,
              in ACTION mode (no `value`, so nothing ever lights). These were
              two hand-rolled `bg-purple-600` buttons with white text — a
              color that is in no theme token and a shape that matched nothing
              else in the sidebar, which is why they read as a different app.
              The key badge replaces the inline `Lock` glyph: same message,
              same corner as `Create AI Image`, and it no longer competes with
              the spinner for the row. */}
          {masking ? (
            /* ── Mask painting is live: the canvas is the surface ──────────
               These replace the two action tiles rather than sitting under
               them. While a mask is being painted, starting Background
               Removal is not a thing the user can coherently want, and the
               popup that used to own these controls made the same choice by
               covering the panel. */
            <div className="space-y-3 rounded-lg border border-border bg-bg-elevated/60 p-3">
              <p className="text-2xs leading-relaxed text-text-secondary">
                Paint over the object on the canvas, then choose Remove Object.
                Press <kbd className="font-mono">Esc</kbd> to cancel.
              </p>
              <SizeSlider
                label="Brush Size"
                value={maskBrush}
                min={8}
                max={120}
                onChange={setMaskBrush}
                presets={MASK_BRUSH_PRESETS}
                disabled={inpaintBusy}
              />
              <div className="flex items-center gap-2">
                <Button
                  className="flex-1"
                  onClick={undoStroke}
                  disabled={!painted || inpaintBusy}
                  title="Undo the last brush stroke"
                >
                  {/* "Undo Stroke", not "Undo": the top bar already has an
                      Undo, and two controls with the same accessible name
                      doing different things is exactly what a screen-reader
                      user cannot disambiguate. Same reason for Clear Mask. */}
                  <Undo2 /> Undo Stroke
                </Button>
                <Button
                  className="flex-1"
                  onClick={clearStrokes}
                  disabled={!painted || inpaintBusy}
                  title="Clear the whole mask"
                >
                  <Eraser /> Clear Mask
                </Button>
              </div>
              <div className="flex items-center gap-2">
                {/* Stays ENABLED while the job runs, and says what it does
                    then: the mask is already uploaded, so this dismisses the
                    overlay rather than cancelling the removal. Disabling it
                    would leave a mouse-only user behind a surface that takes
                    every canvas click until a job that may never settle does.
                    Escape is the keyboard twin and is never gated. */}
                <Button className="flex-1" onClick={cancelMasking}>
                  {inpaintBusy ? "Hide Mask" : "Cancel"}
                </Button>
                <Button
                  size="large"
                  className="flex-1"
                  onClick={() => void confirmObjRemoval()}
                  disabled={!painted || !canRun || inpaintBusy}
                >
                  {inpaintBusy ? <Spinner size={14} /> : <BroomSparkles />}
                  {inpaintBusy
                    ? phase === "uploading"
                      ? "Uploading..."
                      : "Removing..."
                    : "Remove Object"}
                </Button>
              </div>
            </div>
          ) : (
          <ToolButtonGroup<"rembg" | "inpaint">
            columns={2}
            stacked
            disabled={!canRun || busy}
            onChange={(id) => {
              if (id === "rembg") void runModel("rembg");
              else startMasking();
            }}
            options={[
              {
                id: "rembg",
                label:
                  lastType === "rembg" && phase === "uploading"
                    ? "Uploading..."
                    : lastType === "rembg" && phase === "running"
                      ? "Removing..."
                      : "Remove Background",
                icon:
                  busy && lastType === "rembg"
                    ? () => <Spinner size={24} />
                    : Scissors,
                pro: true,
                title: "Remove the background (Pro)",
              },
              {
                id: "inpaint",
                label:
                  lastType === "inpaint" && phase === "uploading"
                    ? "Uploading..."
                    : lastType === "inpaint" && phase === "running"
                      ? "Removing..."
                      : "Remove Object",
                icon:
                  busy && lastType === "inpaint"
                    ? () => <Spinner size={24} />
                    : BroomSparkles,
                pro: true,
                title: "Remove an object (Pro)",
              },
            ]}
          />
          )}
          {lastType === "rembg" && error && (
            <p className="text-2xs text-destructive leading-relaxed">{error}</p>
          )}
          {lastType === "rembg" && phase === "done" && !error && (
            <p className="text-2xs text-success">
              Background removed - applied to canvas.
            </p>
          )}

          {lastType === "inpaint" && error && (
            <p className="text-2xs text-destructive leading-relaxed">{error}</p>
          )}
          {lastType === "inpaint" && phase === "done" && !error && (
            <p className="text-2xs text-success">
              Object removed - applied to canvas.
            </p>
          )}
        </>
      )}
    </div>
  );
}
