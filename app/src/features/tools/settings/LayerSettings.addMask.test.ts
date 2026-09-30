// @vitest-environment jsdom
//
// Layer Settings › Add mask opens its choices inline: the two "entire" masks
// always, the two selection masks only while something is selected (and it
// says so when not), and "Select subject…" as a way into Background Removal.
// Each choice hands `onAdd` the engine's source number.
//
// jsdom + zustand: set the store BEFORE a fresh render.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { LayerSettings } from "./LayerSettings";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useToolStore } from "@/stores/useToolStore";
import type { LayerInfo } from "@/hooks/useEngineCore";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const noop = () => {};

const photo: LayerInfo = {
  id: 2,
  name: "Photo",
  kind: "content",
  visible: true,
  opacity: 1,
  active: true,
  hasMask: false,
  overlay: null,
  textCount: 0,
  shapeCount: 0,
};

function render(onAdd: (id: number, source?: number) => void) {
  act(() => {
    root.render(
      React.createElement(
        TooltipProvider,
        null,
        React.createElement(LayerSettings, {
          stampToolRef: { current: null },
          undoCount: 0,
          disabled: false,
          moveActive: false,
          onToggleMove: noop,
          layers: [photo],
          onSelectLayer: noop,
          mask: {
            editing: false,
            value: 0,
            onAdd,
            onRemove: noop,
            onApply: noop,
            onInvert: noop,
            onToggleEdit: noop,
            onSetValue: noop,
          },
          imgW: 100,
          imgH: 100,
          canvasWidth: 100,
          canvasHeight: 100,
          onResizeCanvas: noop,
          onRemoveCanvas: noop,
          canRemoveCanvas: false,
          section: "layer",
        } as unknown as React.ComponentProps<typeof LayerSettings>),
      ),
    );
  });
}

const button = (name: string) => {
  const b = [...container.querySelectorAll("button")].find((x) => x.textContent?.trim() === name);
  if (!b) throw new Error(`no "${name}" button`);
  return b as HTMLButtonElement;
};

beforeEach(() => {
  useToolStore.setState({ selectionMask: null, activeTool: "arrow", eraserMode: "magic" });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("Add mask", () => {
  it("opens its choices instead of adding straight away", () => {
    const onAdd = vi.fn();
    render(onAdd);
    const tile = button("Add mask");
    expect(tile.getAttribute("aria-expanded")).toBe("false");
    act(() => tile.click());
    expect(onAdd).not.toHaveBeenCalled();
    expect(tile.getAttribute("aria-expanded")).toBe("true");
    expect(() => button("Show entire layer")).not.toThrow();
  });

  it("with no selection, the selection choices are disabled and it says why", () => {
    render(vi.fn());
    act(() => button("Add mask").click());
    expect(button("Reveal selection").disabled).toBe(true);
    expect(button("Hide selection").disabled).toBe(true);
    expect(button("Show entire layer").disabled).toBe(false);
    expect(button("Hide entire layer").disabled).toBe(false);
    expect(container.textContent).toContain("need a selection");
  });

  it("each choice passes the engine's source number, then closes", () => {
    useToolStore.setState({ selectionMask: new Uint8Array(4) });
    const onAdd = vi.fn();
    const expected: [string, number][] = [
      ["Show entire layer", 0],
      ["Hide entire layer", 1],
      ["Reveal selection", 2],
      ["Hide selection", 3],
    ];
    for (const [name, source] of expected) {
      act(() => root.render(React.createElement("div")));
      render(onAdd);
      act(() => button("Add mask").click());
      act(() => button(name).click());
      expect(onAdd).toHaveBeenLastCalledWith(2, source);
      expect(button("Add mask").getAttribute("aria-expanded"), name).toBe("false");
    }
  });

  it("Select subject… opens Background Removal", () => {
    const onAdd = vi.fn();
    render(onAdd);
    act(() => button("Add mask").click());
    act(() => button("Select subject…").click());
    expect(onAdd).not.toHaveBeenCalled();
    expect(useToolStore.getState().activeTool).toBe("ai");
    expect(useToolStore.getState().eraserMode).toBe("rembg");
  });
});
