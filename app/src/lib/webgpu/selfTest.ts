// The correctness harness. This is the point of Phase 0 — a shader that looks
// blurry proves nothing, so this compares the GPU output against the CPU oracle
// pixel by pixel and reports the worst disagreement.
//
// It cannot be a vitest test: there is no WebGPU in jsdom or node, so the only
// honest place to run it is a real browser on real hardware. It is exposed on
// `window` (dev builds, or with the `ih_webgpu` switch on) and reports a
// structured result rather than logging prose:
//
//   await window.__ihGpuBlurSelfTest()
//
// PASS means maxDelta === 0 — byte-identical to the CPU path. Anything above 0
// is a real disagreement and blocks the speed work, because a GPU renderer that
// is "close enough" makes the same document look different depending on which
// path drew it.

import { gaussianBlurCpu, setEngineKernel, hasEngineKernel } from "./blurReference";
import { gaussianBlurGpu, __resetGpuBlurContextForTest } from "./gpuBlur";
import { probeWebGpu } from "./detect";

export interface CaseResult {
  name: string;
  width: number;
  height: number;
  intensity: number;
  /** Largest absolute per-channel difference. 0 = byte-identical. */
  maxDelta: number;
  /** How many of the w*h*4 channels differ at all. */
  differingChannels: number;
  totalChannels: number;
  cpuMs: number;
  gpuMs: number;
  pass: boolean;
  /** First few disagreements, for debugging a non-zero delta. */
  samples: Array<{ index: number; x: number; y: number; channel: string; cpu: number; gpu: number }>;
}

export interface SelfTestReport {
  adapter: string;
  /** "engine" = exact. "ported" = the fround fallback, which cannot be
   *  bit-exact (`f32::exp`), so a non-zero delta may be the KERNEL rather than
   *  the shader. A report that does not say which was used is not evidence. */
  kernelSource: "engine" | "ported";
  cases: CaseResult[];
  pass: boolean;
}

/** Deterministic pseudo-random image — no Math.random, so a failure reproduces. */
function makeImage(w: number, h: number, seed: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  let s = seed >>> 0;
  const next = () => {
    // xorshift32
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s;
  };
  for (let i = 0; i < px.length; i += 4) {
    const v = next();
    px[i] = v & 0xff;
    px[i + 1] = (v >> 8) & 0xff;
    px[i + 2] = (v >> 16) & 0xff;
    // Include non-opaque alpha: the engine blurs the alpha channel too, and a
    // shader that quietly forces 255 would pass an opaque-only test.
    px[i + 3] = (v >> 24) & 0xff;
  }
  return px;
}

/** A hard edge in both axes — where clamp-to-edge and rounding disagree first. */
function makeEdgeImage(w: number, h: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const on = x < w / 2 !== y < h / 2;
      px[i] = on ? 255 : 0;
      px[i + 1] = on ? 0 : 255;
      px[i + 2] = on ? 128 : 127; // straddles a .5 rounding boundary
      px[i + 3] = 255;
    }
  }
  return px;
}

async function runCase(
  name: string,
  px: Uint8ClampedArray,
  w: number,
  h: number,
  intensity: number,
): Promise<CaseResult> {
  const c0 = performance.now();
  const cpu = gaussianBlurCpu(px, w, h, intensity);
  const cpuMs = performance.now() - c0;

  const { pixels: gpu, elapsedMs: gpuMs } = await gaussianBlurGpu(px, w, h, intensity);

  let maxDelta = 0;
  let differing = 0;
  const samples: CaseResult["samples"] = [];
  const chan = ["r", "g", "b", "a"];
  for (let i = 0; i < cpu.length; i++) {
    const d = Math.abs(cpu[i] - gpu[i]);
    if (d !== 0) {
      differing++;
      if (d > maxDelta) maxDelta = d;
      if (samples.length < 8) {
        const p = i >> 2;
        samples.push({ index: i, x: p % w, y: Math.floor(p / w), channel: chan[i & 3], cpu: cpu[i], gpu: gpu[i] });
      }
    }
  }
  return {
    name, width: w, height: h, intensity,
    maxDelta, differingChannels: differing, totalChannels: cpu.length,
    cpuMs: Math.round(cpuMs * 100) / 100,
    gpuMs: Math.round(gpuMs * 100) / 100,
    pass: maxDelta === 0,
    samples,
  };
}

/**
 * Run the whole battery. Small images on purpose — the CPU oracle is
 * intentionally unoptimised, and correctness lives at the edges and in the
 * rounding, not at scale.
 */
// Not exported: `installGpuBlurSelfTest` below is the only caller, and it is in
// this file. Dropping the keyword is what makes the `dead-exports` count HONESTLY
// zero — the audit had stopped flagging it because a comment in blurReference.ts
// happens to spell the name, and that audit counts a name in prose as a
// reference (see PARKING_LOT). Banking that as an improvement would have locked
// in a number that reverts the moment someone rewords a comment.
async function gpuBlurSelfTest(): Promise<SelfTestReport> {
  const status = await probeWebGpu();
  if (!status.ok) {
    return {
      adapter: `unavailable: ${status.reason}`,
      kernelSource: hasEngineKernel() ? "engine" : "ported",
      cases: [],
      pass: false,
    };
  }
  // THE KERNEL COMES FROM THE ENGINE, not from a port — `f32::exp` has no
  // JavaScript equivalent, so a ported kernel drifts by 1 LSB on long kernels
  // and no amount of `Math.fround` closes it. See blurReference.ts's header.
  // Without this the report still runs, and says so, because a delta measured
  // against an approximate kernel is not evidence about the shader.
  try {
    const mod = (await import("stamp_tool")) as unknown as {
      default: () => Promise<void>;
      gaussian_kernel: (r: number) => Float32Array;
    };
    await mod.default();
    if (typeof mod.gaussian_kernel === "function") {
      setEngineKernel((r) => mod.gaussian_kernel(r));
    }
  } catch {
    // Left unwired on purpose — `kernelSource` below reports which was used.
  }

  const cases: CaseResult[] = [];
  // radius 1 — the smallest kernel, where an off-by-one in the span shows up
  cases.push(await runCase("noise 64x64 r1", makeImage(64, 64, 0x1234_5678), 64, 64, 1));
  // a middling radius on a non-square image — catches width/height transposition
  cases.push(await runCase("noise 61x37 r5", makeImage(61, 37, 0x9e37_79b9), 61, 37, 5));
  // hard edges + a .5 rounding straddle
  cases.push(await runCase("edges 48x48 r3", makeEdgeImage(48, 48), 48, 48, 3));
  // radius wider than the image — every tap clamps
  cases.push(await runCase("tiny 5x5 r12 (all-clamp)", makeImage(5, 5, 0xdead_beef), 5, 5, 12));
  // the documented ceiling
  cases.push(await runCase("noise 40x40 r30 (max)", makeImage(40, 40, 0x0bad_f00d), 40, 40, 30));

  // ── PAST 64x64, which is where this harness used to stop ──────────────────
  //
  // ⚠️ EVERY CASE ABOVE IS 64x64 OR SMALLER, AND THAT WAS THE BUG. The oracle
  // accumulated at f64 while the crate accumulates at f32, and the disagreement
  // is a ~15-per-megapixel tie-break — so at 16,384 channels it simply never
  // fired. This harness reported "max channel delta 0" for its whole life while
  // the real divergence sat one size step away. A correctness harness whose
  // largest case is the largest size at which the bug is invisible is not a
  // harness.
  //
  // These are slow (the oracle is deliberately unoptimised) and they are worth
  // it: 512² is 1,048,576 channels, two orders of magnitude past the old
  // ceiling, and radius 30 there is where the kernel-length error concentrates.
  cases.push(await runCase("noise 512x512 r5", makeImage(512, 512, 0x8577_1b3d), 512, 512, 5));
  cases.push(await runCase("noise 512x512 r30", makeImage(512, 512, 0x51de_57ab), 512, 512, 30));

  return {
    adapter: status.adapterInfo,
    kernelSource: hasEngineKernel() ? "engine" : "ported",
    cases,
    pass: cases.every((c) => c.pass),
  };
}

/**
 * Device-loss recovery. The device and pipeline are cached across calls now,
 * and a cache with no loss handling is strictly worse than acquiring per call —
 * a lost device would fail every subsequent blur. `device.destroy()` resolves
 * `device.lost`, which is the only way to exercise that path deliberately.
 *
 * Returns the same case run three times: warm (device cached), after the device
 * is destroyed, and again. All three must be byte-identical to the CPU oracle,
 * and the middle one is the one that would throw if the cache were not cleared.
 */
async function gpuBlurLostDeviceTest(): Promise<{
  adapter: string;
  runs: Array<{ label: string; maxDelta: number; ms: number; pass: boolean }>;
  pass: boolean;
}> {
  const status = await probeWebGpu();
  if (!status.ok) return { adapter: `unavailable: ${status.reason}`, runs: [], pass: false };
  const px = makeImage(61, 37, 0x9e37_79b9);
  const cpu = gaussianBlurCpu(px, 61, 37, 5);
  const once = async (label: string) => {
    const t = performance.now();
    const { pixels } = await gaussianBlurGpu(px, 61, 37, 5);
    const ms = Math.round((performance.now() - t) * 100) / 100;
    let maxDelta = 0;
    for (let i = 0; i < cpu.length; i++) maxDelta = Math.max(maxDelta, Math.abs(cpu[i] - pixels[i]));
    return { label, maxDelta, ms, pass: maxDelta === 0 };
  };
  const runs = [await once("warm")];
  __resetGpuBlurContextForTest(); // destroys the device -> resolves device.lost
  runs.push(await once("after device destroyed"));
  runs.push(await once("warm again"));
  return { adapter: status.adapterInfo, runs, pass: runs.every((r) => r.pass) };
}

/**
 * The GPU blur against the REAL ENGINE, through the exact call sequence
 * `useTransforms.applyGlobalBlur` uses.
 *
 * ⚠️ WHY THIS EXISTS SEPARATELY FROM `gpuBlurSelfTest`. That one compares the
 * shader against `blurReference.ts` — a faithful JS PORT of the Rust. A port is
 * an oracle, not the thing itself, and ADR-030's whole pre-mortem is that the
 * port and the engine drift with nothing to catch it. This compares against
 * `stamp_tool` itself: same document, same intensity, one document blurred by
 * `blur_whole_image` and one by the hand-off pair, then the two layer buffers
 * differenced. If the port ever drifts from the crate, this notices and that
 * one does not.
 *
 * It is also the only check that covers the HAND-OFF: `active_layer_rgba` must
 * return the layer and not the composite, and `apply_blurred_layer_rgba` must
 * land on the same buffer `blur_whole_image` writes. A shader that is perfect
 * and a hand-off that reads the composite produce a beautiful wrong answer.
 *
 * The engine is imported lazily so this costs nothing unless it is called.
 */
async function gpuBlurEngineParity(
  width = 512,
  height = 512,
  intensity = 5,
): Promise<{
  adapter: string;
  width: number;
  height: number;
  intensity: number;
  maxDelta: number;
  differingBytes: number;
  cpuMs: number;
  gpuMs: number;
  speedup: number;
  pass: boolean;
  note?: string;
  samples?: Array<{ x: number; y: number; ch: number; cpu: number; gpu: number; edgeDist: number }>;
  oracleVsEngineMax?: number;
  oracleVsEngineBytes?: number;
  oracleVsGpuMax?: number;
  verdict?: string;
  minEdgeDist?: number;
  maxEdgeDist?: number;
}> {
  const fail = (note: string) => ({
    adapter: "n/a",
    width,
    height,
    intensity,
    maxDelta: -1,
    differingBytes: -1,
    cpuMs: -1,
    gpuMs: -1,
    speedup: -1,
    pass: false,
    note,
  });
  const status = await probeWebGpu();
  if (!status.ok) return fail(`WebGPU unavailable: ${status.reason}`);

  const mod = (await import("stamp_tool")) as unknown as {
    default: () => Promise<void>;
    ImageHorseTool: new (w: number, h: number) => Record<string, (...a: never[]) => never>;
  };
  await mod.default();

  const seedImage = makeImage(width, height, 0x8577_1b3d);
  const make = () => {
    const t = mod.ImageHorseTool ? new mod.ImageHorseTool(width, height) : null;
    if (!t) return null;
    (t as unknown as { load_image: (p: Uint8Array) => void }).load_image(
      new Uint8Array(seedImage.buffer, seedImage.byteOffset, seedImage.length),
    );
    return t as unknown as {
      blur_whole_image: (i: number) => void;
      active_layer_rgba: () => Uint8Array;
      apply_blurred_layer_rgba: (p: Uint8Array) => boolean;
      free?: () => void;
    };
  };

  const cpuTool = make();
  const gpuTool = make();
  if (!cpuTool || !gpuTool) return fail("could not construct ImageHorseTool");
  if (typeof gpuTool.active_layer_rgba !== "function") {
    return fail("engine has no active_layer_rgba — build:wasm after the Rust change");
  }

  const t0 = performance.now();
  cpuTool.blur_whole_image(intensity);
  const cpuMs = Math.round((performance.now() - t0) * 100) / 100;
  const cpuOut = cpuTool.active_layer_rgba();

  // EXACTLY the sequence applyGlobalBlur runs.
  const t1 = performance.now();
  const src = gpuTool.active_layer_rgba();
  const { pixels } = await gaussianBlurGpu(
    new Uint8ClampedArray(src.buffer, src.byteOffset, src.length),
    width,
    height,
    intensity,
  );
  const applied = gpuTool.apply_blurred_layer_rgba(
    new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.length),
  );
  const gpuMs = Math.round((performance.now() - t1) * 100) / 100;
  if (!applied) return fail("apply_blurred_layer_rgba refused the buffer");
  const gpuOut = gpuTool.active_layer_rgba();

  let maxDelta = 0;
  let differingBytes = 0;
  // WHERE, not just how many. A parity failure reported as a bare count is
  // almost unactionable; edge pixels and interior pixels have completely
  // different causes (boundary handling vs arithmetic).
  const samples: Array<{
    x: number;
    y: number;
    ch: number;
    cpu: number;
    gpu: number;
    edgeDist: number;
  }> = [];
  for (let i = 0; i < cpuOut.length; i++) {
    const d = Math.abs(cpuOut[i] - gpuOut[i]);
    if (d !== 0) {
      differingBytes++;
      if (samples.length < 24) {
        const px = i >> 2;
        const x = px % width;
        const y = (px / width) | 0;
        samples.push({
          x,
          y,
          ch: i & 3,
          cpu: cpuOut[i],
          gpu: gpuOut[i],
          edgeDist: Math.min(x, y, width - 1 - x, height - 1 - y),
        });
      }
    }
    if (d > maxDelta) maxDelta = d;
  }
  // ── ISOLATION: which pair actually disagrees? ──────────────────────────
  // A GPU-vs-engine difference has two candidate causes and they need
  // different fixes:
  //   (a) the JS ORACLE has drifted from the crate — ADR-030's pre-mortem,
  //       and `gpuBlurSelfTest` cannot see it because the oracle is what it
  //       compares against;
  //   (b) the REGION path differs from a whole-buffer blur — `blur_whole_image`
  //       goes through `gaussian_blur_region` with scratch buffers and a
  //       bounding box, and the GPU blurs the buffer flat.
  // Comparing the engine against the oracle, CPU to CPU with no GPU in the
  // picture, tells them apart: a difference here is (a), no difference is (b).
  const oracle = gaussianBlurCpu(seedImage, width, height, intensity);
  let oracleVsEngineMax = 0;
  let oracleVsEngineBytes = 0;
  for (let i = 0; i < cpuOut.length; i++) {
    const d = Math.abs(cpuOut[i] - oracle[i]);
    if (d !== 0) oracleVsEngineBytes++;
    if (d > oracleVsEngineMax) oracleVsEngineMax = d;
  }
  let oracleVsGpuMax = 0;
  for (let i = 0; i < gpuOut.length; i++) {
    const d = Math.abs(gpuOut[i] - oracle[i]);
    if (d > oracleVsGpuMax) oracleVsGpuMax = d;
  }

  cpuTool.free?.();
  gpuTool.free?.();
  return {
    adapter: status.adapterInfo,
    width,
    height,
    intensity,
    maxDelta,
    differingBytes,
    cpuMs,
    gpuMs,
    speedup: gpuMs > 0 ? Math.round((cpuMs / gpuMs) * 10) / 10 : -1,
    pass: maxDelta === 0,
    samples,
    oracleVsEngineMax,
    oracleVsEngineBytes,
    oracleVsGpuMax,
    verdict:
      oracleVsEngineMax > 0
        ? "ORACLE DRIFT — blurReference.ts disagrees with the crate (ADR-030's pre-mortem)"
        : oracleVsGpuMax > 0
          ? "SHADER — gpuBlur disagrees with the oracle it was written against"
          : maxDelta > 0
            ? "REGION PATH — oracle matches both, so blur_whole_image's region machinery differs"
            : "all three agree",
    minEdgeDist: samples.length ? Math.min(...samples.map((s2) => s2.edgeDist)) : -1,
    maxEdgeDist: samples.length ? Math.max(...samples.map((s2) => s2.edgeDist)) : -1,
  };
}

/** Attach to window so it can be driven from the console or automation. */
export function installGpuBlurSelfTest(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  g.__ihGpuBlurSelfTest = gpuBlurSelfTest;
  g.__ihGpuBlurLostTest = gpuBlurLostDeviceTest;
  g.__ihGpuBlurEngineParity = gpuBlurEngineParity;
}
