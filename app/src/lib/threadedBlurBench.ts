// app/src/lib/threadedBlurBench.ts
//
// Diagnostics-only microbench for the rayon-parallel blur kernel
// (feat/rayon-parallel-blur, Task D). Lets the Resources diagnostics panel
// measure the REAL in-browser speedup once a wasm build compiled with
// `--features threads` (nightly + `-Z build-std` + atomics) is served under
// COOP/COEP response headers — none of which this session ships (see
// SESSION_LOG.md on this branch + the forthcoming ADR). Enabling those is a
// separate, later, human decision; this hook is inert until it is made:
//
//   1. `crossOriginIsolated` must be true — requires COOP: same-origin +
//      COEP: credentialless (or require-corp) response headers, which are
//      NOT set anywhere in this repo today (checked: no `_headers`/
//      `netlify.toml` entry, no `vercel.json` header, dev server unheadered).
//   2. The loaded `stamp_tool` wasm module must actually export
//      `bench_blur_threaded` — only true for a wasm-pack build compiled with
//      `--features threads`, which is not what `pnpm run build:wasm` (the
//      default, shipped build) produces.
//
// Both are feature-detected at call time rather than assumed, so this stays
// safe to wire into the UI today: on the currently-shipped build it always
// reports "unavailable" with an honest reason, never throws, never blocks.

export type ThreadedBlurBenchResult =
  | { available: false; reason: string }
  | {
      available: true;
      ms: number;
      width: number;
      height: number;
      radius: number;
      threads: number;
    };

const DEFAULT_WIDTH = 2048;
const DEFAULT_HEIGHT = 2048;
const DEFAULT_RADIUS = 8;

/** Shape of the wasm module's export object when (and only when) it was
 *  compiled with `--features threads`. Deliberately NOT part of the
 *  hand-maintained `stamp_tool.d.ts` ambient module (that file describes the
 *  default build's surface) — every use here is feature-detected via
 *  `typeof`, never assumed present. */
interface ThreadedWasmExports {
  bench_blur_threaded?: (width: number, height: number, radius: number) => number;
  initThreadPool?: (numThreads: number) => Promise<void>;
}

/**
 * Run the threaded-blur microbench, or explain why it can't run. Timing is
 * measured here (`performance.now()`), not inside wasm — the Rust export
 * deliberately does no timing itself (see `bench_blur_threaded` in lib.rs).
 */
export async function runThreadedBlurBench(
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  radius = DEFAULT_RADIUS,
): Promise<ThreadedBlurBenchResult> {
  if (typeof crossOriginIsolated === "undefined" || !crossOriginIsolated) {
    return { available: false, reason: "threads unavailable — headers off" };
  }

  const mod = (await import("stamp_tool")) as unknown as ThreadedWasmExports & {
    default: () => Promise<unknown>;
  };
  await mod.default();

  if (typeof mod.bench_blur_threaded !== "function") {
    return {
      available: false,
      reason: "threads unavailable — wasm build lacks the threads feature",
    };
  }

  if (typeof mod.initThreadPool === "function") {
    await mod.initThreadPool(navigator.hardwareConcurrency || 4);
  }

  const t0 = performance.now();
  mod.bench_blur_threaded(width, height, radius);
  const ms = performance.now() - t0;

  return {
    available: true,
    ms,
    width,
    height,
    radius,
    threads: navigator.hardwareConcurrency || 1,
  };
}
