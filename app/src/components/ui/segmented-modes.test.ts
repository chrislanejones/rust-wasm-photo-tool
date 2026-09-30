// @vitest-environment jsdom
//
// The four-mode contract (docs/UI_CONSISTENCY.md §7) for the two group
// primitives, asserted on RENDERED attributes, never on source text: Night 1
// counted `aria-pressed` three times from a grep and two of the three numbers
// were inflated by comments explaining the attribute. A test that reads text
// goes green on documentation. These read the DOM.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Circle, Square, Triangle } from "lucide-react";
import { ToolButtonGroup } from "./tool-button-group";
import { ToggleButtonGroup } from "./toggle-button-group";

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
const OPTS = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Beta" },
  { id: "c", label: "Gamma" },
] as const;

/** A controlled SELECT group, so arrow keys can be seen moving the selection. */
function SelectHarness(props: { initial?: string; disabledId?: string; onPick?: (id: string) => void }) {
  const [v, setV] = React.useState<string | undefined>(props.initial);
  return h(ToolButtonGroup<string>, {
    label: "Letters",
    value: v,
    onChange: (id: string) => {
      setV(id);
      props.onPick?.(id);
    },
    options: OPTS.map((o) => ({ ...o, disabled: o.id === props.disabledId })),
  });
}

function PairHarness() {
  const [on, setOn] = React.useState(true);
  return h(
    "div",
    null,
    h("h3", { id: "hd" }, "Sync"),
    h(ToggleButtonGroup, {
      mode: "select",
      "aria-labelledby": "hd",
      items: [
        { key: "on", icon: Circle, label: "Sync on", active: on, onToggle: () => setOn(true) },
        { key: "off", icon: Square, label: "Sync off", active: !on, onToggle: () => setOn(false) },
      ],
    }),
  );
}

const q = (sel: string) => [...container.querySelectorAll<HTMLElement>(sel)];
const radios = () => q('[role="radio"]');
const checkedLabel = () => radios().find((r) => r.getAttribute("aria-checked") === "true")?.textContent;
const key = (el: Element, k: string) =>
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
  });

/** The accessible name a `role=radiogroup` resolves to, from aria-label or
 *  the text of every element aria-labelledby points at. */
function groupName(g: Element): string {
  const by = g.getAttribute("aria-labelledby");
  if (by) return by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ").trim();
  return g.getAttribute("aria-label") ?? "";
}

describe("SELECT mode", () => {
  it("tool-button-group with `value` emits a radiogroup of radios with aria-checked, and no aria-pressed", () => {
    render(h(SelectHarness, { initial: "b" }));
    expect(q('[role="radiogroup"]')).toHaveLength(1);
    expect(radios()).toHaveLength(3);
    expect(radios().map((r) => r.getAttribute("aria-checked"))).toEqual(["false", "true", "false"]);
    expect(q("[aria-pressed]")).toHaveLength(0);
  });

  it("`value={undefined}` is still a select (presence, not value), with nothing checked", () => {
    render(h(ToolButtonGroup<string>, { options: OPTS, value: undefined, onChange: () => {}, "aria-label": "L" }));
    expect(radios()).toHaveLength(3);
    expect(radios().every((r) => r.getAttribute("aria-checked") === "false")).toBe(true);
  });

  it('toggle-button-group with mode="select" emits radios, not aria-pressed', () => {
    render(h(PairHarness));
    expect(q('[role="radiogroup"]')).toHaveLength(1);
    expect(radios().map((r) => r.getAttribute("aria-checked"))).toEqual(["true", "false"]);
    expect(q("[aria-pressed]")).toHaveLength(0);
  });
});

describe("TOGGLE mode", () => {
  it("a tool-button-group tile with its own `active` emits aria-pressed, and is not a radio", () => {
    render(
      h(ToolButtonGroup<string>, {
        onChange: () => {},
        options: [
          { id: "h", label: "H" },
          { id: "lock", label: "Lock", active: true },
          { id: "grid", label: "Grid", active: false },
        ],
      }),
    );
    const pressed = q("[aria-pressed]");
    expect(pressed.map((b) => [b.textContent, b.getAttribute("aria-pressed")])).toEqual([
      ["Lock", "true"],
      ["Grid", "false"],
    ]);
    expect(radios()).toHaveLength(0);
    expect(q('[role="radiogroup"]')).toHaveLength(0);
  });

  it("toggle-button-group by default emits aria-pressed on every button, and no radios", () => {
    render(
      h(ToggleButtonGroup, {
        items: [
          { key: "t", icon: Circle, label: "Tools", active: true, onToggle: () => {} },
          { key: "g", icon: Square, label: "Gallery", active: true, onToggle: () => {} },
          { key: "r", icon: Triangle, label: "Review", active: false, onToggle: () => {} },
        ],
      }),
    );
    expect(q("button").map((b) => b.getAttribute("aria-pressed"))).toEqual(["true", "true", "false"]);
    expect(radios()).toHaveLength(0);
  });
});

describe("ACTION mode", () => {
  it("a tool-button-group with no `value` and no `active` emits neither aria-pressed nor a radio role", () => {
    render(h(ToolButtonGroup<string>, { options: OPTS, onChange: () => {} }));
    expect(q("button")).toHaveLength(3);
    expect(q("[aria-pressed]")).toHaveLength(0);
    expect(q("[aria-checked]")).toHaveLength(0);
    expect(q("[role]")).toHaveLength(0);
  });
});

describe("the group carries an accessible name", () => {
  it("from tool-button-group's own `label`", () => {
    render(h(SelectHarness, { initial: "a" }));
    expect(groupName(q('[role="radiogroup"]')[0])).toBe("Letters");
  });

  it("from an explicit aria-label when there is no label", () => {
    render(h(ToolButtonGroup<string>, { options: OPTS, value: "a", onChange: () => {}, "aria-label": "Blur mode" }));
    expect(groupName(q('[role="radiogroup"]')[0])).toBe("Blur mode");
  });

  it("from aria-labelledby pointing at a rendered heading", () => {
    render(h(PairHarness));
    expect(groupName(q('[role="radiogroup"]')[0])).toBe("Sync");
  });
});

describe("roving tabindex and arrow keys", () => {
  it("exactly one Tab stop per group: the checked option", () => {
    render(h(SelectHarness, { initial: "b" }));
    expect(radios().map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
  });

  it("with nothing checked, the first enabled option is the Tab stop", () => {
    render(h(SelectHarness, { disabledId: "a" }));
    expect(radios().map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
  });

  it("ArrowRight / ArrowDown select the next option and move focus with it; wraps at the end", () => {
    render(h(SelectHarness, { initial: "a" }));
    radios()[0].focus();
    key(radios()[0], "ArrowRight");
    expect(checkedLabel()).toBe("Beta");
    expect(document.activeElement).toBe(radios()[1]);
    key(radios()[1], "ArrowDown");
    expect(checkedLabel()).toBe("Gamma");
    key(radios()[2], "ArrowRight");
    expect(checkedLabel()).toBe("Alpha");
    expect(radios().map((r) => r.tabIndex)).toEqual([0, -1, -1]);
  });

  it("ArrowLeft / ArrowUp go back and wrap; Home and End jump", () => {
    render(h(SelectHarness, { initial: "a" }));
    key(radios()[0], "ArrowLeft");
    expect(checkedLabel()).toBe("Gamma");
    key(radios()[2], "ArrowUp");
    expect(checkedLabel()).toBe("Beta");
    key(radios()[1], "Home");
    expect(checkedLabel()).toBe("Alpha");
    key(radios()[0], "End");
    expect(checkedLabel()).toBe("Gamma");
    expect(document.activeElement).toBe(radios()[2]);
  });

  it("skips a disabled option", () => {
    render(h(SelectHarness, { initial: "a", disabledId: "b" }));
    key(radios()[0], "ArrowRight");
    expect(checkedLabel()).toBe("Gamma");
  });

  it("the labeled pair in toggle-button-group moves with the arrows too", () => {
    render(h(PairHarness));
    expect(radios().map((r) => r.tabIndex)).toEqual([0, -1]);
    key(radios()[0], "ArrowRight");
    expect(checkedLabel()).toBe("Sync off");
    expect(radios().map((r) => r.tabIndex)).toEqual([-1, 0]);
  });

  it("a key that is not a navigation key selects nothing", () => {
    const picks: string[] = [];
    render(h(SelectHarness, { initial: "a", onPick: (id) => picks.push(id) }));
    key(radios()[0], "x");
    key(radios()[0], "Tab");
    expect(picks).toEqual([]);
  });
});
