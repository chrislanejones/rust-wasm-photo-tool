import { describe, expect, it } from "vitest";
import { brushCursorSize } from "./brushCursorSize";
import type { StampSettings, ToolSettings, ToolType } from "@/lib/types";

/* The brush-preview ring's radius.
 *
 * Extracted from an anonymous IIFE in AppShell, which had no test — so nothing
 * would have noticed if the `arrow`/`maskEditing` branch stopped answering and
 * the mask brush started drawing a ring the size of the Paint brush.
 *
 * Every size below is deliberately distinct, so a branch that returns the
 * WRONG field fails rather than coincidentally matching.
 */
const toolSettings = {
  brushSize: 40,
  eraserSize: 60,
  blurSize: 80,
  maskBrushSize: 100,
  emojiSize: 50,
} as unknown as ToolSettings;

const stampSettings = { brushSize: 7 } as unknown as StampSettings;

const size = (
  activeTool: ToolType,
  over: Partial<{ brushMode: string; stampSubMode: string; maskEditing: boolean }> = {},
) =>
  brushCursorSize({
    activeTool,
    brushMode: "paint",
    stampSubMode: "clone",
    maskEditing: false,
    toolSettings,
    stampSettings,
    ...over,
  });

describe("brushCursorSize", () => {
  it("halves Paint's own brush — toolSettings sizes are diameters", () => {
    expect(size("brush")).toBe(20);
  });

  it("Paint's sub-modes each bring their own size", () => {
    expect(size("brush", { brushMode: "blur" })).toBe(40);
  });

  it('a stale "erase" rings at the PAINT size, not the eraser size', () => {
    // Paint's `erase` mode was deleted 10-01-2026. The store's validator turns
    // a persisted "erase" into "paint" before it ever reaches here, so this is
    // belt and braces for the one frame where a stale value could still be in
    // flight: it must fall through to the plain brush rather than read a size
    // no mode owns any more. 30 — eraserSize / 2 — is what the deleted branch
    // returned, so that number is the regression.
    expect(size("brush", { brushMode: "erase" })).toBe(20);
  });

  it("the mask brush owns the ring while Layer Settings is editing a mask", () => {
    expect(size("arrow", { maskEditing: true })).toBe(50);
  });

  it("and Layer Settings shows NO ring otherwise — not the Paint brush's", () => {
    // The regression this file exists for: 20 here would mean the ring fell
    // through to Paint's size on a tool that is not painting.
    expect(size("arrow")).toBe(0);
    expect(size("crop")).toBe(0);
  });

  it("the Eraser tool reads eraserSize — one physical brush, two jobs", () => {
    expect(size("ai")).toBe(30);
  });

  it("emoji mode sizes to the emoji, at its 1.2 factor", () => {
    expect(size("stamp", { stampSubMode: "emojis" })).toBe(30);
  });

  it("the clone stamp is NOT halved — it already stores a radius", () => {
    // 7, not 3.5. Mixing the two conventions up is the whole hazard.
    expect(size("stamp")).toBe(7);
    expect(size("text")).toBe(7);
  });
});
