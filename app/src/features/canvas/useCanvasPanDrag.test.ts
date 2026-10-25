// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCanvasPanDrag } from "./useCanvasPanDrag";
import { useViewStore } from "@/stores/useViewStore";

const down = { clientX: 10, clientY: 10, preventDefault() {}, stopPropagation() {} } as never;

describe("useCanvasPanDrag", () => {
  beforeEach(() => useViewStore.getState().resetPan());

  it("lets go of the hand when Space is released before the mouse button", () => {
    const { result, rerender } = renderHook(({ panning }) => useCanvasPanDrag(panning), {
      initialProps: { panning: true },
    });
    act(() => result.current.onMouseDown(down));
    expect(result.current.isDraggingPan).toBe(true);
    rerender({ panning: false }); // Space up, mouse still down
    expect(result.current.isDraggingPan).toBe(false);
  });

  it("lets go on a mouseup anywhere in the window, not only over the canvas", () => {
    const { result } = renderHook(() => useCanvasPanDrag(true));
    act(() => result.current.onMouseDown(down));
    act(() => { window.dispatchEvent(new MouseEvent("mouseup")); });
    expect(result.current.isDraggingPan).toBe(false);
  });

  it("pans by the pointer's travel from where the drag started", () => {
    act(() => useViewStore.getState().setPan({ x: 5, y: 7 }));
    const { result } = renderHook(() => useCanvasPanDrag(true));
    act(() => result.current.onMouseDown(down));
    act(() => result.current.onMouseMove({ clientX: 30, clientY: 4 } as never));
    expect(useViewStore.getState().pan).toEqual({ x: 25, y: 1 });
    expect(result.current.panOffset).toEqual({ x: 25, y: 1 });
  });

  it("puts the pan back home when the canvas goes away, as its old useState did", () => {
    const { result, unmount } = renderHook(() => useCanvasPanDrag(true));
    act(() => result.current.onMouseDown(down));
    act(() => result.current.onMouseMove({ clientX: 60, clientY: 40 } as never));
    expect(useViewStore.getState().pan).toEqual({ x: 50, y: 30 });
    unmount();
    expect(useViewStore.getState().pan).toEqual({ x: 0, y: 0 });
  });
});
