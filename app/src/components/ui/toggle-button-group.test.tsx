// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Check, Eye, Lock } from "lucide-react";
import { ToggleButtonGroup, type ToggleGroupItem } from "./toggle-button-group";

// Plan B §1 — pin the SELECT/TOGGLE semantics of ToggleButtonGroup.
//
// Night 2 made these groups announce their selection; nothing watched it
// afterwards. The thing that regresses quietly is not the look, it is which
// ARIA contract each mode emits — and the two modes look IDENTICAL on screen,
// so a mode regression is invisible to a screenshot and to a human.
//
// Every assertion here is about what a screen reader is told, which is why
// these are queried by role rather than by class.

const item = (key: string, label: string, active: boolean, onToggle = () => {}): ToggleGroupItem => ({
  key,
  label,
  active,
  onToggle,
  icon: key === "a" ? Check : key === "b" ? Eye : Lock,
});

describe("ToggleButtonGroup — TOGGLE mode (the default)", () => {
  it("every button is a toggle button and says which way it is", () => {
    render(
      <ToggleButtonGroup
        aria-label="Sections"
        items={[item("a", "History", true), item("b", "Layers", false)]}
      />,
    );
    // aria-pressed, not aria-checked: any number of these may be on.
    expect(screen.getByRole("button", { name: "History", pressed: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Layers", pressed: false })).toBeTruthy();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("more than one button may be on at once", () => {
    // The whole reason the mode is declared rather than inferred: "one is on
    // right now" does not prove "only one can be".
    render(
      <ToggleButtonGroup
        aria-label="Sections"
        items={[item("a", "History", true), item("b", "Layers", true)]}
      />,
    );
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(2);
  });

  it("a named group is a group; an unnamed one claims nothing", () => {
    const { unmount } = render(
      <ToggleButtonGroup aria-label="Sections" items={[item("a", "History", false)]} />,
    );
    expect(screen.getByRole("group", { name: "Sections" })).toBeTruthy();
    unmount();
    render(<ToggleButtonGroup items={[item("a", "History", false)]} />);
    // A group with no name is worse than no group: a screen reader announces
    // an anonymous container around the buttons.
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("every button keeps its own tab stop", () => {
    render(
      <ToggleButtonGroup
        aria-label="Sections"
        items={[item("a", "History", true), item("b", "Layers", false)]}
      />,
    );
    // Independent toggles are independently reachable — the roving single
    // tab stop belongs to SELECT, and applying it here would hide buttons
    // from the keyboard.
    for (const b of screen.getAllByRole("button")) {
      expect(b.getAttribute("tabindex")).toBeNull();
    }
  });
});

describe("ToggleButtonGroup — SELECT mode", () => {
  it("is a radio group whose options are radios", () => {
    render(
      <ToggleButtonGroup
        mode="select"
        aria-label="Theme"
        items={[item("a", "Light", false), item("b", "Dark", true), item("c", "System", false)]}
      />,
    );
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Dark", checked: true })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Light", checked: false })).toBeTruthy();
    // aria-pressed would contradict aria-checked; only one vocabulary applies.
    expect(screen.queryAllByRole("button", { pressed: true })).toHaveLength(0);
  });

  it("has exactly ONE tab stop, on the checked option", () => {
    render(
      <ToggleButtonGroup
        mode="select"
        aria-label="Theme"
        items={[item("a", "Light", false), item("b", "Dark", true), item("c", "System", false)]}
      />,
    );
    const radios = screen.getAllByRole("radio");
    const stops = radios.filter((r) => r.getAttribute("tabindex") === "0");
    expect(stops).toHaveLength(1);
    expect(stops[0]!).toHaveProperty("textContent", expect.stringContaining("Dark"));
  });

  it("falls back to a tab stop even when nothing is selected", () => {
    // A radio group with every option tabIndex -1 is unreachable by keyboard.
    render(
      <ToggleButtonGroup
        mode="select"
        aria-label="Theme"
        items={[item("a", "Light", false), item("b", "Dark", false)]}
      />,
    );
    expect(screen.getAllByRole("radio").filter((r) => r.getAttribute("tabindex") === "0")).toHaveLength(1);
  });

  it("clicking an option selects it", () => {
    const onToggle = vi.fn();
    render(
      <ToggleButtonGroup
        mode="select"
        aria-label="Theme"
        items={[item("a", "Light", false, onToggle), item("b", "Dark", true)]}
      />,
    );
    screen.getByRole("radio", { name: "Light" }).click();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe("ToggleButtonGroup — disabled and bare", () => {
  it("a disabled item is out of the tab order and still named", () => {
    render(
      <ToggleButtonGroup
        aria-label="Sections"
        items={[{ ...item("a", "Export", false), disabled: true }, item("b", "Layers", false)]}
      />,
    );
    const b = screen.getByRole("button", { name: "Export" });
    expect((b as HTMLButtonElement).disabled).toBe(true);
  });

  it("`bare` is display:contents, so it names nothing — the buttons carry their own names", () => {
    render(<ToggleButtonGroup bare aria-label="Sections" items={[item("a", "History", true)]} />);
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.getByRole("button", { name: "History", pressed: true })).toBeTruthy();
  });
});
