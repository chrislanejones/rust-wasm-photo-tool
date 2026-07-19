// ===== FILE: app/src/hooks/useEffectiveTool.test.ts =====
// useEffectiveTool is pure decision logic (no hooks of its own, no DOM) — it
// just picks which set of onMouseDown/Move/Up handlers the canvas should get
// for the currently active tool/sub-mode. Pinning the routing table directly,
// with special attention to the "ai" (Eraser) branch, which is load-bearing
// two ways: if the base branch regresses, dragging on the Eraser tool
// silently does nothing; if the eraserMode === "magic" branch regresses, a
// Magic Eraser stroke either does nothing or silently falls back to the
// destructive Brush Eraser (see the module's own doc comment).
import { describe, it, expect, vi } from "vitest";
import { useEffectiveTool } from "./useEffectiveTool";
import type { useCloneStamp } from "./useCloneStamp";
import type { useColorPicker } from "./useColorPicker";
import type { useMoveLayerTool } from "./useMoveLayerTool";
import type { useDrawingTools } from "./useDrawingTools";
import type { usePaintTool } from "./usePaintTool";
import type { useMagicEraserTool } from "./useMagicEraserTool";
import type { useEmojiTool } from "./useEmojiTool";
import type { useRedStampTool } from "./useRedStampTool";
import type { ToolType } from "@/lib/types";

type Stamp = ReturnType<typeof useCloneStamp>;
type ColorPicker = ReturnType<typeof useColorPicker>;
type MoveLayerTool = ReturnType<typeof useMoveLayerTool>;
type DrawingTools = ReturnType<typeof useDrawingTools>;
type PaintTool = ReturnType<typeof usePaintTool>;
type MagicEraserTool = ReturnType<typeof useMagicEraserTool>;
type EmojiTool = ReturnType<typeof useEmojiTool>;
type RedStampTool = ReturnType<typeof useRedStampTool>;

/** A distinct spy-triple per tool's mock, so a test can prove exactly whose
 *  handlers came back (by identity, not just "a function"). */
function mouseHandlers() {
  return {
    onMouseDown: vi.fn(),
    onMouseMove: vi.fn(),
    onMouseUp: vi.fn(),
  };
}

function makeStamp(): Stamp {
  return {
    ...mouseHandlers(),
    // Everything else on the real hook's return is irrelevant to routing —
    // useEffectiveTool only ever spreads `...stamp` and overrides the three
    // mouse handlers, so a minimal stub is honest about what this unit uses.
  } as unknown as Stamp;
}

function makeColorPicker(): ColorPicker {
  return { ...mouseHandlers(), onMouseLeave: vi.fn(), magnifier: null, RADIUS: 60 } as unknown as ColorPicker;
}

function makeMoveLayerTool(): MoveLayerTool {
  return mouseHandlers() as unknown as MoveLayerTool;
}

function makeDrawingTools(): DrawingTools {
  return { ...mouseHandlers() } as unknown as DrawingTools;
}

function makePaintTool(): PaintTool {
  return mouseHandlers() as unknown as PaintTool;
}

function makeMagicEraserTool(): MagicEraserTool {
  return mouseHandlers() as unknown as MagicEraserTool;
}

function makeEmojiTool(): EmojiTool {
  return mouseHandlers() as unknown as EmojiTool;
}

function makeRedStampTool(hasPending = false): RedStampTool {
  return {
    onMouseDown: vi.fn(),
    hasPendingStamp: vi.fn(() => hasPending),
  } as unknown as RedStampTool;
}

/** Full param set with sane defaults; each test overrides only what it's
 *  exercising, matching the fixture style routeState.test.ts already uses. */
function baseParams(overrides: Partial<Parameters<typeof useEffectiveTool>[0]> = {}) {
  return {
    stamp: makeStamp(),
    activeTool: "effects" as ToolType,
    colorPickerActive: false,
    colorPicker: makeColorPicker(),
    moveActive: false,
    moveLayerTool: makeMoveLayerTool(),
    eraserTool: makePaintTool(),
    magicEraserTool: makeMagicEraserTool(),
    eraserMode: "brush" as const,
    drawingTools: makeDrawingTools(),
    maskEditing: false,
    maskTool: makePaintTool(),
    brushMode: "paint" as const,
    blurDown: vi.fn(),
    blurMove: vi.fn(),
    blurUp: vi.fn(),
    paintTool: makePaintTool(),
    stampSubMode: "clone" as const,
    emojiTool: makeEmojiTool(),
    redStampTool: makeRedStampTool(),
    ...overrides,
  };
}

describe("useEffectiveTool — the Eraser (ai) branch", () => {
  it("routes canvas mouse events to eraserTool, not idle", () => {
    const eraserTool = makePaintTool();
    const result = useEffectiveTool(baseParams({ activeTool: "ai", eraserTool }));
    expect(result.onMouseDown).toBe(eraserTool.onMouseDown);
    expect(result.onMouseMove).toBe(eraserTool.onMouseMove);
    expect(result.onMouseUp).toBe(eraserTool.onMouseUp);
  });

  it("does not leak another tool's handlers onto the Eraser (paintTool stays untouched)", () => {
    const eraserTool = makePaintTool();
    const paintTool = makePaintTool();
    const result = useEffectiveTool(
      baseParams({ activeTool: "ai", eraserTool, paintTool }),
    );
    expect(result.onMouseDown).not.toBe(paintTool.onMouseDown);
    expect(result.onMouseMove).not.toBe(paintTool.onMouseMove);
    expect(result.onMouseUp).not.toBe(paintTool.onMouseUp);
  });

  it("actually invokes eraserTool.onMouseDown when the returned handler is called", () => {
    // Identity checks alone can't catch a handler that resolves to the right
    // reference but a stale/wrong function was passed in by the caller — this
    // proves the routed handler really does the eraser's work when driven.
    const eraserTool = makePaintTool();
    const result = useEffectiveTool(baseParams({ activeTool: "ai", eraserTool }));
    const fakeEvent = {} as Parameters<Stamp["onMouseDown"]>[0];
    result.onMouseDown(fakeEvent);
    expect(eraserTool.onMouseDown).toHaveBeenCalledTimes(1);
  });

  it("ignores stampSubMode/brushMode/moveActive — OTHER tools' sub-mode state never leaks in", () => {
    // AISettings is flat buttons, not a ToolModeToggle: the Eraser's routing
    // only ever branches on its own eraserMode (see the Magic Eraser
    // describe block below), never another tool's sub-mode/toggle state.
    const eraserTool = makePaintTool();
    const a = useEffectiveTool(
      baseParams({ activeTool: "ai", eraserTool, brushMode: "blur", moveActive: true, stampSubMode: "emojis" }),
    );
    expect(a.onMouseDown).toBe(eraserTool.onMouseDown);
  });
});

describe("useEffectiveTool — the Magic Eraser sub-mode (ai + eraserMode)", () => {
  it("brush mode (the default) still routes to eraserTool, not magicEraserTool", () => {
    const eraserTool = makePaintTool();
    const magicEraserTool = makeMagicEraserTool();
    const result = useEffectiveTool(
      baseParams({ activeTool: "ai", eraserMode: "brush", eraserTool, magicEraserTool }),
    );
    expect(result.onMouseDown).toBe(eraserTool.onMouseDown);
    expect(result.onMouseDown).not.toBe(magicEraserTool.onMouseDown);
  });

  it("magic mode routes canvas mouse events to magicEraserTool, not eraserTool", () => {
    const eraserTool = makePaintTool();
    const magicEraserTool = makeMagicEraserTool();
    const result = useEffectiveTool(
      baseParams({ activeTool: "ai", eraserMode: "magic", eraserTool, magicEraserTool }),
    );
    expect(result.onMouseDown).toBe(magicEraserTool.onMouseDown);
    expect(result.onMouseMove).toBe(magicEraserTool.onMouseMove);
    expect(result.onMouseUp).toBe(magicEraserTool.onMouseUp);
    expect(result.onMouseDown).not.toBe(eraserTool.onMouseDown);
  });

  it("actually invokes magicEraserTool.onMouseDown when the returned handler is called", () => {
    const magicEraserTool = makeMagicEraserTool();
    const result = useEffectiveTool(
      baseParams({ activeTool: "ai", eraserMode: "magic", magicEraserTool }),
    );
    const fakeEvent = {} as Parameters<Stamp["onMouseDown"]>[0];
    result.onMouseDown(fakeEvent);
    expect(magicEraserTool.onMouseDown).toHaveBeenCalledTimes(1);
  });
});

describe("useEffectiveTool — no cross-tool leakage (regression net)", () => {
  it("Effects has no canvas interaction of its own (idle)", () => {
    const stamp = makeStamp();
    const result = useEffectiveTool(baseParams({ activeTool: "effects", stamp }));
    result.onMouseDown({} as Parameters<Stamp["onMouseDown"]>[0]);
    result.onMouseMove({} as Parameters<Stamp["onMouseMove"]>[0]);
    result.onMouseUp();
    expect(stamp.onMouseDown).not.toHaveBeenCalled();
    expect(stamp.onMouseMove).not.toHaveBeenCalled();
    expect(stamp.onMouseUp).not.toHaveBeenCalled();
  });

  it("Layer Settings (arrow) is idle unless moveActive is on", () => {
    const moveLayerTool = makeMoveLayerTool();
    const idleResult = useEffectiveTool(baseParams({ activeTool: "arrow", moveActive: false, moveLayerTool }));
    expect(idleResult.onMouseDown).not.toBe(moveLayerTool.onMouseDown);

    const movingResult = useEffectiveTool(baseParams({ activeTool: "arrow", moveActive: true, moveLayerTool }));
    expect(movingResult.onMouseDown).toBe(moveLayerTool.onMouseDown);
  });

  it("Adjust & Select (crop) routes to the color picker only while it's active", () => {
    const colorPicker = makeColorPicker();
    const drawingTools = makeDrawingTools();
    const cropDefault = useEffectiveTool(
      baseParams({ activeTool: "crop", colorPickerActive: false, colorPicker, drawingTools }),
    );
    expect(cropDefault.onMouseDown).toBe(drawingTools.onMouseDown);

    const cropPicking = useEffectiveTool(
      baseParams({ activeTool: "crop", colorPickerActive: true, colorPicker, drawingTools }),
    );
    expect(cropPicking.onMouseDown).toBe(colorPicker.onMouseDown);
  });

  it("Paint routes blur/erase/pen sub-modes to distinct handler sets", () => {
    const eraserTool = makePaintTool();
    const paintTool = makePaintTool();
    const blurDown = vi.fn();

    const blur = useEffectiveTool(
      baseParams({ activeTool: "brush", brushMode: "blur", blurDown, eraserTool, paintTool }),
    );
    expect(blur.onMouseDown).toBe(blurDown);

    // Dormant path (no tile in PaintSettings' toggle row anymore, but the
    // switch branch itself is intentionally still live) — still resolves to
    // the Eraser's own handlers, never Paint's.
    const erase = useEffectiveTool(
      baseParams({ activeTool: "brush", brushMode: "erase", eraserTool, paintTool }),
    );
    expect(erase.onMouseDown).toBe(eraserTool.onMouseDown);

    const pen = useEffectiveTool(
      baseParams({ activeTool: "brush", brushMode: "pen", eraserTool, paintTool }),
    );
    expect(pen.onMouseDown).toBe(paintTool.onMouseDown);
  });

  it("Paint's mask-editing branch outranks brushMode entirely", () => {
    const maskTool = makePaintTool();
    const result = useEffectiveTool(
      baseParams({ activeTool: "brush", maskEditing: true, brushMode: "blur", maskTool }),
    );
    expect(result.onMouseDown).toBe(maskTool.onMouseDown);
  });

  it("Stamp routes to the emoji tool only in the emojis sub-mode", () => {
    const emojiTool = makeEmojiTool();
    const emojis = useEffectiveTool(baseParams({ activeTool: "stamp", stampSubMode: "emojis", emojiTool }));
    expect(emojis.onMouseDown).toBe(emojiTool.onMouseDown);

    const clone = useEffectiveTool(baseParams({ activeTool: "stamp", stampSubMode: "clone", emojiTool }));
    expect(clone.onMouseDown).not.toBe(emojiTool.onMouseDown);
  });

  it("Stamp's clone-mode combinedDown defers to the red-stamp tool only when one is pending", () => {
    const stamp = makeStamp();
    const redStampTool = makeRedStampTool(true);
    const result = useEffectiveTool(
      baseParams({ activeTool: "stamp", stampSubMode: "clone", stamp, redStampTool }),
    );
    result.onMouseDown({} as Parameters<Stamp["onMouseDown"]>[0]);
    expect(redStampTool.onMouseDown).toHaveBeenCalledTimes(1);
    expect(stamp.onMouseDown).not.toHaveBeenCalled();
  });

  it("a tool with no branch of its own (e.g. text) falls through to idle", () => {
    const stamp = makeStamp();
    const result = useEffectiveTool(baseParams({ activeTool: "text", stamp }));
    result.onMouseDown({} as Parameters<Stamp["onMouseDown"]>[0]);
    expect(stamp.onMouseDown).not.toHaveBeenCalled();
  });
});
