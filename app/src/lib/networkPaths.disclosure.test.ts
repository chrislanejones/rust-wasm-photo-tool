import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NETWORK_PATHS } from "./networkPaths";

/* The privacy policy must name every path in the network registry.
 *
 * The policy stays hand-written — it is legal text, and generating it would
 * be the wrong trade. So this is the other half: a registry path the policy
 * does not mention fails here, in CI, in the same PR that added the path.
 *
 * It matches each path's `disclosedAs` phrase against the policy's RENDERED
 * text, not its source: a phrase that only survives in a JSX comment or a
 * prop is not a disclosure. Tags and `{…}` expressions are stripped first.
 *
 * The phrases are deliberately specific. "back" would also match "background"
 * and "feedback", and a test that passes when the disclosure is gone is worse
 * than no test.
 */

// Lives in the APP suite on purpose: marketing/ has no test runner, so a test
// there would never run — a gate nobody can run is worse than none. The app
// suite runs on every PR, and reads the policy by path.
const source = readFileSync(
  join(__dirname, "..", "..", "..", "marketing", "src", "pages", "PrivacyPolicy.tsx"),
  "utf8",
);

/** The policy as a reader sees it: JSX comments, tags and expressions gone,
 *  common entities decoded, whitespace folded. */
function rendered(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ") // JSX comments
    .replace(/\/\*[\s\S]*?\*\//g, " ") // block comments
    .replace(/^\s*\/\/.*$/gm, " ") // line comments
    .replace(/<[^>]+>/g, " ") // tags
    .replace(/\{[^{}]*\}/g, " ") // expressions
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&rsaquo;/g, "›")
    .replace(/&mdash;/g, "—")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

const text = rendered(source);

describe("the privacy policy names every network path", () => {
  it.each(NETWORK_PATHS.map((p) => [p.id, p.disclosedAs]))(
    "%s — must say %j",
    (_id, phrase) => {
      expect(text).toContain(phrase);
    },
  );

  it("reads rendered text, not comments", () => {
    // The guard for the guard: a phrase hidden in a comment must not count.
    expect(rendered("{/* share links */}<p>nothing</p>")).not.toContain("share links");
    expect(rendered("// share links\n<p>nothing</p>")).not.toContain("share links");
  });

  it("no phrase is so short it matches by accident", () => {
    for (const p of NETWORK_PATHS) {
      expect(p.disclosedAs.length, p.id).toBeGreaterThanOrEqual(5);
    }
  });
});
