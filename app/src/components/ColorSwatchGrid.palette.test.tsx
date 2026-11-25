// @vitest-environment jsdom
//
// The swatch row every panel shares (Chris, 11-24-2026):
//   presets → saved colors → transparent (checkerboard) → "+"
// and the editable palette (`paletteKey`): add on the row, remove and reset
// in the "+" dialog — never a pencil or × on the row (Chris, 11-25-2026).
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeEach, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("VITE_CONVEX_URL", "");
  vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "");
});
afterAll(() => vi.unstubAllEnvs());

// The picker dialog is its own component with its own tests
// (ColorPickerDialog.palette.test.tsx); here it is a button that "uses" a
// fixed color, plus the editable palette it was handed as plain buttons, so
// the grid's routing is what's tested.
type MockPalette = {
  colors: readonly string[];
  defaults: readonly string[];
  save: (colors: readonly string[]) => void;
};
vi.mock("@/components/ColorPickerDialog", () => ({
  ColorPickerDialog: (p: {
    open: boolean;
    onPick: (c: string) => void;
    title: string;
    initialColor: string;
    palette?: MockPalette;
  }) =>
    p.open ? (
      <div data-initial={p.initialColor} data-testid="dialog">
        <button type="button" onClick={() => p.onPick("#123456")}>
          {`ok in: ${p.title}`}
        </button>
        {p.palette?.colors.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => p.palette?.save(p.palette.colors.filter((x) => x !== c))}
          >
            {`dialog remove ${c}`}
          </button>
        ))}
        {p.palette && (
          <>
            <button type="button" onClick={() => p.palette?.save([...p.palette.colors, "#123456"])}>
              dialog add
            </button>
            <button type="button" onClick={() => p.palette?.save(p.palette.defaults)}>
              dialog reset
            </button>
          </>
        )}
      </div>
    ) : null,
}));

import { ColorSwatchGrid } from "./ColorSwatchGrid";
import { isTransparent } from "@/lib/colors";

const DEFAULTS = ["#ffffff", "#ef4444", "#000000"] as const;

beforeEach(() => {
  localStorage.clear();
  // useUserColors caches its read; this drops it.
  window.dispatchEvent(new StorageEvent("storage", { key: "image-horse-user-colors" }));
});

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

const openDialog = () =>
  fireEvent.click(screen.getByRole("button", { name: "Edit Fill Color swatches" }));

it("the row has no pencil, no ×, and no Reset: editing is in the dialog", () => {
  localStorage.setItem("image-horse-palette:test", JSON.stringify(["#ffffff", "#000000"]));
  localStorage.setItem("image-horse-user-colors", JSON.stringify(["#abcdef"]));
  window.dispatchEvent(new StorageEvent("storage", { key: "image-horse-user-colors" }));
  render(
    <ColorSwatchGrid label="Fill Color" colors={DEFAULTS} paletteKey="test" value="#ffffff" onChange={vi.fn()} />,
  );
  // Edited, so the old row would have shown Reset; and every swatch its badges,
  // the saved color included.
  expect(radios("Fill Color")).toContain("Color #abcdef");
  expect(screen.queryByRole("button", { name: /^Remove / })).toBeNull();
  expect(screen.queryByRole("button", { name: /^Replace / })).toBeNull();
  expect(screen.queryByRole("button", { name: /^Reset/ })).toBeNull();
});

it("the dialog gets the palette; what it saves is the row, and OK uses the color", () => {
  const onChange = vi.fn();
  render(
    <ColorSwatchGrid label="Fill Color" colors={DEFAULTS} paletteKey="test" value="#ef4444" onChange={onChange} />,
  );
  openDialog();
  expect(screen.getByRole("button", { name: /^ok in: Edit Fill Color swatches$/ })).toBeTruthy();
  expect(screen.getAllByRole("button", { name: /^dialog remove / })).toHaveLength(DEFAULTS.length);

  fireEvent.click(screen.getByRole("button", { name: "dialog add" }));
  expect(radios("Fill Color")).toEqual([
    "Color #ffffff", "Color #ef4444", "Color #000000", "Color #123456",
    "Transparent (checkerboard)",
  ]);
  fireEvent.click(screen.getByRole("button", { name: "dialog remove #000000" }));
  expect(radios("Fill Color")).toEqual([
    "Color #ffffff", "Color #ef4444", "Color #123456", "Transparent (checkerboard)",
  ]);
  fireEvent.click(screen.getByRole("button", { name: "dialog reset" }));
  expect(radios("Fill Color")).toEqual([
    "Color #ffffff", "Color #ef4444", "Color #000000", "Transparent (checkerboard)",
  ]);
  // Saving the site's colors stores nothing: new site colors still arrive.
  expect(localStorage.getItem("image-horse-palette:test")).toBeNull();

  act(() => screen.getByRole("button", { name: /^ok in:/ }).click());
  expect(onChange).toHaveBeenLastCalledWith("#123456");
});

it("a transparent value opens the dialog on the row's last solid color, not black at 0%", () => {
  const { rerender } = render(
    <ColorSwatchGrid label="Fill Color" colors={DEFAULTS} paletteKey="test" value="#ef4444" onChange={vi.fn()} />,
  );
  rerender(
    <ColorSwatchGrid label="Fill Color" colors={DEFAULTS} paletteKey="test" value="transparent" onChange={vi.fn()} />,
  );
  openDialog();
  expect(screen.getByTestId("dialog").getAttribute("data-initial")).toBe("#ef4444");
});

it("two grids on the same palette stay in step, with no window event", () => {
  // The in-tab sync is a listener set in useEditablePalette, not a window
  // CustomEvent (CLAUDE.md: new CustomEvents are forbidden).
  const dispatch = vi.spyOn(window, "dispatchEvent");
  render(
    <>
      <ColorSwatchGrid label="Fill Color" colors={DEFAULTS} paletteKey="test" value="#ffffff" onChange={vi.fn()} />
      <ColorSwatchGrid label="Fill B" colors={DEFAULTS} paletteKey="test" value="#ffffff" onChange={vi.fn()} />
    </>,
  );
  openDialog();
  fireEvent.click(screen.getByRole("button", { name: "dialog remove #000000" }));
  expect(radios("Fill B")).toEqual(["Color #ffffff", "Color #ef4444", "Transparent (checkerboard)"]);
  expect(dispatch).not.toHaveBeenCalled();
  dispatch.mockRestore();
});

it("a color with alpha 0 counts as transparent", () => {
  for (const c of ["transparent", " Transparent ", "#00000000", "#ffffff00", "#0000"]) expect(isTransparent(c)).toBe(true);
  for (const c of ["#000000", "#000000ff", "#00000001", "#fff", "rgb(10, 20, 0)", "", null, undefined]) expect(isTransparent(c)).toBe(false);
});
