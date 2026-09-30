// @vitest-environment jsdom
//
// Apply Crop is only live when there is a rectangle to crop to.
//
// QC §3, 09-22: the button was gated on `disabled` alone, so with no rectangle
// drawn it clicked through to `applyCrop`'s early return and did nothing,
// silently. The Enter shortcut already had the right gate (`hasCropSelection`
// in useKeyboardShortcuts); the button now reads the same fact from the store,
// where `useDrawingTools` publishes it.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { TransformCropSettings } from "./TransformCropSettings";
import { useToolStore } from "@/stores/useToolStore";
import { TooltipProvider } from "@/components/ui/tooltip";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function render(): void {
  const noop = () => {};
  act(() => {
    root.render(
      React.createElement(TooltipProvider, null, React.createElement(TransformCropSettings, {
        disabled: false,
        section: "crop",
        onFlipH: noop,
        onFlipV: noop,
        onRotate90Cw: noop,
        onApplyCrop: noop,
        imageWidth: 256,
        imageHeight: 256,
        cropRatio: null,
        onCropRatioChange: noop,
      } as React.ComponentProps<typeof TransformCropSettings>)),
    );
  });
}

function applyCropButton(): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Apply Crop");
  if (!btn) throw new Error("Apply Crop button not rendered");
  return btn as HTMLButtonElement;
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  useToolStore.setState({ cropSelectionActive: false });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("Apply Crop", () => {
  // Each case sets the store BEFORE a fresh render. In this jsdom harness a
  // zustand change does not re-render an already-mounted component (measured:
  // not even a bare probe), so a set-then-assert on a live render would test
  // the harness, not the gate.
  it("is disabled until a crop rectangle exists", () => {
    useToolStore.setState({ cropSelectionActive: false });
    render();
    expect(applyCropButton().disabled, "no rectangle, nothing to apply").toBe(true);
  });

  it("is enabled when the Crop tool has a rectangle", () => {
    useToolStore.setState({ cropSelectionActive: true });
    render();
    expect(applyCropButton().disabled).toBe(false);
  });
});
