// @vitest-environment jsdom
//
// The Fill Color opacity (Chris, 11-25-2026 — mock-up D): "Opacity N%" on the
// right, no lightbulb; hold Alt over the row (or click the %) and the swatches
// become the current color at 100% … 0%.
import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeEach, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("VITE_CONVEX_URL", "");
  vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "");
});
afterAll(() => vi.unstubAllEnvs());

import { TooltipProvider } from "@/components/ui/tooltip";
import { OPACITY_STEPS, alphaOf, rgbOf, withAlpha } from "@/lib/colors";
import { ColorSwatchGrid } from "./ColorSwatchGrid";

const COLORS = ["#ffffff", "#3b82f6", "#000000"] as const;

beforeEach(() => localStorage.clear());

function renderGrid(value: string) {
  const onChange = vi.fn();
  const utils = render(
    <ColorSwatchGrid label="Fill Color" colors={COLORS} value={value} onChange={onChange} opacity />,
    { wrapper: TooltipProvider },
  );
  const row = utils.container.querySelector('[data-slot="control-row"]')!.parentElement!;
  return { onChange, row };
}

const radios = () =>
  Array.from(
    screen.getByRole("radiogroup", { name: "Fill Color" }).querySelectorAll('[role="radio"]'),
  );

it("the helpers: 8-digit hex carries the opacity, 0% is transparent, 100% plain hex", () => {
  expect(withAlpha("#3b82f6", 60)).toBe("#3b82f699");
  expect(withAlpha("#3b82f699", 100)).toBe("#3b82f6");
  expect(withAlpha("#3b82f6", 0)).toBe("transparent");
  expect(alphaOf("#3b82f699")).toBe(60);
  expect(alphaOf("#3b82f6")).toBe(100);
  expect(alphaOf("transparent")).toBe(0);
  expect(rgbOf("#3B82F699")).toBe("#3b82f6");
});

it("shows 'Opacity 100%' and no lightbulb", () => {
  renderGrid("#3b82f6");
  expect(screen.getByRole("button", { name: /Fill Color opacity 100%/ }).textContent).toBe(
    "Opacity 100%",
  );
  expect(screen.queryByRole("button", { name: /info/ })).toBeNull();
});

it("a translucent value lights its color swatch, and picking another color keeps the opacity", () => {
  const { onChange } = renderGrid("#3b82f699");
  const lit = radios().filter((r) => r.getAttribute("aria-checked") === "true");
  expect(lit.map((r) => r.getAttribute("aria-label"))).toEqual(["Color #3b82f6"]);
  fireEvent.click(screen.getByRole("radio", { name: "Color #000000" }));
  expect(onChange).toHaveBeenLastCalledWith("#00000099");
});

it("hold Alt over the row: the swatches become opacity steps; let go and the colors return", () => {
  const { onChange, row } = renderGrid("#3b82f6");
  fireEvent.pointerEnter(row);
  fireEvent.keyDown(window, { key: "Alt" });
  expect(radios().map((r) => r.getAttribute("aria-label"))).toEqual(
    OPACITY_STEPS.map((n) => `Opacity ${n}%`),
  );
  expect(screen.queryByRole("button", { name: "Pick a custom color" })).toBeNull();
  fireEvent.click(screen.getByRole("radio", { name: "Opacity 60%" }));
  expect(onChange).toHaveBeenLastCalledWith("#3b82f699");
  fireEvent.click(screen.getByRole("radio", { name: "Opacity 0%" }));
  expect(onChange).toHaveBeenLastCalledWith("transparent");
  fireEvent.keyUp(window, { key: "Alt" });
  expect(radios()[0].getAttribute("aria-label")).toBe("Color #ffffff");
});

it("Alt anywhere else does nothing", () => {
  renderGrid("#3b82f6");
  fireEvent.keyDown(window, { key: "Alt" });
  expect(radios()[0].getAttribute("aria-label")).toBe("Color #ffffff");
});

it("clicking the % opens the steps without a key; a pick closes them", () => {
  const { onChange } = renderGrid("#3b82f6");
  fireEvent.click(screen.getByRole("button", { name: /Fill Color opacity/ }));
  fireEvent.click(screen.getByRole("radio", { name: "Opacity 50%" }));
  expect(onChange).toHaveBeenLastCalledWith(withAlpha("#3b82f6", 50));
  expect(radios()[0].getAttribute("aria-label")).toBe("Color #ffffff");
});
