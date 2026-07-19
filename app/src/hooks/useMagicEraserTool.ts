import { useCallback, useRef } from "react";
import type { ImageHorseTool } from "stamp_tool";
import type { ToolSettings } from "@/lib/types";
import { isPatchmatchEnabled, tryRemoveObject } from "@/lib/patchmatch";
import { useToolStore } from "@/stores/useToolStore";

// Magic Eraser brush — verification-only, NOT a shipped preference.
//
// `magic_eraser_brush_down/move/up` only exist on a wasm build compiled with
// `--features patchmatch` (see Cargo.toml's `patchmatch` feature comment) —
// the default, shipped `pkg/` never has them. Deliberately NOT added to the
// shared ambient `app/src/hooks/stamp_tool.d.ts` (which describes what the
// shipped build actually has) — same precedent as `lib/patchmatch.ts`'s own
// `PatchmatchWasmExports` and `lib/tilesFlush.ts`'s `TilesWasmExports` — so
// feature-detect at runtime via a local interface + cast instead of widening
// the ambient surface to something that isn't always true.
//
// This guard is load-bearing, not defensive: the Magic Eraser tile in
// AISettings.tsx is NOT itself flag-gated (only the controls rendered once
// it's selected are), so `eraserMode` can reach "magic" — and this hook can
// receive real pointer events — on a default build that lacks these exports
// entirely. Skipping the check would mean calling a method that doesn't
// exist on the object the moment a flag-off user clicks the tile and drags.
interface MagicEraserWasmExports {
  magic_eraser_brush_down(
    x: number,
    y: number,
    size: number,
    hardness: number,
    stab: string,
  ): void;
  magic_eraser_brush_move(x: number, y: number): boolean;
  magic_eraser_brush_up(): boolean;
  /** Always present (unconditional export, same as wand/lasso use) — not
   *  part of the feature-detected surface, just read alongside it here. */
  selection_overlay(): Uint8Array;
}

function hasMagicEraserExports(t: object): t is MagicEraserWasmExports {
  return (
    typeof (t as Partial<MagicEraserWasmExports>).magic_eraser_brush_down ===
    "function"
  );
}

interface Opts {
  toolRef: React.RefObject<ImageHorseTool | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  settings: ToolSettings;
  flushToCanvas: () => void;
  syncState: () => void;
}

/**
 * Thin pointer-event forwarder for the Magic Eraser brush — mirrors
 * `usePaintTool`'s shape exactly. Unlike Paint/Erase, this stroke never
 * touches a pixel: it paints a SELECTION mask (`magic_eraser_brush_down/
 * move/up`, Rust's `self.selection` — the same shape the wand/lasso build
 * and `remove_object` consumes), pushed to `useToolStore.selectionMask`
 * after every dab so `<SelectionOverlay>` (already generic, already wired
 * into CanvasArea) shows the live paint-in with no changes of its own.
 *
 * On release: if anything ended up selected, immediately runs the removal
 * fill (`tryRemoveObject` — the same call SelectSettings.tsx's Remove
 * Object button makes) and flushes/syncs on success, then always clears the
 * selection mask. One gesture — paint over the object, let go, it's gone —
 * rather than a separate confirm step, matching how an eraser (as opposed
 * to a wand-then-button selection flow) is expected to behave.
 */
export function useMagicEraserTool({
  toolRef,
  canvasRef,
  settings,
  flushToCanvas,
  syncState,
}: Opts) {
  const painting = useRef(false);
  const setSelectionMask = useToolStore((s) => s.setSelectionMask);
  // `selection_overlay()` is O(image size) — a full-image allocation + a
  // boundary scan over every pixel in Rust, then a second full-image copy
  // (`SelectionOverlay`'s own `putImageData`) downstream of every
  // `setSelectionMask` call. Calling that on every raw mousemove event is
  // fine on a small canvas but not on a real multi-megapixel photo: a fast
  // drag can fire mousemove 100+ times/sec, which floods the main thread
  // with tens of MB/sec of allocation and repaint work and hangs the tab —
  // caught via a real freeze on a 1385x2068 test image. Coalesce the overlay
  // refresh to at most once per animation frame via these two refs; the
  // brush stroke itself (`magic_eraser_brush_move`) stays uncapped below
  // since marking dabs is cheap (bounded by brush radius, not image size).
  const rafPending = useRef(false);
  const rafTool = useRef<MagicEraserWasmExports | null>(null);

  const coords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const c = canvasRef.current;
      if (!c) return { x: 0, y: 0 };
      const r = c.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) * c.width) / r.width,
        y: ((e.clientY - r.top) * c.height) / r.height,
      };
    },
    [canvasRef],
  );

  const pushOverlay = useCallback(
    (t: MagicEraserWasmExports) => {
      const mask = t.selection_overlay();
      setSelectionMask(mask.length ? mask : null);
    },
    [setSelectionMask],
  );

  const scheduleOverlay = useCallback(
    (t: MagicEraserWasmExports) => {
      rafTool.current = t;
      if (rafPending.current) return;
      rafPending.current = true;
      requestAnimationFrame(() => {
        rafPending.current = false;
        const tool = rafTool.current;
        rafTool.current = null;
        // The stroke may have already ended (onMouseUp) by the time this
        // frame callback runs — skip so a late overlay doesn't flash back in
        // after the mask was already cleared.
        if (tool && painting.current) pushOverlay(tool);
      });
    },
    [pushOverlay],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const t = toolRef.current;
      if (
        !t ||
        e.button !== 0 ||
        !isPatchmatchEnabled() ||
        !hasMagicEraserExports(t)
      ) {
        return;
      }
      painting.current = true;
      const { x, y } = coords(e);
      t.magic_eraser_brush_down(
        x,
        y,
        settings.eraserSize,
        settings.eraserHardness / 100,
        settings.paintStabilizer,
      );
      pushOverlay(t); // one-off — fine to run immediately, it's a single call
    },
    [
      toolRef,
      coords,
      pushOverlay,
      settings.eraserSize,
      settings.eraserHardness,
      settings.paintStabilizer,
    ],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!painting.current) return;
      const t = toolRef.current;
      if (!t || !hasMagicEraserExports(t)) return;
      const { x, y } = coords(e);
      t.magic_eraser_brush_move(x, y);
      scheduleOverlay(t);
    },
    [toolRef, coords, scheduleOverlay],
  );

  const onMouseUp = useCallback(() => {
    if (!painting.current) return;
    painting.current = false;
    rafTool.current = null;
    const t = toolRef.current;
    if (!t || !hasMagicEraserExports(t)) {
      setSelectionMask(null);
      return;
    }
    const hadSelection = t.magic_eraser_brush_up();
    if (hadSelection && tryRemoveObject(t)) {
      flushToCanvas();
      syncState();
    }
    setSelectionMask(null);
  }, [toolRef, flushToCanvas, syncState, setSelectionMask]);

  return { onMouseDown, onMouseMove, onMouseUp };
}
