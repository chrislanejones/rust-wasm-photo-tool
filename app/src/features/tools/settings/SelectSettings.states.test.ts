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
import { CLEAN_UP } from "@/lib/selectionRefine";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const noop = () => {};
/** Calls recorded by the last controls() — which action a tile actually ran. */
let calls: string[] = [];
function controls(kind: SelectionKind, active = false): SelectionControls {
  const spy = (name: string) => () => calls.push(name);
  return {
    tolerance: 24,
    onToleranceChange: noop,
    onSelectAll: spy("all"),
    onDeselect: spy("deselect"),
    onDelete: spy("delete"),
    onNewLayerCopy: spy("copy"),
    onNewLayerCut: spy("cut"),
    onRemoveObject: spy("remove"),
    active,
    kind,
    onKindChange: noop,
    edgeThreshold: 90,
    onEdgeThresholdChange: noop,
  };
}

function render(kind: SelectionKind, active = false): void {
  act(() => {
    root.render(
      React.createElement(
        TooltipProvider,
        null,
        React.createElement(SelectSettings, { disabled: false, selection: controls(kind, active) }),
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

/** Refine shows ONE slider — whichever operation's tile is open. The five
 *  per-operation sliders it replaced are gone, so there is nothing to name.
 *  It is the LAST range input on the panel: Tolerance and Edge sensitivity
 *  belong to the mode section above, and nothing below Refine has a slider. */
function openSlider(): HTMLInputElement {
  const inputs = [...container.querySelectorAll('input[type="range"]')] as HTMLInputElement[];
  if (inputs.length === 0) throw new Error("no range input on the panel");
  return inputs[inputs.length - 1];
}

/** The text SizeSlider prints over that slider. Asserting this — not merely
 *  that the word appears somewhere — is what catches a label frozen on one
 *  operation while the value tracks another: the TILES carry those same five
 *  words, so a page-wide search always finds them. */
function openSliderLabel(): string {
  const input = openSlider();
  let el: HTMLElement | null = input.parentElement;
  // Walk out until a container holds label text as well as the input.
  for (let i = 0; el && i < 4; i++, el = el.parentElement) {
    const t = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (t && !/^\s*$/.test(t)) return t;
  }
  return "";
}

beforeEach(() => {
  calls = [];
  useToolStore.setState({
    selectionCombine: 0,
    selectionCoverage: null,
    selectionRefine: CLEAN_UP,
    refinePreviewing: false,
    refineRequest: null,
  });
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
  /** By ACCESSIBLE NAME, not visible text. The segments went icon-only with
   *  the Select Panel design (09-27-2026), so the name moved to `aria-label`
   *  and the chosen one is spelled out in the section header instead. Reading
   *  the name is what a screen reader does, and it holds whichever way the
   *  control is drawn — querying visible text was the thing that broke. */
  const radio = (name: string) => {
    const b = [...container.querySelectorAll("button")].find(
      (x) => (x.getAttribute("aria-label") ?? x.textContent?.trim()) === name,
    );
    if (!b) throw new Error(`no ${name} button`);
    return b;
  };

  it("offers New selection / Add / Subtract / Intersect, with the store's mode lit", () => {
    useToolStore.setState({ selectionCombine: 3 });
    render("wand");
    for (const n of ["New selection", "Add", "Subtract", "Intersect"]) expect(() => radio(n)).not.toThrow();
    // Lit = the ToolButton active style on master; once Night 2 (#230) lands
    // the same tile also says so as a checked radio. Either counts.
    const lit = (b: HTMLButtonElement) =>
      b.getAttribute("aria-checked") === "true" ||
      b.className.split(/\s+/).includes("border-theme-primary");
    expect(lit(radio("Intersect"))).toBe(true);
    expect(lit(radio("New selection"))).toBe(false);
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

describe("Refine", () => {
  const button = (name: string) => {
    const b = [...container.querySelectorAll("button")].find((x) => x.textContent?.trim() === name);
    if (!b) throw new Error(`no ${name} button`);
    return b as HTMLButtonElement;
  };

  it("with nothing selected: every control disabled, and it says why", () => {
    render("wand", false);
    expect(button("Clean Up").disabled).toBe(true);
    expect(button("Apply").disabled).toBe(true);
    // All six tiles, not five sliders — the five operations are tiles now and
    // only the open one has a slider.
    for (const name of ["Clean Up", "Islands", "Holes", "Smooth", "Feather", "Expand"]) {
      expect(button(name).disabled, name).toBe(true);
    }
    expect(openSlider().disabled).toBe(true);
    expect(text()).toContain("Select something to refine it.");
  });

  it("starts on Holes, and every tile opens its own operation at the Clean Up value", () => {
    render("wand", true);
    // The panel opens on Holes (the one people reach for after a wand click),
    // so its value is what the single slider shows before anything is clicked.
    expect(button("Holes").getAttribute("aria-checked")).toBe("true");
    expect(Number(openSlider().value)).toBe(6);

    // Each tile swaps the slider to ITS operation: label, value and range.
    // A tile that changed the label but not the value would be the real bug
    // here, so both are asserted every time.
    const expected = [
      ["Islands", 4, 0, 200],
      ["Smooth", 2, 0, 8],
      ["Feather", 1, 0, 8],
      ["Expand", -1, -10, 10],
      ["Holes", 6, 0, 200],
    ] as const;
    for (const [name, value, min, max] of expected) {
      act(() => button(name).click());
      expect(button(name).getAttribute("aria-checked"), name).toBe("true");
      const s = openSlider();
      expect(Number(s.value), name).toBe(value);
      expect(Number(s.min), name).toBe(min);
      expect(Number(s.max), name).toBe(max);
      // …and the SLIDER is labeled with the operation it is editing. The
      // tiles print these same words, so this must read the slider's own
      // label or a frozen label passes.
      expect(openSliderLabel(), name).toContain(name);
    }
  });

  it("the five operations are ONE radio group; Clean Up is not in it", () => {
    render("wand", true);
    // Clean Up runs the preset — announcing it as "radio, 1 of 6" would be a
    // lie about what pressing it does.
    expect(button("Clean Up").getAttribute("role")).not.toBe("radio");
    for (const name of ["Islands", "Holes", "Smooth", "Feather", "Expand"]) {
      expect(button(name).getAttribute("role"), name).toBe("radio");
    }
    // One Tab stop: only the checked tile is reachable, the rest are arrows.
    const stops = ["Islands", "Holes", "Smooth", "Feather", "Expand"].filter(
      (n) => button(n).tabIndex === 0,
    );
    expect(stops).toEqual(["Holes"]);
  });

  it("Clean Up and Apply each send ONE request to the session hook", () => {
    render("wand", true);
    act(() => button("Clean Up").click());
    expect(useToolStore.getState().refineRequest).toEqual({ kind: "cleanUp", n: 1 });
    act(() => button("Apply").click());
    expect(useToolStore.getState().refineRequest).toEqual({ kind: "apply", n: 2 });
  });

  it("Apply is disabled when every selection op is off (feather alone does nothing)", () => {
    useToolStore.setState({ selectionRefine: { islands: 0, holes: 0, smooth: 0, feather: 3, expand: 0 } });
    render("wand", true);
    expect(button("Apply").disabled).toBe(true);
  });

  it("works in every mode — refine is about the selection, not how it was made", () => {
    for (const kind of ["lasso", "rect", "colorRange"] as const) {
      act(() => root.render(React.createElement("div")));
      render(kind, true);
      expect(button("Clean Up").disabled, kind).toBe(false);
    }
  });

  it("every Selection tile runs ITS action — Remove included", () => {
    // Remove Object used to be a section of its own with a full-width button.
    // Folding it into the grid as a sixth tile is only correct if it still
    // calls onRemoveObject, and only a click proves that.
    render("wand", true);
    for (const name of ["All", "Deselect", "Delete", "Copy", "Cut", "Remove"]) {
      act(() => button(name).click());
    }
    expect(calls).toEqual(["all", "deselect", "delete", "copy", "cut", "remove"]);
  });

  it("the Apply label says when a preview is what it will apply", () => {
    useToolStore.setState({ refinePreviewing: true });
    render("wand", true);
    expect(() => button("Apply refine")).not.toThrow();
  });
});

