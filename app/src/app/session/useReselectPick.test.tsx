// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useReselectPick } from "./useReselectPick";
import type { ReselectObject } from "@/features/canvas/ReviewPanel";
import { useAnnotationStore } from "@/stores/useAnnotationStore";
import { usePerspectiveStore } from "@/stores/usePerspectiveStore";
import { useToolStore } from "@/stores/useToolStore";

type Args = Parameters<typeof useReselectPick>;

function setup(shapes: { id: number; kind: number; points: number[][] }[] = []) {
  const textTool = { selectAnnotation: vi.fn() };
  const drawingTools = { shapes, selectShape: vi.fn() };
  const { result } = renderHook(() =>
    useReselectPick(textTool as unknown as Args[0], drawingTools as unknown as Args[1]),
  );
  return { pick: result.current, textTool, drawingTools };
}

const square: ReselectObject = { key: "s3", type: "shape", id: 3, label: "Square #1", kind: 0 };
const text: ReselectObject = { key: "t3", type: "text", id: 3, label: "Text #1" };

beforeEach(() => {
  useToolStore.getState().setActiveTool("compress");
  useToolStore.getState().setBrushMode("paint");
  useAnnotationStore.setState({ selectedObject: null, penEditRequest: null });
  usePerspectiveStore.setState({ target: null, dismissed: false });
});

it("with Perspective open, a shape pick retargets Perspective and opens no editor (#366)", () => {
  useToolStore.getState().setActiveTool("perspective");
  const { pick, drawingTools, textTool } = setup([{ id: 3, kind: 0, points: [] }]);
  pick(square);
  expect(usePerspectiveStore.getState().target).toEqual({ kind: "shape", id: 3 });
  expect(useToolStore.getState().activeTool).toBe("perspective");
  expect(drawingTools.selectShape).not.toHaveBeenCalled();
  expect(textTool.selectAnnotation).not.toHaveBeenCalled();
  expect(useAnnotationStore.getState().selectedObject).toEqual(square);
});

it("with Perspective open, a text pick targets the TEXT id space, not the shape one", () => {
  useToolStore.getState().setActiveTool("perspective");
  const { pick, textTool } = setup();
  pick(text);
  expect(usePerspectiveStore.getState().target).toEqual({ kind: "text", id: 3 });
  expect(useToolStore.getState().activeTool).toBe("perspective");
  expect(textTool.selectAnnotation).not.toHaveBeenCalled();
});

it("a pick un-dismisses a Canceled Perspective box", () => {
  useToolStore.getState().setActiveTool("perspective");
  usePerspectiveStore.getState().dismiss();
  setup().pick(square);
  expect(usePerspectiveStore.getState().dismissed).toBe(false);
});

it("without Perspective, a text pick opens the Text tool on it", () => {
  const { pick, textTool } = setup();
  pick(text);
  expect(useToolStore.getState().activeTool).toBe("text");
  expect(textTool.selectAnnotation).toHaveBeenCalledWith(3);
  expect(usePerspectiveStore.getState().target).toBeNull();
});

it("without Perspective, a pen path opens Paint → Pen with its points", () => {
  const { pick, drawingTools } = setup([{ id: 3, kind: 7, points: [[1, 2], [3, 4]] }]);
  pick(square);
  expect(useToolStore.getState().activeTool).toBe("brush");
  expect(useToolStore.getState().brushMode).toBe("pen");
  expect(useAnnotationStore.getState().penEditRequest).toEqual({ id: 3, points: [1, 2, 3, 4] });
  expect(drawingTools.selectShape).not.toHaveBeenCalled();
});

it("without Perspective, any other shape opens the Shapes editor", () => {
  const { pick, drawingTools } = setup([{ id: 3, kind: 0, points: [] }]);
  pick(square);
  expect(drawingTools.selectShape).toHaveBeenCalledWith(3);
  expect(usePerspectiveStore.getState().target).toBeNull();
});
