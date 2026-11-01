// @vitest-environment jsdom
//
// What assistive tech is told about the Fall Back garland. Pins the shape of
// it, not the look: one named image (not eight letters), one named button,
// and nothing at all outside the season or once closed. Focus hand-off after
// closing and the 24px target need real layout, so they are checked in a
// browser, not here.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function load() {
  // The closed state is module-level (shared by both copies), so every test
  // gets a fresh module.
  vi.resetModules();
  return (await import("./FallBackBanner")).FallBackBanner;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 1, 12));
  localStorage.clear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

const LABEL = "Fall back: clocks go back one hour";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Fall Back garland, to a screen reader", () => {
  it.each(["bar", "centered"] as const)("%s: one image named Fall back and a named close button", async (placement) => {
    const FallBackBanner = await load();
    render(<FallBackBanner placement={placement} />);

    const img = screen.getByRole("img", { name: LABEL });
    // The letters, pumpkin and clocks are inside the image and hidden, so the
    // words are read once, not spelled out.
    expect(img.querySelector(".fallback-string")?.getAttribute("aria-hidden")).toBe("true");
    for (const svg of img.querySelectorAll("svg")) expect(svg.getAttribute("aria-hidden")).toBe("true");

    const close = screen.getByRole("button", { name: "Hide the Fall Back banner" });
    expect(close.tagName).toBe("BUTTON");
    expect(close.className).toContain("btn-icon"); // the 24px `tiny` size, not 20px `xs`
    expect(close.className).not.toContain("btn-icon-xs");

    // The letters spell the message, with the pumpkin hanging between the words.
    const letters = [...img.querySelectorAll(".fallback-flag:not(.fallback-flag-blank)")].map((f) => f.textContent);
    expect(letters.join("")).toBe("FALLBACK");
    expect(img.querySelectorAll(".fallback-gap .fallback-pumpkin")).toHaveLength(1);
    expect(img.querySelectorAll(".fallback-clock")).toHaveLength(2);
  });

  it("closing one copy removes both, and it stays closed", async () => {
    const FallBackBanner = await load();
    render(
      <>
        <FallBackBanner placement="bar" />
        <FallBackBanner placement="centered" />
      </>,
    );
    expect(screen.getAllByRole("img", { name: LABEL })).toHaveLength(2);
    act(() => {
      fireEvent.click(screen.getAllByRole("button", { name: "Hide the Fall Back banner" })[0]!);
    });
    expect(screen.queryByRole("img", { name: LABEL })).toBeNull();
    expect(screen.queryByRole("button", { name: "Hide the Fall Back banner" })).toBeNull();

    cleanup();
    const Again = await load();
    render(<Again placement="bar" />);
    expect(screen.queryByRole("img", { name: LABEL })).toBeNull();
  });

  it("is not in the page at all outside the season", async () => {
    vi.setSystemTime(new Date(2026, 10, 4, 12));
    const FallBackBanner = await load();
    const { container } = render(<FallBackBanner placement="bar" />);
    expect(container.innerHTML).toBe("");
  });
});
