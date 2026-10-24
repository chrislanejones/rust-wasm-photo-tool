// openArea (user tests 10-23, C3/C19): the part of the canvas area no closable
// panel covers. Each panel trims the side it sits on. The real layout is
// covered end to end by e2e/screenshot-compare.spec.ts; this pins the rule.
import { afterEach, describe, expect, it, vi } from "vitest";
import { openArea } from "./panelYield";

type R = { left: number; top: number; right: number; bottom: number };

function panels(...rects: R[]) {
  vi.stubGlobal("window", { innerWidth: 1689, innerHeight: 922 });
  vi.stubGlobal("document", {
    querySelectorAll: () => rects.map((r) => ({ getBoundingClientRect: () => r })),
  });
}

afterEach(() => vi.unstubAllGlobals());

const WHOLE = { l: 0, t: 0, r: 1689, b: 874 };

describe("openArea", () => {
  it("is the area, inside the window, when no panel is open", () => {
    panels();
    expect(openArea({ l: -40, t: 0, r: 2000, b: 874 })).toEqual(WHOLE);
  });

  it("the Gallery strip trims the bottom", () => {
    panels({ left: 284, top: 686, right: 1677, bottom: 874 });
    expect(openArea(WHOLE)).toEqual({ ...WHOLE, b: 686 });
  });

  it("the Review panel trims the right, and with the strip both go", () => {
    panels({ left: 284, top: 686, right: 1405, bottom: 874 }, { left: 1417, top: 12, right: 1677, bottom: 874 });
    expect(openArea(WHOLE)).toEqual({ ...WHOLE, r: 1417, b: 686 });
  });

  it("the Tools panel trims the left; a panel outside the area changes nothing", () => {
    panels({ left: 12, top: 12, right: 272, bottom: 874 }, { left: 0, top: 880, right: 1689, bottom: 922 });
    expect(openArea(WHOLE)).toEqual({ ...WHOLE, l: 272 });
  });
});
