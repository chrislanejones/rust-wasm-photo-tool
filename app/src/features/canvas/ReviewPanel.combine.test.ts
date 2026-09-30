// @vitest-environment jsdom
//
// REVIEW → COMBINE. The four-mode strip (New selection / Add / Subtract /
// Intersect) and the object list under it.
//
// The strip's cases came from SelectSettings.states.test.ts, unchanged in
// substance — the control moved panels, so its tests moved with it. What is NEW
// here is the second half of the move: an object row is a selection producer,
// so a click has to reach the session hook with the right object, and the row
// has to say what the CURRENT mode will do to it.
//
// The section starts CLOSED, so every case opens it first — which is itself the
// assertion that the fifth toggle exists and is wired.
//
// jsdom + zustand: a store change does not re-render a mounted component here,
// so each case sets the store BEFORE a fresh render.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ReviewPanel, type ReselectObject } from "./ReviewPanel";
import { useToolStore } from "@/stores/useToolStore";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CLEAN_UP } from "@/lib/selectionRefine";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const noop = () => {};

/** Two placed objects — one text, one shape — so a click can be shown to
 *  identify the right one across the two separate id-spaces. */
const OBJECTS: ReselectObject[] = [
  { key: "t4", type: "text", id: 4, label: "Text #1" },
  { key: "s7", type: "shape", id: 7, label: "Circle #1", kind: 1 },
];

function render(objects: ReselectObject[] = OBJECTS): void {
  act(() => {
    root.render(
      React.createElement(
        TooltipProvider,
        null,
        React.createElement(ReviewPanel, {
          history: [],
          onJump: noop,
          onDelete: noop,
          onClose: noop,
          onUndo: noop,
          canUndo: false,
          onRedo: noop,
          canRedo: false,
          objects,
          onSelectObject: noop,
          onDeleteObject: noop,
          onDuplicateObject: noop,
          onToggleDuplicatePad: noop,
          duplicatePadId: null,
          userMode: "paid",
          layers: [],
          onAddLayer: noop,
          onDuplicateLayer: noop,
          onDeleteLayer: noop,
          onSelectLayer: noop,
          onToggleLayerVisible: noop,
          onSetLayerOpacity: noop,
          onRenameLayer: noop,
          onMoveLayer: noop,
          onMergeDown: noop,
          onFlattenAll: noop,
          getHistogram: () => Promise.resolve(null),
          histogramSignature: "sig",
          histogramPhotoKey: "photo",
        }),
      ),
    );
  });
}

/** A control by ACCESSIBLE NAME. The section toggles and the Combine segments
 *  are both icon-only, so `aria-label` is the only name either has — and it is
 *  what a screen reader reads, which is the point of asserting on it. */
function named(name: string): HTMLButtonElement {
  const b = [...container.querySelectorAll("button")].find(
    (x) => (x.getAttribute("aria-label") ?? x.textContent?.trim()) === name,
  );
  if (!b) throw new Error(`no ${name} button`);
  return b as HTMLButtonElement;
}

/** Open the Combine section (it starts closed) and return the panel text. */
function openCombine(): void {
  act(() => named("Combine").click());
}

/** An object row — a `role="button"` from ReselectBar, found by its label. */
function row(label: string): HTMLElement {
  const r = [...container.querySelectorAll('[role="button"]')].find((x) =>
    x.textContent?.includes(label),
  );
  if (!r) throw new Error(`no row for ${label}`);
  return r as HTMLElement;
}

const text = () => container.textContent ?? "";

beforeEach(() => {
  useToolStore.setState({
    selectionCombine: 0,
    selectionCoverage: null,
    selectionRefine: CLEAN_UP,
    refinePreviewing: false,
    refineRequest: null,
    combineRequest: null,
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("the Combine toggle", () => {
  it("is the fifth section and starts closed", () => {
    render();
    // All five toggles exist…
    for (const n of ["History", "Layers", "Reselect", "Histogram", "Combine"]) {
      expect(() => named(n), n).not.toThrow();
    }
    // …and Combine is LAST, after Histogram. Order is the ask ("another toggle
    // after the histogram icon"), and a toggle row is the one place where the
    // order is the whole affordance.
    const labels = [...container.querySelectorAll("button")]
      .map((b) => b.getAttribute("aria-label"))
      .filter((l): l is string =>
        ["History", "Layers", "Reselect", "Histogram", "Combine"].includes(l ?? ""),
      );
    expect(labels).toEqual(["History", "Layers", "Reselect", "Histogram", "Combine"]);
    // Closed: the toggle is not pressed and the strip is not rendered.
    expect(named("Combine").getAttribute("aria-pressed")).toBe("false");
    expect(() => named("New selection")).toThrow();
  });

  it("opens the section — and the three-open cap evicts Reselect, not Combine", () => {
    // History / Layers / Reselect are open on first render, which is the cap.
    // Reselect is the designated victim, so Combine actually opens rather than
    // being refused — the behaviour the existing eviction rule already had for
    // Histogram, now with a fifth toggle asking for the slot.
    render();
    openCombine();
    expect(named("Combine").getAttribute("aria-pressed")).toBe("true");
    expect(named("Reselect").getAttribute("aria-pressed")).toBe("false");
    expect(() => named("New selection")).not.toThrow();
  });
});

describe("the mode strip", () => {
  it("offers New selection / Add / Subtract / Intersect, with the store's mode lit", () => {
    useToolStore.setState({ selectionCombine: 3 });
    render();
    openCombine();
    for (const n of ["New selection", "Add", "Subtract", "Intersect"]) {
      expect(() => named(n), n).not.toThrow();
    }
    const lit = (b: HTMLButtonElement) =>
      b.getAttribute("aria-checked") === "true" ||
      b.className.split(/\s+/).includes("border-theme-primary");
    expect(lit(named("Intersect"))).toBe(true);
    expect(lit(named("New selection"))).toBe(false);
  });

  it("clicking a mode writes it to the store", () => {
    render();
    openCombine();
    act(() => named("Subtract").click());
    expect(useToolStore.getState().selectionCombine).toBe(2);
    act(() => named("Intersect").click());
    expect(useToolStore.getState().selectionCombine).toBe(3);
  });

  it("spells the chosen mode out in the section header", () => {
    // The segments are icon-only and the four glyphs are four squares. Without
    // this line the current mode is unreadable — the same reason the Select
    // panel put it in SectionHeader's `value` before the move.
    useToolStore.setState({ selectionCombine: 2 });
    render();
    openCombine();
    expect(text()).toContain("Subtract");
  });
});

describe("the readout", () => {
  it("says 'Nothing selected' rather than disappearing", () => {
    render();
    openCombine();
    expect(container.querySelector('[data-testid="combine-coverage"]')?.textContent).toBe(
      "Nothing selected",
    );
  });

  it("shows the engine's count when something is selected", () => {
    // Same formatter and same words as the Select panel's readout and the
    // status-bar chip — three surfaces, one `describeCoverage`.
    useToolStore.setState({ selectionCoverage: { selected: 2_100_000, total: 11_413_043 } });
    render();
    openCombine();
    expect(container.querySelector('[data-testid="combine-coverage"]')?.textContent).toBe(
      "Selected 18.4% · 2.1 MP",
    );
  });
});

describe("the object list — an object is a selection producer", () => {
  it("lists every placed object, text and shapes alike", () => {
    render();
    openCombine();
    expect(() => row("Text #1")).not.toThrow();
    expect(() => row("Circle #1")).not.toThrow();
  });

  it("says so when there is nothing placed", () => {
    render([]);
    openCombine();
    expect(text()).toContain("Add text or a shape to combine the area it covers");
  });

  it("a click asks the session hook for THAT object, type and id both", () => {
    // The two id-spaces overlap (text #4 and shape #4 can both exist), so the
    // request carries the type as well — this is the assertion that a click on
    // a text row cannot combine a shape.
    render();
    openCombine();
    act(() => row("Circle #1").click());
    expect(useToolStore.getState().combineRequest).toEqual({ type: "shape", id: 7, n: 1 });
    act(() => row("Text #1").click());
    expect(useToolStore.getState().combineRequest).toEqual({ type: "text", id: 4, n: 2 });
  });

  it("asks again when the same row is clicked twice — the nonce moves", () => {
    // Combining the same shape twice in Add mode is a no-op the ENGINE decides
    // (it pushes no step when nothing changed). The panel must not decide it by
    // sending a request the hook cannot tell from the last one.
    render();
    openCombine();
    act(() => row("Text #1").click());
    act(() => row("Text #1").click());
    expect(useToolStore.getState().combineRequest?.n).toBe(2);
  });

  it("the row names the OUTCOME for the current mode, not the mode", () => {
    // A row is inches from four icons that all look like squares; "Subtract
    // Circle #1 from the selection" is the only thing that says what a click
    // there is about to do.
    const want: Record<number, string> = {
      0: "Select Circle #1 — replacing the current selection",
      1: "Add Circle #1 to the selection",
      2: "Subtract Circle #1 from the selection",
      3: "Keep only where the selection overlaps Circle #1",
    };
    for (const [mode, title] of Object.entries(want)) {
      act(() => root.render(React.createElement("div")));
      useToolStore.setState({ selectionCombine: Number(mode) as 0 | 1 | 2 | 3 });
      render();
      openCombine();
      expect(row("Circle #1").getAttribute("title"), mode).toBe(title);
    }
  });
});
