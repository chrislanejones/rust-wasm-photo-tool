// ===== FILE: app/src/lib/engine/enginePort.proxy.test.ts =====
//
// ADR-024 a12.0 — the main-thread handle for a worker-resident engine.
//
// The proxy itself is three lines of forwarding. What needs proving is the
// thing that is NOT obvious: it must expose only the methods the engine really
// has, because four subsystems in this app decide whether they are available at
// all by asking `typeof t.someMethod === "function"`.
//
//   hasPatchmatchExports    remove_object
//   hasTilesExports         tiles_flush
//   hasMagicEraserExports   magic_eraser_brush_down
//   hasPersistExports       oplog_encoded_ops
//
// An open proxy answers YES to every one of those on every build, including the
// default wasm that has none of them. The failure is not a type error and not a
// crash at flip time — it is a call routed into an engine that cannot serve it,
// discovered later and somewhere else.
import { describe, it, expect, vi } from "vitest";
import { createEngineProxy, type EngineCallPort } from "./port";

/** A port with a fixed surface and a spy on `call`. */
function fakePort(names: string[]) {
  const call = vi.fn(async (method: string, args: unknown[] = []) => ({ method, args }));
  const port: EngineCallPort = { call: call as EngineCallPort["call"], surface: new Set(names) };
  return { port, call };
}

/** The four real feature detections, copied in shape from their own modules so
 *  this test fails if the proxy stops satisfying them. */
const DETECTIONS: Record<string, string> = {
  patchmatch: "remove_object",
  tiles: "tiles_flush",
  magicEraser: "magic_eraser_brush_down",
  oplogPersist: "oplog_encoded_ops",
};

describe("createEngineProxy — the surface gate", () => {
  it("exposes a callable function for a method the engine has", () => {
    const { port } = fakePort(["width", "undo"]);
    const t = createEngineProxy(port) as unknown as Record<string, unknown>;
    expect(typeof t.width).toBe("function");
    expect(typeof t.undo).toBe("function");
  });

  it("returns undefined for a method the engine does NOT have", () => {
    // The whole point. An open proxy returns a function here and every feature
    // detection in the app flips to true on a build that cannot serve it.
    const { port } = fakePort(["width"]);
    const t = createEngineProxy(port) as unknown as Record<string, unknown>;
    expect(t.remove_object).toBeUndefined();
    expect(typeof t.remove_object).toBe("undefined");
  });

  it("satisfies each real feature detection only when the surface carries it", () => {
    for (const [subsystem, method] of Object.entries(DETECTIONS)) {
      const absent = createEngineProxy(fakePort(["width"]).port) as unknown as Record<
        string,
        unknown
      >;
      const present = createEngineProxy(
        fakePort(["width", method]).port,
      ) as unknown as Record<string, unknown>;
      expect(typeof absent[method], `${subsystem} must be OFF without ${method}`).toBe(
        "undefined",
      );
      expect(typeof present[method], `${subsystem} must be ON with ${method}`).toBe(
        "function",
      );
    }
  });

  it("an EMPTY surface exposes nothing — fails loudly, never silently forwards", () => {
    // `workerClient` leaves the set empty when a worker reports no surface (an
    // older build, or a fake). Exposing everything in that case would be the
    // worst outcome: silent forwarding of methods that may not exist.
    const t = createEngineProxy(fakePort([]).port) as unknown as Record<string, unknown>;
    expect(t.width).toBeUndefined();
    expect(t.remove_object).toBeUndefined();
  });

  it("forwards the call with its method name and arguments", async () => {
    const { port, call } = fakePort(["magic_wand_select"]);
    const t = createEngineProxy(port) as unknown as Record<
      string,
      (...a: unknown[]) => Promise<unknown>
    >;
    await t.magic_wand_select(10, 20, 30);
    expect(call).toHaveBeenCalledWith("magic_wand_select", [10, 20, 30]);
  });

  it("returns a STABLE function identity per method", async () => {
    // These handlers land in React dependency arrays (`useEffectiveTool` routes
    // whole handler sets by identity). A fresh closure per property access
    // would make every memo downstream miss on every render.
    const { port } = fakePort(["width"]);
    const t = createEngineProxy(port) as unknown as Record<string, unknown>;
    expect(t.width).toBe(t.width);
  });

  it("answers `in` and enumerates the surface, like a real handle", () => {
    const { port } = fakePort(["width", "height"]);
    const t = createEngineProxy(port) as unknown as object;
    expect("width" in t).toBe(true);
    expect("remove_object" in t).toBe(false);
    expect(Object.keys(t).sort()).toEqual(["height", "width"]);
  });

  it("every method returns a Promise, which is what makes the call sites shared", async () => {
    // Stage 3.5 + a10 converted all 113 value-consuming sites to `await`, and
    // `await` is transparent over a plain value — so the same call site works
    // against a local engine and this proxy with no branch. That property is
    // the reason the migration was worth doing, so pin it.
    const { port } = fakePort(["width"]);
    const t = createEngineProxy(port) as unknown as Record<string, () => unknown>;
    const r = t.width();
    expect(r).toBeInstanceOf(Promise);
    await r;
  });
});
