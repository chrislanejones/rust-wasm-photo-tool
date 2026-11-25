// @vitest-environment jsdom
//
// Corner Radius, mock-up F (Chris, 11-25-2026): hold Alt over the row and the
// presets become the corners; pick one and the slider and presets move that
// corner only, until All. The arrow squares every corner.
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { defaultToolSettings } from "@/lib/defaultToolSettings";
import type { ToolSettings } from "@/lib/types";
import { useCornerFocusStore } from "@/stores/useCornerFocusStore";
import { CornerRadiusControl } from "./CornerRadiusControl";

beforeEach(() => useCornerFocusStore.setState({ corner: null }));

function renderControl(shape: string, cornerRadii: ToolSettings["cornerRadii"] = [24, 24, 24, 24]) {
  const onChange = vi.fn();
  const settings = { ...defaultToolSettings, cornerRadii };
  const utils = render(<CornerRadiusControl shape={shape} settings={settings} onChange={onChange} />, {
    wrapper: TooltipProvider,
  });
  const row = utils.container.firstElementChild as HTMLElement;
  const holdAlt = () => {
    fireEvent.pointerEnter(row);
    fireEvent.keyDown(window, { key: "Alt" });
  };
  const letGo = () => fireEvent.keyUp(window, { key: "Alt" });
  return { onChange, holdAlt, letGo, rerender: (s: ToolSettings) =>
    utils.rerender(<CornerRadiusControl shape={shape} settings={s} onChange={onChange} />), settings };
}

const label = () =>
  document.querySelector('[data-slot="control-row"] [data-slot="label"]')?.textContent;

it("hold Alt: the presets become All + each corner, with its radius", () => {
  const { holdAlt, letGo } = renderControl("rect", [24, 0, 8, 24]);
  expect(screen.queryByRole("radiogroup", { name: "Corner" })).toBeNull();
  holdAlt();
  const tiles = Array.from(
    screen.getByRole("radiogroup", { name: "Corner" }).querySelectorAll('[role="radio"]'),
  ).map((t) => t.getAttribute("aria-label"));
  expect(tiles).toEqual([
    "All corners, mixed", "Top Left, 24 px", "Top Right, 0 px", "Bottom Right, 8 px", "Bottom Left, 24 px",
  ]);
  letGo();
  expect(screen.queryByRole("radiogroup", { name: "Corner" })).toBeNull();
});

it("pick a corner: the slider and presets move that corner only, until All", () => {
  const { holdAlt, letGo, onChange } = renderControl("rect");
  holdAlt();
  fireEvent.click(screen.getByRole("radio", { name: "Top Right, 24 px" }));
  letGo();
  expect(label()).toBe("Corner Radius · Top Right");
  expect(useCornerFocusStore.getState().corner).toBe(1);
  fireEvent.click(screen.getByRole("radio", { name: / 64px$/ }));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ cornerRadii: [24, 64, 24, 24] }));
  holdAlt();
  fireEvent.click(screen.getByRole("radio", { name: /^All corners/ }));
  letGo();
  expect(label()).toBe("Corner Radius");
  fireEvent.click(screen.getByRole("radio", { name: / 8px$/ }));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ cornerRadii: [8, 8, 8, 8] }));
});

it("the triangle has three corners; the star none to pick", () => {
  const tri = renderControl("triangle");
  tri.holdAlt();
  expect(
    Array.from(screen.getByRole("radiogroup", { name: "Corner" }).querySelectorAll('[role="radio"]')),
  ).toHaveLength(4);
  tri.letGo();
  document.body.innerHTML = "";
  const star = renderControl("star");
  star.holdAlt();
  expect(screen.queryByRole("radiogroup", { name: "Corner" })).toBeNull();
});

it("the reset arrow squares every corner and goes back to All", () => {
  const { holdAlt, letGo, onChange } = renderControl("rect");
  holdAlt();
  fireEvent.click(screen.getByRole("radio", { name: "Bottom Left, 24 px" }));
  letGo();
  fireEvent.click(screen.getByRole("button", { name: /^Reset Corner Radius/ }));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ cornerRadii: [0, 0, 0, 0] }));
  expect(useCornerFocusStore.getState().corner).toBeNull();
});

// Landing fixes (CodeRabbit on #517): the swap must not drop keyboard focus,
// and the Alt hint must reach a keyboard / screen reader.
it("Alt with a preset focused moves focus to the picked corner; letting go returns it to the slider", () => {
  const { holdAlt, letGo } = renderControl("rect");
  (screen.getByRole("radio", { name: "Corner Radius 24px" }) as HTMLElement).focus();
  holdAlt();
  expect(document.activeElement?.getAttribute("aria-label")).toBe("All corners, 24 px");
  letGo();
  expect(document.activeElement).toBe(screen.getByRole("slider"));
});

it("the slider's description carries the Alt hint", () => {
  renderControl("rect");
  const ids = screen.getByRole("slider").getAttribute("aria-describedby")?.split(" ") ?? [];
  expect(ids.map((id) => document.getElementById(id)?.textContent)).toContain(
    "Hold Alt (⌥) to round one corner at a time",
  );
});
