// Two review fixes on #446 (11-07-2026):
//  - Batch view: a layout switch in one tab must not write back a stale
//    Masonry column count over a newer one another tab saved.
//  - Compare mode: starting from the gallery's right-click menu replaces any
//    stale pick, so the ticks are the pair actually being compared.
import { describe, it, expect, beforeEach, vi } from "vitest";

const LS_KEY = "image-horse-batch-view";

function stubLocalStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  });
  return map;
}

describe("useBatchViewStore keeps the newest saved preference", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("a layout switch keeps a column count another tab saved", async () => {
    const map = stubLocalStorage({ [LS_KEY]: JSON.stringify({ layout: "grid", masonryCols: 4 }) });
    const { useBatchViewStore } = await import("./useBatchViewStore");
    // Another tab zooms Masonry to 7 columns after this one loaded.
    map.set(LS_KEY, JSON.stringify({ layout: "masonry", masonryCols: 7 }));
    useBatchViewStore.getState().setLayout("grid");
    expect(JSON.parse(map.get(LS_KEY)!)).toEqual({ layout: "grid", masonryCols: 7 });
    expect(useBatchViewStore.getState().masonryCols).toBe(7);
  });

  it("a zoom step starts from the saved column count", async () => {
    const map = stubLocalStorage({ [LS_KEY]: JSON.stringify({ layout: "masonry", masonryCols: 4 }) });
    const { useBatchViewStore } = await import("./useBatchViewStore");
    map.set(LS_KEY, JSON.stringify({ layout: "masonry", masonryCols: 6 }));
    useBatchViewStore.getState().zoomOut();
    expect(JSON.parse(map.get(LS_KEY)!).masonryCols).toBe(7);
  });

  it("after a failed write, its own values win over the older saved copy", async () => {
    const map = stubLocalStorage({ [LS_KEY]: JSON.stringify({ layout: "masonry", masonryCols: 4 }) });
    localStorage.setItem = () => {
      throw new Error("quota");
    };
    const { useBatchViewStore } = await import("./useBatchViewStore");
    useBatchViewStore.getState().zoomIn();
    useBatchViewStore.getState().zoomIn();
    expect(useBatchViewStore.getState().masonryCols).toBe(2);
    expect(JSON.parse(map.get(LS_KEY)!).masonryCols).toBe(4);
  });

  it("still works with no localStorage (node)", async () => {
    const { useBatchViewStore } = await import("./useBatchViewStore");
    useBatchViewStore.getState().setLayout("masonry");
    useBatchViewStore.getState().zoomIn();
    expect(useBatchViewStore.getState()).toMatchObject({ layout: "masonry", masonryCols: 3 });
  });
});

describe("useScreenshotCompareStore.start reconciles compare picks", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("the right-click menu replaces a stale pick with the pair", async () => {
    const { useScreenshotCompareStore } = await import("./useScreenshotCompareStore");
    const { useGalleryStore } = await import("./useGalleryStore");
    useGalleryStore.setState({ activePhotoId: "open" });
    const cmp = useScreenshotCompareStore.getState();
    cmp.beginPick();
    cmp.setPicks(["stale"]);
    useScreenshotCompareStore.getState().start("other");
    expect(useScreenshotCompareStore.getState()).toMatchObject({ otherId: "other", picks: ["other", "open"] });
  });

  it("outside compare mode the picks are left alone", async () => {
    const { useScreenshotCompareStore } = await import("./useScreenshotCompareStore");
    const { useGalleryStore } = await import("./useGalleryStore");
    useGalleryStore.setState({ activePhotoId: "open" });
    useScreenshotCompareStore.getState().start("other");
    expect(useScreenshotCompareStore.getState().picks).toEqual([]);
  });
});
