// @vitest-environment jsdom
//
// Fill is a closed dropdown, like Placement (Chris, 11-07-2026: "on
// everyplace there is a fill - treat like placement and do a closed
// dropdown"). Rectangle → Fill opens to None | Solid | Gradient | Pixelate,
// and a fill that is ON still shows in the shut header.
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
import type { ToolSettings } from "@/lib/types";
import { ShapesSettings } from "./ShapeSettings";

function renderPanel(overrides: Partial<ToolSettings> = {}) {
  const onChange = vi.fn();
  render(
    <ShapesSettings
      settings={{ ...defaultToolSettings, shape: "rect", ...overrides }}
      onChange={onChange}
    />,
    { wrapper: TooltipProvider },
  );
  return { onChange };
}

const fillHeader = () => {
  const found = screen
    .getAllByRole("button", { name: /^Fill/ })
    .filter((b) => b.hasAttribute("aria-expanded"));
  expect(found).toHaveLength(1);
  return found[0]!;
};

it("Rectangle's Fill starts shut and says what is on", () => {
  renderPanel({ fillMode: "gradient" });
  expect(fillHeader().getAttribute("aria-expanded")).toBe("false");
  expect(fillHeader().textContent).toContain("Gradient");
  // In the DOM, inside the hidden region.
  expect(screen.getByRole("radiogroup", { name: "Fill", hidden: true }).closest("[hidden]"))
    .not.toBeNull();
});

it("opening Fill shows None | Solid | Gradient | Pixelate", () => {
  const { onChange } = renderPanel();
  fireEvent.click(fillHeader());
  expect(fillHeader().getAttribute("aria-expanded")).toBe("true");
  const group = screen.getByRole("radiogroup", { name: "Fill" });
  const names = Array.from(group.querySelectorAll('[role="radio"]')).map((r) => r.textContent);
  expect(names).toEqual(["None", "Solid", "Gradient", "Pixelate"]);
  fireEvent.click(screen.getByRole("radio", { name: "Pixelate" }));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ fillMode: "pixelate" }));
});

it("the line has no Fill dropdown", () => {
  renderPanel({ shape: "line" });
  expect(
    screen.queryAllByRole("button", { name: /^Fill/ }).filter((b) => b.hasAttribute("aria-expanded")),
  ).toHaveLength(0);
});
