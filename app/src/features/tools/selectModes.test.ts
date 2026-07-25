// The Select tool's six modes are stated in more than one place — SELECT_MODES
// (panel + palette), the SelectionKind union (types), and isMarqueeKind (which
// gesture runs). Nothing forced them to agree, and the identical drift already
// bit us once: ShortcutModal kept its own hand-written tool list and silently
// lost Select for three releases. These pin the agreement.
import { describe, it, expect } from "vitest";
import { SELECT_MODES } from "./settings/SelectSettings";
import { MARQUEE_KINDS, isMarqueeKind } from "@/stores/useToolStore";
import type { SelectionKind } from "@/stores/useToolStore";

describe("the six selection modes are one exclusive set", () => {
  it("SELECT_MODES holds exactly the six, in panel order", () => {
    expect(SELECT_MODES.map((m) => m.id)).toEqual([
      "wand",
      "edge",
      "lasso",
      "colorRange",
      "rect",
      "ellipse",
    ]);
  });

  it("every mode carries a label and a searchable info string", () => {
    for (const m of SELECT_MODES) {
      expect(m.label.length).toBeGreaterThan(0);
      // The palette indexes `info` as a keyword, so it must stay a plain
      // string here even though the panel wraps it in a ReactNode.
      expect(typeof m.info).toBe("string");
    }
  });

  it("isMarqueeKind accepts exactly the drag modes", () => {
    const drag = SELECT_MODES.map((m) => m.id).filter(isMarqueeKind);
    expect(drag).toEqual(["rect", "ellipse"]);
    expect([...MARQUEE_KINDS]).toEqual(drag);
  });

  it("the click modes are never treated as marquee modes", () => {
    const clickModes: SelectionKind[] = ["wand", "edge", "colorRange", "lasso"];
    for (const k of clickModes) expect(isMarqueeKind(k)).toBe(false);
  });
});
