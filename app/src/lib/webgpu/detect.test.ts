// `probeWebGpu` refuses a software adapter — ADR-030's un-applied recommendation.
//
// WHY THIS FILE EXISTS AND WHY IT LOOKS LIKE THIS. The bug being pinned is not
// "the matcher returns the wrong boolean" — a matcher is easy to get right and
// easy to test vacuously. It is "a CPU rasterizer reaches the caller as
// `ok: true`". So every test below drives the REAL `probeWebGpu` against a
// stubbed `navigator.gpu` and asserts on `GpuStatus`, not on the matcher.
// Testing `softwareAdapterMarker` alone would pass forever if someone deleted
// the call site — the exact shape `docs/vacuous-checks.md` collects.
//
// `probeWebGpu` memoises its answer for the tab's lifetime, so each case gets a
// fresh module via `vi.resetModules()` + a dynamic import. Sharing one import
// would make every test after the first assert on the first one's cached result.

import { describe, it, expect, vi, afterEach } from "vitest";

type Info = { vendor: string; architecture: string } | undefined;

/** A stub adapter that answers every question a real one does. That is the
 *  point: a software adapter is not broken, it is just slow. */
function stubGpu(info: Info, destroyed: { count: number } = { count: 0 }) {
  return {
    requestAdapter: async () => ({
      info,
      limits: {
        maxTextureDimension2D: 8192,
        maxComputeWorkgroupSizeX: 256,
        maxStorageBufferBindingSize: 134217728,
      },
      requestDevice: async () => ({
        destroy: () => {
          destroyed.count += 1;
        },
      }),
    }),
  };
}

async function probeWith(info: Info, destroyed?: { count: number }) {
  vi.resetModules();
  vi.stubGlobal("navigator", { gpu: stubGpu(info, destroyed) });
  const { probeWebGpu } = await import("./detect");
  return probeWebGpu();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("probeWebGpu — software adapter refusal", () => {
  // The one actually observed: WSL2 headless Chromium under
  // --enable-unsafe-webgpu. This is the case ADR-030 says nearly produced a
  // wrong benchmark answer.
  it("refuses google/swiftshader", async () => {
    const status = await probeWith({ vendor: "google", architecture: "swiftshader" });
    expect(status.ok).toBe(false);
    if (status.ok) return;
    // The identity must survive into the reason — a bare "unavailable" would be
    // a worse diagnostic than the silent `ok: true` this replaced.
    expect(status.reason).toContain("google/swiftshader");
    expect(status.reason).toMatch(/software adapter/i);
  });

  it.each([
    ["mesa", "llvmpipe"],
    ["mesa", "lavapipe"],
    // Case and field position are both deliberately wrong here: the matcher
    // lowercases and searches the whole "vendor/architecture" string, because
    // guessing WHICH field a name lands in is how this check would end up
    // never firing.
    ["SwiftShader", "unknown"],
    ["?", "LLVMpipe"],
  ])("refuses %s/%s", async (vendor, architecture) => {
    const status = await probeWith({ vendor, architecture });
    expect(status.ok).toBe(false);
  });

  it("destroys the device it refuses", async () => {
    const destroyed = { count: 0 };
    await probeWith({ vendor: "google", architecture: "swiftshader" }, destroyed);
    expect(destroyed.count).toBe(1);
  });
});

describe("probeWebGpu — real hardware still passes", () => {
  // THE ANTI-VACUOUS HALF. Without this, a matcher that returned "software" for
  // everything would pass every test above and disable WebGPU for everyone.
  it("accepts intel/xe-lpg — the adapter every number in ADR-030 was taken on", async () => {
    const status = await probeWith({ vendor: "intel", architecture: "xe-lpg" });
    expect(status.ok).toBe(true);
    if (!status.ok) return;
    expect(status.adapterInfo).toBe("intel/xe-lpg");
    expect(status.limits.maxTextureDimension2D).toBe(8192);
  });

  it.each([
    ["nvidia", "ampere"],
    ["apple", "apple-m"],
    ["amd", "rdna-3"],
    ["qualcomm", "adreno"],
  ])("accepts %s/%s", async (vendor, architecture) => {
    const status = await probeWith({ vendor, architecture });
    expect(status.ok).toBe(true);
  });

  it("accepts an adapter that reports no info at all", async () => {
    // Chrome only exposes `adapter.info` in some versions/contexts. Absent info
    // must not read as "software" — it reads as unknown, and unknown is allowed.
    const status = await probeWith(undefined);
    expect(status.ok).toBe(true);
    if (!status.ok) return;
    expect(status.adapterInfo).toBe("unknown adapter");
  });
});
