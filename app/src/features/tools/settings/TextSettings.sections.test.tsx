// @vitest-environment jsdom
//
// Background, Stroke and Drop Shadow are dropdowns now (Chris, 10-31-2026:
// "it's just so much stuff on here"). Shut in the Text mode, open in the
// Background mode, and a setting that is ON still shows in the shut header.
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { defaultToolSettings } from "@/lib/defaultToolSettings";
import { useToolStore } from "@/stores/useToolStore";
import type { ToolSettings } from "@/lib/types";
import { TextSettings } from "./TextSettings";

vi.mock("@/hooks/useAIJob", () => ({
  useAIJob: () => ({ run: vi.fn(), phase: "idle", busy: false, error: null, textResult: null }),
}));

const SECTIONS = ["Background", "Stroke", "Drop Shadow"] as const;

function renderPanel(overrides: Partial<ToolSettings> = {}) {
  const onChange = vi.fn();
  const settings = { ...defaultToolSettings, ...overrides };
  render(
    <TextSettings
      settings={settings}
      onChange={onChange}
      activePhotoId={null}
      stampToolRef={{ current: null }}
    />,
    { wrapper: TooltipProvider },
  );
  return { onChange, settings };
}

/** The disclosure button whose accessible name starts with `label`. */
const header = (label: string) =>
  screen.getByRole("button", { name: new RegExp(`^${label}`) });

beforeEach(() => useToolStore.setState({ textMode: "text" }));

it("the Text mode starts with all three sections shut", () => {
  renderPanel();
  for (const label of SECTIONS) {
    expect(header(label).getAttribute("aria-expanded"), label).toBe("false");
  }
  expect(screen.queryByText("Stroke Width")).toBeNull();
});

it("the Background mode starts with them open", () => {
  useToolStore.setState({ textMode: "background" });
  renderPanel();
  for (const label of SECTIONS) {
    expect(header(label).getAttribute("aria-expanded"), label).toBe("true");
  }
});

it("a shut header still says what is on", () => {
  renderPanel({ bgKind: "bubble", textStrokeWidth: 3, shadowText: true });
  expect(header("Background").textContent).toContain("Bubble");
  expect(header("Stroke").textContent).toContain("3 px");
  expect(header("Drop Shadow").textContent).toContain("Text");
});

it("opening Stroke and picking a width turns the stroke on", () => {
  const { onChange } = renderPanel();
  expect(header("Stroke").textContent).toContain("Off");
  fireEvent.click(header("Stroke"));
  const slider = screen.getByRole("slider", { name: /Stroke Width/ });
  fireEvent.change(slider, { target: { value: "4" } });
  expect(onChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ textStrokeWidth: 4 }),
  );
});
