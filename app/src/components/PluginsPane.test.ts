// @vitest-environment jsdom
//
// Settings › Plugins: the master switch gates every row, a row's toggle writes
// the plugin's own key, and the pane reads what is already on. STATIC
// imports, like BetaPane.test.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PluginsPane } from "./PluginsPane";
import {
  PLUGINS,
  arePluginsAllowed,
  isPluginOn,
  setPluginOn,
  setPluginsAllowed,
  activeFormats,
} from "@/lib/plugins";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function render(): void {
  act(() => {
    root.render(React.createElement(PluginsPane));
  });
}

/** The On / Off pair belongs to the section whose heading starts with `title`. */
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

beforeEach(() => {
  localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("Settings › Plugins", () => {
  it("lists the master switch and every plugin in the catalogue, with its blurb", () => {
    render();
    const text = document.body.textContent ?? "";
    expect(text).toContain("Allow plugins");
    for (const p of PLUGINS) {
      expect(text, p.id).toContain(p.name);
      expect(text, `${p.id} blurb`).toContain(p.blurb.slice(0, 40));
      expect(text, `${p.id} version`).toContain(`v${p.version}`);
    }
    expect(text).toContain("nothing is downloaded");
  });

  it("keeps every plugin row disabled until the master is on", () => {
    render();
    expect(toggle("Photoshop PSD", "On").disabled).toBe(true);
    act(() => toggle("Allow plugins", "On").click());
    expect(arePluginsAllowed()).toBe(true);
    expect(toggle("Photoshop PSD", "On").disabled).toBe(false);
  });

  it("turns a plugin on and off, and its formats follow", () => {
    render();
    act(() => toggle("Allow plugins", "On").click());
    act(() => toggle("Photoshop PSD", "On").click());
    expect(isPluginOn("psd")).toBe(true);
    expect(activeFormats().map((f) => f.format.id)).toEqual(["psd"]);

    act(() => toggle("Photoshop PSD", "Off").click());
    expect(isPluginOn("psd")).toBe(false);
    expect(activeFormats()).toEqual([]);
  });

  it("shows what is already on when it opens", () => {
    setPluginsAllowed(true);
    setPluginOn("psd", true);
    render();
    // The lit button is styled, not labeled (ToggleButtonGroup emits no
    // aria-pressed — see BetaPane.test), so compare On against Off.
    expect(toggle("Photoshop PSD", "On").className).not.toBe(
      toggle("Photoshop PSD", "Off").className,
    );
    expect(toggle("Allow plugins", "On").className).not.toBe(
      toggle("Allow plugins", "Off").className,
    );
  });

  it("turning the master off hides the formats but keeps the plugin's choice", () => {
    setPluginsAllowed(true);
    setPluginOn("psd", true);
    render();
    act(() => toggle("Allow plugins", "Off").click());
    expect(activeFormats()).toEqual([]);
    expect(isPluginOn("psd")).toBe(true);
    expect(toggle("Photoshop PSD", "On").disabled).toBe(true);
  });
});
