// Beta "history forks" (ih_history_forks, ADR-086): the device switch reaches
// the engine, OFF stays off, and the branch list parses without churn.
import { describe, it, expect, afterEach, vi } from "vitest";

const store = new Map<string, string>();
vi.stubGlobal("window", {
  localStorage: { getItem: (k: string) => store.get(k) ?? null },
  addEventListener: () => {},
  removeEventListener: () => {},
});

const { applyHistoryForks, isHistoryForksEnabled, parseBranches } = await import("./historyForks");

afterEach(() => store.clear());

/** A stand-in engine that records what it was told. */
function engine() {
  const told: boolean[] = [];
  return { told, set_history_forks: (on: boolean) => void told.push(on) };
}

describe("history forks switch", () => {
  it("is off unless the key is exactly '1'", () => {
    expect(isHistoryForksEnabled()).toBe(false);
    store.set("ih_history_forks", "true");
    expect(isHistoryForksEnabled()).toBe(false);
    store.set("ih_history_forks", "1");
    expect(isHistoryForksEnabled()).toBe(true);
  });

  it("tells the engine OFF by default and ON when opted in", async () => {
    const e = engine();
    await applyHistoryForks(e);
    store.set("ih_history_forks", "1");
    await applyHistoryForks(e);
    expect(e.told).toEqual([false, true]);
  });

  it("is a no-op on no engine or an older wasm without the export", async () => {
    await expect(applyHistoryForks(null)).resolves.toBeUndefined();
    await expect(applyHistoryForks({})).resolves.toBeUndefined();
  });

  it("does not throw when the engine call rejects", async () => {
    const e = { set_history_forks: () => Promise.reject(new Error("engine document replaced")) };
    await expect(applyHistoryForks(e)).resolves.toBeUndefined();
  });
});

describe("parseBranches", () => {
  it("returns ONE shared empty array for '[]', missing, or junk", () => {
    const a = parseBranches("[]");
    expect(a).toEqual([]);
    expect(parseBranches(undefined)).toBe(a);
    expect(parseBranches("not json")).toBe(a);
    expect(parseBranches('{"id":1}')).toBe(a);
  });

  it("parses the engine's rows", () => {
    expect(
      parseBranches('[{"id":3,"label":"Crop","steps":4,"bytes":1024,"nested":false}]'),
    ).toEqual([{ id: 3, label: "Crop", steps: 4, bytes: 1024, nested: false }]);
  });
});

describe("Settings › Beta registration", () => {
  it("is offered as ?beta=history-forks, read through this module's predicate", async () => {
    const { betaFeature } = await import("./beta");
    const f = betaFeature("history-forks");
    expect(f?.flag.key).toBe("ih_history_forks");
    expect(f?.flag.kind).toBe("optin");
    expect(f?.flag.isOn).toBe(isHistoryForksEnabled);
  });
});
