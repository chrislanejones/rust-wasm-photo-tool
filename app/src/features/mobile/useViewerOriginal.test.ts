// @vitest-environment jsdom
//
// The phone viewer's original: read from IndexedDB, decoded off-screen, then
// painted. Nothing during the 300 ms grace, a skeleton after it, and a failure
// that always ends the wait (missing original, decode error, or the deadline).
// A result only ever counts for the photo it was read for.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const store = vi.hoisted(() => ({
  reads: [] as { key: string; resolve: (url: string | null) => void }[],
}));
vi.mock("@/lib/dexie/originalsAdapter", () => ({
  getOriginalAsBlobUrl: (key: string) =>
    new Promise<string | null>((resolve) => store.reads.push({ key, resolve })),
}));

import { useViewerOriginal, viewerBox, VIEWER_ORIGINAL_TIMEOUT_MS } from "./useViewerOriginal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no Image.decode. Each call hands back a promise the test settles.
let decodes: { src: string; resolve: () => void; reject: () => void }[] = [];
const revoked: string[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  store.reads = [];
  decodes = [];
  revoked.length = 0;
  HTMLImageElement.prototype.decode = function (this: HTMLImageElement) {
    return new Promise<void>((resolve, reject) => {
      decodes.push({ src: this.src, resolve, reject: () => reject(new Error("decode")) });
    });
  };
  URL.revokeObjectURL = (u: string) => void revoked.push(u);
});

let root: Root | null = null;
let last: ReturnType<typeof useViewerOriginal>;
function Probe({ k }: { k: string | null }) {
  last = useViewerOriginal(k);
  return null;
}
function render(k: string | null) {
  if (!root) {
    const c = document.createElement("div");
    document.body.appendChild(c);
    root = createRoot(c);
  }
  act(() => root!.render(React.createElement(Probe, { k })));
}
const flush = () => act(async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); });
const read = (key: string) => store.reads.find((r) => r.key === key)!;

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("useViewerOriginal", () => {
  it("shows nothing during the grace, then asks for a skeleton", () => {
    render("a");
    expect(last).toMatchObject({ src: null, pending: true, showSkeleton: false, failed: false });
    act(() => vi.advanceTimersByTime(300));
    expect(last.showSkeleton).toBe(true);
  });

  it("paints only once the original has decoded, not when the URL arrives", async () => {
    render("a");
    read("a").resolve("blob:a");
    await flush();
    expect(last.src).toBeNull();
    expect(decodes).toHaveLength(1);
    decodes[0]!.resolve();
    await flush();
    expect(last).toMatchObject({ src: "blob:a", pending: false, showSkeleton: false, failed: false });
  });

  it("a missing original fails instead of waiting for ever", async () => {
    render("a");
    read("a").resolve(null);
    await flush();
    expect(last).toMatchObject({ src: null, failed: true, pending: false, showSkeleton: false });
  });

  it("a decode error fails", async () => {
    render("a");
    read("a").resolve("blob:a");
    await flush();
    decodes[0]!.reject();
    await flush();
    expect(last.failed).toBe(true);
  });

  it("gives up at the deadline, and a late decode does not undo that", async () => {
    render("a");
    read("a").resolve("blob:a");
    await flush();
    act(() => vi.advanceTimersByTime(VIEWER_ORIGINAL_TIMEOUT_MS));
    expect(last.failed).toBe(true);
    decodes[0]!.resolve();
    await flush();
    expect(last).toMatchObject({ src: null, failed: true });
  });

  it("a swipe never pairs the new photo with the old picture", async () => {
    render("a");
    read("a").resolve("blob:a");
    await flush();
    decodes[0]!.resolve();
    await flush();
    expect(last.src).toBe("blob:a");
    render("b");
    expect(last).toMatchObject({ src: null, pending: true, showSkeleton: false });
    expect(revoked).toContain("blob:a");
  });

  it("a superseded read cannot land on the next photo", async () => {
    render("a");
    render("b");
    read("a").resolve("blob:a");
    await flush();
    expect(decodes).toHaveLength(0);
    expect(revoked).toContain("blob:a");
    expect(last.pending).toBe(true);
  });
});

describe("viewerBox", () => {
  it("fits the stage, keeps the ratio, and never grows past the photo", () => {
    expect(viewerBox(4000, 3000)).toEqual({
      width: `min(100cqw, calc(100cqh * ${4000 / 3000}), 4000px)`,
      aspectRatio: "4000 / 3000",
    });
  });
  it("unknown dimensions get a square", () => {
    expect(viewerBox(0, 0)).toEqual({ width: "min(100cqw, 100cqh)", aspectRatio: "1 / 1" });
  });
});
