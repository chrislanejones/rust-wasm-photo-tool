// @vitest-environment jsdom
//
// Settings › Beta: a row per registered feature, and a toggle that writes the
// key the feature itself reads. STATIC imports (see MobileSettingsSheet.test).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BetaPane } from "./BetaPane";
import { BETA_FEATURES, isBetaOn, setBetaOn } from "@/lib/beta";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function render(): void {
  act(() => {
    root.render(React.createElement(BetaPane));
  });
}

/** The On / Off pair belongs to the section whose heading names the feature. */
function toggle(label: string, which: "On" | "Off"): HTMLButtonElement {
  const section = [...document.body.querySelectorAll("section")].find(
    (s) => s.querySelector("h3")?.textContent?.trim() === label,
  );
  if (!section) throw new Error(`no row for "${label}"`);
  const btn = [...section.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === which,
  );
  if (!btn) throw new Error(`no ${which} button for "${label}"`);
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

describe("Settings › Beta", () => {
  it("shows every registered feature, with its blurb", () => {
    render();
    const text = document.body.textContent ?? "";
    for (const f of BETA_FEATURES) {
      expect(text, f.id).toContain(f.label);
      expect(text, `${f.id} blurb`).toContain(f.blurb.slice(0, 40));
    }
    expect(text).toContain("never sent anywhere");
  });

  it("turns one on and back off, writing the feature's own key", () => {
    render();
    const smart = BETA_FEATURES.find((f) => f.id === "smart-brush")!;

    act(() => toggle(smart.label, "On").click());
    expect(isBetaOn("smart-brush")).toBe(true);
    expect(localStorage.getItem(smart.flag.key)).toBe("1");

    act(() => toggle(smart.label, "Off").click());
    expect(isBetaOn("smart-brush")).toBe(false);
    expect(localStorage.getItem(smart.flag.key)).toBeNull();
  });

  it("shows what is already on when it opens, and only that one", () => {
    setBetaOn("gpu-blur", true);
    render();
    const gpu = BETA_FEATURES.find((f) => f.id === "gpu-blur")!;
    const smart = BETA_FEATURES.find((f) => f.id === "smart-brush")!;
    // The lit button is styled, not labeled (ToggleButtonGroup emits no
    // aria-pressed — parked in PARKING_LOT), so compare the two rows: the one
    // that is on must not render its On button the same as the one that is off.
    expect(toggle(gpu.label, "On").className).not.toBe(toggle(smart.label, "On").className);
    expect(toggle(gpu.label, "On").className).toBe(toggle(smart.label, "Off").className);
    expect(isBetaOn("gpu-blur")).toBe(true);
    expect(isBetaOn("smart-brush")).toBe(false);
  });

  it("tells every row a reload is needed — the registry says it of them all", () => {
    render();
    const rows = [...document.body.querySelectorAll("section")];
    const reloadRows = rows.filter((s) => s.textContent?.includes("Reload the page"));
    expect(reloadRows).toHaveLength(BETA_FEATURES.length);
  });

  it("copies an invite link for the row it was pressed on", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render();

    const section = [...document.body.querySelectorAll("section")].find(
      (s) => s.querySelector("h3")?.textContent?.trim() === "Smart Brush",
    )!;
    const copy = [...section.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Copy invite link"),
    ) as HTMLButtonElement;

    await act(async () => {
      copy.click();
    });
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/?beta=smart-brush`);
  });
});
