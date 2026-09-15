/**
 * The editor's retired address. Image Horse moved to `edit.imagehorse.app` on
 * 2026-09-12; the Netlify site keeps building master as a rollback path until
 * it becomes a redirect on 2026-09-29 (Chris, 2026-09-15).
 *
 * Until then it matters which host a visitor is on: a gallery saved WITHOUT
 * signing in lives in IndexedDB, which the browser keeps per origin. It does
 * not follow the user to the new address, and once this host redirects it
 * cannot be reached at all. Signed-in galleries live in Convex and are already
 * on the new address.
 */
const LEGACY_HOST = "rust-wasm-photo-tool.netlify.app";
export const EDITOR_URL = "https://edit.imagehorse.app/";

/** The retired Netlify site, or one of its deploy previews / branch deploys
 *  (`deploy-preview-148--rust-wasm-photo-tool.netlify.app`). Exact match or a
 *  `--` subdomain only, so a lookalike host never qualifies. */
export function isLegacyHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === LEGACY_HOST || host.endsWith(`--${LEGACY_HOST}`);
}
