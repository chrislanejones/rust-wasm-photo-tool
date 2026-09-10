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
// 800,000–840,000 B, and the crate currently sits at 816,971 B (measured
// 2026-09-05, byte-identical local and deployed). wgpu plus its shader
// translation layer does not fit in the ~23 KB of headroom — not close. Raising
// the band is a real decision, not a footnote, so this module keeps the GPU on
// the JS side and hands the engine's pixels to it. See ADR-030, ADR-045.
//
// The numbers above were 700–800 KB / ~761 KB until 2026-09-05 and had been
// stale since ADR-037 moved the band. The CONCLUSION never changed — wgpu has
// never come close to fitting — but the arithmetic supporting it was wrong, and
// a right answer resting on wrong figures is one edit away from becoming a
// wrong one.
//
// Nothing here throws. Every failure path returns a reason string, because the
// interesting question during Phase 0 is *why* a machine can't run it.
//
// ⚠️ "CAN run it" IS NOT "SHOULD run it". A software rasterizer passes every
// question this module used to ask and then loses to the engine it was meant
// to beat, so `probeWebGpu` refuses one — see SOFTWARE_ADAPTER_MARKERS below.

export type GpuStatus =
  | { ok: true; adapterInfo: string; limits: { maxTextureDimension2D: number; maxComputeWorkgroupSizeX: number; maxStorageBufferBindingSize: number } }
  | { ok: false; reason: string };

/**
 * Names that identify a CPU rasterizer wearing a GPU label.
 *
 * ⚠️ THIS IS A CORRECTNESS-OF-THE-ANSWER GUARD, NOT A CAPABILITY CHECK. A
 * software adapter answers every other question in this module correctly: it
 * returns a device, it reports limits, it runs the shader, and it produces
 * byte-identical output. What it does not do is go faster than the engine —
 * it IS the CPU, with a copy in and a copy out on top. ADR-030 measured the
 * hazard from the other side: benchmarking `google/swiftshader` would have
 * read as "WebGPU is not worth it" and killed the arc on a false negative.
 * The product has the mirror-image bug — a user with no GPU who sets
 * `ih_webgpu=1` silently gets a SLOWER editor and no way to tell.
 *
 * MATCHED AS A SUBSTRING of `"<vendor>/<architecture>"`, lowercased, rather
 * than as an exact field pair. Only `google/swiftshader` has actually been
 * observed here (WSL2 headless Chromium under `--enable-unsafe-webgpu`); for
 * the Mesa pair the field each name lands in is a guess, and a guess about
 * WHICH FIELD produces a check that silently never fires. Matching the name
 * wherever it appears does not depend on guessing right. The names are long
 * and unambiguous — no hardware adapter is called "llvmpipe".
 *
 * Deliberately NOT listed: Microsoft's WARP, whose architecture string is the
 * bare word `warp`. Four characters is too short to substring-match without
 * risking a real adapter, and it has never been seen from this repo. A Windows
 * machine with no GPU therefore still falls through this guard — a known gap,
 * written down rather than papered over with a match that might be wrong.
 */
const SOFTWARE_ADAPTER_MARKERS = ["swiftshader", "llvmpipe", "lavapipe"] as const;

/** `null` when the adapter looks like real hardware, else the marker that matched.
 *  Not exported: the tests drive `probeWebGpu`, not this, on purpose. */
function softwareAdapterMarker(vendor: string, architecture: string): string | null {
  const identity = `${vendor}/${architecture}`.toLowerCase();
  return SOFTWARE_ADAPTER_MARKERS.find((m) => identity.includes(m)) ?? null;
}

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
function webgpuAvailable(): boolean {
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
      const vendor = info?.vendor ?? "?";
      const architecture = info?.architecture ?? "?";
      // Refuse a software adapter — see SOFTWARE_ADAPTER_MARKERS. The identity
      // goes in the reason so the Feature Flags panel still shows WHAT was
      // found; "unavailable" with no name would be a worse diagnostic than the
      // silent `ok: true` this replaces.
      const software = softwareAdapterMarker(vendor, architecture);
      if (software) {
        // We asked for a device and have just decided not to use it. gpuBlur
        // acquires its own, so nothing downstream holds this one.
        device.destroy();
        return {
          ok: false,
          reason: `software adapter (${vendor}/${architecture}) — a CPU rasterizer, slower than the SIMD engine, so the GPU path is refused`,
        };
      }
      return {
        ok: true,
        adapterInfo: info ? `${vendor}/${architecture}` : "unknown adapter",
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
