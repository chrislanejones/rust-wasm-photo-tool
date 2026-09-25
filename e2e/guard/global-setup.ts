// Runs AFTER the webServer is up (Playwright 1.63 starts plugins, then global
// setups) and BEFORE any test. Two checks, both fatal:
//
//  1. The server under test serves the placeholder Convex URL and no other
//     Convex host. The config only proves what it WOULD build; with
//     `reuseExistingServer` a server already on the port — say one built with
//     the real `.env` — is tested instead, so read what is actually served.
//     Walks the entry HTML and every JS chunk reachable from it.
//  2. No spec imports `test` straight from @playwright/test, which would skip
//     the per-request guard in ./test.ts.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { FullConfig } from "@playwright/test";
import { PLACEHOLDER_CONVEX_URL, convexHostsIn, disallowedHosts, importsUnguardedTest } from "./backend";

const MAX_ASSETS = 500;

async function servedConvexHosts(baseURL: string): Promise<{ hosts: string[]; scanned: number }> {
  const seen = new Set<string>();
  const queue: string[] = [new URL("/", baseURL).href];
  const hosts = new Set<string>();
  while (queue.length > 0 && seen.size < MAX_ASSETS) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    const res = await fetch(url);
    if (!res.ok) continue;
    const text = await res.text();
    for (const h of convexHostsIn(text)) hosts.add(h);
    // Script/modulepreload references in HTML, and chunk imports inside JS
    // ("./Foo-abc.js", "assets/Foo-abc.js", "/assets/Foo-abc.js").
    for (const m of text.matchAll(/["'(]((?:\.{0,2}\/)?(?:assets\/)?[\w.-]+\.js)["')]/g)) {
      const ref = new URL(m[1], url);
      if (ref.origin === new URL(baseURL).origin) queue.push(ref.href);
    }
  }
  return { hosts: [...hosts], scanned: seen.size };
}

/**
 * Convex hosts written into the Convex client library itself. They are
 * EXAMPLES in its error messages ("ConvexReactClient requires a URL like
 * 'https://happy-otter-123.convex.cloud'") and get bundled with it. Read from
 * the installed package rather than hardcoded, so a library upgrade that
 * changes an example cannot turn the run red; a real deployment's URL can never
 * be in there.
 */
function libraryExampleHosts(rootDir: string): Set<string> {
  const pkg = createRequire(join(rootDir, "package.json")).resolve("convex/package.json");
  const hosts = new Set<string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.[cm]?js$/.test(name)) for (const h of convexHostsIn(readFileSync(p, "utf8"))) hosts.add(h);
    }
  };
  walk(join(dirname(pkg), "dist"));
  return hosts;
}

function specFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...specFiles(p));
    else if (/\.spec\.[cm]?[jt]sx?$/.test(name)) out.push(p);
  }
  return out;
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const project = config.projects[0];
  const baseURL = project?.use.baseURL;
  if (!baseURL) throw new Error("[e2e backend guard] no baseURL configured; cannot check the served build");

  const rootDir = config.configFile ? dirname(config.configFile) : process.cwd();
  const examples = libraryExampleHosts(rootDir);
  const { hosts, scanned } = await servedConvexHosts(baseURL);
  const bad = disallowedHosts(hosts.filter((h) => !examples.has(h)));
  if (bad.length > 0) {
    throw new Error(
      `[e2e backend guard] the server at ${baseURL} serves a build that talks to a REAL Convex deployment: ` +
        `${bad.join(", ")}. If a server was already on the port, reuseExistingServer tested it instead of building; stop it.`,
    );
  }
  const placeholderHost = new URL(PLACEHOLDER_CONVEX_URL).host;
  if (!hosts.includes(placeholderHost)) {
    throw new Error(
      `[e2e backend guard] scanned ${scanned} files at ${baseURL} and did not find the placeholder Convex URL. ` +
        `The guard cannot vouch for a build whose backend it cannot see.`,
    );
  }

  const unguarded = specFiles(project.testDir).filter((f) => importsUnguardedTest(readFileSync(f, "utf8")));
  if (unguarded.length > 0) {
    throw new Error(
      `[e2e backend guard] these specs import \`test\` from @playwright/test and skip the request guard; ` +
        `import { test, expect } from "./guard/test" instead:\n  ${unguarded.join("\n  ")}`,
    );
  }
  console.log(
    `[e2e backend guard] OK — ${scanned} served files; Convex hosts: ${hosts.join(", ")} ` +
      `(library examples ignored: ${[...examples].join(", ")}); all specs use the guarded test.`,
  );
}
