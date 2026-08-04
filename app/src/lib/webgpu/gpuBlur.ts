// Separable Gaussian blur as a WebGPU compute pass.
//
// CORRECTNESS BEFORE SPEED. This is written to produce byte-identical output to
// `blurReference.ts` (and therefore to the Rust engine), not to be fast. The
// obvious optimisations are all deliberately absent:
//
//   • no shared-memory tiling (each invocation re-reads its whole kernel span)
//   • no f16, no packed math
//   • the intermediate buffer round-trips through u8 exactly like the CPU does
//
// That last one is the whole game. Keeping f32 between the horizontal and
// vertical passes would be cheaper AND produce a slightly better image — and it
// would be wrong, because the CPU path quantises there, so the two renderers
// would disagree about the same document. Speed work only starts once the
// harness reports a max channel delta of 0.
//
// Pixels are carried as `array<u32>` of packed RGBA8 rather than a texture:
// storage textures would force a format choice and an extra copy, and this way
// the buffer is exactly the engine's byte layout.

import { probeWebGpu } from "./detect";
import { buildGaussianKernel, clampRadius } from "./blurReference";

const WORKGROUP = 8; // 8x8 = 64 invocations; safely under every maxComputeWorkgroupSize

const SHADER = /* wgsl */ `
struct Params {
  width  : u32,
  height : u32,
  radius : i32,
  // 0 = horizontal, 1 = vertical. Both passes run the same code path so the
  // two directions cannot drift apart.
  vertical : u32,
};

@group(0) @binding(0) var<storage, read>       src    : array<u32>;
@group(0) @binding(1) var<storage, read_write> dst    : array<u32>;
@group(0) @binding(2) var<uniform>             params : Params;
@group(0) @binding(3) var<storage, read>       kernel : array<f32>;

fn unpack(px : u32) -> vec4<f32> {
  return vec4<f32>(
    f32( px         & 0xffu),
    f32((px >>  8u) & 0xffu),
    f32((px >> 16u) & 0xffu),
    f32((px >> 24u) & 0xffu),
  );
}

// Round-half-up then clamp to 0..255, matching Rust's
// \`f32::round().clamp(0.0, 255.0) as u8\` for the non-negative values a
// normalised kernel can produce. WGSL's round() is round-half-to-EVEN, which
// disagrees on exact .5 — so floor(x + 0.5) is used instead, on purpose.
fn pack(c : vec4<f32>) -> u32 {
  let r = clamp(floor(c.x + 0.5), 0.0, 255.0);
  let g = clamp(floor(c.y + 0.5), 0.0, 255.0);
  let b = clamp(floor(c.z + 0.5), 0.0, 255.0);
  let a = clamp(floor(c.w + 0.5), 0.0, 255.0);
  return u32(r) | (u32(g) << 8u) | (u32(b) << 16u) | (u32(a) << 24u);
}

@compute @workgroup_size(${WORKGROUP}, ${WORKGROUP})
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let w = params.width;
  let h = params.height;
  if (gid.x >= w || gid.y >= h) { return; }

  let x = i32(gid.x);
  let y = i32(gid.y);
  let kr = params.radius;

  var acc = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  for (var ki : i32 = -kr; ki <= kr; ki = ki + 1) {
    // Clamp to edge — the engine's only boundary rule.
    var sx = x;
    var sy = y;
    if (params.vertical == 1u) {
      sy = clamp(y + ki, 0, i32(h) - 1);
    } else {
      sx = clamp(x + ki, 0, i32(w) - 1);
    }
    let si = u32(sy) * w + u32(sx);
    acc = acc + unpack(src[si]) * kernel[u32(ki + kr)];
  }

  dst[gid.y * w + gid.x] = pack(acc);
}
`;

export interface GpuBlurResult {
  pixels: Uint8ClampedArray;
  /** Wall-clock for submit→map, in ms. Not a benchmark — see the ADR. */
  elapsedMs: number;
}

/**
 * Blur `rgba` on the GPU. Throws with a readable reason if WebGPU is
 * unavailable; callers are expected to have checked `gpuUsable()` first.
 *
 * Creates and tears down its own device-side resources per call. That is
 * wasteful and intentional for now: a persistent pipeline is a speed
 * optimisation, and speed work is gated behind a zero-delta harness run.
 */
export async function gaussianBlurGpu(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  intensity: number,
): Promise<GpuBlurResult> {
  const status = await probeWebGpu();
  if (!status.ok) throw new Error(`WebGPU unavailable: ${status.reason}`);

  const adapter = await navigator.gpu!.requestAdapter();
  const device = await adapter!.requestDevice();
  const t0 = performance.now();

  const kr = clampRadius(intensity);
  const kernel = buildGaussianKernel(kr);
  const pxCount = width * height;
  const byteLen = pxCount * 4;

  const mkStorage = (usage: number) =>
    device.createBuffer({ size: byteLen, usage });

  const srcBuf = mkStorage(GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
  const midBuf = mkStorage(GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
  const dstBuf = mkStorage(GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
  const readBuf = device.createBuffer({
    size: byteLen,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  device.queue.writeBuffer(srcBuf, 0, rgba.buffer as ArrayBuffer, rgba.byteOffset, byteLen);

  const kernelBuf = device.createBuffer({
    size: kernel.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(kernelBuf, 0, kernel.buffer as ArrayBuffer, kernel.byteOffset, kernel.byteLength);

  const mkParams = (vertical: number) => {
    const b = device.createBuffer({
      size: 16, // 4 x u32/i32, std140-friendly
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const data = new ArrayBuffer(16);
    const dv = new DataView(data);
    dv.setUint32(0, width, true);
    dv.setUint32(4, height, true);
    dv.setInt32(8, kr, true);
    dv.setUint32(12, vertical, true);
    device.queue.writeBuffer(b, 0, data);
    return b;
  };
  const hParams = mkParams(0);
  const vParams = mkParams(1);

  const module = device.createShaderModule({ code: SHADER });
  const pipeline = device.createComputePipeline({
    layout: "auto",
    compute: { module, entryPoint: "main" },
  });

  const bind = (a: GPUBuffer, b: GPUBuffer, p: GPUBuffer) =>
    device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: a } },
        { binding: 1, resource: { buffer: b } },
        { binding: 2, resource: { buffer: p } },
        { binding: 3, resource: { buffer: kernelBuf } },
      ],
    });

  const enc = device.createCommandEncoder();
  const gx = Math.ceil(width / WORKGROUP);
  const gy = Math.ceil(height / WORKGROUP);

  // Pass 1: horizontal, src -> mid.
  {
    const p = enc.beginComputePass();
    p.setPipeline(pipeline);
    p.setBindGroup(0, bind(srcBuf, midBuf, hParams));
    p.dispatchWorkgroups(gx, gy);
    p.end();
  }
  // mid is COPY_SRC only, so it cannot also be the read source of pass 2 —
  // copy it into a fresh readable storage buffer first.
  const midAsSrc = device.createBuffer({
    size: byteLen,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  enc.copyBufferToBuffer(midBuf, 0, midAsSrc, 0, byteLen);
  // Pass 2: vertical, mid -> dst.
  {
    const p = enc.beginComputePass();
    p.setPipeline(pipeline);
    p.setBindGroup(0, bind(midAsSrc, dstBuf, vParams));
    p.dispatchWorkgroups(gx, gy);
    p.end();
  }
  enc.copyBufferToBuffer(dstBuf, 0, readBuf, 0, byteLen);
  device.queue.submit([enc.finish()]);

  await readBuf.mapAsync(GPUMapMode.READ);
  const out = new Uint8ClampedArray(readBuf.getMappedRange().slice(0));
  readBuf.unmap();
  const elapsedMs = performance.now() - t0;

  for (const b of [srcBuf, midBuf, midAsSrc, dstBuf, readBuf, kernelBuf, hParams, vParams]) b.destroy();
  device.destroy();

  return { pixels: out, elapsedMs };
}
