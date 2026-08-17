// Guide color preference — load/validate/persist behavior of the store's
// localStorage-backed `guideColor`. The store reads localStorage at MODULE
// init, so each test stubs a fresh localStorage and re-imports the module
// (vitest runs in a node environment with no real localStorage — the store
// must also survive having none at all).
import { describe, it, expect, beforeEach, vi } from "vitest";

const LS_KEY = "image-horse-guide-color";
const DEFAULT = "#22d3ee";

function stubLocalStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  const ls = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
  vi.stubGlobal("localStorage", ls);
  return map;
}

async function freshStore() {
  vi.resetModules();
  const mod = await import("./useGuidesStore");
  return mod.useGuidesStore;
}

describe("useGuidesStore guideColor", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to cyan when nothing is stored", async () => {
    stubLocalStorage();
    const store = await freshStore();
    expect(store.getState().guideColor).toBe(DEFAULT);
  });

  it("defaults to cyan when localStorage does not exist (node env)", async () => {
    const store = await freshStore();
    expect(store.getState().guideColor).toBe(DEFAULT);
  });

  it("loads a stored valid hex", async () => {
    stubLocalStorage({ [LS_KEY]: "#ef4444" });
    const store = await freshStore();
    expect(store.getState().guideColor).toBe("#ef4444");
  });

  it("falls back to the default on a stored non-hex value", async () => {
    stubLocalStorage({ [LS_KEY]: "not-a-color" });
    const store = await freshStore();
    expect(store.getState().guideColor).toBe(DEFAULT);
  });

  it("setGuideColor updates state AND writes through to localStorage", async () => {
    const map = stubLocalStorage();
    const store = await freshStore();
    store.getState().setGuideColor("#22c55e");
    expect(store.getState().guideColor).toBe("#22c55e");
    expect(map.get(LS_KEY)).toBe("#22c55e");
  });

  it("clearGuides leaves the color alone — it is a preference, not guide state", async () => {
    stubLocalStorage({ [LS_KEY]: "#ec4899" });
    const store = await freshStore();
    store.getState().addGuide("h", 800, 600);
    store.getState().clearGuides();
    expect(store.getState().guides).toHaveLength(0);
    expect(store.getState().guideColor).toBe("#ec4899");
  });

  it("survives a throwing localStorage on write (private mode / quota)", async () => {
    stubLocalStorage();
    const store = await freshStore();
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    });
    store.getState().setGuideColor("#3b82f6");
    expect(store.getState().guideColor).toBe("#3b82f6");
  });
});
