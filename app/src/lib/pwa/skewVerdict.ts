// Pure verdict logic for the build-skew guard — zero imports, zero globals,
// so the unit tests (skewVerdict.test.ts) exercise it hermetically in node.
//
// "Skew" is the classic service-worker failure: a stale cache serving an old
// JS bundle (with an old embedded hash) while the server — reached past the
// cache via a no-store fetch of version.json — already has a new build (or
// the reverse, old WASM + new JS, since the WASM travels as a hashed asset
// of the same build). Two builds, one origin, one running page.

export type SkewVerdict = "match" | "skew" | "unknown";

/**
 * Compare the hash baked into the RUNNING bundle against the hash the server
 * reports. Anything missing or empty on either side is "unknown", never
 * "skew" — an offline boot or a misconfigured build must not raise a false
 * update banner.
 */
export function evaluateBuildSkew(
  embeddedHash: string | null | undefined,
  manifestHash: string | null | undefined,
): SkewVerdict {
  const embedded = typeof embeddedHash === "string" ? embeddedHash.trim() : "";
  const manifest = typeof manifestHash === "string" ? manifestHash.trim() : "";
  if (!embedded || !manifest) return "unknown";
  return embedded === manifest ? "match" : "skew";
}
