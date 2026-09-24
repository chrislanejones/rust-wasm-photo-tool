// @vitest-environment jsdom
//
// The Select panel's settings are shown in every mode and DISABLED WITH A
// REASON where the mode does not use them — never hidden. Per mode: which
// sliders are live, and that each disabled one says why. Plus the readout
// line and the Combine group writing the store.
//
// jsdom + zustand: a store change does not re-render a mounted component
// here, so each case sets the store BEFORE a fresh render.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SelectSettings, type SelectionControls } from "./SelectSettings";
import { edgeSensitivityReason, toleranceReason } from "./selectReasons";
import { useToolStore, type SelectionKind } from "@/stores/useToolStore";
import { TooltipProvider } from "@/components/ui/tooltip";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const noop = () => {};
function controls(kind: SelectionKind): SelectionControls {
  return {
    tolerance: 24,
    onToleranceChange: noop,
    onSelectAll: noop,
    onDeselect: noop,
    onDelete: noop,
    onNewLayerCopy: noop,
    onNewLayerCut: noop,
    onRemoveObject: noop,
    active: false,
    kind,
    onKindChange: noop,
    edgeThreshold: 90,
    onEdgeThresholdChange: noop,
  };
}

function render(kind: SelectionKind): void {
  act(() => {
    root.render(
      React.createElement(
        TooltipProvider,
        null,
        React.createElement(SelectSettings, { disabled: false, selection: controls(kind) }),
      ),
    );
  });
}

/** The range input under the label `name` — SizeSlider renders label + input. */
function slider(name: string): HTMLInputElement {
  const label = [...container.querySelectorAll("*")].find(
    (el) => el.children.length === 0 && el.textContent?.trim() === name,
  );
  if (!label) throw new Error(`no slider labeled "${name}"`);
  let el: Element | null = label;
  while (el && !el.querySelector('input[type="range"]')) el = el.parentElement;
  const input = el?.querySelector('input[type="range"]');
  if (!input) throw new Error(`no range input near "${name}"`);
  return input as HTMLInputElement;
}

const text = () => container.textContent ?? "";

beforeEach(() => {
  useToolStore.setState({ selectionCombine: 0, selectionCoverage: null });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const EXPECT: Record<SelectionKind, { tolerance: boolean; edge: boolean }> = {
  wand: { tolerance: true, edge: false },
  edge: { tolerance: true, edge: true },
  colorRange: { tolerance: true, edge: false },
  lasso: { tolerance: false, edge: false },
  rect: { tolerance: false, edge: false },
  ellipse: { tolerance: false, edge: false },
};

describe("every mode shows both sliders; unused ones are disabled with a reason", () => {
  for (const [kind, want] of Object.entries(EXPECT) as [SelectionKind, typeof EXPECT.wand][]) {
    it(kind, () => {
      render(kind);
      const tol = slider("Tolerance");
      const edge = slider("Edge sensitivity");
      expect(tol.disabled, "Tolerance disabled").toBe(!want.tolerance);
      expect(edge.disabled, "Edge sensitivity disabled").toBe(!want.edge);

      const tr = toleranceReason(kind);
      const er = edgeSensitivityReason(kind);
      expect(tr === null, "tolerance reason exists iff disabled").toBe(want.tolerance);
      expect(er === null, "edge reason exists iff disabled").toBe(want.edge);
      if (tr) expect(text()).toContain(tr);
      if (er) expect(text()).toContain(er);
    });
  }
});

describe("the readout", () => {
  it("says 'Nothing selected' rather than disappearing", () => {
    render("wand");
    expect(container.querySelector('[data-testid="selection-coverage"]')?.textContent).toBe(
      "Nothing selected",
    );
  });
  it("shows the engine's count when something is selected", () => {
    useToolStore.setState({ selectionCoverage: { selected: 2_100_000, total: 11_413_043 } });
    render("wand");
    expect(container.querySelector('[data-testid="selection-coverage"]')?.textContent).toBe(
      "Selected 18.4% · 2.1 MP",
    );
  });
});

describe("Combine", () => {
  const radio = (name: string) => {
    const b = [...container.querySelectorAll("button")].find(
      (x) => x.textContent?.trim() === name,
    );
    if (!b) throw new Error(`no ${name} button`);
    return b;
  };

  it("offers New / Add / Subtract / Intersect, with the store's mode lit", () => {
    useToolStore.setState({ selectionCombine: 3 });
    render("wand");
    for (const n of ["New", "Add", "Subtract", "Intersect"]) expect(() => radio(n)).not.toThrow();
    // Lit = the ToolButton active style on master; once Night 2 (#230) lands
    // the same tile also says so as a checked radio. Either counts.
    const lit = (b: HTMLButtonElement) =>
      b.getAttribute("aria-checked") === "true" ||
      b.className.split(/\s+/).includes("border-theme-primary");
    expect(lit(radio("Intersect"))).toBe(true);
    expect(lit(radio("New"))).toBe(false);
  });

  it("clicking a mode writes it to the store", () => {
    render("wand");
    act(() => radio("Subtract").click());
    expect(useToolStore.getState().selectionCombine).toBe(2);
    act(() => radio("Intersect").click());
    expect(useToolStore.getState().selectionCombine).toBe(3);
  });

  it("applies in modes where Tolerance does not — a marquee combines too", () => {
    render("rect");
    act(() => radio("Add").click());
    expect(useToolStore.getState().selectionCombine).toBe(1);
  });
});
