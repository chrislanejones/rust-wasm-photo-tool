// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { useGalleryLoading, useGalleryTile, GalleryRevealContext, type GalleryLoading } from "./useGalleryLoading";
import { GalleryLoadingRegion } from "./GalleryLoadingRegion";
import type { ThumbImage } from "./useThumbImage";

// UI Night 8 §1 — the gallery loads like Tools. The rules, as a hook:
//
//   · loading = a tile IN VIEW has nothing to show, or an import is in flight
//   · 300 ms of grace (a cached restore shows nothing), then the chrome
//     skeletons; it ends when the last tile in view lands
//   · a 15 s cap unlocks it and logs
//   · one status, read once, with a number frozen at the start
//
// ⚠️ jsdom has no IntersectionObserver. Without a stub every tile counts as in
// view (the hook's documented fallback), which is right for the other tests
// and useless for the off-screen rule — so that one installs a controllable
// stub and drives the intersections by hand.

const logged: string[] = [];

beforeEach(() => {
  logged.length = 0;
  vi.spyOn(console, "warn").mockImplementation((m: string) => void logged.push(m));
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

function setup(opts: { ids?: string[]; imports?: number; mode?: "fill" | "together"; root?: HTMLElement } = {}) {
  const root = opts.root ?? document.createElement("div");
  const hook = renderHook(
    (p: { imports: number }) =>
      useGalleryLoading({ itemIds: opts.ids ?? ["a", "b", "c"], pendingImports: p.imports, mode: opts.mode }),
    { initialProps: { imports: opts.imports ?? 0 } },
  );
  // The root arrives AFTER mount, like the phone grid's scroller after boot.
  act(() => hook.result.current.setRoot(root));
  return hook;
}

describe("loading is past-grace, in-view emptiness", () => {
  it("a restore that decodes inside 300 ms never goes loading", () => {
    const h = setup();
    act(() => {
      for (const id of ["a", "b", "c"]) h.result.current.reportPending(id, true);
    });
    advance(250);
    act(() => {
      for (const id of ["a", "b", "c"]) h.result.current.reportPending(id, false);
    });
    advance(1000);
    expect(h.result.current.loading).toBe(false);
  });

  it("slower than 300 ms: loading, with the empty count frozen at the start", () => {
    const h = setup();
    act(() => {
      for (const id of ["a", "b", "c"]) h.result.current.reportPending(id, true);
    });
    advance(299);
    expect(h.result.current.loading, "still inside the grace").toBe(false);
    advance(2);
    expect(h.result.current.loading).toBe(true);
    expect(h.result.current.announceCount).toBe(3);
    // One lands — the number does NOT count down (said once, not per tile).
    act(() => h.result.current.reportPending("a", false));
    expect(h.result.current.announceCount).toBe(3);
    expect(h.result.current.loading).toBe(true);
  });

  it("ends when the last tile lands (after the short settle), not before", () => {
    const h = setup();
    act(() => {
      for (const id of ["a", "b"]) h.result.current.reportPending(id, true);
    });
    advance(400);
    act(() => h.result.current.reportPending("a", false));
    advance(500);
    expect(h.result.current.loading, "one tile is still empty").toBe(true);
    act(() => h.result.current.reportPending("b", false));
    advance(200);
    expect(h.result.current.loading).toBe(false);
    expect(h.result.current.busy).toBe(false);
  });

  it("a one-commit gap (import tile gone, real tile not reported yet) does not blink", () => {
    const h = setup({ imports: 2 });
    advance(400);
    expect(h.result.current.loading).toBe(true);
    h.rerender({ imports: 0 });
    advance(16);
    expect(h.result.current.loading, "held through the gap").toBe(true);
    act(() => h.result.current.reportPending("c", true));
    advance(100);
    expect(h.result.current.loading).toBe(true);
  });

  it("an import in flight is loading until its files land", () => {
    const h = setup({ imports: 10 });
    advance(301);
    expect(h.result.current.loading).toBe(true);
    expect(h.result.current.announceCount).toBe(10);
    expect(h.result.current.busy).toBe(true);
    h.rerender({ imports: 0 });
    advance(200);
    expect(h.result.current.loading).toBe(false);
  });

  it("an edit (a tile that HAS a picture) never reports pending, so never loads", () => {
    // useThumbImage keeps the previous picture during a regeneration, so the
    // tile's `pending` stays false; the hook only ever hears `false`.
    const h = setup();
    act(() => h.result.current.reportPending("a", false));
    advance(1000);
    expect(h.result.current.loading).toBe(false);
    expect(h.result.current.busy).toBe(false);
  });
});

describe("an off-screen tile does not hold the card hostage", () => {
  it("only tiles the observer says are in view count", () => {
    let fire: ((entries: { target: Element; isIntersecting: boolean }[]) => void) | null = null;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: (e: { target: Element; isIntersecting: boolean }[]) => void) {
          fire = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    const root = document.createElement("div");
    const tiles = ["near", "far"].map((id) => {
      const el = document.createElement("div");
      el.dataset.id = id;
      root.appendChild(el);
      return el;
    });
    const h = setup({ ids: ["near", "far"], root });
    act(() => fire!([{ target: tiles[0]!, isIntersecting: true }, { target: tiles[1]!, isIntersecting: false }]));
    act(() => h.result.current.reportPending("far", true));
    advance(1000);
    expect(h.result.current.loading, "the far tile is empty but out of view").toBe(false);
    expect(h.result.current.busy, "the strip's aria-busy still counts it").toBe(true);
    // Scroll it into view: now it counts.
    act(() => fire!([{ target: tiles[1]!, isIntersecting: true }]));
    advance(301);
    expect(h.result.current.loading).toBe(true);
  });
});

describe("the 15 s cap", () => {
  it("unlocks and logs", () => {
    const h = setup();
    act(() => h.result.current.reportPending("a", true));
    advance(301);
    expect(h.result.current.loading).toBe(true);
    advance(15_000);
    expect(h.result.current.loading).toBe(false);
    expect(h.result.current.capped).toBe(true);
    expect(logged.some((m) => /did not finish loading in 15s/.test(m))).toBe(true);
  });
});

describe("reveal mode 'together'", () => {
  it("holds while loading, at most 1.5 s", () => {
    const h = setup({ mode: "together" });
    act(() => h.result.current.reportPending("a", true));
    advance(301);
    expect(h.result.current.holdReveal).toBe(true);
    advance(1_500);
    expect(h.result.current.holdReveal).toBe(false);
  });

  it("'fill' never holds", () => {
    const h = setup({ mode: "fill" });
    act(() => h.result.current.reportPending("a", true));
    advance(301);
    expect(h.result.current.loading).toBe(true);
    expect(h.result.current.holdReveal).toBe(false);
  });
});

const thumb = (over: Partial<ThumbImage> = {}): ThumbImage => ({
  src: "",
  showSkeleton: false,
  failed: false,
  pending: true,
  ...over,
});

function tileWith(ctx: { regionLoading?: boolean; holdReveal?: boolean; capped?: boolean }) {
  const value = { regionLoading: false, holdReveal: false, capped: false, ...ctx };
  return ({ children }: { children: ReactNode }) => (
    <GalleryRevealContext.Provider value={value}>{children}</GalleryRevealContext.Provider>
  );
}

describe("a tile inside the card", () => {
  it("outside a loading card, an empty tile waits out its own grace", () => {
    const { result } = renderHook(() => useGalleryTile(thumb()), { wrapper: tileWith({}) });
    expect(result.current.showSkeleton).toBe(false);
  });

  it("inside a loading card, an empty tile is a skeleton at once", () => {
    const { result } = renderHook(() => useGalleryTile(thumb()), { wrapper: tileWith({ regionLoading: true }) });
    expect(result.current.showSkeleton).toBe(true);
  });

  it("a decoded tile keeps its photo while the card loads", () => {
    const { result } = renderHook(() => useGalleryTile(thumb({ src: "blob:x", pending: false })), {
      wrapper: tileWith({ regionLoading: true }),
    });
    expect(result.current.src).toBe("blob:x");
    expect(result.current.showSkeleton).toBe(false);
  });

  it("'together': a tile mounted empty during the hold stays a skeleton once decoded", () => {
    const { result, rerender } = renderHook((t: ThumbImage) => useGalleryTile(t), {
      initialProps: thumb(),
      wrapper: tileWith({ regionLoading: true, holdReveal: true }),
    });
    rerender(thumb({ src: "blob:x", pending: false }));
    expect(result.current.src).toBe("");
    expect(result.current.showSkeleton).toBe(true);
  });

  it("past the cap, a tile still waiting shows its error, not a skeleton for ever", () => {
    const { result } = renderHook(() => useGalleryTile(thumb({ showSkeleton: true })), {
      wrapper: tileWith({ capped: true }),
    });
    expect(result.current.failed).toBe(true);
    expect(result.current.showSkeleton).toBe(false);
  });
});

describe("the region", () => {
  const state = (over: Partial<GalleryLoading> = {}): GalleryLoading => ({
    setRoot: () => {},
    reportPending: () => {},
    busy: true,
    loading: true,
    holdReveal: false,
    capped: false,
    announceCount: 12,
    ...over,
  });

  it("carries the skeleton attribute and ONE status while loading", () => {
    const { container, getAllByRole } = render(
      <GalleryLoadingRegion state={state()}>
        <div>chrome</div>
      </GalleryLoadingRegion>,
    );
    expect(container.firstElementChild!.getAttribute("data-skeleton-region")).toBe("gallery");
    expect(getAllByRole("status")).toHaveLength(1);
    expect(getAllByRole("status")[0]!.textContent).toBe("Loading 12 photos…");
  });

  it("says nothing and carries nothing at rest", () => {
    const { container, queryAllByRole } = render(
      <GalleryLoadingRegion state={state({ loading: false })}>
        <div>chrome</div>
      </GalleryLoadingRegion>,
    );
    expect(container.firstElementChild!.hasAttribute("data-skeleton-region")).toBe(false);
    expect(queryAllByRole("status")).toHaveLength(0);
  });

  it("one photo is a photo", () => {
    const { getByRole } = render(
      <GalleryLoadingRegion state={state({ announceCount: 1 })}>
        <div />
      </GalleryLoadingRegion>,
    );
    expect(getByRole("status").textContent).toBe("Loading 1 photo…");
  });
});
