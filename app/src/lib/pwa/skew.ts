import { evaluateBuildSkew } from "./skewVerdict";
import { showUpdateToast } from "./updateToast";

// Build-skew guard wiring (Night B brief, Task B). Two artifacts carry the
// same per-build hash:
//   1. this bundle — `__IH_BUILD_HASH__`, injected via `define` (and thereby
//      riding inside every hashed asset of the build, WASM included, since
//      the bundle references them by hashed filename), and
//   2. version.json — emitted next to index.html, EXCLUDED from the service
//      worker's precache (globIgnores in vite.config.ts) so a no-store fetch
//      of it always reaches the real server.
// If a stale service-worker cache serves an old bundle while the server has
// moved on (or old WASM + new JS — same detection, the hash pair diverges),
// the fetched hash disagrees with the embedded one: log ONE console.error
// and raise the update banner immediately.
//
// Called from swBoot (boot) and from the engine-init paths in useCloneStamp
// (the brief's "the WASM loader checks" — the moment stale WASM would start
// doing real work). In default builds (__IH_SW_MODE__ "off") the guard is
// constant-folded to a no-op: without a service worker there is nothing that
// could serve a stale build, and version.json is not even emitted.

let skewReported = false;

export async function checkBuildSkew(context: string): Promise<void> {
  if (__IH_SW_MODE__ !== "on") return; // statically removed in default builds
  if (skewReported) return; // one error + one banner per session, not per init

  let manifestHash: string | null;
  try {
    const res = await fetch("/version.json", { cache: "no-store" });
    if (!res.ok) return; // deploy target without a manifest — unknown, no banner
    const body = (await res.json()) as { buildHash?: unknown };
    manifestHash = typeof body.buildHash === "string" ? body.buildHash : null;
  } catch {
    return; // offline / unreachable — unknown, never a false positive
  }

  if (evaluateBuildSkew(__IH_BUILD_HASH__, manifestHash) === "skew") {
    skewReported = true;
    console.error(
      `[pwa] build skew detected at ${context}: running bundle is ` +
        `${__IH_BUILD_HASH__}, server has ${manifestHash}. A stale ` +
        `service-worker cache is serving an old build — reload to update.`,
    );
    showUpdateToast(() => window.location.reload());
  }
}
