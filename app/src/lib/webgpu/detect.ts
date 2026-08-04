// WebGPU capability detection + the `ih_webgpu` switch. Phase 0 of the GPU
// acceleration arc: prove we can get a device and say so honestly, before any
// pixel work depends on it.
//
// OPT-IN, not a kill switch. The shipped flags in this repo (`ih_patchmatch`,
// the op-log pair) default ON with a `"0"` kill, because they shipped after a
// dogfood period. This one is the opposite: nothing has been verified on real
// hardware beyond one Intel Xe-LPG laptop, so it defaults OFF and you turn it
// on deliberately:
//
//   localStorage.setItem("ih_webgpu", "1")   // enable, then reload
//
// WHY NOT wgpu IN THE RUST CRATE. The obvious "engine owns pixels" answer is to
// pull `wgpu` into `stamp_tool` and keep everything behind the WASM boundary.
// That is very likely foreclosed by a constraint the repo already enforces:
// `scripts/deploy-sentinel.sh` fails any deploy whose wasm falls outside
// 700–800 KB, and the crate currently sits at ~761 KB. wgpu plus its shader
// translation layer does not fit in the ~39 KB of headroom — not close. Raising
// the band is a real decision, not a footnote, so this module keeps the GPU on
// the JS side and hands the engine's pixels to it. See ADR-030.
//
// Nothing here throws. Every failure path returns a reason string, because the
// interesting question during Phase 0 is *why* a machine can't run it.

export type GpuStatus =
  | { ok: true; adapterInfo: string; limits: { maxTextureDimension2D: number; maxComputeWorkgroupSizeX: number; maxStorageBufferBindingSize: number } }
  | { ok: false; reason: string };

/** The switch, read fresh each call so a tab can be flipped without a rebuild. */
export function webgpuEnabled(): boolean {
  try {
    return localStorage.getItem("ih_webgpu") === "1";
  } catch {
    // Storage can throw in a partitioned/blocked context; treat as off.
    return false;
  }
}

/** Is the API even present? Cheap, synchronous, no device acquisition. */
export function webgpuAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator && !!navigator.gpu;
}

let cached: Promise<GpuStatus> | null = null;

/**
 * Acquire an adapter and device once, and remember the result — including a
 * failure. Requesting a device is not free and a machine that failed once will
 * fail the same way again within a session.
 *
 * Deliberately does NOT consult `webgpuEnabled()`: probing capability and
 * choosing to use it are different questions, and the diagnostics want the
 * first one answerable even when the switch is off.
 */
export function probeWebGpu(): Promise<GpuStatus> {
  if (cached) return cached;
  cached = (async (): Promise<GpuStatus> => {
    if (!webgpuAvailable()) {
      return { ok: false, reason: "navigator.gpu is not present (browser too old, or a non-secure context)" };
    }
    try {
      const adapter = await navigator.gpu!.requestAdapter();
      if (!adapter) {
        return { ok: false, reason: "requestAdapter() returned null — no compatible GPU, or the browser blocked it" };
      }
      const device = await adapter.requestDevice();
      if (!device) return { ok: false, reason: "requestDevice() returned nothing" };
      const info = (adapter as GPUAdapter & { info?: GPUAdapterInfo }).info;
      return {
        ok: true,
        adapterInfo: info ? `${info.vendor ?? "?"}/${info.architecture ?? "?"}` : "unknown adapter",
        limits: {
          maxTextureDimension2D: adapter.limits.maxTextureDimension2D,
          maxComputeWorkgroupSizeX: adapter.limits.maxComputeWorkgroupSizeX,
          maxStorageBufferBindingSize: Number(adapter.limits.maxStorageBufferBindingSize),
        },
      };
    } catch (e) {
      return { ok: false, reason: `WebGPU init threw: ${String(e)}` };
    }
  })();
  return cached;
}

/** Both halves: the user asked for it AND the machine can do it. */
export async function gpuUsable(): Promise<boolean> {
  if (!webgpuEnabled()) return false;
  return (await probeWebGpu()).ok;
}

/** Test seam — forget the cached probe. */
export function __resetGpuProbe(): void {
  cached = null;
}
