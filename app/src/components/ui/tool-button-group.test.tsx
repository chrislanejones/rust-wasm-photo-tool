// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Crop, Scissors, Undo2 } from "lucide-react";
import { ToolButtonGroup } from "./tool-button-group";

// Plan B §1 — pin ToolButtonGroup's THREE modes.
//
// Unlike ToggleButtonGroup, the mode here is INFERRED: `"value" in props` is
// SELECT, otherwise the tiles are TOGGLEs if they carry `active` and ACTIONs
// if they do not. That inference is the fragile part — it is decided by the
// shape of the props, so an innocent-looking call-site edit (passing `value`
// as undefined, say, or adding `active` to an action tile) silently changes
// which ARIA vocabulary 43 segmented controls emit.
//
// All three modes render the same grid, so none of this is visible on screen.

const OPTS = [
  { id: "crop" as const, label: "Crop", icon: Crop },
  { id: "cut" as const, label: "Cut", icon: Scissors },
];

describe("ToolButtonGroup — SELECT (a `value` is passed)", () => {
  it("is a radio group whose tiles are radios", () => {
    render(<ToolButtonGroup aria-label="Shape" options={OPTS} value="crop" onChange={() => {}} />);
    expect(screen.getByRole("radiogroup", { name: "Shape" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Crop", checked: true })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Cut", checked: false })).toBeTruthy();
  });

  it("has exactly one tab stop", () => {
    render(<ToolButtonGroup aria-label="Shape" options={OPTS} value="cut" onChange={() => {}} />);
    expect(screen.getAllByRole("radio").filter((r) => r.getAttribute("tabindex") === "0")).toHaveLength(1);
  });

  it("picking a tile reports the id, not the index", () => {
    const onChange = vi.fn();
    render(<ToolButtonGroup aria-label="Shape" options={OPTS} value="crop" onChange={onChange} />);
    screen.getByRole("radio", { name: "Cut" }).click();
    expect(onChange).toHaveBeenCalledWith("cut");
  });

  it("a visible `label` becomes the group's name, without repeating it", () => {
    render(<ToolButtonGroup label="Shape" options={OPTS} value="crop" onChange={() => {}} />);
    // aria-labelledby at the words already on screen, rather than an
    // aria-label that duplicates them and can drift from them.
    const group = screen.getByRole("radiogroup", { name: "Shape" });
    expect(group.getAttribute("aria-labelledby")).toBeTruthy();
    expect(group.getAttribute("aria-label")).toBeNull();
  });

  it("an explicit aria-label beats the visible label", () => {
    // `label` may hold more than words — a lightbulb button, whose own name
    // would otherwise be read into the group's.
    render(
      <ToolButtonGroup aria-label="Shape of the crop" label="Shape" options={OPTS} value="crop" onChange={() => {}} />,
    );
    expect(screen.getByRole("radiogroup", { name: "Shape of the crop" })).toBeTruthy();
  });
});

describe("ToolButtonGroup — TOGGLE (no `value`, tiles carry `active`)", () => {
  it("tiles are toggle buttons and say which way they are", () => {
    render(
      <ToolButtonGroup
        label="Guides"
        options={[
          { id: "lock", label: "Lock", icon: Crop, active: true },
          { id: "rulers", label: "Rulers", icon: Scissors, active: false },
        ]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Lock", pressed: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Rulers", pressed: false })).toBeTruthy();
    // No radio vocabulary, and no radiogroup wrapper to imply one-of-many.
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("several tiles may be on at once", () => {
    render(
      <ToolButtonGroup
        label="Guides"
        options={[
          { id: "lock", label: "Lock", icon: Crop, active: true },
          { id: "rulers", label: "Rulers", icon: Scissors, active: true },
        ]}
        onChange={() => {}}
      />,
    );
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(2);
  });
});

describe("ToolButtonGroup — ACTION (no `value`, no `active`)", () => {
  it("tiles claim no state at all", () => {
    render(
      <ToolButtonGroup
        label="Do"
        options={[{ id: "undo", label: "Undo", icon: Undo2 }]}
        onChange={() => {}}
      />,
    );
    const b = screen.getByRole("button", { name: "Undo" });
    // The bug this catches: an action tile that announces "not pressed"
    // tells a screen-reader user there is a state to toggle when there is not.
    expect(b.getAttribute("aria-pressed")).toBeNull();
    expect(b.getAttribute("aria-checked")).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("an action tile still fires", () => {
    const onChange = vi.fn();
    render(
      <ToolButtonGroup label="Do" options={[{ id: "undo", label: "Undo", icon: Undo2 }]} onChange={onChange} />,
    );
    screen.getByRole("button", { name: "Undo" }).click();
    expect(onChange).toHaveBeenCalledWith("undo");
  });
});
