// Settings → Plugins' contract: off by default, the master gates everything,
// the per-plugin choice survives the master going off and on, nothing leaves
// localStorage.
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  activeFormatById,
  activeFormats,
  arePluginsAllowed,
  isPluginActive,
  isPluginOn,
  PLUGINS_ALLOWED_KEY,
  pluginKey,
  setPluginOn,
  setPluginsAllowed,
  subscribePlugins,
} from "./state";
import { PLUGINS, pluginById } from "./registry";

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
});

describe("the catalogue", () => {
  it("ships the PSD plugin, and every format id is unique and not a built-in", () => {
    expect(pluginById("psd")?.formats.map((f) => f.id)).toEqual(["psd"]);
    const ids = PLUGINS.flatMap((p) => p.formats.map((f) => f.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(["png", "jpeg", "webp", "avif", "ora"]).not.toContain(id);
  });

  it("loads a format's codec on demand", async () => {
    const codec = await pluginById("psd")!.formats[0].load();
    expect(typeof codec.read).toBe("function");
    expect(typeof codec.write).toBe("function");
  });
});

describe("the switches", () => {
  it("are all off on a fresh device", () => {
    expect(arePluginsAllowed()).toBe(false);
    expect(isPluginOn("psd")).toBe(false);
    expect(isPluginActive("psd")).toBe(false);
    expect(activeFormats()).toEqual([]);
  });

  it("need the master AND the plugin on before a format appears", () => {
    setPluginOn("psd", true);
    expect(isPluginOn("psd")).toBe(true);
    expect(isPluginActive("psd")).toBe(false);
    expect(activeFormats()).toEqual([]);

    setPluginsAllowed(true);
    expect(isPluginActive("psd")).toBe(true);
    expect(activeFormats().map((f) => f.format.id)).toEqual(["psd"]);
    expect(activeFormatById("psd")?.plugin.id).toBe("psd");
    expect(activeFormatById("ora")).toBeUndefined();
  });

  it("keep the per-plugin choice when the master goes off, and restore it when it returns", () => {
    setPluginsAllowed(true);
    setPluginOn("psd", true);
    setPluginsAllowed(false);
    expect(isPluginOn("psd")).toBe(true);
    expect(activeFormats()).toEqual([]);
    setPluginsAllowed(true);
    expect(activeFormats()).toHaveLength(1);
  });

  it("write exactly one key each, and clear it for off", () => {
    setPluginsAllowed(true);
    setPluginOn("psd", true);
    expect(localStorage.getItem(PLUGINS_ALLOWED_KEY)).toBe("1");
    expect(localStorage.getItem(pluginKey("psd"))).toBe("1");
    setPluginOn("psd", false);
    expect(localStorage.getItem(pluginKey("psd"))).toBeNull();
    setPluginsAllowed(false);
    expect(localStorage.getItem(PLUGINS_ALLOWED_KEY)).toBeNull();
  });

  it("ignore a plugin nobody registered", () => {
    setPluginOn("nope", true);
    expect(localStorage.getItem(pluginKey("nope"))).toBeNull();
  });

  it("treat anything but exactly \"1\" as off", () => {
    localStorage.setItem(PLUGINS_ALLOWED_KEY, "true");
    localStorage.setItem(pluginKey("psd"), "yes");
    expect(arePluginsAllowed()).toBe(false);
    expect(isPluginOn("psd")).toBe(false);
  });

  it("hand the same array back while nothing changed (useSyncExternalStore needs that)", () => {
    setPluginsAllowed(true);
    setPluginOn("psd", true);
    const a = activeFormats();
    expect(activeFormats()).toBe(a);
    setPluginOn("psd", false);
    expect(activeFormats()).not.toBe(a);
  });

  it("notify subscribers on every change, and stop after unsubscribe", () => {
    const l = vi.fn();
    const off = subscribePlugins(l);
    setPluginsAllowed(true);
    setPluginOn("psd", true);
    expect(l).toHaveBeenCalledTimes(2);
    off();
    setPluginOn("psd", false);
    expect(l).toHaveBeenCalledTimes(2);
  });

  it("fall back to off when storage throws", () => {
    Object.defineProperty(globalThis, "localStorage", {
      get() {
        throw new Error("blocked");
      },
      configurable: true,
    });
    expect(arePluginsAllowed()).toBe(false);
    expect(() => setPluginsAllowed(true)).not.toThrow();
  });
});
