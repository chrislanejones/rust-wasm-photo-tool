// @vitest-environment jsdom
//
// UI Night 19: what fills the master bar's strip while its lazy chunk loads.
// It was `fallback={null}`, so the reserved 252 px sat empty and the bar
// popped in. The shell paints at once; the slot blocks wait out the grace.
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MasterBarFallback } from "./MasterBarFallback";
import { MASTER_BAR_CHROME_H } from "./constants";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("is the bar's own box from the first frame, with no grey yet", () => {
  render(<MasterBarFallback />);
  const el = screen.getByTestId("master-bar-fallback");
  expect(el.className).toContain("w-[252px]");
  expect(el.style.height).toBe(`${MASTER_BAR_CHROME_H}px`);
  expect(el.querySelectorAll(".skeleton")).toHaveLength(0);
});

it("paints the seven slots after the grace", () => {
  render(<MasterBarFallback />);
  act(() => vi.advanceTimersByTime(300));
  expect(screen.getByTestId("master-bar-fallback").querySelectorAll(".skeleton")).toHaveLength(7);
});

it("is decorative: nothing announced", () => {
  render(<MasterBarFallback />);
  act(() => vi.advanceTimersByTime(300));
  expect(screen.getByTestId("master-bar-fallback").getAttribute("aria-hidden")).toBe("true");
  expect(screen.queryByRole("status")).toBeNull();
});
