// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ControlRow } from "./control-row";

// Plan B §1 — pin ControlRow's SLOTS and its id contract.
//
// The slots (`label` / `value` / `control` / the reason line) are what make
// nine panels read as one application, and the panel-grammar probes in §4
// measure them by `data-slot`. If a slot is renamed or stops rendering, those
// probes stop measuring anything and still pass — so the names are pinned here
// rather than only being relied on there.
//
// The id contract is the load-bearing half: the render-prop form hands the
// control the id of the words ALREADY ON SCREEN, so a radio group can point
// `aria-labelledby` at them instead of repeating them in an `aria-label` that
// then drifts from the visible text.

describe("ControlRow — slots", () => {
  it("renders the label, the value and the control in their own slots", () => {
    const { container } = render(
      <ControlRow label="Strength" value="42%">
        <input aria-label="Strength" type="range" />
      </ControlRow>,
    );
    expect(container.querySelector('[data-slot="control-row"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="label"]')?.textContent).toBe("Strength");
    expect(container.querySelector('[data-slot="value"]')?.textContent).toBe("42%");
    expect(container.querySelector('[data-slot="control"]')).toBeTruthy();
  });

  it("omits the value slot entirely when there is no value", () => {
    // Not an empty box: a lit tile already shows its own state, and an empty
    // right-hand slot reads as a value that failed to load.
    const { container } = render(
      <ControlRow label="Mode">
        <button type="button">Tile</button>
      </ControlRow>,
    );
    expect(container.querySelector('[data-slot="value"]')).toBeNull();
  });

  it("keeps a value of 0, which is a value", () => {
    // `value != null`, not truthiness — the bug this catches is a row whose
    // number vanishes exactly when it reaches zero.
    const { container } = render(
      <ControlRow label="Feather" value={0}>
        <input aria-label="Feather" type="range" />
      </ControlRow>,
    );
    expect(container.querySelector('[data-slot="value"]')?.textContent).toBe("0");
  });
});

describe("ControlRow — the id contract", () => {
  it("hands the control the id of the visible label", () => {
    render(
      <ControlRow label="Shape">
        {({ labelId }) => (
          <div role="radiogroup" aria-labelledby={labelId}>
            <button type="button" role="radio" aria-checked="true">
              Square
            </button>
          </div>
        )}
      </ControlRow>,
    );
    // Named by the words on screen — the point of the render prop.
    expect(screen.getByRole("radiogroup", { name: "Shape" })).toBeTruthy();
  });

  it("gives a reason an id, and only while a reason renders", () => {
    const withReason = render(
      <ControlRow label="Apply" reason="Draw a crop box first.">
        {({ reasonId }) => (
          <button type="button" disabled aria-describedby={reasonId}>
            Apply Crop
          </button>
        )}
      </ControlRow>,
    );
    const btn = screen.getByRole("button", { name: "Apply Crop" });
    const id = btn.getAttribute("aria-describedby");
    expect(id).toBeTruthy();
    expect(withReason.container.querySelector(`#${id}`)?.textContent).toContain("Draw a crop box first.");
    withReason.unmount();

    // No reason, no id — a dangling aria-describedby pointing at nothing is
    // worse than none, because the control claims a description it has not got.
    render(
      <ControlRow label="Apply">
        {({ reasonId }) => (
          <button type="button" aria-describedby={reasonId}>
            Apply Crop
          </button>
        )}
      </ControlRow>,
    );
    expect(screen.getByRole("button", { name: "Apply Crop" }).getAttribute("aria-describedby")).toBeNull();
  });

  it("the label id and the reason id are distinct per row", () => {
    // Two rows on one panel must not collide — `useId` per instance.
    const seen: string[] = [];
    const Capture = ({ label }: { label: string }) => (
      <ControlRow label={label}>{({ labelId }) => { seen.push(labelId); return <div />; }}</ControlRow>
    );
    render(
      <>
        <Capture label="One" />
        <Capture label="Two" />
      </>,
    );
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe("ControlRow — the plain children form still works", () => {
  it("accepts a node instead of a function", () => {
    render(
      <ControlRow label="Size" value="8 px">
        <input aria-label="Size" type="range" />
      </ControlRow>,
    );
    expect(screen.getByRole("slider", { name: "Size" })).toBeTruthy();
  });
});
