// diagramShapes.ts is a hand mirror of src/diagram.rs. This reads the Rust
// table straight out of the source and fails when the two disagree, so a shape
// edited on one side cannot quietly preview one way and commit another.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  DIAGRAM_PROGRAMS,
  DIAGRAM_SHAPES,
  diagramGeometry,
  diagramStrokes,
  isDiagramKind,
} from "./diagramShapes";
import { SHAPE_KIND_NAME, SHAPE_NAME_KIND, shapeCanFill } from "./drawEditState";
import { shapeKindLabel } from "./perspectiveTarget";

const RUST = resolve(dirname(fileURLToPath(import.meta.url)), "../../../src/diagram.rs");

/** `kind => &[numbers…],` entries between the TABLE markers. */
function rustTable(): Record<number, number[]> {
  const src = readFileSync(RUST, "utf8");
  const body = src.slice(src.indexOf("// TABLE-BEGIN"), src.indexOf("// TABLE-END"));
  const out: Record<number, number[]> = {};
  for (const m of body.matchAll(/(\d+)\s*=>\s*&\[([^\]]*)\]/g)) {
    out[Number(m[1])] = m[2]
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .map(Number);
  }
  return out;
}

describe("diagram shapes", () => {
  it("the TS program table is the Rust one, number for number", () => {
    const rust = rustTable();
    expect(Object.keys(rust)).toHaveLength(30);
    expect(DIAGRAM_PROGRAMS).toEqual(rust);
  });

  it("names, kinds and labels cover all thirty, once each", () => {
    expect(DIAGRAM_SHAPES.map((d) => d.kind)).toEqual(
      Array.from({ length: 30 }, (_, i) => 11 + i),
    );
    expect(new Set(DIAGRAM_SHAPES.map((d) => d.id)).size).toBe(30);
    for (const d of DIAGRAM_SHAPES) {
      expect(isDiagramKind(d.kind)).toBe(true);
      expect(SHAPE_NAME_KIND[d.id]).toBe(d.kind);
      expect(SHAPE_KIND_NAME[d.kind]).toBe(d.id);
      expect(shapeKindLabel(d.kind)).toBe(d.label);
      expect(shapeCanFill(d.id)).toBe(true);
    }
    expect(isDiagramKind(10)).toBe(false);
    expect(isDiagramKind(41)).toBe(false);
  });

  // The same four properties diagram.rs's own tests pin.
  it("every kind has a closed outline inside its box", () => {
    for (const { kind } of DIAGRAM_SHAPES) {
      const g = diagramGeometry(kind, { x: 10, y: 20 }, { x: 110, y: 220 })!;
      expect(g.outline.length).toBeGreaterThanOrEqual(3);
      for (const p of [...g.outline, ...g.details.flat()]) {
        expect(p.x).toBeGreaterThanOrEqual(8);
        expect(p.x).toBeLessThanOrEqual(112);
        expect(p.y).toBeGreaterThanOrEqual(15);
        expect(p.y).toBeLessThanOrEqual(225);
      }
    }
    expect(diagramGeometry(10, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull();
  });

  it("a full circle drops its repeated closing point", () => {
    const g = diagramGeometry(28, { x: 0, y: 0 }, { x: 100, y: 100 })!;
    const f = g.outline[0];
    const l = g.outline[g.outline.length - 1];
    expect(Math.hypot(f.x - l.x, f.y - l.y)).toBeGreaterThan(1e-6);
    expect(g.details).toHaveLength(2);
    expect(g.smooth).toBe(true);
  });

  it("only curved outlines are smooth", () => {
    const smooth = (k: number) => diagramGeometry(k, { x: 0, y: 0 }, { x: 10, y: 10 })!.smooth;
    expect(smooth(12)).toBe(false);
    expect(smooth(34)).toBe(false);
    expect(smooth(19)).toBe(true);
  });

  it("a reversed drag is the same shape", () => {
    const a = diagramGeometry(13, { x: 0, y: 0 }, { x: 50, y: 40 })!;
    const b = diagramGeometry(13, { x: 50, y: 40 }, { x: 0, y: 0 })!;
    expect(a.outline).toEqual(b.outline);
  });

  it("firm strokes are the clean outline plus each detail", () => {
    const from = { x: 0, y: 0 };
    const to = { x: 100, y: 80 };
    const g = diagramGeometry(15, from, to)!;
    const firm = diagramStrokes(g, from, to, 0, 3);
    expect(firm).toHaveLength(3);
    expect(firm[0]).toEqual({ pts: g.outline, closed: true });
    // Sketchy: still one stroke per piece, now wobbled, and deterministic.
    const a = diagramStrokes(g, from, to, 60, 3);
    const b = diagramStrokes(g, from, to, 60, 3);
    expect(a).toHaveLength(3);
    expect(a).toEqual(b);
    expect(a[0].pts).not.toEqual(g.outline);
  });
});
