// @vitest-environment jsdom
//
// The "+" dialog is where an editable palette is edited (Chris, 11-25-2026):
// the row's colors — the site's 12 until changed — each with a × that is
// always shown, a "+" that adds the color being picked, and Reset once the
// palette differs. The saved colors come below only when there are some.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, beforeEach, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("VITE_CONVEX_URL", "");
  vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "");
});
afterAll(() => vi.unstubAllEnvs());

import { TooltipProvider } from "@/components/ui/tooltip";
import { ColorPickerDialog, type DialogPalette } from "./ColorPickerDialog";
import { FILL_COLORS } from "@/lib/colors";

// useUserColors caches its read; a storage event for its key drops the cache.
const savedColors = (colors: string[]) => {
  localStorage.setItem("image-horse-user-colors", JSON.stringify(colors));
  window.dispatchEvent(new StorageEvent("storage", { key: "image-horse-user-colors" }));
};

beforeEach(() => {
  localStorage.clear();
  savedColors([]);
});

function palette(over: Partial<DialogPalette> = {}): DialogPalette {
  return {
    label: "Fill Color",
    colors: FILL_COLORS,
    defaults: FILL_COLORS,
    max: 32,
    save: vi.fn(),
    ...over,
  };
}

const wrap = (ui: React.ReactElement) => render(<TooltipProvider>{ui}</TooltipProvider>);

const open = (p: DialogPalette, initial = "#8b5cf6", onPick = vi.fn(), onOpenChange = vi.fn()) =>
  wrap(
    <ColorPickerDialog open onOpenChange={onOpenChange} initialColor={initial} onPick={onPick} title="Edit Fill Color swatches" palette={p} />,
  );

const paletteRadios = () =>
  within(screen.getByRole("radiogroup", { name: "Fill Color swatches" })).getAllByRole("radio");

it("shows the Fill Color swatches's 12 colors, each with a × that is always there", () => {
  open(palette());
  expect(paletteRadios()).toHaveLength(12);
  expect(screen.getByText("Fill Color swatches (12/32)")).toBeTruthy();
  const removes = screen.getAllByRole("button", { name: /^Remove .* from Fill Color swatches$/ });
  expect(removes).toHaveLength(12);
  // Not hover-only: the dialog is the place to edit it.
  for (const r of removes) expect(r.className).not.toMatch(/(^|\s)hidden(\s|$)/);
  // The confirm button says OK, not "Use color".
  expect(screen.getByRole("button", { name: "OK" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Use color/ })).toBeNull();
});

it("× and + edit a draft; OK saves it and uses the color", () => {
  const p = palette();
  const onPick = vi.fn();
  // A color not already in it (#8b5cf6 is one of the 12: violet).
  open(p, "#123456", onPick);
  fireEvent.click(screen.getByRole("button", { name: `Remove ${FILL_COLORS[1]} from Fill Color swatches` }));
  fireEvent.click(screen.getByRole("button", { name: "Save to Fill Color swatches" }));
  expect(paletteRadios()).toHaveLength(12); // −1 +1
  expect(screen.getByText("OK saves these changes.")).toBeTruthy();
  expect(p.save).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "OK" }));
  const want = [...FILL_COLORS.filter((_, i) => i !== 1), "#123456"];
  expect(p.save).toHaveBeenCalledWith(want);
  expect(onPick).toHaveBeenCalledWith("#123456");
});

it("Cancel drops the draft", () => {
  const p = palette();
  open(p);
  fireEvent.click(screen.getByRole("button", { name: `Remove ${FILL_COLORS[0]} from Fill Color swatches` }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(p.save).not.toHaveBeenCalled();
});

it("OK with no palette change saves nothing", () => {
  const p = palette();
  open(p);
  fireEvent.click(screen.getByRole("button", { name: "OK" }));
  expect(p.save).not.toHaveBeenCalled();
});

it("Reset puts the site colors back in the draft, and only shows when they differ", () => {
  const p = palette({ colors: ["#ffffff", "#123456"] });
  open(p);
  expect(paletteRadios()).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Reset Fill Color swatches to the site colors" }));
  expect(paletteRadios()).toHaveLength(12);
  expect(screen.queryByRole("button", { name: /^Reset Fill Color swatches/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "OK" }));
  expect(p.save).toHaveBeenCalledWith(FILL_COLORS);
});

it("the last color has no ×", () => {
  open(palette({ colors: ["#ffffff"] }));
  expect(screen.queryByRole("button", { name: /^Remove / })).toBeNull();
});

it("the saved colors show under it only when there are some", () => {
  const { unmount } = open(palette());
  expect(screen.queryByRole("radiogroup", { name: "Saved colors" })).toBeNull();
  unmount();

  savedColors(["#abcdef"]);
  open(palette());
  const saved = screen.getByRole("radiogroup", { name: "Saved colors" });
  expect(within(saved).getAllByRole("radio")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Remove #abcdef from Saved colors" })).toBeTruthy();
});

it("with no editable palette it is the global palette, as before", () => {
  wrap(<ColorPickerDialog open onOpenChange={() => {}} initialColor="#8b5cf6" onPick={() => {}} />);
  expect(screen.getByRole("radiogroup", { name: "Palette" })).toBeTruthy();
  expect(screen.getByText("Palette (0/32)")).toBeTruthy();
  expect(screen.queryByRole("radiogroup", { name: "Fill Color swatches" })).toBeNull();
});
