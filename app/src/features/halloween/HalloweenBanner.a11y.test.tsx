// @vitest-environment jsdom
//
// What assistive tech is told about the Halloween garland. Pins the shape of
// it, not the look: one named image (not fifteen letters), one named button,
// and nothing at all outside the season or once closed. Focus hand-off after
// closing and the 24px target need real layout, so they are checked in a
// browser, not here.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function load() {
  // The closed state is module-level (shared by both copies), so every test
  // gets a fresh module.
  vi.resetModules();
  return (await import("./HalloweenBanner")).HalloweenBanner;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 31, 12));
  localStorage.clear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Halloween garland, to a screen reader", () => {
  it.each(["bar", "centered"] as const)("%s: one image named Happy Halloween and a named close button", async (placement) => {
    const HalloweenBanner = await load();
    render(<HalloweenBanner placement={placement} />);

    const img = screen.getByRole("img", { name: "Happy Halloween" });
    // The letters, pumpkin and bat are inside the image and hidden, so the
    // words are read once, not spelled out.
    expect(img.querySelector(".halloween-string")?.getAttribute("aria-hidden")).toBe("true");
    for (const svg of img.querySelectorAll("svg")) expect(svg.getAttribute("aria-hidden")).toBe("true");

    const close = screen.getByRole("button", { name: "Hide the Halloween banner" });
    expect(close.tagName).toBe("BUTTON");
    expect(close.className).toContain("btn-icon"); // the 24px `tiny` size, not 20px `xs`
    expect(close.className).not.toContain("btn-icon-xs");
  });

  it("closing one copy removes both, and it stays closed", async () => {
    const HalloweenBanner = await load();
    render(
      <>
        <HalloweenBanner placement="bar" />
        <HalloweenBanner placement="centered" />
      </>,
    );
    expect(screen.getAllByRole("img", { name: "Happy Halloween" })).toHaveLength(2);
    act(() => {
      fireEvent.click(screen.getAllByRole("button", { name: "Hide the Halloween banner" })[0]!);
    });
    expect(screen.queryByRole("img", { name: "Happy Halloween" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Hide the Halloween banner" })).toBeNull();

    cleanup();
    const Again = await load();
    render(<Again placement="bar" />);
    expect(screen.queryByRole("img", { name: "Happy Halloween" })).toBeNull();
  });

  it("is not in the page at all outside the season", async () => {
    vi.setSystemTime(new Date(2026, 10, 1, 12));
    const HalloweenBanner = await load();
    const { container } = render(<HalloweenBanner placement="bar" />);
    expect(container.innerHTML).toBe("");
  });
});
