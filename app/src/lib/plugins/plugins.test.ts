// The plugin runtime, end to end in node: a plugin file loads and is checked
// field by field, an added plugin is kept in IndexedDB and comes back after a
// "reload", the two switches gate what the app sees, and every refusal names
// its reason. The plugin under test is the repo's fixture
// (e2e/fixtures/layered-json.plugin.js), the same file the e2e adds through
// the real pane.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { IDBFactory } from "fake-indexeddb";
import { compositeLayers, type LayeredDocument } from "./document";

const FIXTURE = readFileSync(
  join(__dirname, "../../../../e2e/fixtures/layered-json.plugin.js"),
  "utf8",
);

/** A second plugin that claims the fixture's format id under another plugin id. */
const CLASHING = FIXTURE.replace('id: "layered-json"', 'id: "other-json"').replace(
  'name: "Layered JSON (test plugin)"',
  'name: "Other JSON"',
);

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
}

type State = typeof import("./state");
type Load = typeof import("./load");
let state: State;
let load: Load;

/** A fresh module graph + a fresh in-memory IndexedDB: what a page reload
 *  gives the real app, minus the storage that survives it (see `reload`). */
async function boot(): Promise<void> {
  vi.resetModules();
  state = await import("./state");
  load = await import("./load");
}

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
  await boot();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function doc(): LayeredDocument {
  const w = 3;
  const h = 2;
  const px = (v: number) => new Uint8Array(w * h * 4).map((_, i) => (v + i) & 0xff);
  return {
    width: w,
    height: h,
    layers: [
      { name: "Bottom", visible: true, opacity: 1, rgba: px(1) },
      { name: "Top ✎", visible: false, opacity: 0.5, rgba: px(100) },
    ],
    activeIndex: null,
    composite: null,
    notes: [],
  };
}

describe("loading a plugin file", () => {
  it("evaluates the module and returns its checked manifest, with working codecs", async () => {
    const mod = await load.loadPluginModule(FIXTURE);
    expect(mod.id).toBe("layered-json");
    expect(mod.apiVersion).toBe(1);
    expect(mod.formats.map((f) => f.id)).toEqual(["ihl"]);
    const f = mod.formats[0];
    const back = f.read(f.write(doc()));
    expect(back.width).toBe(3);
    expect(back.layers.map((l) => l.name)).toEqual(["Bottom", "Top ✎"]);
    expect(back.layers[1].opacity).toBe(0.5);
    expect(back.layers[1].visible).toBe(false);
    expect(back.layers[0].rgba).toEqual(doc().layers[0].rgba);
  });

  it("strips the code out of the stored manifest", async () => {
    const mod = await load.loadPluginModule(FIXTURE);
    const manifest = load.manifestOf(mod);
    expect(JSON.parse(JSON.stringify(manifest)).formats[0]).toEqual({
      id: "ihl",
      label: "IHL",
      hint: "Layered · JSON (test)",
      extension: ".ihl",
      accept: ".ihl,application/json",
      mime: "application/json",
      describe: "Image Horse's own test format: every layer, as JSON.",
    });
  });

  it.each([
    ["export default 42;", /default export is not an object/],
    ["export default { apiVersion: 2, id: 'x', formats: [] };", /API version 2/],
    ["export default { apiVersion: 1, id: 'Bad Id', name: 'n', version: '1', formats: [] };", /lowercase/],
    ["export default { apiVersion: 1, id: 'x', name: 'n', version: '1', formats: [] };", /no formats/],
    [
      "export default { apiVersion: 1, id: 'x', name: 'n', version: '1', formats: [{ id: 'png', label: 'P', hint: 'h', extension: '.png', read(){}, write(){} }] };",
      /already uses/,
    ],
    [
      "export default { apiVersion: 1, id: 'x', name: 'n', version: '1', formats: [{ id: 'q', label: 'Q', hint: 'h', extension: '.q', write(){} }] };",
      /formats\[0\]\.read is not a function/,
    ],
    ["this is not javascript", /didn't load as a plugin/],
  ])("refuses %s with a reason", async (source, message) => {
    await expect(load.loadPluginModule(source)).rejects.toThrow(message);
  });

  it("caps a plugin at 4 MB", async () => {
    await expect(load.loadPluginModule("x".repeat(4 * 1024 * 1024 + 1))).rejects.toThrow(/too large/);
  });
});

describe("adding, keeping and removing", () => {
  it("adds a plugin, turns its switch on, and keeps it across a reload", async () => {
    const added = await state.addPlugin(FIXTURE, null);
    expect(added.id).toBe("layered-json");
    expect(added.sourceUrl).toBeNull();
    expect(state.installedPlugins().map((p) => p.id)).toEqual(["layered-json"]);
    expect(state.isPluginOn("layered-json")).toBe(true);

    await boot(); // same IndexedDB, same localStorage — a page reload
    expect(state.installedPlugins()).toEqual([]);
    await state.hydrateInstalledPlugins();
    expect(state.installedPlugins().map((p) => p.id)).toEqual(["layered-json"]);
    expect(state.installedPlugins()[0].source).toBe(FIXTURE);
  });

  it("re-adding the same id replaces the record and keeps one entry", async () => {
    await state.addPlugin(FIXTURE, null);
    const v2 = FIXTURE.replace('version: "0.1.0"', 'version: "0.2.0"');
    await state.addPlugin(v2, "https://example.com/p.js");
    expect(state.installedPlugins()).toHaveLength(1);
    expect(state.installedPlugins()[0].version).toBe("0.2.0");
    expect(state.installedPlugins()[0].sourceUrl).toBe("https://example.com/p.js");
  });

  it("refuses a second plugin that provides a format another one already does", async () => {
    await state.addPlugin(FIXTURE, null);
    await expect(state.addPlugin(CLASHING, null)).rejects.toThrow(
      /"ihl" format is already provided by the Layered JSON/,
    );
    expect(state.installedPlugins()).toHaveLength(1);
  });

  it("removes a plugin, its switch and its formats", async () => {
    state.setPluginsAllowed(true);
    await state.addPlugin(FIXTURE, null);
    expect(state.activeFormats()).toHaveLength(1);
    await state.removePlugin("layered-json");
    expect(state.installedPlugins()).toEqual([]);
    expect(state.isPluginOn("layered-json")).toBe(false);
    expect(state.activeFormats()).toEqual([]);
    await boot();
    await state.hydrateInstalledPlugins();
    expect(state.installedPlugins()).toEqual([]);
  });

  it("does not store a plugin that fails to load", async () => {
    await expect(state.addPlugin("export default 1;", null)).rejects.toThrow();
    await boot();
    await state.hydrateInstalledPlugins();
    expect(state.installedPlugins()).toEqual([]);
  });
});

describe("the switches", () => {
  it("are off on a fresh device, and the master gates everything", async () => {
    expect(state.arePluginsAllowed()).toBe(false);
    await state.addPlugin(FIXTURE, null);
    expect(state.isPluginOn("layered-json")).toBe(true);
    expect(state.isPluginActive("layered-json")).toBe(false);
    expect(state.activeFormats()).toEqual([]);

    state.setPluginsAllowed(true);
    expect(state.isPluginActive("layered-json")).toBe(true);
    expect(state.activeFormats().map((f) => f.format.id)).toEqual(["ihl"]);
    expect(state.activeFormatById("ihl")?.plugin.id).toBe("layered-json");
    expect(state.activeFormatById("ora")).toBeUndefined();
  });

  it("keep the per-plugin choice when the master goes off, and restore it when it returns", async () => {
    state.setPluginsAllowed(true);
    await state.addPlugin(FIXTURE, null);
    state.setPluginsAllowed(false);
    expect(state.isPluginOn("layered-json")).toBe(true);
    expect(state.activeFormats()).toEqual([]);
    state.setPluginsAllowed(true);
    expect(state.activeFormats()).toHaveLength(1);
  });

  it("write exactly one key each, and clear it for off", async () => {
    state.setPluginsAllowed(true);
    await state.addPlugin(FIXTURE, null);
    expect(localStorage.getItem(state.PLUGINS_ALLOWED_KEY)).toBe("1");
    expect(localStorage.getItem(state.pluginKey("layered-json"))).toBe("1");
    state.setPluginOn("layered-json", false);
    expect(localStorage.getItem(state.pluginKey("layered-json"))).toBeNull();
    state.setPluginsAllowed(false);
    expect(localStorage.getItem(state.PLUGINS_ALLOWED_KEY)).toBeNull();
  });

  it("ignore a switch for a plugin this device does not have", () => {
    state.setPluginOn("nope", true);
    expect(localStorage.getItem(state.pluginKey("nope"))).toBeNull();
  });

  it("treat anything but exactly \"1\" as off", () => {
    localStorage.setItem(state.PLUGINS_ALLOWED_KEY, "true");
    expect(state.arePluginsAllowed()).toBe(false);
  });

  it("hand the same array back while nothing changed (useSyncExternalStore needs that)", async () => {
    state.setPluginsAllowed(true);
    await state.addPlugin(FIXTURE, null);
    const a = state.activeFormats();
    expect(state.activeFormats()).toBe(a);
    state.setPluginOn("layered-json", false);
    expect(state.activeFormats()).not.toBe(a);
  });

  it("notify subscribers on every change, and stop after unsubscribe", async () => {
    const l = vi.fn();
    const off = state.subscribePlugins(l);
    await state.hydrateInstalledPlugins();
    l.mockClear();
    state.setPluginsAllowed(true);
    await state.addPlugin(FIXTURE, null);
    expect(l).toHaveBeenCalledTimes(2);
    off();
    state.setPluginOn("layered-json", false);
    expect(l).toHaveBeenCalledTimes(2);
  });

  it("hands an active format a codec that round-trips through the loaded module", async () => {
    state.setPluginsAllowed(true);
    await state.addPlugin(FIXTURE, null);
    const codec = await state.activeFormatById("ihl")!.format.load();
    const back = codec.read(codec.write(doc()));
    expect(back.layers).toHaveLength(2);
    expect(back.layers[1].rgba).toEqual(doc().layers[1].rgba);
  });
});

describe("adding from a URL", () => {
  it("turns a GitHub blob page into its raw file, and adds what it gets", async () => {
    const fetch = vi.fn(async () => new Response(FIXTURE, { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const added = await state.addPluginFromUrl(
      "https://github.com/someone/psd-plugin/blob/main/dist/plugin.js",
    );
    expect(fetch).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/someone/psd-plugin/main/dist/plugin.js",
      expect.objectContaining({ credentials: "omit" }),
    );
    expect(added.sourceUrl).toBe(
      "https://raw.githubusercontent.com/someone/psd-plugin/main/dist/plugin.js",
    );
  });

  it.each([
    ["not a url", /web address/],
    ["http://example.com/p.js", /https:\/\//],
  ])("refuses %s", async (input, message) => {
    await expect(state.addPluginFromUrl(input)).rejects.toThrow(message);
  });

  it("names a failed download and a bad status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("blocked"); }));
    await expect(state.addPluginFromUrl("https://example.com/p.js")).rejects.toThrow(/Add from file/);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 404 })));
    await expect(state.addPluginFromUrl("https://example.com/p.js")).rejects.toThrow(/answered 404/);
  });
});

describe("compositeLayers", () => {
  it("source-overs visible layers at their opacity, bottom first", () => {
    const d = doc();
    d.layers[0].rgba = new Uint8Array(3 * 2 * 4).fill(255); // opaque white
    d.layers[1].visible = true;
    d.layers[1].opacity = 0.5;
    d.layers[1].rgba = new Uint8Array(3 * 2 * 4);
    for (let i = 0; i < 6; i++) d.layers[1].rgba.set([0, 0, 0, 255], i * 4);
    const out = compositeLayers(d);
    expect([...out.subarray(0, 4)]).toEqual([128, 128, 128, 255]);
  });
});
