// ADR-024 a11.1 — canvas mount/unmount bookkeeping.
//
// The behaviour under test is small, and every assertion here exists because
// getting it wrong breaks a11.2 in a specific way:
//
//   generation must advance on a NEW element   -> otherwise a stale handle is
//                                                 indistinguishable from a live one
//   generation must NOT advance on a re-attach -> otherwise ordinary re-renders
//                                                 look like remounts and a11.2
//                                                 rejects every draw
//   the sink must stay populated               -> the whole app reads
//                                                 canvasRef.current
//
// Element identity is modelled with plain objects: this is pure bookkeeping and
// vitest runs in the `node` environment, so there is no DOM and none is needed.
import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvasIdentity, assignRef } from "./canvasIdentity";

/** Stands in for an HTMLCanvasElement — only identity matters. */
const el = (name: string) => ({ name });

function setup() {
  const sink: { current: ReturnType<typeof el> | null } = { current: null };
  const onMount = vi.fn();
  const onUnmount = vi.fn();
  const id = createCanvasIdentity(sink, { onMount, onUnmount });
  return { sink, onMount, onUnmount, id };
}

describe("canvas identity", () => {
  it("starts at generation 0 with nothing mounted", () => {
    const { id, sink } = setup();
    // 0 is load-bearing: a11.2 treats a draw tagged 0 as always stale, because
    // there is no element it could refer to.
    expect(id.generation()).toBe(0);
    expect(id.current()).toBeNull();
    expect(sink.current).toBeNull();
  });

  it("advances the generation and populates the sink on mount", () => {
    const { id, sink, onMount } = setup();
    const a = el("a");

    id.attach(a);

    expect(id.generation()).toBe(1);
    expect(id.current()).toBe(a);
    expect(sink.current).toBe(a);
    expect(onMount).toHaveBeenCalledWith(a, 1);
  });

  it("reports the DEAD generation on unmount, not the next one", () => {
    const { id, sink, onUnmount } = setup();
    id.attach(el("a"));

    id.attach(null);

    // The consumer needs to know which handle just died. Reporting the
    // post-increment value would name an element that does not exist yet.
    expect(onUnmount).toHaveBeenCalledWith(1);
    expect(id.current()).toBeNull();
    expect(sink.current).toBeNull();
  });

  it("gives each element its own generation across a remount", () => {
    const { id, onMount, onUnmount } = setup();
    const a = el("a");
    const b = el("b");

    id.attach(a);
    id.attach(null);
    id.attach(b);

    expect(id.generation()).toBe(2);
    expect(onMount.mock.calls).toEqual([
      [a, 1],
      [b, 2],
    ]);
    expect(onUnmount.mock.calls).toEqual([[1]]);
  });

  it("handles a swap with no null in between", () => {
    // React usually calls a callback ref with null before the new element, but
    // it is not guaranteed across every path — a direct swap must still close
    // out the old generation rather than leak it as still-live.
    const { id, onMount, onUnmount } = setup();
    const a = el("a");
    const b = el("b");

    id.attach(a);
    id.attach(b);

    expect(onUnmount.mock.calls).toEqual([[1]]);
    expect(onMount.mock.calls).toEqual([
      [a, 1],
      [b, 2],
    ]);
    expect(id.generation()).toBe(2);
  });

  it("DOES NOT advance the generation when the same element re-attaches", () => {
    // The assertion this module exists to satisfy. React re-invokes a callback
    // ref whenever the callback's identity changes, and CanvasArea re-renders
    // constantly. If those counted, the generation would be meaningless within
    // a frame and a11.2 would reject live draws.
    const { id, onMount, onUnmount } = setup();
    const a = el("a");

    id.attach(a);
    id.attach(a);
    id.attach(a);

    expect(id.generation()).toBe(1);
    expect(onMount).toHaveBeenCalledTimes(1);
    expect(onUnmount).not.toHaveBeenCalled();
  });

  it("ignores a repeated unmount", () => {
    const { id, onUnmount } = setup();
    id.attach(el("a"));

    id.attach(null);
    id.attach(null);

    expect(onUnmount).toHaveBeenCalledTimes(1);
  });

  it("survives an unmount before anything ever mounted", () => {
    const { id, onUnmount, sink } = setup();

    id.attach(null);

    expect(onUnmount).not.toHaveBeenCalled();
    expect(id.generation()).toBe(0);
    expect(sink.current).toBeNull();
  });
});

describe("assignRef", () => {
  it("writes through an object ref", () => {
    const ref = { current: null as { name: string } | null };
    const a = el("a");
    assignRef(ref, a);
    expect(ref.current).toBe(a);
    assignRef(ref, null);
    expect(ref.current).toBeNull();
  });

  it("calls a function ref", () => {
    // forwardRef permits both styles. CanvasArea assumes the object form (it
    // casts at :460) and AppShell does pass one, but assuming it here would
    // silently drop the element for any future caller that passes a callback.
    const fn = vi.fn();
    const a = el("a");
    assignRef(fn, a);
    expect(fn).toHaveBeenCalledWith(a);
  });

  it("does nothing for a missing ref", () => {
    expect(() => assignRef(undefined, el("a"))).not.toThrow();
    expect(() => assignRef(null, el("a"))).not.toThrow();
  });
});

describe("ownership — the counter must outlive what it counts", () => {
  // THIS GUARD EXISTS BECAUSE THE FIRST BUILD GOT IT WRONG, and every other
  // gate passed: tsc, lint, 439 unit tests, production build. The bookkeeping
  // above was correct; its OWNER was not. `useCanvasIdentity` was called inside
  // `CanvasArea`, which is rendered in both arms of AppShell's
  // `activeTool === "emoji"` ternary — so crossing the Batch boundary destroys
  // the component and the counter with it. The browser showed five distinct
  // canvas elements and a generation still reading 1.
  //
  // A generation that resets on remount is worse than none: a11.2 would treat
  // every fresh element as "generation 1" and be unable to tell a live handle
  // from a dead one, which is precisely the check it exists to perform.
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

  it("is called from exactly one place, and that place is AppShell", () => {
    const callers = walk(SRC)
      .filter((f) => !f.endsWith("canvasIdentity.ts"))
      // The regex matches the GENERIC form too. The first version of this
      // guard used `.includes("useCanvasIdentity(")` and matched nothing,
      // because the real call is `useCanvasIdentity<HTMLCanvasElement>(...)` —
      // a type argument sits between the name and the paren. Fifth detector on
      // this arc defeated by syntax, and the only self-inflicted one. A guard
      // that matches nothing fails loudly here, but would have passed silently
      // had the expectation been "not CanvasArea" instead of "exactly AppShell".
      .filter((f) =>
        readFileSync(f, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\/\/.*$/gm, "")
          .search(/useCanvasIdentity\s*(?:<[^>]*>)?\s*\(/) !== -1,
      )
      .map((f) => f.split("/src/")[1]);

    expect(
      callers,
      "useCanvasIdentity must be called once, from a component that does NOT " +
        "remount when the canvas does. AppShell qualifies; CanvasArea does not " +
        "— it is rendered in both arms of the activeTool === 'emoji' ternary, " +
        "so it is destroyed by the very event the generation counts.",
    ).toEqual(["app/AppShell.tsx"]);
  });
});
