// ADR-024 a11.3 — the kill switch, and why the canvas is keyed.
//
// THE PROPERTY. After `transferControlToOffscreen()` a canvas can never return
// its 2D context, so a flip that kept the same element would strand the user on
// a surface nothing can draw to. Keying the <canvas> on the mode means a flip
// remounts it, and the new node was never transferred.
//
// ⚠️ **THIS HEADER CLAIMED THE SWITCH WORKED MID-SESSION, AND IT DID NOT
// (corrected v8.30).** It called `ih_engine_worker=0` a RUNTIME kill switch and
// cited the guardrail-that-cannot-fire pattern as the thing being avoided —
// while being an instance of it. The element half is real; the ENGINE half was
// never built, because nothing migrates `toolRef.current` on a flip. Measured on
// the production build: flipping to `0` mid-session ran the local blit against
// the worker Proxy, `tool.width()` returned a Promise, `new ImageData` threw
// `IndexSizeError` inside render, and React unmounted the tree — `#root` empty,
// the whole app gone.
//
// The truthful property, which the tests below now pin:
//
//   1. the key still differs by mode, so a flip cannot strand a transferred
//      element (that part always worked), and
//   2. a worker-resident document is NEVER drawn down the local path, whatever
//      the flag says — `blitLiveEngine` branches on where the engine lives.
//
// `ih_engine_worker` therefore takes effect on the NEXT LOAD, like every other
// flag here. That is a fine kill switch; a comment promising more is not.
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  blitLiveEngine,
  canvasSurfaceKey,
  createLiveEngine,
  disposeLivePort,
} from "./port";
import type { ImageHorseTool } from "stamp_tool";

// ⚠️ ANCHORED ON THIS FILE, NEVER ON THE LAUNCH DIRECTORY (v8.30). A source-walking
// guard that resolves relative to the launch directory reads ZERO files when
// vitest is started from the repo root — `<repo>/src` is the Rust crate and has
// no `.ts` in it — so `walk()` returns an empty list and every assertion over it
// passes VACUOUSLY. Verified by planting a real violation: from the repo root
// the guard stayed green; from `app/` it caught it.
const APP_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SRC = join(APP_ROOT, "src");
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

// ── The half the old header was missing ──────────────────────────────────────
//
// Keying the element was never enough on its own. The ENGINE does not follow a
// mid-session flip, so the question that decides whether the app survives is
// not "what does the flag say?" but "where does this document actually live?".
//
// This is the regression guard for the crash: flipping to `0` while a
// worker-resident document is open used to run the LOCAL blit against the
// worker Proxy — `tool.width()` returned a Promise, `new ImageData` threw
// `IndexSizeError` inside render, and React unmounted the whole tree.
describe("a worker-resident document is never drawn down the local path", () => {
  /** Enough of a Worker for `EngineWorkerClient.init()` to resolve, plus a
   *  record of the fire-and-forget blits the port sends. */
  function fakeWorkerClass() {
    const blits: number[] = [];
    class FakeWorker {
      onmessage: ((e: { data: unknown }) => void) | null = null;
      onerror: (() => void) | null = null;
      onmessageerror: (() => void) | null = null;
      private listeners: ((e: { data: unknown }) => void)[] = [];
      addEventListener(_t: string, fn: (e: { data: unknown }) => void) {
        this.listeners.push(fn);
      }
      removeEventListener(_t: string, fn: (e: { data: unknown }) => void) {
        this.listeners = this.listeners.filter((l) => l !== fn);
      }
      postMessage(msg: { kind?: string; id?: number }) {
        if (msg?.kind === "blit") blits.push(1);
        if (msg?.kind === "init" || msg?.kind === "reinit") {
          queueMicrotask(() => {
            const e = { data: { id: 0, ok: true, value: { ready: true, surface: ["width"] } } };
            for (const l of [...this.listeners]) l(e);
          });
        }
      }
      terminate() {}
    }
    return { FakeWorker, blits };
  }

  /** A handle that FAILS LOUDLY if the local blit ever touches it. The real
   *  failure was quieter than this — a Promise coerced to `NaN` — but a throw
   *  is what makes the test say which line was wrong. */
  const boobyTrappedTool = {
    width: () => {
      throw new Error("local blit path touched a worker-resident engine");
    },
    height: () => {
      throw new Error("local blit path touched a worker-resident engine");
    },
    recomposite: () => {
      throw new Error("local blit path touched a worker-resident engine");
    },
  } as unknown as ImageHorseTool;

  const deadCanvas = {
    width: 0,
    height: 0,
    getContext: () => {
      // Exactly what a transferred element does.
      throw new Error("InvalidStateError: canvas has transferred its control");
    },
  } as unknown as HTMLCanvasElement;

  afterEach(() => {
    disposeLivePort();
    vi.unstubAllGlobals();
  });

  it("keeps drawing through the worker after the flag is flipped OFF mid-session", async () => {
    withFlag("1");
    const { FakeWorker, blits } = fakeWorkerClass();
    vi.stubGlobal("Worker", FakeWorker);
    const Tool = class {} as unknown as new (w: number, h: number) => ImageHorseTool;
    await createLiveEngine({ Tool, width: 4, height: 4 });

    // The user reaches for the escape hatch. The engine does NOT move.
    withFlag("0");

    expect(() =>
      blitLiveEngine(boobyTrappedTool, deadCanvas, null, { current: null }),
    ).not.toThrow();
    // and it went where the document actually is
    expect(blits.length).toBe(1);
  });

  it("uses the local path when there is no worker, whatever the flag says", async () => {
    // The mirror image, and the reason this branches on the PORT rather than
    // simply always calling the port: a local document flipped to `=1`
    // mid-session must not post into the void and freeze the canvas.
    withFlag("1"); // flag says worker...
    disposeLivePort(); // ...but no worker exists
    let touched = 0;
    const localTool = {
      width: () => {
        touched++;
        return 2;
      },
      height: () => 2,
      recomposite: () => {},
      get_image_data: () => new Uint8Array(2 * 2 * 4),
    } as unknown as ImageHorseTool;
    const ctx = { putImageData: () => {} };
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ctx,
    } as unknown as HTMLCanvasElement;

    try {
      blitLiveEngine(localTool, canvas, null, { current: null });
    } catch {
      // `ImageData` is not a global in vitest's node environment, so the local
      // path cannot finish here. Reaching it at all is the assertion — the
      // question is which branch was taken, not whether node can paint.
    }
    expect(touched, "the local blit path was not taken").toBeGreaterThan(0);
  });
});
