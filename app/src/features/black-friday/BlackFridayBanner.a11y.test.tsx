// @vitest-environment jsdom
//
// What assistive tech is told about the Black Friday garland. Pins the shape
// of it, not the look: one named image (not eleven letters), one named
// button, and nothing at all outside the season or once closed. Focus
// hand-off after closing and the 24px target need real layout, so they are
// checked in a browser, not here.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function load() {
  // The closed state is module-level (shared by both copies), so every test
  // gets a fresh module.
  vi.resetModules();
  return (await import("./BlackFridayBanner")).BlackFridayBanner;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 27, 12));
  localStorage.clear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

const LABEL = "Black Friday";
const CLOSE = "Hide the Black Friday banner";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Black Friday garland, to a screen reader", () => {
  it.each(["bar", "centered"] as const)("%s: one image named Black Friday and a named close button", async (placement) => {
    const BlackFridayBanner = await load();
    render(<BlackFridayBanner placement={placement} />);

    const img = screen.getByRole("img", { name: LABEL });
    // The letters, bag, star and tag are inside the image and hidden,
    // so the words are read once, not spelled out.
    expect(img.querySelector(".black-friday-string")?.getAttribute("aria-hidden")).toBe("true");
    for (const svg of img.querySelectorAll("svg")) expect(svg.getAttribute("aria-hidden")).toBe("true");

    const close = screen.getByRole("button", { name: CLOSE });
    expect(close.tagName).toBe("BUTTON");
    expect(close.className).toContain("btn-icon"); // the 24px `tiny` size, not 20px `xs`
    expect(close.className).not.toContain("btn-icon-xs");

    // The letters spell the message, with a star between the words and
    // a shopping bag and a sale tag at the ends.
    const letters = [...img.querySelectorAll(".black-friday-flag:not(.black-friday-flag-blank)")].map(
      (f) => f.textContent,
    );
    expect(letters.join("")).toBe("BLACKFRIDAY");
    expect(img.querySelectorAll(".black-friday-gap .black-friday-star")).toHaveLength(1);
    expect(img.querySelectorAll(".black-friday-bag")).toHaveLength(1);
    expect(img.querySelectorAll(".black-friday-tag")).toHaveLength(1);
  });

  it("closing one copy removes both, and it stays closed", async () => {
    const BlackFridayBanner = await load();
    render(
      <>
        <BlackFridayBanner placement="bar" />
        <BlackFridayBanner placement="centered" />
      </>,
    );
    expect(screen.getAllByRole("img", { name: LABEL })).toHaveLength(2);
    act(() => {
      fireEvent.click(screen.getAllByRole("button", { name: CLOSE })[0]!);
    });
    expect(screen.queryByRole("img", { name: LABEL })).toBeNull();
    expect(screen.queryByRole("button", { name: CLOSE })).toBeNull();

    cleanup();
    const Again = await load();
    render(<Again placement="bar" />);
    expect(screen.queryByRole("img", { name: LABEL })).toBeNull();
  });

  it("is not in the page at all outside the season", async () => {
    vi.setSystemTime(new Date(2026, 10, 30, 12));
    const BlackFridayBanner = await load();
    const { container } = render(<BlackFridayBanner placement="bar" />);
    expect(container.innerHTML).toBe("");
  });
});
