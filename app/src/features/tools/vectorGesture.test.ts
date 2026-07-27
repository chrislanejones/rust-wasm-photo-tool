// The Vector rail selection and the canvas gesture layer speak two different
// vocabularies (see vectorGesture.ts). That is the same shape as the paid-tier
// bug — `free|pro|team` vs `demo|loggedIn|paid`, no translation layer, no test,
// a paying customer silently on free-tier caps for months. So the translation
// gets pinned here: every mode, both directions, plus the pass-through.
import { describe, it, expect } from "vitest";
import { gestureToolFor, penModeFor, forcedShapeFor, cursorToolFor } from "./vectorGesture";
import { TEXT_MODES, VECTOR_DRAW_MODES, isVectorDrawMode } from "@/stores/useToolStore";
import type { ToolType } from "@/lib/types";

describe("gestureToolFor: rail selection -> canvas behaviour", () => {
  it("routes the drawing modes to the gestures the old Shapes tool used", () => {
    expect(gestureToolFor("text", "shapes")).toBe("shapes");
    expect(gestureToolFor("text", "pens")).toBe("shapes");
    expect(gestureToolFor("text", "line")).toBe("shapes");
    // Arrows have their own drag path, as they did when Shapes owned them.
    expect(gestureToolFor("text", "arrow")).toBe("arrow");
  });

  it("leaves the text modes on the text gesture", () => {
    expect(gestureToolFor("text", "text")).toBe("text");
    // OCR touches no pixels; it must not arm a drawing gesture.
    expect(gestureToolFor("text", "ocr")).toBe("text");
  });

  it("passes every other tool straight through, whatever the stale sub-mode", () => {
    // The sub-mode persists across tool switches, so a user who was last in
    // Vector/arrow and then picks Paint arrives here with textMode "arrow".
    // If that leaked, Paint would draw arrows.
    const others: ToolType[] = [
      "stamp", "compress", "crop", "select", "brush",
      "arrow", "ai", "effects", "emoji",
    ];
    for (const tool of others) {
      for (const mode of TEXT_MODES) {
        expect(gestureToolFor(tool, mode)).toBe(tool);
      }
    }
  });

  it("never returns a tool the canvas layer can't route", () => {
    // Total over the union — a seventh sub-mode won't compile without a case,
    // but this catches one added via a widened type.
    for (const mode of TEXT_MODES) {
      expect(["text", "shapes", "arrow"]).toContain(gestureToolFor("text", mode));
    }
  });
});

describe("penModeFor", () => {
  it("arms the pin path for Pens and nothing else", () => {
    expect(penModeFor("text", "pens")).toBe("pins");
    for (const mode of TEXT_MODES.filter((m) => m !== "pens")) {
      expect(penModeFor("text", mode)).toBeNull();
    }
    // Not armed by a stale sub-mode under another tool.
    expect(penModeFor("brush", "pens")).toBeNull();
  });
});

describe("forcedShapeFor", () => {
  it("pins Line's primitive, since Line is a mode rather than a kind now", () => {
    expect(forcedShapeFor("line")).toBe("line");
    for (const mode of TEXT_MODES.filter((m) => m !== "line")) {
      expect(forcedShapeFor(mode)).toBeNull();
    }
  });
});

describe("isVectorDrawMode agrees with the gesture router", () => {
  // The panel router and the gesture layer must not disagree about which modes
  // draw: one deciding "shapes panel" while the other routes the text gesture
  // is a tool that looks armed and does nothing.
  it("is true for exactly the modes that route to a drawing gesture", () => {
    for (const mode of TEXT_MODES) {
      const draws = gestureToolFor("text", mode) !== "text";
      expect(isVectorDrawMode(mode)).toBe(draws);
    }
  });

  it("VECTOR_DRAW_MODES is a subset of TEXT_MODES", () => {
    for (const m of VECTOR_DRAW_MODES) {
      expect(TEXT_MODES).toContain(m);
    }
  });
});

describe("cursorToolFor: the canvas cursor, which is not quite the gesture", () => {
  it("shows the drag-to-draw crosshair for arrow-drawing", () => {
    // Feeding the raw gesture here would hand Vector's Arrow mode the LAYER
    // SETTINGS cursor, because both are the id "arrow".
    expect(cursorToolFor("text", "arrow")).toBe("shapes");
  });

  it("leaves the Layer Settings tool alone", () => {
    expect(cursorToolFor("arrow", "text")).toBe("arrow");
    expect(cursorToolFor("arrow", "arrow")).toBe("arrow");
  });

  it("matches the gesture for every other mode", () => {
    for (const mode of TEXT_MODES.filter((m) => m !== "arrow")) {
      expect(cursorToolFor("text", mode)).toBe(gestureToolFor("text", mode));
    }
  });
});
