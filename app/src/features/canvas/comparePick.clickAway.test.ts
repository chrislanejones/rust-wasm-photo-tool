// @vitest-environment jsdom
// Compare mode's "click elsewhere" exit (11-12-2026): a pointerdown outside
// the gallery, the Compare bar and its views ends compare mode, the same
// `stop` as the X and the top bar's button. Inside them, or while a dialog or
// menu is open (that click is closing it), compare mode stays.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { leavesCompareMode, useCompareClickAway } from "./comparePick";
import { useScreenshotCompareStore } from "@/stores/useScreenshotCompareStore";

function el(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

/** What a real pointerdown dispatches: a bubbling event on the target. */
function pointerDown(target: Element) {
  target.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }));
}

const picking = () => useScreenshotCompareStore.getState().picking;

beforeEach(() => {
  useScreenshotCompareStore.getState().stop();
});
afterEach(() => {
  // Unmount each test's hook: no vitest globals here, so RTL won't do it.
  cleanup();
  document.body.innerHTML = "";
});

describe("leavesCompareMode", () => {
  it("is elsewhere outside the marked areas, and not inside them", () => {
    el(`<main><canvas id="c"></canvas></main>
        <div data-compare-keep=""><button id="tick">tick</button></div>`);
    expect(leavesCompareMode(document.getElementById("c"))).toBe(true);
    expect(leavesCompareMode(document.getElementById("tick"))).toBe(false);
  });

  it("keeps floating layers, and ignores clicks while a dialog or menu is open", () => {
    el(`<div role="tooltip"><span id="tip">tip</span></div><p id="out">x</p>`);
    expect(leavesCompareMode(document.getElementById("tip"))).toBe(false);
    expect(leavesCompareMode(document.getElementById("out"))).toBe(true);
    el(`<div role="menu"><button>Compare with this</button></div>`);
    expect(leavesCompareMode(document.getElementById("out"))).toBe(false);
  });

  it("is not elsewhere for a detached node or a non-element", () => {
    expect(leavesCompareMode(document.createElement("div"))).toBe(false);
    expect(leavesCompareMode(null)).toBe(false);
    expect(leavesCompareMode(window)).toBe(false);
  });
});

describe("useCompareClickAway", () => {
  it("ends compare mode on a pointerdown elsewhere, not on one in the gallery", () => {
    el(`<p id="out">canvas area</p><div data-compare-keep=""><button id="in">pick</button></div>`);
    renderHook(() => useCompareClickAway());
    act(() => {
      useScreenshotCompareStore.getState().beginPick();
      useScreenshotCompareStore.getState().setPicks(["a"]);
    });

    pointerDown(document.getElementById("in")!);
    expect(picking()).toBe(true);
    expect(useScreenshotCompareStore.getState().picks).toEqual(["a"]);

    pointerDown(document.getElementById("out")!);
    expect(useScreenshotCompareStore.getState()).toMatchObject({ picking: false, picks: [], otherId: null });
  });

  it("hears a pointerdown that a control stopped from bubbling", () => {
    el(`<div id="wrap"><button id="out">stops it</button></div>`);
    document.getElementById("out")!.addEventListener("pointerdown", (e) => e.stopPropagation());
    renderHook(() => useCompareClickAway());
    act(() => useScreenshotCompareStore.getState().beginPick());
    pointerDown(document.getElementById("out")!);
    expect(picking()).toBe(false);
  });

  it("does nothing outside compare mode (a right-click comparison is left alone)", () => {
    el(`<p id="out">x</p>`);
    renderHook(() => useCompareClickAway());
    act(() => useScreenshotCompareStore.getState().start("a"));
    pointerDown(document.getElementById("out")!);
    expect(useScreenshotCompareStore.getState().otherId).toBe("a");
  });
});
