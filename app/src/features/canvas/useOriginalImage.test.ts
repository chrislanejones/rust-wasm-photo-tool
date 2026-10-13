// @vitest-environment jsdom
//
// The Compare overlay's original: read from IndexedDB, then decoded off-screen
// before it is painted. Pending shows a skeleton after the 300 ms grace;
// failure (a decode error, or no original within the deadline) always ends the
// wait, so the skeleton never pulses for ever.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useOriginalImage, ORIGINAL_TIMEOUT_MS } from "./useOriginalImage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no Image.decode. Each call hands back a promise the test settles.
let decodes: { src: string; resolve: () => void; reject: () => void }[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  decodes = [];
  HTMLImageElement.prototype.decode = function (this: HTMLImageElement) {
    return new Promise<void>((resolve, reject) => {
      decodes.push({ src: this.src, resolve, reject: () => reject(new Error("decode")) });
    });
  };
});

let root: Root | null = null;
let last: ReturnType<typeof useOriginalImage>;
function Probe({ url, active }: { url: string | null; active: boolean }) {
  last = useOriginalImage(url, active);
  return null;
}
function render(url: string | null, active = true) {
  if (!root) {
    const c = document.createElement("div");
    document.body.appendChild(c);
    root = createRoot(c);
  }
  act(() => root!.render(React.createElement(Probe, { url, active })));
}
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("useOriginalImage", () => {
  it("waits out the grace, then asks for a skeleton", () => {
    render(null);
    expect(last).toMatchObject({ pending: true, showSkeleton: false, ready: false, failed: false });
    act(() => vi.advanceTimersByTime(300));
    expect(last.showSkeleton).toBe(true);
  });

  it("is ready only once the original has decoded, not when the URL arrives", async () => {
    render("blob:a");
    expect(last.ready).toBe(false);
    expect(decodes.map((d) => d.src)).toEqual(["blob:a"]);
    decodes[0].resolve();
    await flush();
    expect(last).toMatchObject({ ready: true, pending: false, failed: false });
  });

  it("a decode error ends the wait as a failure", async () => {
    render("blob:a");
    decodes[0].reject();
    await flush();
    expect(last).toMatchObject({ failed: true, pending: false, ready: false });
  });

  it("no original within the deadline is a failure, not an endless skeleton", () => {
    render(null);
    act(() => vi.advanceTimersByTime(ORIGINAL_TIMEOUT_MS - 1));
    expect(last.failed).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(last).toMatchObject({ failed: true, pending: false, showSkeleton: false });
  });

  it("a decode that never settles times out", () => {
    render("blob:a");
    act(() => vi.advanceTimersByTime(ORIGINAL_TIMEOUT_MS));
    expect(last.failed).toBe(true);
  });

  it("another photo's decode never counts for this one", async () => {
    render("blob:a");
    render("blob:b");
    decodes[0].resolve();
    await flush();
    expect(last.ready).toBe(false);
    expect(last.pending).toBe(true);
  });

  it("reopening compare starts a fresh wait instead of failing at once", () => {
    render(null);
    act(() => vi.advanceTimersByTime(ORIGINAL_TIMEOUT_MS));
    expect(last.failed).toBe(true);
    render(null, false);
    expect(last.failed).toBe(false);
    render(null, true);
    expect(last).toMatchObject({ failed: false, pending: true });
  });

  it("closed, it is not pending and shows nothing", () => {
    render(null, false);
    act(() => vi.advanceTimersByTime(1000));
    expect(last).toMatchObject({ pending: false, showSkeleton: false, failed: false });
  });
});
