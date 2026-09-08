// WebGPU blur benchmark — the numbers in ADR-030's Measurements section.
//
// HOW TO RUN. Open the app (production or dev) on a machine with a real GPU,
// open a console, paste this whole file, then:
//
//     await __ihGpuBlurBench()
//
// It needs no build and no feature flag: it imports the engine module straight
// off the page and carries its own copy of the shader, so it measures the
// shipped SIMD blur against the shipped WGSL without either being wired up.
//
// ⚠️ IT REFUSES TO REPORT TIMINGS ON A SOFTWARE ADAPTER, and that guard is the
// most important thing in this file. Headless Chromium in WSL2 (and any machine
// with no usable Vulkan ICD) hands out `google/swiftshader` — a CPU rasterizer —
// as soon as `--enable-unsafe-webgpu` is set. `detect.ts` calls that `ok: true`,
// because it only asks whether a device came back. Benchmarking against it
// produces a full table of plausible CPU-vs-CPU numbers under a GPU column
// header, and the conclusion "WebGPU is not worth it" is then entirely wrong.
// Check the vendor string before you believe a number. See ADR-030.
//
// Parity runs before timing, always. A shader that disagrees with the engine is
// not faster, it is broken, and its timings are meaningless.

(() => {
  const WORKGROUP = 8;

  // ── CPU oracle: kept in step with app/src/lib/webgpu/blurReference.ts ──────
  const buildGaussianKernel = (radius) => {
    const r = Math.trunc(radius), sigma = Math.max(r, 1) / 2, twoSigmaSq = 2 * sigma * sigma;
    const k = new Float32Array(2 * r + 1);
    let sum = 0;
    for (let i = -r; i <= r; i++) { const v = Math.exp(-(i * i) / twoSigmaSq); k[i + r] = v; sum += v; }
    for (let i = 0; i < k.length; i++) k[i] /= sum;
    return k;
  };
  const clampRadius = (x) => Math.min(30, Math.max(1, Math.trunc(x)));

  const pass = (src, dst, w, h, kr, kernel, horizontal) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let ki = -kr; ki <= kr; ki++) {
        const sx = horizontal ? Math.min(w - 1, Math.max(0, x + ki)) : x;
        const sy = horizontal ? y : Math.min(h - 1, Math.max(0, y + ki));
        const si = (sy * w + sx) * 4, wt = kernel[ki + kr];
        r += src[si] * wt; g += src[si + 1] * wt; b += src[si + 2] * wt; a += src[si + 3] * wt;
      }
      const di = (y * w + x) * 4;
      dst[di]     = Math.min(255, Math.max(0, Math.round(r)));
      dst[di + 1] = Math.min(255, Math.max(0, Math.round(g)));
      dst[di + 2] = Math.min(255, Math.max(0, Math.round(b)));
      dst[di + 3] = Math.min(255, Math.max(0, Math.round(a)));
    }
  };
  const gaussianBlurCpu = (rgba, w, h, intensity) => {
    const kr = clampRadius(intensity), k = buildGaussianKernel(kr);
    const hp = new Uint8ClampedArray(rgba.length), out = new Uint8ClampedArray(rgba.length);
    pass(rgba, hp, w, h, kr, k, true);
    pass(hp, out, w, h, kr, k, false);
    return out;
  };

  // ── Shader: verbatim from app/src/lib/webgpu/gpuBlur.ts ───────────────────
  const SHADER = `
struct Params { width:u32, height:u32, radius:i32, vertical:u32, };
@group(0) @binding(0) var<storage, read>       src    : array<u32>;
@group(0) @binding(1) var<storage, read_write> dst    : array<u32>;
@group(0) @binding(2) var<uniform>             params : Params;
@group(0) @binding(3) var<storage, read>       kernel : array<f32>;
fn unpack(px:u32)->vec4<f32>{return vec4<f32>(f32(px & 0xffu),f32((px>>8u)&0xffu),f32((px>>16u)&0xffu),f32((px>>24u)&0xffu));}
fn pack(c:vec4<f32>)->u32{let r=clamp(floor(c.x+0.5),0.0,255.0);let g=clamp(floor(c.y+0.5),0.0,255.0);let b=clamp(floor(c.z+0.5),0.0,255.0);let a=clamp(floor(c.w+0.5),0.0,255.0);return u32(r)|(u32(g)<<8u)|(u32(b)<<16u)|(u32(a)<<24u);}
@compute @workgroup_size(${WORKGROUP}, ${WORKGROUP})
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
  let w=params.width; let h=params.height;
  if (gid.x>=w || gid.y>=h) { return; }
  let x=i32(gid.x); let y=i32(gid.y); let kr=params.radius;
  var acc=vec4<f32>(0.0,0.0,0.0,0.0);
  for (var ki:i32=-kr; ki<=kr; ki=ki+1) {
    var sx=x; var sy=y;
    if (params.vertical==1u) { sy=clamp(y+ki,0,i32(h)-1); } else { sx=clamp(x+ki,0,i32(w)-1); }
    let si=u32(sy)*w+u32(sx);
    acc = acc + unpack(src[si]) * kernel[u32(ki+kr)];
  }
  dst[gid.y*w+gid.x] = pack(acc);
}`;

  // Deterministic content — same generator as selfTest.ts, so a disagreement
  // here and a disagreement there are the same disagreement.
  const makeImage = (w, h, seed) => {
    const px = new Uint8ClampedArray(w * h * 4);
    let s = seed >>> 0;
    const next = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s; };
    for (let i = 0; i < px.length; i += 4) {
      const v = next();
      px[i] = v & 0xff; px[i + 1] = (v >> 8) & 0xff; px[i + 2] = (v >> 16) & 0xff; px[i + 3] = (v >> 24) & 0xff;
    }
    return px;
  };

  const median = (a) => { const v = [...a].sort((x, y) => x - y); return Math.round(v[Math.floor(v.length / 2)] * 100) / 100; };

  globalThis.__ihGpuBlurBench = async function (opts = {}) {
    if (!navigator.gpu) return { fatal: "navigator.gpu absent — not a secure context, or WebGPU unavailable" };
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { fatal: "requestAdapter() returned null — no compatible GPU" };
    const info = adapter.info || {};
    const vendor = String(info.vendor ?? "?"), arch = String(info.architecture ?? "?");

    // THE GUARD. A software adapter answers every other question correctly.
    const software = vendor === "google" && arch === "swiftshader";
    if (software && !opts.iAcceptSoftwareAdapterNumbersAreMeaningless) {
      return {
        fatal: `adapter is ${vendor}/${arch} — a CPU rasterizer, not a GPU.`,
        why: "Timings against SwiftShader are CPU-vs-CPU and will read as 'no speedup'. Run this on a machine with a real adapter.",
      };
    }

    const hasTS = adapter.features.has("timestamp-query");
    const device = await adapter.requestDevice({ requiredFeatures: hasTS ? ["timestamp-query"] : [] });
    const pipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module: device.createShaderModule({ code: SHADER }), entryPoint: "main" },
    });

    // One blur, device and pipeline already built (the amortised path). The
    // shipped gpuBlur.ts builds and destroys a device per call instead; that
    // costs ~26 ms and is measured separately in the ADR.
    const gpuBlur = async (rgba, w, h, intensity) => {
      const kr = clampRadius(intensity), kernel = buildGaussianKernel(kr), byteLen = w * h * 4;
      const t0 = performance.now();
      const mk = (u) => device.createBuffer({ size: byteLen, usage: u });
      const src = mk(GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
      // Plain STORAGE: binds read_write in pass 1 and read in pass 2, so the
      // mid -> midAsSrc copy gpuBlur.ts performs is not needed. Byte-identical.
      const mid = mk(GPUBufferUsage.STORAGE);
      const dst = mk(GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
      const read = device.createBuffer({ size: byteLen, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      const kernelBuf = device.createBuffer({ size: kernel.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(src, 0, rgba.buffer, rgba.byteOffset, byteLen);
      device.queue.writeBuffer(kernelBuf, 0, kernel.buffer, kernel.byteOffset, kernel.byteLength);
      const mkP = (vertical) => {
        const b = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        const d = new ArrayBuffer(16), dv = new DataView(d);
        dv.setUint32(0, w, true); dv.setUint32(4, h, true); dv.setInt32(8, kr, true); dv.setUint32(12, vertical, true);
        device.queue.writeBuffer(b, 0, d); return b;
      };
      const hP = mkP(0), vP = mkP(1);
      const tUpload = performance.now();
      const bind = (a, b, p) => device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: a } }, { binding: 1, resource: { buffer: b } },
                  { binding: 2, resource: { buffer: p } }, { binding: 3, resource: { buffer: kernelBuf } }],
      });
      let qs = null, qbuf = null, qread = null;
      if (hasTS) {
        qs = device.createQuerySet({ type: "timestamp", count: 2 });
        qbuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
        qread = device.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      }
      const enc = device.createCommandEncoder();
      const gx = Math.ceil(w / WORKGROUP), gy = Math.ceil(h / WORKGROUP);
      { const p = enc.beginComputePass(qs ? { timestampWrites: { querySet: qs, beginningOfPassWriteIndex: 0 } } : {});
        p.setPipeline(pipeline); p.setBindGroup(0, bind(src, mid, hP)); p.dispatchWorkgroups(gx, gy); p.end(); }
      { const p = enc.beginComputePass(qs ? { timestampWrites: { querySet: qs, endOfPassWriteIndex: 1 } } : {});
        p.setPipeline(pipeline); p.setBindGroup(0, bind(mid, dst, vP)); p.dispatchWorkgroups(gx, gy); p.end(); }
      enc.copyBufferToBuffer(dst, 0, read, 0, byteLen);
      if (qs) { enc.resolveQuerySet(qs, 0, 2, qbuf, 0); enc.copyBufferToBuffer(qbuf, 0, qread, 0, 16); }
      const tEncode = performance.now();
      device.queue.submit([enc.finish()]);
      await read.mapAsync(GPUMapMode.READ);
      const tMap = performance.now();
      const out = new Uint8ClampedArray(read.getMappedRange().slice(0));
      read.unmap();
      const tCopy = performance.now();
      let dispatchMs = null;
      if (qs) { await qread.mapAsync(GPUMapMode.READ); const ts = new BigUint64Array(qread.getMappedRange().slice(0)); qread.unmap(); dispatchMs = Number(ts[1] - ts[0]) / 1e6; }
      for (const b of [src, mid, dst, read, kernelBuf, hP, vP]) b.destroy();
      if (qs) { qs.destroy(); qbuf.destroy(); qread.destroy(); }
      return { pixels: out, total: tCopy - t0, upload: tUpload - t0, encode: tEncode - tUpload, submitToMap: tMap - tEncode, readCopy: tCopy - tMap, dispatchMs };
    };

    // ── Parity gate. Timings are not reported if the shader disagrees. ───────
    const parity = [];
    for (const [w, h, r, seed] of [[64, 64, 1, 0x12345678], [61, 37, 5, 0x9e3779b9], [40, 40, 30, 0x0badf00d]]) {
      const px = makeImage(w, h, seed);
      const cpu = gaussianBlurCpu(px, w, h, r);
      const { pixels } = await gpuBlur(px, w, h, r);
      let maxDelta = 0;
      for (let i = 0; i < cpu.length; i++) maxDelta = Math.max(maxDelta, Math.abs(cpu[i] - pixels[i]));
      parity.push({ case: `${w}x${h} r${r}`, maxDelta, pass: maxDelta === 0 });
    }
    if (!parity.every((p) => p.pass)) {
      device.destroy();
      return { adapter: `${vendor}/${arch}`, parity, fatal: "shader disagrees with the CPU oracle — fix parity before trusting any timing" };
    }

    // ── Engine SIMD baseline. Needs the module the page already loaded. ──────
    const entry = performance.getEntriesByType("resource").map((r) => r.name).find((n) => /stamp_tool-.*\.js$/.test(n));
    if (!entry) { device.destroy(); return { adapter: `${vendor}/${arch}`, parity, fatal: "engine module not found on this page — open the app first" };}
    const mod = await import(entry);
    if (typeof mod.default === "function") { try { await mod.default(); } catch { /* already initialised */ } }

    const sizes = opts.sizes ?? [[512, 512], [1024, 1024], [2048, 2048]];
    const intensity = opts.intensity ?? 5;
    const reps = opts.reps ?? 5;
    const rows = [];
    for (const [w, h] of sizes) {
      const eng = new mod.ImageHorseTool(w, h);
      eng.load_image(makeImage(w, h, 0x1234567));
      const R = Math.max(w, h);
      eng.blur_region(w / 2, h / 2, R, intensity); // warm
      const cpu = [];
      for (let i = 0; i < reps; i++) { const t = performance.now(); eng.blur_region(w / 2, h / 2, R, intensity); cpu.push(performance.now() - t); }
      const img = makeImage(w, h, 0x1234567);
      await gpuBlur(img, w, h, intensity); // warm
      const g = [];
      for (let i = 0; i < reps; i++) g.push(await gpuBlur(img, w, h, intensity));
      rows.push({
        size: `${w}x${h}`,
        engineSimdMs: median(cpu),
        gpuMs: median(g.map((x) => x.total)),
        speedup: Math.round((median(cpu) / median(g.map((x) => x.total))) * 10) / 10,
        dispatchMs: hasTS ? median(g.map((x) => x.dispatchMs)) : null,
        uploadMs: median(g.map((x) => x.upload)),
        submitToMapMs: median(g.map((x) => x.submitToMap)),
        readCopyMs: median(g.map((x) => x.readCopy)),
      });
    }
    device.destroy();
    return { adapter: `${vendor}/${arch}`, timestampQuery: hasTS, intensity, parity, rows };
  };

  console.log("__ihGpuBlurBench() installed — run: await __ihGpuBlurBench()");
})();
