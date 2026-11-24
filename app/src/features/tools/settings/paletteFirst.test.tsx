// @vitest-environment jsdom
//
// ADR-107, finished (Chris, 11-23-2026): the color palette is the FIRST row
// of Paint › Brush, Paint › Pen and Text, as it already was on Shapes.
//
//   Brush: Color · Brush Size · Opacity · Hardness
//   Pen:   Color · Stroke Width
//   Text:  Text Color · Font Size · Font Family · Font Weight
import { render } from "@testing-library/react";
import { afterAll, beforeEach, expect, it, vi } from "vitest";

// Demo mode, whatever the checkout's .env.local says (the color grid's
// useUserColors) — the same stub as ShapeSettings.fillFirst.test.tsx.
vi.hoisted(() => {
  vi.stubEnv("VITE_CONVEX_URL", "");
  vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "");
});
afterAll(() => vi.unstubAllEnvs());
// The Text panel's OCR row reaches for the AI job hook; it never runs here.
vi.mock("@/hooks/useAIJob", () => ({
  useAIJob: () => ({ run: vi.fn(), phase: "idle", busy: false, error: null, textResult: null }),
}));
import { TooltipProvider } from "@/components/ui/tooltip";
import { defaultToolSettings } from "@/lib/defaultToolSettings";
import { useToolStore } from "@/stores/useToolStore";
import { PaintSettings } from "./PaintSettings";
import { TextSettings } from "./TextSettings";

beforeEach(() => useToolStore.setState({ textMode: "text" }));

/** Every control row's label, top to bottom — the panel's order as read. */
const rowLabels = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-slot="control-row"] [data-slot="label"]')).map(
    (el) => el.textContent?.trim(),
  );

it("Paint › Brush: Color first, then Brush Size, Opacity, Hardness", () => {
  const { container } = render(
    <PaintSettings settings={defaultToolSettings} onChange={vi.fn()} activeMode="paint" />,
    { wrapper: TooltipProvider },
  );
  expect(rowLabels(container).slice(0, 4)).toEqual(["Color", "Brush Size", "Opacity", "Hardness"]);
});

it("Paint › Pen: Color first, then Stroke Width", () => {
  const { container } = render(
    <PaintSettings settings={defaultToolSettings} onChange={vi.fn()} activeMode="pen" />,
    { wrapper: TooltipProvider },
  );
  expect(rowLabels(container).slice(0, 2)).toEqual(["Color", "Stroke Width"]);
});

it("Text: Text Color first, then Font Size, Font Family, Font Weight", () => {
  const { container } = render(
    <TextSettings
      settings={defaultToolSettings}
      onChange={vi.fn()}
      activePhotoId={null}
      stampToolRef={{ current: null }}
    />,
    { wrapper: TooltipProvider },
  );
  expect(rowLabels(container).slice(0, 4)).toEqual(["Text Color", "Font Size", "Font Family", "Font Weight"]);
});
