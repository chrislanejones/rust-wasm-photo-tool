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
      pushOverlay(t);
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
      pushOverlay(t);
    },
    [toolRef, coords, pushOverlay],
  );

  const onMouseUp = useCallback(() => {
    if (!painting.current) return;
    painting.current = false;
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
