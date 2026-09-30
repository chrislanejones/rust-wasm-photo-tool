// @vitest-environment jsdom
//
// The Night 3 tool-panel grammar, asserted on RENDERED DOM — never on source
// text (a grep goes green on a comment; see UI_CONSISTENCY §6). Each block
// here was seen red once by a deliberate mutation of the primitive it names,
// then restored; the mutation is written above the block.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ControlRow } from "./control-row";
import { SizeSlider } from "./size-slider";
import { PresetRow } from "./preset-row";
import { Kbd } from "./kbd";
import { PanelAction, PanelActionBar } from "./panel-action-bar";
import { AdvancedSection } from "./advanced-section";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(el: React.ReactElement): void {
  act(() => root.render(el));
}

const h = React.createElement;
const $ = <T extends Element = HTMLElement>(sel: string) => container.querySelector<T>(sel)!;
const slot = (name: string) => $(`[data-slot="${name}"]`);

// Mutation seen red: label and value swapped inside ControlRow's header row.
describe("ControlRow — fixed slots", () => {
  it("puts the label left and the value right on one row, and the control under both", () => {
    render(
      h(ControlRow, { label: "Brush Size", value: "20" }, h("input", { type: "range", "data-testid": "ctl" })),
    );
    const label = slot("label");
    const value = slot("value");
    const control = slot("control");
    expect(label.textContent).toBe("Brush Size");
    expect(value.textContent).toBe("20");
    expect(control.querySelector('[data-testid="ctl"]')).not.toBeNull();

    // Label and value share the header row; label comes first in it.
    const header = value.parentElement!;
    expect(header.contains(label)).toBe(true);
    expect(label.compareDocumentPosition(value) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(header.lastElementChild).toBe(value);
    // The control is the header's next sibling: under it, not beside it.
    expect(header.nextElementSibling).toBe(control);
  });

  it("renders no value slot and no reason slot when neither is given", () => {
    render(h(ControlRow, { label: "Stroke Stabilizer" }, h("div")));
    expect(container.querySelector('[data-slot="value"]')).toBeNull();
    expect(container.querySelector('[data-slot="reason"]')).toBeNull();
  });

  it("hands the control the label's id, so a group is named by the words on screen", () => {
    render(
      h(ControlRow, {
        label: "Ratio",
        children: ({ labelId }: { labelId: string }) => h("div", { role: "radiogroup", "aria-labelledby": labelId }),
      }),
    );
    const group = $('[role="radiogroup"]');
    expect(document.getElementById(group.getAttribute("aria-labelledby")!)?.textContent).toBe("Ratio");
  });
});

// Mutation seen red: `aria-valuetext` removed from both range inputs.
describe("SizeSlider — the value text is the control's value", () => {
  it("plain slider: the value slot, the input's value and its valuetext agree", () => {
    render(h(SizeSlider, { label: "Blur Intensity", value: 7, min: 1, max: 20, unit: "px", onChange: () => {} }));
    const input = $<HTMLInputElement>('input[type="range"]');
    expect(input.value).toBe("7");
    expect(slot("value").textContent).toBe("7px");
    expect(input.getAttribute("aria-valuetext")).toBe(slot("value").textContent);
  });

  it("preset slider: the track position is NOT the value, so valuetext carries the value", () => {
    render(h(SizeSlider, { label: "Brush Size", value: 20, presets: [4, 8, 16, 32], onChange: () => {} }));
    const input = $<HTMLInputElement>('input[type="range"]');
    // 16 sits at 67 and 32 at 100, so 20 is a quarter of the way: 75.
    expect(input.value).toBe("75");
    expect(slot("value").textContent).toBe("20");
    expect(input.getAttribute("aria-valuetext")).toBe("20");
  });

  it("follows the value when it changes", () => {
    function Harness() {
      const [v, setV] = React.useState(50);
      return h(SizeSlider, { label: "Opacity", value: v, onChange: setV, presets: [25, 50, 75, 100], unit: "%", variant: "numbers" });
    }
    render(h(Harness));
    act(() => $<HTMLButtonElement>('[aria-label="Opacity 75%"]').click());
    expect(slot("value").textContent).toBe("75%");
    expect($('input[type="range"]').getAttribute("aria-valuetext")).toBe("75%");
  });
});

// Mutation seen red: radio props dropped from PresetRow's buttons.
describe("PresetRow — a named radio group, one Tab stop", () => {
  function Harness() {
    const [v, setV] = React.useState(50);
    return h(PresetRow, { label: "Opacity", presets: [25, 50, 75, 100], value: v, onChange: setV, unit: "%", variant: "numbers" as const });
  }

  it("checks the preset that matches the value, and only it is tabbable", () => {
    render(h(Harness));
    const group = $('[role="radiogroup"]');
    expect(group.getAttribute("aria-label")).toBe("Opacity presets");
    const radios = [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["false", "true", "false", "false"]);
    expect(radios.map((r) => r.tabIndex)).toEqual([-1, 0, -1, -1]);
  });

  it("ArrowRight moves to and picks the next preset", () => {
    render(h(Harness));
    const checked = $<HTMLButtonElement>('[aria-checked="true"]');
    act(() => {
      checked.focus();
      checked.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect($('[aria-checked="true"]').getAttribute("aria-label")).toBe("Opacity 75%");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Opacity 75%");
  });

  it("a value between presets checks nothing and leaves the first preset as the stop", () => {
    render(h(PresetRow, { label: "Brush Size", presets: [4, 8, 16, 32], value: 20, onChange: () => {} }));
    const radios = [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    expect(radios.every((r) => r.getAttribute("aria-checked") === "false")).toBe(true);
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1, -1]);
  });
});

// Mutation seen red: Kbd rendering a <span>.
describe("Kbd", () => {
  it("renders a real <kbd> element on the house radius", () => {
    render(h(Kbd, null, "Ctrl+Z"));
    const el = container.firstElementChild!;
    expect(el.tagName).toBe("KBD");
    expect(el.textContent).toBe("Ctrl+Z");
    expect(el.classList.contains("rounded-sm")).toBe(true);
  });
});

// Mutations seen red: (a) `reason` dropped from SizeSlider's ControlRow;
// (b) PanelAction's `aria-describedby` removed.
describe("a disabled control says why", () => {
  it("SizeSlider: the reason is visible, and both the presets and the track are described by it", () => {
    render(
      h(SizeSlider, {
        label: "Brush Size",
        value: 40,
        presets: [8, 40, 80, 120],
        onChange: () => {},
        disabled: true,
        reason: "Locked while the object is being removed.",
      }),
    );
    const reason = slot("reason");
    expect(reason.textContent).toBe("Locked while the object is being removed.");
    const input = $<HTMLInputElement>('input[type="range"]');
    expect(input.disabled).toBe(true);
    expect(input.getAttribute("aria-describedby")).toBe(reason.id);
    expect($('[role="radiogroup"]').getAttribute("aria-describedby")).toBe(reason.id);
  });

  it("PanelActionBar: a disabled action is described by the bar's reason; an enabled one is not", () => {
    const bar = (disabled: boolean) =>
      h(
        PanelActionBar,
        { reason: disabled ? "Drag a crop box on the canvas, or pick a ratio." : undefined },
        h(PanelAction, { disabled }, "Apply Crop"),
      );
    render(bar(true));
    const button = $<HTMLButtonElement>("button");
    const reason = slot("reason");
    expect(reason.textContent).toBe("Drag a crop box on the canvas, or pick a ratio.");
    expect(button.getAttribute("aria-describedby")).toBe(reason.id);

    render(bar(false));
    expect(container.querySelector('[data-slot="reason"]')).toBeNull();
    expect($("button").hasAttribute("aria-describedby")).toBe(false);
  });
});

// Mutation seen red: AdvancedSection's `defaultOpen` defaulting to true.
describe("AdvancedSection", () => {
  it("is collapsed by default, says what is inside, and opens as a disclosure", () => {
    render(h(AdvancedSection, { summary: "Stabilizer: Med" }, h("p", null, "inside")));
    const toggle = $<HTMLButtonElement>("button[aria-expanded]");
    const region = document.getElementById(toggle.getAttribute("aria-controls")!)!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(region.hidden).toBe(true);
    expect(toggle.textContent).toContain("Stabilizer: Med");

    act(() => toggle.click());
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(region.hidden).toBe(false);
    expect(region.textContent).toBe("inside");
  });
});
