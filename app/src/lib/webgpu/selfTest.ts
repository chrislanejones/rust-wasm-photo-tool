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

import { gaussianBlurCpu } from "./blurReference";
import { gaussianBlurGpu } from "./gpuBlur";
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
export async function gpuBlurSelfTest(): Promise<SelfTestReport> {
  const status = await probeWebGpu();
  if (!status.ok) {
    return { adapter: `unavailable: ${status.reason}`, cases: [], pass: false };
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

  return { adapter: status.adapterInfo, cases, pass: cases.every((c) => c.pass) };
}

/** Attach to window so it can be driven from the console or automation. */
export function installGpuBlurSelfTest(): void {
  (globalThis as unknown as Record<string, unknown>).__ihGpuBlurSelfTest = gpuBlurSelfTest;
}
