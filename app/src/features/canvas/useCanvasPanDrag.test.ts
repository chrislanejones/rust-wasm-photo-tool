// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCanvasPanDrag } from "./useCanvasPanDrag";

const down = { clientX: 10, clientY: 10, preventDefault() {}, stopPropagation() {} } as never;

describe("useCanvasPanDrag", () => {
  it("lets go of the hand when Space is released before the mouse button", () => {
    const { result, rerender } = renderHook(({ panning }) => useCanvasPanDrag(panning, { x: 0, y: 0 }, vi.fn()), {
      initialProps: { panning: true },
    });
    act(() => result.current.onMouseDown(down));
    expect(result.current.isDraggingPan).toBe(true);
    rerender({ panning: false }); // Space up, mouse still down
    expect(result.current.isDraggingPan).toBe(false);
  });

  it("lets go on a mouseup anywhere in the window, not only over the canvas", () => {
    const { result } = renderHook(() => useCanvasPanDrag(true, { x: 0, y: 0 }, vi.fn()));
    act(() => result.current.onMouseDown(down));
    act(() => { window.dispatchEvent(new MouseEvent("mouseup")); });
    expect(result.current.isDraggingPan).toBe(false);
  });

  it("pans by the pointer's travel from where the drag started", () => {
    const set = vi.fn();
    const { result } = renderHook(() => useCanvasPanDrag(true, { x: 5, y: 7 }, set));
    act(() => result.current.onMouseDown(down));
    act(() => result.current.onMouseMove({ clientX: 30, clientY: 4 } as never));
    expect(set).toHaveBeenLastCalledWith({ x: 25, y: 1 });
  });
});
