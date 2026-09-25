// The e2e backend guard's rules. Pure: imported by both Playwright configs, the
// global setup, and the auto fixture in ./test.ts.
//
// WHY. No e2e spec signs in or uploads — every one of them runs the logged-out
// demo against a PLACEHOLDER Convex URL, and 16 of 17 abort all non-local
// traffic. That is a convention, not a guarantee. The live app's backend is a
// deployment called "dev" (brave-ant-608) that holds real users' photos; one
// spec pointed at it, or one build baked with the real `.env`, and a test run
// would write there. This file turns the convention into a failure.
//
// The placeholder is a `*.convex.cloud` name on purpose — the Convex client
// fatally rejects a deployment name that is not the `word-word-123` shape —
// so "no convex.cloud host" cannot be the rule. The rule is: this ONE host, or
// a reserved TLD that can never resolve.

/** The only Convex URL an e2e build may contain. */
export const PLACEHOLDER_CONVEX_URL = "https://smoke-placeholder-123.convex.cloud";
/** Well-formed pk_test key for `clerk.smoke.invalid` — points nowhere. */
const PLACEHOLDER_CLERK_KEY = "pk_test_Y2xlcmsuc21va2UuaW52YWxpZCQ=";

/** The env baked into every e2e build (both configs). */
export function demoEnv(convexUrl: string = PLACEHOLDER_CONVEX_URL): string {
  return `VITE_CONVEX_URL="${convexUrl}" VITE_CLERK_PUBLISHABLE_KEY="${PLACEHOLDER_CLERK_KEY}"`;
}

const PLACEHOLDER_HOSTS = new Set([new URL(PLACEHOLDER_CONVEX_URL).host]);
/** RFC 2606 / 6761 reserved names: guaranteed never to reach a real server. */
const RESERVED_TLD = /\.(invalid|test|example|localhost)$/;

function isAllowedBackendHost(host: string): boolean {
  return PLACEHOLDER_HOSTS.has(host) || RESERVED_TLD.test(host);
}

/** Throws unless `url` is the placeholder or a reserved-TLD host. Called at
 *  config load, so a real URL fails the run BEFORE anything is built. */
export function assertPlaceholderConvexUrl(url: string): void {
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    throw new Error(`[e2e backend guard] the configured Convex URL ${JSON.stringify(url)} is not a URL`);
  }
  if (!isAllowedBackendHost(host)) {
    throw new Error(
      `[e2e backend guard] the configured Convex URL ${url} is a REAL deployment host (${host}). ` +
        `e2e builds must use the placeholder ${PLACEHOLDER_CONVEX_URL} or a *.invalid host. Refusing to run.`,
    );
  }
}

const CONVEX_HOST = /(^|\.)convex\.(cloud|site)$/;
/** Where Convex serves uploads: `POST https://<deployment>.convex.cloud/api/storage/upload?token=…`. */
const UPLOAD_PATH = /\/api\/storage\/upload\b/;

/** Why a browser request must not happen in an e2e run, or null if it may.
 *  Covers http(s) and ws(s); blob:/data:/about: never leave the browser. */
export function forbiddenRequestReason(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!/^(https?|wss?):$/.test(u.protocol)) return null;
  if (UPLOAD_PATH.test(u.pathname)) return "Convex upload URL path";
  if (CONVEX_HOST.test(u.hostname) && !isAllowedBackendHost(u.host)) return `real Convex deployment host ${u.host}`;
  return null;
}

/** Every Convex host named anywhere in `text` (a served JS bundle). */
export function convexHostsIn(text: string): string[] {
  return [...new Set([...text.matchAll(/https?:\/\/([a-z0-9-]+\.convex\.(?:cloud|site))/g)].map((m) => m[1]))];
}

/** Hosts in `hosts` that are not allowed backends. */
export function disallowedHosts(hosts: readonly string[]): string[] {
  return hosts.filter((h) => !isAllowedBackendHost(h));
}

/** A spec that imports `test` straight from @playwright/test skips the auto
 *  fixture in ./test.ts. Type-only imports and `expect` alone are fine. */
export function importsUnguardedTest(source: string): boolean {
  for (const m of source.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s*from\s*["']@playwright\/test["']/g)) {
    if (m[1]) continue;
    const names = m[2].split(",").map((s) => s.trim());
    if (names.some((n) => n === "test" || n.startsWith("test "))) return true;
  }
  return false;
}
