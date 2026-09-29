import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

/**
 * The CSP allows exactly one inline script by SHA-256 hash: the anti-FOUC theme
 * setter in `app/index.html`, which has to be inline or the page paints the
 * wrong theme before the bundle loads.
 *
 * A hash is the right call — `'unsafe-inline'` would re-open script injection
 * for the sake of twelve lines — but it is brittle on purpose: change one
 * character of that script, even whitespace, and the hash stops matching. Under
 * an ENFORCING policy the theme setter would then silently not run, and the
 * only symptom is a flash of the wrong theme on a cold load. Nothing else in
 * this repo would catch it: no gate serves headers, so tsc, eslint, the build
 * and the deploy sentinel all pass.
 *
 * So this test recomputes the hash from index.html and asserts that EVERY
 * header config serving the app still names it:
 *
 *   vercel.json    production (edit.imagehorse.app) — the policy users get
 *
 * ⚠️ It used to read netlify.toml ONLY, and stayed that way through the move to
 * Vercel. With vercel.json's hash deliberately broken it went 2/2 green
 * (2026-09-15) — a test guarding a file production does not serve. netlify.toml
 * went with the Netlify origin on 2026-09-27, so CONFIGS is down to one entry
 * and that trap is one step closer, not further away: the loop below cannot
 * tell "one host, correctly checked" from "a second host nobody added". If
 * another host ever serves the app, add its config to CONFIGS.
 *
 * The hash is looked for inside the CSP header's `script-src` directive, not
 * anywhere in the file, so a hash left behind in another directive — or in a
 * second policy on the same file — cannot satisfy the check.
 *
 * If you changed the theme script deliberately: run this test, take the hash it
 * prints, and paste it into `script-src` in vercel.json.
 */
const ROOT = resolve(__dirname, "../../..");

const CSP_KEY = /^content-security-policy(-report-only)?$/i;

function inlineScripts(html: string): string[] {
  // Only `<script>` with no attributes — the ones a hash applies to. A
  // `<script src=…>` is covered by the origin allowlist instead.
  //
  // Case-INSENSITIVE, and the closing tag tolerates junk, because this regex is
  // load-bearing for the count assertion below and browsers are far more
  // forgiving than a naive pattern. `<SCRIPT>` is valid HTML and `</script foo>`
  // closes a script in every browser; a pattern that missed either would report
  // "exactly one inline script" while a second one sat there unhashed — the
  // count check silently passing is the one failure this file exists to prevent.
  return [...html.matchAll(/<script\s*>([\s\S]*?)<\/script\s*[^>]*>/gi)].map(
    (m) => m[1],
  );
}

const sha256 = (s: string) =>
  `sha256-${createHash("sha256").update(s, "utf8").digest("base64")}`;

type VercelJson = {
  headers?: { source: string; headers: { key: string; value: string }[] }[];
};

/** Every CSP header value in vercel.json, report-only or enforcing. */
function policiesFromVercelJson(text: string): string[] {
  const config = JSON.parse(text) as VercelJson;
  return (config.headers ?? [])
    .flatMap((rule) => rule.headers)
    .filter((h) => CSP_KEY.test(h.key))
    .map((h) => h.value);
}

/** The source tokens of a policy's `script-src` directive, or [] if absent. */
function scriptSrc(policy: string): string[] {
  for (const directive of policy.split(";")) {
    const [name, ...tokens] = directive.trim().split(/\s+/);
    if (name?.toLowerCase() === "script-src") return tokens;
  }
  return [];
}

const CONFIGS = [{ file: "vercel.json", policies: policiesFromVercelJson }];

describe("CSP inline-script hash", () => {
  const html = readFileSync(resolve(ROOT, "app/index.html"), "utf8");
  const scripts = inlineScripts(html);

  it("index.html carries exactly one attribute-less inline script", () => {
    // If this fails, the policy needs one hash PER inline script — the count is
    // the thing that silently invalidates the single-hash assumption below.
    expect(scripts).toHaveLength(1);
  });

  describe.each(CONFIGS)("$file", ({ file, policies }) => {
    it("every CSP header's script-src names that script's current hash", () => {
      const want = `'${sha256(scripts[0])}'`;
      const found = policies(readFileSync(resolve(ROOT, file), "utf8"));

      // Zero policies would make the loop below assert nothing — a renamed
      // header key must fail here, not pass silently.
      expect(found.length, `${file} has no Content-Security-Policy header`).toBeGreaterThan(0);

      for (const policy of found) {
        expect(
          scriptSrc(policy),
          `${file} does not allow the current inline script.\n` +
            `Expected script-src to contain:  ${want}\n` +
            `The theme setter in app/index.html changed; paste that hash into ` +
            `script-src in vercel.json.`,
        ).toContain(want);
      }
    });
  });
});
