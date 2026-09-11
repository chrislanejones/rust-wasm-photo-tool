import { describe, it, expect } from "vitest";
import { StrokeLeash } from "./strokeLeash";

// Leash lengths mirror src/stabilizer.rs: low 12, med 22, high 36.
const MED = 22;

describe("StrokeLeash", () => {
  it("draws nothing while the cursor is inside the leash", () => {
    const s = new StrokeLeash(MED);
    s.begin(100, 100);
    expect(s.advance(110, 100)).toBeNull();
    expect(s.advance(121, 100)).toBeNull();
  });

  it("a pull past the leash advances to exactly leash-behind the cursor", () => {
    const s = new StrokeLeash(MED);
    s.begin(100, 100);
    const p = s.advance(150, 100)!;
    expect(p.x).toBeCloseTo(128, 9); // 150 - 22
    expect(p.y).toBe(100);
  });

  it("the tip trails by exactly the leash however hard it is pulled", () => {
    for (const dist of [23, 40, 137.5, 1000]) {
      const s = new StrokeLeash(MED);
      s.begin(0, 0);
      const p = s.advance(dist, 0)!;
      expect(dist - p.x).toBeCloseTo(MED, 9);
    }
  });

  // THE TRAP, written down so a third file does not get it wrong.
  it("measures from the TIP, not from the last cursor", () => {
    const s = new StrokeLeash(36);
    s.begin(100, 0);
    s.advance(150, 0); // tip -> 114
    // 145 is 5 back from the last cursor but 31 from the tip: inside 36.
    expect(s.advance(145, 0)).toBeNull();
    // 160 is only 10 past the last cursor but 46 from the tip: outside 36.
    const s2 = new StrokeLeash(36);
    s2.begin(100, 0);
    s2.advance(150, 0);
    expect(s2.advance(160, 0)).not.toBeNull();
  });

  it("flush lands on the true cursor and clears", () => {
    const s = new StrokeLeash(36);
    s.begin(0, 0);
    expect(s.flush(10, 5)).toEqual({ x: 10, y: 5 });
    expect(s.flush(10, 5)).toBeNull();
  });

  it("flush on an already caught-up tip draws nothing", () => {
    const s = new StrokeLeash(36);
    s.begin(4, 4);
    expect(s.flush(4.0005, 4.0005)).toBeNull();
  });

  it("a first move with no begin anchors instead of drawing", () => {
    const s = new StrokeLeash(12);
    expect(s.advance(70, 70)).toBeNull();
    const p = s.advance(200, 70)!;
    expect(p).not.toBeNull();
  });

  it("cancel drops the tip without drawing", () => {
    const s = new StrokeLeash(36);
    s.begin(0, 0);
    s.cancel();
    expect(s.flush(500, 500)).toBeNull();
  });

  it("off is off", () => {
    expect(new StrokeLeash(0).isOn).toBe(false);
    expect(new StrokeLeash(12).isOn).toBe(true);
  });
});
