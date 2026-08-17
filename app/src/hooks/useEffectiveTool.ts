// Resolves which tool's mouse handlers the canvas should actually receive for
// the currently active SUB-TOOL.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS SWITCHES ON THE SUB-TOOL AND NOT THE TOOL ID.
//
// It used to switch on `activeTool`, with an unmatched-tool fallthrough that
// returned the RAW clone-stamp handlers. That fallthrough is how a marquee drag
// once nearly clone-stamped: any tool without its own branch inherited whatever
// the stamp was doing. Two things fix that here.
//
//   1. The default is `idle`, not `stamp`. A sub-tool that reaches the bottom
//      of this function does nothing to the canvas, which is the safe answer.
//   2. Every group has an EXPLICIT case, and inside Create and Edit every
//      sub-tool does too. There is no "whatever's left" bucket that can quietly
//      acquire new members when the registry grows.
//
// The registry is the other half of the guarantee: a sub-tool with no canvas
// gesture carries no `cursor`, and those are exactly the ones that idle here.
// Cursor and handlers are two views of one fact, so they are declared together
// (toolGroups.ts) and read together.
import type { MouseEvent } from "react";
import type { useCloneStamp } from "./useCloneStamp";
import type { useColorPicker } from "./useColorPicker";
import type { useMoveLayerTool } from "./useMoveLayerTool";
import type { useDrawingTools } from "./useDrawingTools";
import type { usePaintTool } from "./usePaintTool";
import type { useMagicEraserTool } from "./useMagicEraserTool";
import type { useEmojiTool } from "./useEmojiTool";
import type { useRedStampTool } from "./useRedStampTool";
import type { ResolvedSubTool } from "@/features/tools/toolGroups";

type Stamp = ReturnType<typeof useCloneStamp>;

interface UseEffectiveToolParams {
  stamp: Stamp;
  /** The lit sub-tool. `undefined` only in the moment before the store settles;
   *  treated as "no canvas gesture", which is the safe default. */
  subTool: ResolvedSubTool | undefined;
  colorPickerActive: boolean;
  colorPicker: ReturnType<typeof useColorPicker>;
  moveActive: boolean;
  moveLayerTool: ReturnType<typeof useMoveLayerTool>;
  eraserTool: ReturnType<typeof usePaintTool>;
  /** Local Magic Eraser (PatchMatch). Behind `ih_patchmatch`; the hook itself is
   *  the flag+export guard, so this branch is safe to route to unconditionally. */
  magicEraserTool: ReturnType<typeof useMagicEraserTool>;
  drawingTools: ReturnType<typeof useDrawingTools>;
  maskEditing: boolean;
  maskTool: ReturnType<typeof usePaintTool>;
  blurDown: Stamp["onMouseDown"];
  blurMove: Stamp["onMouseMove"];
  blurUp: Stamp["onMouseUp"];
  paintTool: ReturnType<typeof usePaintTool>;
  emojiTool: ReturnType<typeof useEmojiTool>;
  redStampTool: ReturnType<typeof useRedStampTool>;
}

export function useEffectiveTool({
  stamp,
  subTool,
  colorPickerActive,
  colorPicker,
  moveActive,
  moveLayerTool,
  eraserTool,
  magicEraserTool,
  drawingTools,
  maskEditing,
  maskTool,
  blurDown,
  blurMove,
  blurUp,
  paintTool,
  emojiTool,
  redStampTool,
}: UseEffectiveToolParams): Stamp {
  // Idle handlers for sub-tools that don't paint on the canvas. The clone
  // stamp's own onMouseDown/Move/Up ride along on `...stamp`; without
  // overriding them they "leak" — on Adjustments, say, the clone stamp would
  // keep drawing.
  const idle: Stamp = {
    ...stamp,
    // `async` since Stage 3.5 made the clone stamp's own onMouseDown async —
    // this is the shared slot type, so the no-op has to match it. Still a no-op.
    onMouseDown: (async () => {}) as typeof stamp.onMouseDown,
    onMouseMove: (() => {}) as typeof stamp.onMouseMove,
    onMouseUp: (() => {}) as typeof stamp.onMouseUp,
  };

  /** Swap in one tool's three handlers, keeping the rest of the stamp surface
   *  (state, refs, helpers) that CanvasArea reads off the same object. */
  const use = (t: {
    onMouseDown: unknown;
    onMouseMove: unknown;
    onMouseUp: unknown;
  }): Stamp => ({
    ...stamp,
    onMouseDown: t.onMouseDown as typeof stamp.onMouseDown,
    onMouseMove: t.onMouseMove as typeof stamp.onMouseMove,
    onMouseUp: t.onMouseUp as typeof stamp.onMouseUp,
  });

  if (!subTool || subTool.subTool.comingSoon) return idle;
  const id = subTool.subTool.id;

  switch (subTool.group.id) {
    // ── Enhance ──────────────────────────────────────────────────────────────
    // Compress, Resize and Adjustments are panel-only. AI's Background/Object
    // Removal are click-triggered inside AISettings, not canvas-driven. All
    // four idle — and none of them declares a cursor, which is the same fact.
    case "enhance":
      return idle;

    // ── Select ───────────────────────────────────────────────────────────────
    // All six gestures are wired a level up (CanvasArea's wrappers →
    // useSelectionActions), so the underlying stamp handlers MUST idle. This is
    // the specific case the old fallthrough got wrong: a marquee drag reaching
    // raw stamp handlers is the near-miss that motivated this rewrite.
    case "select":
      return idle;

    // ── Batch ────────────────────────────────────────────────────────────────
    // Logo / Text / Rename act on the whole gallery from the panel.
    case "batch":
      return idle;

    // ── Edit ─────────────────────────────────────────────────────────────────
    case "edit": {
      // The Color Picker toggle still lives in TransformCropSettings, so it can
      // be switched on while a different Edit sub-tool is lit. Honour it first,
      // exactly as before, or the panel toggle would become a no-op.
      if (colorPickerActive) {
        return {
          ...stamp,
          onMouseDown: colorPicker.onMouseDown as typeof stamp.onMouseDown,
          onMouseMove: colorPicker.onMouseMove as typeof stamp.onMouseMove,
          // Deliberately the stamp's own mouse-up — the picker commits on
          // down/move and has no release behaviour of its own.
          onMouseUp: stamp.onMouseUp,
        };
      }
      switch (id) {
        case "crop":
          // The crop-rectangle drag.
          return use(drawingTools);
        case "resize-layer":
          // Move drags the layer only while its toggle is on; otherwise idle so
          // canvas clicks fall through to the Selection marker.
          return moveActive ? use(moveLayerTool) : idle;
        case "color-picker":
          // Reached when the sub-tool is lit but the toggle hasn't been set —
          // activateSubTool sets it, so this is the belt to that braces. Same
          // shape as the toggle branch above: the picker has no mouse-up of its
          // own (it commits on down/move), so the stamp's is kept.
          return {
            ...stamp,
            onMouseDown: colorPicker.onMouseDown as typeof stamp.onMouseDown,
            onMouseMove: colorPicker.onMouseMove as typeof stamp.onMouseMove,
            onMouseUp: stamp.onMouseUp,
          };
        case "transform":
        case "canvas-size":
        case "guides":
        case "distort":
        case "perspective":
        case "skew":
          // Button-driven: flips/rotations, the W×H resizer, and guide
          // add/remove. Guides ARE draggable, but on their own overlay
          // (ImageGuidesOverlay), not through the stamp handlers — so this
          // must idle or a guide drag would reach the clone stamp.
          //
          // Perspective's three rules join them for exactly that reason
          // (v8.42) — they are one tool wearing three sub-tool tiles. Its corner
          // and edge handles are dragged on PerspectiveOverlay, which owns its
          // own pointer capture. Routing it through the stamp handlers instead
          // would put a clone-stamp dab under every handle grab — the same
          // near-miss this whole function was rewritten to prevent. It carries
          // a `crosshair` cursor because the canvas IS the target here, unlike
          // the three above; cursor and dispatch are allowed to differ when the
          // gesture lives on a sibling overlay, and guides is the precedent.
          return idle;
        default:
          return idle;
      }
    }

    // ── Create ───────────────────────────────────────────────────────────────
    case "create": {
      switch (id) {
        case "brush":
          // Mask editing borrows the paint gesture to scrub a mask instead.
          return maskEditing ? use(maskTool) : use(paintTool);
        case "pen":
          // Drawn via the PenOverlay; the canvas keeps the paint handlers,
          // harmless while the overlay is capturing.
          return use(paintTool);
        case "blur-brush":
          return { ...stamp, onMouseDown: blurDown, onMouseMove: blurMove, onMouseUp: blurUp };
        case "eraser":
          return use(eraserTool);
        case "magic-eraser":
          return use(magicEraserTool);
        case "emoji":
          return use(emojiTool);
        case "clone-stamp":
        case "stamps": {
          // Both keep the clone stamp's full surface (source point, preview),
          // with the red/batch stamp taking the press when one is pending —
          // preserved exactly as it behaved under the old `stamp` branch.
          // `async` + `await` on the stamp branch: since Stage 3.5 its
          // onMouseDown is async, and dropping the promise here would make the
          // press fire-and-forget — the caller could not sequence anything
          // after it, and a rejection would surface as an unhandled rejection
          // rather than at the call site. The red-stamp branch is still sync.
          const combinedDown: typeof stamp.onMouseDown = async (e) => {
            if (redStampTool.hasPendingStamp()) {
              redStampTool.onMouseDown(e as MouseEvent<HTMLCanvasElement>);
            } else {
              await stamp.onMouseDown(e);
            }
          };
          return { ...stamp, onMouseDown: combinedDown };
        }
        case "shapes":
        case "pins":
        case "arrow":
          return use(drawingTools);
        case "text":
        case "ocr":
          // Text placement is handled a level up (useTextTool via CanvasArea)
          // and OCR reads the whole image from the panel — both idle here, as
          // `text` did before this rewrite.
          return idle;
        default:
          return idle;
      }
    }

    default:
      return idle;
  }
}
