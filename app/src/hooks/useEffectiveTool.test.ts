// ===== FILE: app/src/hooks/useEffectiveTool.test.ts =====
// useEffectiveTool is pure decision logic (no hooks of its own, no DOM) — it
// just picks which set of onMouseDown/Move/Up handlers the canvas should get
// for the currently active SUB-TOOL. Pinning the routing table directly,
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
import { resolveSubTool } from "@/features/tools/toolGroups";

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
    // Default: a sub-tool with no canvas gesture at all.
    subTool: sub("enhance", "adjustments"),
    colorPickerActive: false,
    colorPicker: makeColorPicker(),
    moveActive: false,
    moveLayerTool: makeMoveLayerTool(),
    eraserTool: makePaintTool(),
    magicEraserTool: makeMagicEraserTool(),
    drawingTools: makeDrawingTools(),
    maskEditing: false,
    maskTool: makePaintTool(),
    blurDown: vi.fn(),
    blurMove: vi.fn(),
    blurUp: vi.fn(),
    paintTool: makePaintTool(),
    emojiTool: makeEmojiTool(),
    redStampTool: makeRedStampTool(),
    ...overrides,
  };
}

/** Resolve a real registry sub-tool. Deliberately NOT a hand-built literal:
 *  routing is pinned against the SHIPPING registry, so a sub-tool that is
 *  renamed or dropped fails here instead of silently losing its dispatch. */
function sub(group: string, id: string) {
  const r = resolveSubTool(group, id);
  if (!r) throw new Error(`no such sub-tool: ${group}/${id}`);
  return r;
}

describe("useEffectiveTool — the Eraser (ai) branch", () => {
  it("routes canvas mouse events to eraserTool, not idle", () => {
    const eraserTool = makePaintTool();
    const result = useEffectiveTool(baseParams({ subTool: sub("create", "eraser"), eraserTool }));
    expect(result.onMouseDown).toBe(eraserTool.onMouseDown);
    expect(result.onMouseMove).toBe(eraserTool.onMouseMove);
    expect(result.onMouseUp).toBe(eraserTool.onMouseUp);
  });

  it("does not leak another tool's handlers onto the Eraser (paintTool stays untouched)", () => {
    const eraserTool = makePaintTool();
    const paintTool = makePaintTool();
    const result = useEffectiveTool(
      baseParams({ subTool: sub("create", "eraser"), eraserTool, paintTool }),
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
    const result = useEffectiveTool(baseParams({ subTool: sub("create", "eraser"), eraserTool }));
    const fakeEvent = {} as Parameters<Stamp["onMouseDown"]>[0];
    result.onMouseDown(fakeEvent);
    expect(eraserTool.onMouseDown).toHaveBeenCalledTimes(1);
  });

  it("ignores other sub-tools' state — moveActive never leaks into the Eraser", () => {
    // Dispatch keys off the sub-tool identity alone, so unrelated live state
    // (here: the Layer-Settings Move toggle) can't redirect the Eraser.
    const eraserTool = makePaintTool();
    const a = useEffectiveTool(
      baseParams({ subTool: sub("create", "eraser"), eraserTool, moveActive: true }),
    );
    expect(a.onMouseDown).toBe(eraserTool.onMouseDown);
  });
});

describe("useEffectiveTool — the Magic Eraser sub-tool", () => {
  it("brush mode (the default) still routes to eraserTool, not magicEraserTool", () => {
    const eraserTool = makePaintTool();
    const magicEraserTool = makeMagicEraserTool();
    const result = useEffectiveTool(
      baseParams({ subTool: sub("create", "eraser"), eraserTool, magicEraserTool }),
    );
    expect(result.onMouseDown).toBe(eraserTool.onMouseDown);
    expect(result.onMouseDown).not.toBe(magicEraserTool.onMouseDown);
  });

  it("magic mode routes canvas mouse events to magicEraserTool, not eraserTool", () => {
    const eraserTool = makePaintTool();
    const magicEraserTool = makeMagicEraserTool();
    const result = useEffectiveTool(
      baseParams({ subTool: sub("create", "magic-eraser"), eraserTool, magicEraserTool }),
    );
    expect(result.onMouseDown).toBe(magicEraserTool.onMouseDown);
    expect(result.onMouseMove).toBe(magicEraserTool.onMouseMove);
    expect(result.onMouseUp).toBe(magicEraserTool.onMouseUp);
    expect(result.onMouseDown).not.toBe(eraserTool.onMouseDown);
  });

  it("actually invokes magicEraserTool.onMouseDown when the returned handler is called", () => {
    const magicEraserTool = makeMagicEraserTool();
    const result = useEffectiveTool(
      baseParams({ subTool: sub("create", "magic-eraser"), magicEraserTool }),
    );
    const fakeEvent = {} as Parameters<Stamp["onMouseDown"]>[0];
    result.onMouseDown(fakeEvent);
    expect(magicEraserTool.onMouseDown).toHaveBeenCalledTimes(1);
  });
});

describe("useEffectiveTool — no cross-tool leakage (regression net)", () => {
  it("Adjustments has no canvas interaction of its own (idle)", () => {
    const stamp = makeStamp();
    const result = useEffectiveTool(baseParams({ subTool: sub("enhance", "adjustments"), stamp }));
    result.onMouseDown({} as Parameters<Stamp["onMouseDown"]>[0]);
    result.onMouseMove({} as Parameters<Stamp["onMouseMove"]>[0]);
    result.onMouseUp();
    expect(stamp.onMouseDown).not.toHaveBeenCalled();
    expect(stamp.onMouseMove).not.toHaveBeenCalled();
    expect(stamp.onMouseUp).not.toHaveBeenCalled();
  });

  it("Resize Layer is idle unless moveActive is on", () => {
    const moveLayerTool = makeMoveLayerTool();
    const idleResult = useEffectiveTool(baseParams({ subTool: sub("edit", "resize-layer"), moveActive: false, moveLayerTool }));
    expect(idleResult.onMouseDown).not.toBe(moveLayerTool.onMouseDown);

    const movingResult = useEffectiveTool(baseParams({ subTool: sub("edit", "resize-layer"), moveActive: true, moveLayerTool }));
    expect(movingResult.onMouseDown).toBe(moveLayerTool.onMouseDown);
  });

  it("Crop routes to the color picker only while it is active", () => {
    const colorPicker = makeColorPicker();
    const drawingTools = makeDrawingTools();
    const cropDefault = useEffectiveTool(
      baseParams({ subTool: sub("edit", "crop"), colorPickerActive: false, colorPicker, drawingTools }),
    );
    expect(cropDefault.onMouseDown).toBe(drawingTools.onMouseDown);

    const cropPicking = useEffectiveTool(
      baseParams({ subTool: sub("edit", "crop"), colorPickerActive: true, colorPicker, drawingTools }),
    );
    expect(cropPicking.onMouseDown).toBe(colorPicker.onMouseDown);
  });

  it("Blur Brush / Eraser / Pen route to distinct handler sets", () => {
    const eraserTool = makePaintTool();
    const paintTool = makePaintTool();
    const blurDown = vi.fn();

    const blur = useEffectiveTool(
      baseParams({ subTool: sub("create", "blur-brush"), blurDown, eraserTool, paintTool }),
    );
    expect(blur.onMouseDown).toBe(blurDown);

    // Dormant path (no tile in PaintSettings' toggle row anymore, but the
    // switch branch itself is intentionally still live) — still resolves to
    // the Eraser's own handlers, never Paint's.
    const erase = useEffectiveTool(
      baseParams({ subTool: sub("create", "eraser"), eraserTool, paintTool }),
    );
    expect(erase.onMouseDown).toBe(eraserTool.onMouseDown);

    const pen = useEffectiveTool(
      baseParams({ subTool: sub("create", "pen"), eraserTool, paintTool }),
    );
    expect(pen.onMouseDown).toBe(paintTool.onMouseDown);
  });

  it("Brush's mask-editing branch outranks the paint tool", () => {
    const maskTool = makePaintTool();
    const result = useEffectiveTool(
      baseParams({ subTool: sub("create", "brush"), maskEditing: true, maskTool }),
    );
    expect(result.onMouseDown).toBe(maskTool.onMouseDown);
  });

  it("Emoji routes to the emoji tool; Clone Stamp does not", () => {
    const emojiTool = makeEmojiTool();
    const emojis = useEffectiveTool(baseParams({ subTool: sub("create", "emoji"), emojiTool }));
    expect(emojis.onMouseDown).toBe(emojiTool.onMouseDown);

    const clone = useEffectiveTool(baseParams({ subTool: sub("create", "clone-stamp"), emojiTool }));
    expect(clone.onMouseDown).not.toBe(emojiTool.onMouseDown);
  });

  it("Clone Stamp's combinedDown defers to the red-stamp tool only when one is pending", () => {
    const stamp = makeStamp();
    const redStampTool = makeRedStampTool(true);
    const result = useEffectiveTool(
      baseParams({ subTool: sub("create", "clone-stamp"), stamp, redStampTool }),
    );
    result.onMouseDown({} as Parameters<Stamp["onMouseDown"]>[0]);
    expect(redStampTool.onMouseDown).toHaveBeenCalledTimes(1);
    expect(stamp.onMouseDown).not.toHaveBeenCalled();
  });

  it("Text has no canvas gesture of its own and idles", () => {
    const stamp = makeStamp();
    const result = useEffectiveTool(baseParams({ subTool: sub("create", "text"), stamp }));
    result.onMouseDown({} as Parameters<Stamp["onMouseDown"]>[0]);
    expect(stamp.onMouseDown).not.toHaveBeenCalled();
  });
});
