// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Check, Crop, Eye, Scissors } from "lucide-react";
import { ToggleButtonGroup, type ToggleGroupItem } from "./toggle-button-group";
import { ToolButtonGroup } from "./tool-button-group";

// Plan B §1 — the gaps LEFT OVER by segmented-modes.test.ts.
//
// ⚠️ READ THAT FILE FIRST. It already renders both group primitives under
// jsdom (`createRoot` + `act`) and already pins the whole four-mode contract
// plus roving tabindex, arrow keys, wrapping, Home/End and disabled-skipping.
// Writing a second set of mode tests here was a mistake and 19 duplicate tests
// were deleted rather than shipped. What remains is only what that file does
// NOT assert:
//
//   • whether a TOGGLE group names itself, and what an UNNAMED one claims
//   • `bare` (display: contents), which has no box to hang a role on
//   • that independent toggles each keep their own tab stop — the roving
//     single stop belongs to SELECT, and applying it here would hide buttons
//     from the keyboard
//   • name PRECEDENCE when a visible label and an explicit aria-label are
//     both present (that file covers aria-label only when there is no label)
//   • that a picked tile reports its id, not its index
//
// These use Testing Library because every one of them is a question about the
// ACCESSIBLE NAME and role, which `getByRole(role, { name, pressed })` asks
// directly and a manual attribute query only approximates.

const item = (key: string, label: string, active: boolean, onToggle = () => {}): ToggleGroupItem => ({
  key,
  label,
  active,
  onToggle,
  icon: key === "a" ? Check : Eye,
});

describe("ToggleButtonGroup — does the group name itself?", () => {
  it("a named TOGGLE group is a group", () => {
    render(<ToggleButtonGroup mode="toggle" aria-label="Sections" items={[item("a", "History", false)]} />);
    expect(screen.getByRole("group", { name: "Sections" })).toBeTruthy();
  });

  it("an UNNAMED group claims nothing at all", () => {
    // An anonymous container around the buttons is worse than no container:
    // a screen reader announces entering and leaving a group it cannot name.
    render(<ToggleButtonGroup mode="toggle" items={[item("a", "History", false)]} />);
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.getByRole("button", { name: "History" })).toBeTruthy();
  });

  it("`bare` names nothing, because display:contents is no box to hang a role on", () => {
    render(<ToggleButtonGroup bare mode="toggle" aria-label="Sections" items={[item("a", "History", true)]} />);
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    // The buttons still carry their own names and state.
    expect(screen.getByRole("button", { name: "History", pressed: true })).toBeTruthy();
  });
});

describe("ToggleButtonGroup — keyboard reach in TOGGLE mode", () => {
  it("every button keeps its own tab stop", () => {
    render(
      <ToggleButtonGroup
        mode="toggle"
        aria-label="Sections"
        items={[item("a", "History", true), item("b", "Layers", false)]}
      />,
    );
    // No roving tabindex: these are independent, so each must be reachable.
    for (const b of screen.getAllByRole("button")) {
      expect(b.getAttribute("tabindex")).toBeNull();
    }
  });

  it("a disabled item is really disabled and still named", () => {
    render(
      <ToggleButtonGroup
        mode="toggle"
        aria-label="Sections"
        items={[{ ...item("a", "Export", false), disabled: true }, item("b", "Layers", false)]}
      />,
    );
    const b = screen.getByRole("button", { name: "Export" });
    expect((b as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("ToolButtonGroup — name precedence and the onChange payload", () => {
  const OPTS = [
    { id: "crop" as const, label: "Crop", icon: Crop },
    { id: "cut" as const, label: "Cut", icon: Scissors },
  ];

  it("an explicit aria-label beats a visible label", () => {
    // `label` may hold more than words — a lightbulb button, whose own name
    // would otherwise be read into the group's. So an explicit name wins.
    render(
      <ToolButtonGroup
        aria-label="Shape of the crop"
        label="Shape"
        options={OPTS}
        value="crop"
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("radiogroup", { name: "Shape of the crop" })).toBeTruthy();
    expect(screen.queryByRole("radiogroup", { name: "Shape" })).toBeNull();
  });

  it("a visible label names the group by POINTING at it, not by copying it", () => {
    render(<ToolButtonGroup label="Shape" options={OPTS} value="crop" onChange={() => {}} />);
    const group = screen.getByRole("radiogroup", { name: "Shape" });
    // aria-labelledby at the words already on screen; an aria-label copy can
    // drift from the visible text and nothing would notice.
    expect(group.getAttribute("aria-labelledby")).toBeTruthy();
    expect(group.getAttribute("aria-label")).toBeNull();
  });

  it("picking a tile reports its id, not its index", () => {
    const onChange = vi.fn();
    render(<ToolButtonGroup aria-label="Shape" options={OPTS} value="crop" onChange={onChange} />);
    screen.getByRole("radio", { name: "Cut" }).click();
    expect(onChange).toHaveBeenCalledWith("cut");
  });
});
