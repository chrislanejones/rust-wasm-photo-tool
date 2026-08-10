// ADR-024 a11.3 — the runtime kill switch, and why the canvas is keyed.
//
// THE PROPERTY. `ih_engine_worker=0` is specified as a RUNTIME kill switch.
// After `transferControlToOffscreen()` a canvas can never return its 2D
// context, so flipping the flag mid-session cannot restore the main-thread path
// on the element that was transferred. Keying the <canvas> on the mode means a
// flip remounts it, and the new node was never transferred.
//
// A kill switch that only works on reload is the guardrail-that-cannot-fire
// pattern, and this repo has shipped that shape before. Hence a test rather
// than a comment.
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { canvasSurfaceKey } from "./port";

const SRC = join(process.cwd(), "src");
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e) && !e.endsWith(".d.ts")) out.push(p);
  }
  return out;
}
const code = (f: string) =>
  readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

function withFlag(value: string | null) {
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (k === "ih_engine_worker" ? value : null),
  });
}

describe("canvasSurfaceKey", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("differs between the two engine modes", () => {
    // THE WHOLE POINT. Equal keys mean React reuses the element, the flip does
    // not remount, and a transferred canvas stays transferred — the kill switch
    // silently does nothing.
    withFlag("1");
    const on = canvasSurfaceKey();
    withFlag("0");
    const off = canvasSurfaceKey();
    expect(on).not.toBe(off);
  });

  it("is stable while the flag does not move", () => {
    // Ordinary use must see exactly the reconciliation it saw before a11.3. A
    // key that varied per call would remount the canvas on every render, which
    // would be a live-render regression wearing plumbing's clothes.
    withFlag("0");
    expect(canvasSurfaceKey()).toBe(canvasSurfaceKey());
    withFlag("1");
    expect(canvasSurfaceKey()).toBe(canvasSurfaceKey());
  });

  it("treats anything other than \"1\" as off, including a missing flag", () => {
    withFlag(null);
    const missing = canvasSurfaceKey();
    withFlag("0");
    expect(canvasSurfaceKey()).toBe(missing);
    withFlag("true"); // not the house convention — must not enable
    expect(canvasSurfaceKey()).toBe(missing);
  });

  it("survives storage throwing, without changing key identity", () => {
    // Partitioned or blocked storage throws on getItem. `engineWorkerEnabled`
    // already treats that as off; the key must agree, or a privacy-mode tab
    // would remount its canvas on every render.
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
    });
    const a = canvasSurfaceKey();
    expect(a).toBe(canvasSurfaceKey());
    withFlag("0");
    expect(canvasSurfaceKey()).toBe(a);
  });

  it("returns an opaque token, not the flag value", () => {
    // A caller must not be able to read behaviour out of it. `"1"`/`"0"` or a
    // boolean would invite `if (key === "1")`, which is the branching the
    // async-migration contract forbids.
    withFlag("1");
    expect(["1", "0", "true", "false"]).not.toContain(canvasSurfaceKey());
  });
});

describe("the canvas is actually keyed on it", () => {
  it("CanvasArea keys the <canvas> element", () => {
    // The function existing proves nothing; it has to be applied. Without the
    // key on the element, every test above passes and the kill switch is still
    // broken.
    const s = code(join(SRC, "features/canvas/CanvasArea.tsx"));
    // Accepts the once-per-render local. The key and the re-blit effect must
    // read the SAME value: two separate `canvasSurfaceKey()` calls could
    // straddle a flip and leave the element and the effect disagreeing.
    expect(s, "the main <canvas> must be keyed on the engine mode").toMatch(
      /key=\{(canvasSurfaceKey\(\)|surfaceKey)\}/,
    );
    expect(s, "the key must be derived from the port's token").toContain("canvasSurfaceKey()");
    // On the element that is transferred, not some wrapper — a keyed <div>
    // around it would remount the wrapper and reuse the canvas.
    const keyAt = s.search(/key=\{(canvasSurfaceKey\(\)|surfaceKey)\}/);
    const canvasAt = s.lastIndexOf("<canvas", keyAt);
    const closeAt = s.indexOf(">", keyAt);
    expect(canvasAt, "the key must sit on a <canvas> tag").toBeGreaterThan(-1);
    expect(
      s.slice(canvasAt, closeAt),
      "the key must be inside the <canvas> element's own props",
    ).toMatch(/key=\{(canvasSurfaceKey\(\)|surfaceKey)\}/);
  });

  it("the re-blit effect reacts to the key", () => {
    // FOUND BY THE BROWSER, not by any gate. Keying the <canvas> remounts the
    // ELEMENT but not the COMPONENT, so CanvasArea's effects do not re-run —
    // every other dep is unchanged across a flip and `canvasRef` is a stable
    // ref object. Without the key in this dep array the flip produced a fresh,
    // empty canvas that nothing ever painted: generation advanced 1 -> 2 and
    // the element went blank. The silent blank a11 exists to prevent, arriving
    // early by a different route.
    const s = code(join(SRC, "features/canvas/CanvasArea.tsx"));
    const effect = s.indexOf("flushToCanvas();");
    expect(effect).toBeGreaterThan(-1);
    const deps = s.slice(effect, s.indexOf("]);", effect) + 3);
    expect(
      deps,
      "the re-blit effect must depend on the surface key, or a flag flip " +
        "leaves a fresh canvas that nothing paints",
    ).toMatch(/surfaceKey|canvasSurfaceKey/);
  });

  it("no component reads the flag directly to build the key", () => {
    // Same invariant `engineAsyncMigration.contract.test.ts` enforces, asserted
    // here too because a11.3 is exactly the change most tempted to break it:
    // the obvious implementation is `key={engineWorkerEnabled() ? ... : ...}`
    // in the component.
    const offenders = walk(SRC)
      .filter((f) => !f.includes("/lib/engine/port.ts") && !f.includes("/lib/featureFlags.ts"))
      .filter((f) => /ih_engine_worker|engineWorkerEnabled/.test(code(f)))
      .map((f) => f.split("/src/")[1]);
    expect(
      offenders,
      "the flag belongs in port.ts. Callers take the opaque key instead — a " +
        "component that knows which engine is live can diverge from the other one.",
    ).toEqual([]);
  });
});
