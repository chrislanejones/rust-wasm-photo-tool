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
 * So this test recomputes the hash from index.html and asserts netlify.toml
 * still names it. It fails in CI at the moment the script changes, which is the
 * moment someone can still fix it cheaply.
 *
 * If you changed the theme script deliberately: run this test, take the hash it
 * prints, and paste it into netlify.toml's `script-src`.
 */
const ROOT = resolve(__dirname, "../../..");

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

describe("CSP inline-script hash", () => {
  const html = readFileSync(resolve(ROOT, "app/index.html"), "utf8");
  const netlify = readFileSync(resolve(ROOT, "netlify.toml"), "utf8");
  const scripts = inlineScripts(html);

  it("index.html carries exactly one attribute-less inline script", () => {
    // If this fails, the policy needs one hash PER inline script — the count is
    // the thing that silently invalidates the single-hash assumption below.
    expect(scripts).toHaveLength(1);
  });

  it("netlify.toml's script-src names that script's current hash", () => {
    const want = sha256(scripts[0]);
    expect(
      netlify.includes(want),
      `netlify.toml does not allow the current inline script.\n` +
        `Expected script-src to contain:  '${want}'\n` +
        `The theme setter in app/index.html changed; paste that hash into the ` +
        `Content-Security-Policy-Report-Only line in netlify.toml.`,
    ).toBe(true);
  });
});
