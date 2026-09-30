// @vitest-environment jsdom
//
// Settings › Plugins: a plugin file added through the pane lands as a row
// with its own switch, the master switch gates every row, and Remove takes
// it away. The plugin is the repo's fixture (e2e/fixtures/layered-json.
// plugin.js) — the same file the e2e adds through the real pane. STATIC
// imports, like BetaPane.test; the state module is shared across the file,
// so each test removes what it added.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PluginsPane } from "./PluginsPane";
import {
  activeFormats,
  addPlugin,
  arePluginsAllowed,
  installedPlugins,
  isPluginOn,
  removePlugin,
  setPluginsAllowed,
} from "@/lib/plugins";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FIXTURE = readFileSync(
  join(__dirname, "../../../e2e/fixtures/layered-json.plugin.js"),
  "utf8",
);

let container: HTMLDivElement;
let root: Root;

function render(): void {
  act(() => {
    root.render(React.createElement(PluginsPane));
  });
}

/** The On / Off pair in the section whose heading starts with `title`. */
function toggle(title: string, which: "On" | "Off"): HTMLButtonElement {
  const section = [...document.body.querySelectorAll("section")].find((s) =>
    s.querySelector("h3")?.textContent?.trim().startsWith(title),
  );
  if (!section) throw new Error(`no section "${title}"`);
  const btn = [...section.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === which,
  );
  if (!btn) throw new Error(`no ${which} button under "${title}"`);
  return btn as HTMLButtonElement;
}

const flush = () => act(async () => {});

beforeEach(() => {
  localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  for (const p of installedPlugins()) await removePlugin(p.id);
});

describe("Settings › Plugins", () => {
  it("shows the master switch, the two ways to add, and an empty list", async () => {
    render();
    await flush();
    const text = document.body.textContent ?? "";
    expect(text).toContain("Allow plugins");
    expect(text).toContain("Add from file");
    expect(text).toContain("Add from link");
    expect(text).toContain("Nothing added yet");
    expect(text).toContain("same access as the app");
  });

  it("adds a plugin from a file: a row appears, switched on, and the master still gates it", async () => {
    render();
    await flush();
    const input = document.body.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File([FIXTURE], "layered-json.plugin.js", { type: "text/javascript" });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    // The add is async (module load + IndexedDB); wait for the row.
    for (let i = 0; i < 50 && installedPlugins().length === 0; i++) await flush();
    await flush();

    expect(installedPlugins().map((p) => p.id)).toEqual(["layered-json"]);
    expect(isPluginOn("layered-json")).toBe(true);
    const text = document.body.textContent ?? "";
    expect(text).toContain("Layered JSON (test plugin)");
    expect(text).toContain("v0.1.0");
    expect(text).toContain("Import and export .ihl");
    expect(text).toContain("added from a file");

    // Master off: the row is there but disabled, and no format is active.
    expect(arePluginsAllowed()).toBe(false);
    expect(toggle("Layered JSON", "On").disabled).toBe(true);
    expect(activeFormats()).toEqual([]);

    act(() => toggle("Allow plugins", "On").click());
    expect(toggle("Layered JSON", "Off").disabled).toBe(false);
    expect(activeFormats().map((f) => f.format.id)).toEqual(["ihl"]);

    act(() => toggle("Layered JSON", "Off").click());
    expect(activeFormats()).toEqual([]);
  });

  it("shows what is already added when it opens, and Remove takes it away", async () => {
    setPluginsAllowed(true);
    await addPlugin(FIXTURE, "https://example.com/layered-json.plugin.js");
    render();
    await flush();
    expect(document.body.textContent).toContain("https://example.com/layered-json.plugin.js");
    const remove = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Remove Layered JSON (test plugin)"]',
    )!;
    await act(async () => {
      remove.click();
    });
    for (let i = 0; i < 50 && installedPlugins().length > 0; i++) await flush();
    expect(installedPlugins()).toEqual([]);
    expect(document.body.textContent).toContain("Nothing added yet");
  });
});
