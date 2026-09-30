// @vitest-environment jsdom
//
// Add mask with a source: the engine gets the layer, the source and Refine's
// Feather; only an ACCEPTED add flushes, syncs and opens the mask brush — a
// refused one (say, "Reveal selection" with nothing selected) must not.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useMaskActions } from "./useMaskActions";
import { useToolStore } from "@/stores/useToolStore";
import { CLEAN_UP } from "@/lib/selectionRefine";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function fakeStamp(accept: boolean) {
  const add = vi.fn(async () => accept);
  return {
    add,
    stamp: {
      toolRef: { current: { add_layer_mask_from: add, active_layer_id: async () => 2 } },
      setActiveLayer: vi.fn(),
      flushToCanvas: vi.fn(),
      syncState: vi.fn(),
    },
  };
}

let actions: ReturnType<typeof useMaskActions> | null = null;
function Probe({ stamp }: { stamp: unknown }) {
  actions = useMaskActions(stamp as Parameters<typeof useMaskActions>[0]);
  return null;
}

beforeEach(() => {
  useToolStore.setState({ maskEditing: false, selectionRefine: { ...CLEAN_UP, feather: 3 } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  actions = null;
});

describe("useMaskActions.handleAddMask", () => {
  it("passes layer, source and Refine's feather; an accepted add opens the brush", async () => {
    const { add, stamp } = fakeStamp(true);
    act(() => root.render(React.createElement(Probe, { stamp })));
    await act(async () => {
      await actions!.handleAddMask(2, 3);
    });
    expect(add).toHaveBeenCalledWith(2, 3, 3);
    expect(stamp.flushToCanvas).toHaveBeenCalledTimes(1);
    expect(stamp.syncState).toHaveBeenCalledTimes(1);
    expect(useToolStore.getState().maskEditing).toBe(true);
  });

  it("defaults to reveal-all — the old one-click Add mask", async () => {
    const { add, stamp } = fakeStamp(true);
    act(() => root.render(React.createElement(Probe, { stamp })));
    await act(async () => {
      await actions!.handleAddMask(2);
    });
    expect(add).toHaveBeenCalledWith(2, 0, 3);
  });

  it("a refused add changes nothing on screen", async () => {
    const { stamp } = fakeStamp(false);
    act(() => root.render(React.createElement(Probe, { stamp })));
    await act(async () => {
      await actions!.handleAddMask(2, 2);
    });
    expect(stamp.flushToCanvas).not.toHaveBeenCalled();
    expect(stamp.syncState).not.toHaveBeenCalled();
    expect(useToolStore.getState().maskEditing).toBe(false);
  });
});
