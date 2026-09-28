// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QuotaGauge } from "./quota-gauge";
import { formatStorage, quotaSegments } from "@/lib/quota";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const GB = 1e9;
const MB = 1e6;
let container: HTMLDivElement;
let root: Root;

function render(usedBytes: number, trashBytes: number, limitBytes: number, signedIn = true) {
  act(() => {
    root.render(React.createElement(QuotaGauge, { figures: { usedBytes, trashBytes, limitBytes }, signedIn }));
  });
}
const text = () => container.textContent ?? "";

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("formatStorage is DECIMAL", () => {
  it.each([
    [2.4 * GB, "2.4 GB"],
    [5 * GB, "5 GB"],
    [180 * MB, "180 MB"],
    [1_000_000, "1 MB"],
    [999, "999 B"],
    [12.5 * GB, "13 GB"],
  ])("%d bytes → %s", (b, want) => {
    expect(formatStorage(b)).toBe(want);
  });

  it("1 GB is a billion bytes, not 1,073,741,824", () => {
    // The trap: binary maths under decimal names. 1024³ bytes must read
    // "1.1 GB", or the gauge disagrees with the pricing page's "5 GB".
    expect(formatStorage(1e9)).toBe("1 GB");
    expect(formatStorage(1024 ** 3)).toBe("1.1 GB");
  });
});

describe("the gauge", () => {
  it("signed out: no gauge at all", () => {
    render(1 * GB, 0, 5 * GB, false);
    expect(container.innerHTML).toBe("");
  });

  it("shows used + trash as the total, in decimal units", () => {
    render(2.4 * GB, 180 * MB, 5 * GB);
    expect(text()).toContain("2.6 GB of 5 GB");
  });

  it("trash is a segment ON the bar, not only a footnote", () => {
    render(2 * GB, 1 * GB, 5 * GB);
    const trash = container.querySelector('[data-segment="trash"]') as HTMLElement;
    expect(trash.style.width).toBe("20%");
    expect(text()).toContain("Trash 1 GB · counts toward this");
  });

  it("emptying trash visibly frees space", () => {
    const before = quotaSegments({ usedBytes: 2 * GB, trashBytes: 1 * GB, limitBytes: 5 * GB });
    const after = quotaSegments({ usedBytes: 2 * GB, trashBytes: 0, limitBytes: 5 * GB });
    expect(before.used + before.trash).toBeGreaterThan(after.used + after.trash);
  });

  it("over quota: the bar is full and it says NOTHING was deleted", () => {
    render(5 * GB, 500 * MB, 5 * GB);
    const used = container.querySelector('[data-segment="used"]') as HTMLElement;
    const trash = container.querySelector('[data-segment="trash"]') as HTMLElement;
    expect(parseFloat(used.style.width) + parseFloat(trash.style.width)).toBeLessThanOrEqual(100);
    expect(parseFloat(used.style.width)).toBe(100);
    // Both sentences — the second is the promise.
    expect(text()).toContain("New uploads paused.");
    expect(text()).toContain("Nothing has been deleted.");
  });

  it("under quota: no over-quota line", () => {
    render(1 * GB, 0, 5 * GB);
    expect(container.querySelector("[data-over-quota]")).toBeNull();
  });

  it("is an ARIA meter with a spoken value", () => {
    render(2.4 * GB, 180 * MB, 5 * GB);
    const m = container.querySelector('[role="meter"]');
    expect(m?.getAttribute("aria-label")).toBe("Storage");
    expect(m?.getAttribute("aria-valuetext")).toBe("2.6 GB of 5 GB");
  });
});
