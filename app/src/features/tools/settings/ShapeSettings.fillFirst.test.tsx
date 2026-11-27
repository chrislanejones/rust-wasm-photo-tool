// @vitest-environment jsdom
//
// The Shapes panel is FILL FIRST and PALETTE FIRST (Chris, 11-19-2026):
//
//   tiles → Fill Color → Points → Corner Radius → Sloppiness → Stroke ▸
//
// The color palette is the first control on every tab — a design-system
// rule since (UI_CONSISTENCY §8). On the Arrows tab it sits above the tiles
// too (11-23-2026). On the Shapes tab that color
// is the shape's FILL, and its stroke is a closed dropdown at the foot whose
// default is None. The old Fill dropdown (None | Solid | Gradient | Pixelate)
// left this tab; the diagram shapes on the Arrows tab, which stay stroke
// first, keep it.
import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, expect, it, vi } from "vitest";

// Demo mode, whatever the checkout's .env.local says — see the same note in
// TextSettings.sections.test.tsx (the color grid's useUserColors).
vi.hoisted(() => {
  vi.stubEnv("VITE_CONVEX_URL", "");
  vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "");
});
afterAll(() => vi.unstubAllEnvs());
import { TooltipProvider } from "@/components/ui/tooltip";
import { defaultToolSettings } from "@/lib/defaultToolSettings";
import { FILL_COLORS, TEXT_COLORS } from "@/lib/colors";
import type { ToolSettings } from "@/lib/types";
import type { ShapesMode } from "@/stores/useToolStore";
import { ShapesSettings } from "./ShapeSettings";

function renderPanel(overrides: Partial<ToolSettings> = {}, mode: ShapesMode = "shapes") {
  const onChange = vi.fn();
  const { container } = render(
    <ShapesSettings
      settings={{ ...defaultToolSettings, shape: "rect", ...overrides }}
      onChange={onChange}
      activeMode={mode}
    />,
    { wrapper: TooltipProvider },
  );
  return { onChange, container };
}

/** The disclosure header named `name`, or undefined. */
const section = (name: RegExp) =>
  screen
    .queryAllByRole("button", { name })
    .find((b) => b.hasAttribute("aria-expanded"));

/** Every control row's label, top to bottom — the panel's order as read. */
const rowLabels = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-slot="control-row"] [data-slot="label"]')).map(
    (el) => el.textContent?.trim(),
  );

const checkedIn = (group: HTMLElement) =>
  Array.from(group.querySelectorAll('[role="radio"][aria-checked="true"]'));

it("a rectangle: Fill Color first, then Corner Radius, Sloppiness, and Stroke shut at None", () => {
  const { container } = renderPanel();
  // Stroke's two rows are in the DOM, inside its hidden region, hence last.
  expect(rowLabels(container)).toEqual([
    "Fill Color", "Corner Radius", "Sloppiness", "Stroke Color", "Stroke Width",
  ]);
  const stroke = section(/^Stroke/)!;
  expect(stroke.getAttribute("aria-expanded")).toBe("false");
  expect(stroke.textContent).toContain("None");
  expect(
    screen.getByRole("radiogroup", { name: "Stroke Color", hidden: true }).closest("[hidden]"),
  ).not.toBeNull();
  // The Fill dropdown is gone from this tab.
  expect(section(/^Fill/)).toBeUndefined();
});

it("the star keeps Points, between Fill Color and Corner Radius", () => {
  const { container } = renderPanel({ shape: "star" });
  expect(rowLabels(container).slice(0, 4)).toEqual([
    "Fill Color", "Points", "Corner Radius", "Sloppiness",
  ]);
});

it("the default fill is the palette's second color, red, and it is the one checked", () => {
  renderPanel();
  const checked = checkedIn(screen.getByRole("radiogroup", { name: "Fill Color" }));
  expect(checked).toHaveLength(1);
  expect(defaultToolSettings.shapeFillColor).toBe(TEXT_COLORS[1]);
  expect(defaultToolSettings.shapeStrokeWidth).toBe(0);
});

it("picking a Fill Color makes the fill solid — on an outline-only shape too", () => {
  // A reselected outline-only shape: no fill IS a transparent fill, so the
  // checkerboard swatch is the one lit.
  const { onChange } = renderPanel({ shapeFillMode: "none", shapeStrokeWidth: 3 });
  const group = screen.getByRole("radiogroup", { name: "Fill Color" });
  expect(checkedIn(group).map((r) => r.getAttribute("aria-label"))).toEqual([
    "Transparent (checkerboard)",
  ]);
  fireEvent.click(group.querySelectorAll('[role="radio"]')[1]!);
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ shapeFillMode: "solid", shapeFillColor: TEXT_COLORS[1] }),
  );
});

it("Stroke opens to Stroke Color then Stroke Width, and a color pick turns a None stroke on", () => {
  const { onChange } = renderPanel();
  fireEvent.click(section(/^Stroke/)!);
  expect(section(/^Stroke/)!.getAttribute("aria-expanded")).toBe("true");
  const color = screen.getByRole("radiogroup", { name: "Stroke Color" });
  // None: no stroke color is lit, and the width row says so.
  expect(checkedIn(color)).toHaveLength(0);
  expect(screen.getByRole("slider", { name: "Stroke Width" }).getAttribute("aria-valuetext"))
    .toBe("None");
  fireEvent.click(color.querySelectorAll('[role="radio"]')[1]!);
  const sent = onChange.mock.lastCall![0] as ToolSettings;
  expect(sent.shapeStrokeColor).toBe(TEXT_COLORS[1]);
  expect(sent.shapeStrokeWidth).toBeGreaterThan(0);
  // The shared stroke — the arrow's, the pin's — is not touched by any of it.
  expect(sent.strokeWidth).toBe(defaultToolSettings.strokeWidth);
  expect(sent.strokeColor).toBe(defaultToolSettings.strokeColor);
});

it("a stroke that is ON shows in the shut header, and a width preset sets it", () => {
  const { onChange } = renderPanel({ shapeStrokeWidth: 4 });
  expect(section(/^Stroke/)!.textContent).toContain("4 px");
  fireEvent.click(section(/^Stroke/)!);
  fireEvent.click(screen.getByRole("radio", { name: "Stroke Width 8" }));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ shapeStrokeWidth: 8 }));
  fireEvent.click(screen.getByRole("radio", { name: "Stroke Width 0" }));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ shapeStrokeWidth: 0 }));
});

it("an outline-only shape cannot lose its stroke too", () => {
  // No fill and no stroke would be an object nobody can see.
  const { onChange } = renderPanel({ shapeFillMode: "none", shapeStrokeWidth: 3 });
  fireEvent.click(section(/^Stroke/)!);
  fireEvent.click(screen.getByRole("radio", { name: "Stroke Width 0" }));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ shapeStrokeWidth: 1 }));
});

it("the line has no interior: Stroke Color, then Stroke Width, and no dropdown", () => {
  const { container, onChange } = renderPanel({ shape: "line" });
  expect(rowLabels(container)).toEqual(["Stroke Color", "Stroke Width", "Sloppiness"]);
  expect(section(/^Stroke/)).toBeUndefined();
  expect(section(/^Fill/)).toBeUndefined();
  // Its stroke is the shared one, which is never None.
  fireEvent.click(screen.getByRole("radio", { name: "Stroke Width 8" }));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ strokeWidth: 8 }));
});

it("Arrows & Diagram Shapes: Stroke Color, then Stroke Width, ABOVE the shape tiles", () => {
  // Chris, 11-23-2026: Stroke Color · Stroke Width · Arrows · Flowchart ·
  // Basic · Block arrows. The color and width lead, the tiles follow.
  const { container } = renderPanel({}, "arrows");
  expect(rowLabels(container).slice(0, 6)).toEqual([
    "Stroke Color",
    "Stroke Width",
    "Arrows",
    "Flowchart",
    "Basic",
    "Block arrows",
  ]);
});

it("a diagram shape keeps its Fill dropdown: None | Solid | Gradient | Pixelate", () => {
  const { onChange } = renderPanel({ arrowShape: "terminator", fillMode: "gradient" }, "arrows");
  const fill = section(/^Fill/)!;
  expect(fill.getAttribute("aria-expanded")).toBe("false");
  expect(fill.textContent).toContain("Gradient");
  fireEvent.click(fill);
  const group = screen.getByRole("radiogroup", { name: "Fill" });
  const names = Array.from(group.querySelectorAll('[role="radio"]')).map((r) => r.textContent);
  expect(names).toEqual(["None", "Solid", "Gradient", "Pixelate"]);
  fireEvent.click(screen.getByRole("radio", { name: "Pixelate" }));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ fillMode: "pixelate" }));
});

it("Pins: Color, then the size", () => {
  const { container } = renderPanel({}, "pens");
  const labels = rowLabels(container);
  expect(labels.indexOf("Color")).toBeGreaterThan(-1);
  expect(labels.indexOf("Color")).toBeLessThan(labels.indexOf("Stroke Width"));
});

it("Sloppiness says why it does nothing on a strokeless shape, and only then", () => {
  // Default: fill-first square, stroke None. The row stays, with a lightbulb.
  const first = renderPanel();
  expect(screen.getByRole("button", { name: "Sloppiness info" })).toBeTruthy();
  first.container.remove();
  // A stroke is on: the hint is gone (sloppiness now visibly roams it).
  renderPanel({ shapeStrokeWidth: 4 });
  expect(screen.queryByRole("button", { name: "Sloppiness info" })).toBeNull();
});

it("the default fill is the Fill Color row's second swatch, red — not white, which vanishes on a blank canvas", () => {
  // A new blank canvas starts white, so a white default shape was invisible
  // (Chris, 2026-11-27). The built-in row is a constant and ColorSwatchGrid
  // appends the person's own colors AFTER it, so the second swatch is always
  // TEXT_COLORS[1].
  expect(TEXT_COLORS[1]).toBe("#ef4444");
  expect(defaultToolSettings.shapeFillColor).toBe(TEXT_COLORS[1]);
  renderPanel();
  const group = screen.getByRole("radiogroup", { name: "Fill Color" });
  const secondSwatch = group.querySelectorAll('[role="radio"]')[1]!;
  expect(secondSwatch.getAttribute("aria-checked")).toBe("true");
});

it("Fill Color starts as every site color, then the checkerboard, then the +", () => {
  localStorage.clear();
  renderPanel();
  const group = screen.getByRole("radiogroup", { name: "Fill Color" });
  const names = Array.from(group.querySelectorAll('[role="radio"]')).map((r) =>
    r.getAttribute("aria-label"),
  );
  expect(names).toEqual([
    ...FILL_COLORS.map((c) => `Color ${c}`),
    "Transparent (checkerboard)",
  ]);
  // The "+" of this palette ADDS to it.
  expect(screen.getByRole("button", { name: "Edit Fill Color swatches" })).toBeTruthy();
});

it("a transparent Fill Color is no fill — and a strokeless shape gets a stroke, never invisible", () => {
  const { onChange } = renderPanel();
  fireEvent.click(screen.getByRole("radio", { name: "Transparent (checkerboard)" }));
  const sent = onChange.mock.lastCall![0] as ToolSettings;
  expect(sent.shapeFillMode).toBe("none");
  expect(sent.shapeStrokeWidth).toBeGreaterThan(0);
});

it("the Stroke Color is ink: no transparent swatch", () => {
  renderPanel();
  const stroke = screen.getByRole("radiogroup", { name: "Stroke Color", hidden: true });
  expect(stroke.querySelector('[aria-label="Transparent (checkerboard)"]')).toBeNull();
});

it("Corner Radius gets the reset arrow once a corner is rounded — one Shift-dragged corner too", () => {
  renderPanel();
  expect(screen.queryByRole("button", { name: "Reset Corner Radius" })).toBeNull();
  const { onChange, container } = renderPanel({ cornerRadii: [0, 24, 0, 0] });
  // No "changed on this photo" dot: a shape's corners aren't per-photo.
  expect(container.querySelector('[data-slot="edited"]')).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reset Corner Radius" }));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ cornerRadii: [0, 0, 0, 0] }));
});
