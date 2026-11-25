// @vitest-environment jsdom
//
// The swatch row every panel shares (Chris, 11-24-2026):
//   presets → saved colors → transparent (checkerboard) → "+"
// and the editable palette (`paletteKey`): replace, remove, add, reset.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeEach, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("VITE_CONVEX_URL", "");
  vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "");
});
afterAll(() => vi.unstubAllEnvs());

// The picker dialog is its own component with its own tests; here it is a
// button that "uses" a fixed color, so the grid's routing is what's tested.
vi.mock("@/components/ColorPickerDialog", () => ({
  ColorPickerDialog: (p: { open: boolean; onPick: (c: string) => void; title: string }) =>
    p.open ? (
      <button type="button" onClick={() => p.onPick("#123456")}>
        {`use in: ${p.title}`}
      </button>
    ) : null,
}));

import { ColorSwatchGrid } from "./ColorSwatchGrid";
import { isTransparent } from "@/lib/colors";

const DEFAULTS = ["#ffffff", "#ef4444", "#000000"] as const;

beforeEach(() => localStorage.clear());

const radios = (name: string) =>
  Array.from(
    screen.getByRole("radiogroup", { name }).querySelectorAll('[role="radio"]'),
  ).map((r) => r.getAttribute("aria-label"));

it("the transparent swatch sits last in the group, right before the +", () => {
  render(<ColorSwatchGrid colors={DEFAULTS} value="#ffffff" onChange={() => {}} />);
  expect(radios("Color")).toEqual([
    "Color #ffffff", "Color #ef4444", "Color #000000", "Transparent (checkerboard)",
  ]);
  const transparent = screen.getByRole("radio", { name: "Transparent (checkerboard)" });
  const plus = screen.getByRole("button", { name: "Pick a custom color" });
  expect(transparent.compareDocumentPosition(plus) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it("a 'transparent' preset moves to that slot instead of showing twice", () => {
  render(
    <ColorSwatchGrid colors={["transparent", "#ffffff"]} value="transparent" onChange={() => {}} />,
  );
  expect(radios("Color")).toEqual(["Color #ffffff", "Transparent (checkerboard)"]);
  expect(screen.getByRole("radio", { name: "Transparent (checkerboard)" }).getAttribute("aria-checked"))
    .toBe("true");
});

it("emits 'transparent', and an ink grid can turn it off", () => {
  const onChange = vi.fn();
  const { unmount } = render(<ColorSwatchGrid colors={DEFAULTS} value="#ffffff" onChange={onChange} />);
  fireEvent.click(screen.getByRole("radio", { name: "Transparent (checkerboard)" }));
  expect(onChange).toHaveBeenLastCalledWith("transparent");
  unmount();
  render(<ColorSwatchGrid colors={DEFAULTS} value="#ffffff" onChange={onChange} transparent={false} />);
  expect(screen.queryByRole("radio", { name: "Transparent (checkerboard)" })).toBeNull();
});

it("an editable palette: + adds and uses, the pencil replaces, × removes, Reset restores", () => {
  const onChange = vi.fn();
  render(
    <ColorSwatchGrid
      label="Fill Color"
      colors={DEFAULTS}
      paletteKey="test"
      value="#ef4444"
      onChange={onChange}
    />,
  );
  // Untouched: the defaults, and no Reset.
  expect(screen.queryByRole("button", { name: /^Reset/ })).toBeNull();

  // Add.
  fireEvent.click(screen.getByRole("button", { name: "Add a color to Fill Color" }));
  act(() => screen.getByRole("button", { name: /^use in: Add/ }).click());
  expect(onChange).toHaveBeenLastCalledWith("#123456");
  expect(radios("Fill Color")).toEqual([
    "Color #ffffff", "Color #ef4444", "Color #000000", "Color #123456",
    "Transparent (checkerboard)",
  ]);

  // Replace the lit swatch: the palette changes AND so does the value.
  onChange.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Replace #ef4444" }));
  act(() => screen.getByRole("button", { name: /^use in: Replace/ }).click());
  // #123456 was already there, so it MOVES into red's slot.
  expect(radios("Fill Color")).toEqual([
    "Color #ffffff", "Color #123456", "Color #000000", "Transparent (checkerboard)",
  ]);
  expect(onChange).toHaveBeenLastCalledWith("#123456");

  // Remove.
  fireEvent.click(screen.getByRole("button", { name: "Remove #000000" }));
  expect(radios("Fill Color")).toEqual([
    "Color #ffffff", "Color #123456", "Transparent (checkerboard)",
  ]);

  // Reset.
  fireEvent.click(screen.getByRole("button", { name: "Reset Fill Color to the site colors" }));
  expect(radios("Fill Color")).toEqual([
    "Color #ffffff", "Color #ef4444", "Color #000000", "Transparent (checkerboard)",
  ]);
  expect(localStorage.getItem("image-horse-palette:test")).toBeNull();
});

it("replacing a swatch that isn't lit edits the palette only", () => {
  const onChange = vi.fn();
  render(
    <ColorSwatchGrid colors={DEFAULTS} paletteKey="test" value="#ffffff" onChange={onChange} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Replace #000000" }));
  act(() => screen.getByRole("button", { name: /^use in: Replace/ }).click());
  expect(onChange).not.toHaveBeenCalled();
  expect(radios("Color")).toContain("Color #123456");
});

it("two grids on the same palette stay in step, with no window event", () => {
  // The in-tab sync is a listener set in useEditablePalette, not a window
  // CustomEvent (CLAUDE.md: new CustomEvents are forbidden).
  const dispatch = vi.spyOn(window, "dispatchEvent");
  render(
    <>
      <ColorSwatchGrid label="Fill A" colors={DEFAULTS} paletteKey="test" value="#ffffff" onChange={vi.fn()} />
      <ColorSwatchGrid label="Fill B" colors={DEFAULTS} paletteKey="test" value="#ffffff" onChange={vi.fn()} />
    </>,
  );
  fireEvent.click(screen.getAllByRole("button", { name: "Remove #000000" })[0]);
  expect(radios("Fill B")).toEqual(["Color #ffffff", "Color #ef4444", "Transparent (checkerboard)"]);
  expect(dispatch).not.toHaveBeenCalled();
  dispatch.mockRestore();
});

it("a replace follows its swatch when another tab removes an earlier one", () => {
  render(<ColorSwatchGrid colors={DEFAULTS} paletteKey="test" value="#ffffff" onChange={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Replace #ef4444" }));
  // Another tab removes white while the dialog is open: red is now slot 0.
  act(() => {
    localStorage.setItem("image-horse-palette:test", JSON.stringify(["#ef4444", "#000000"]));
    window.dispatchEvent(new StorageEvent("storage"));
  });
  act(() => screen.getByRole("button", { name: /^use in: Replace/ }).click());
  expect(radios("Color")).toEqual(["Color #123456", "Color #000000", "Transparent (checkerboard)"]);
});

it("a disabled grid offers no remove or replace", () => {
  render(<ColorSwatchGrid colors={DEFAULTS} paletteKey="test" value="#ffffff" onChange={vi.fn()} disabled />);
  expect(screen.queryByRole("button", { name: /^Remove / })).toBeNull();
  expect(screen.queryByRole("button", { name: /^Replace / })).toBeNull();
});

it("a color with alpha 0 counts as transparent", () => {
  for (const c of ["transparent", " Transparent ", "#00000000", "#ffffff00", "#0000"]) expect(isTransparent(c)).toBe(true);
  for (const c of ["#000000", "#000000ff", "#00000001", "#fff", "rgb(10, 20, 0)", "", null, undefined]) expect(isTransparent(c)).toBe(false);
});
