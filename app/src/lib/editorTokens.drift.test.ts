import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
// @ts-expect-error — a plain .mjs build script, untyped on purpose.
import { renderEditorTokens } from "../../../marketing/scripts/gen-editor-tokens.mjs";
// @ts-expect-error — a plain .mjs build script, untyped on purpose.
import { renderSiteTokens } from "../../../marketing/scripts/gen-site-tokens.mjs";
import { LINKED_PATHS } from "../../../marketing/src/data/designSystem";

// The public /design-system page shows the editor's real colors. It reads them
// from a generated copy (marketing can't reach outside marketing/ on Vercel),
// and a copy goes stale silently. This is the check: the copy must say exactly
// what this stylesheet says, or CI fails and names the fix.
describe("the design-system page's copy of the editor tokens", () => {
  it("matches app/src/styles.css", () => {
    const root = resolve(__dirname, "../../..");
    const css = readFileSync(resolve(root, "app/src/styles.css"), "utf8");
    const committed = readFileSync(resolve(root, "marketing/src/data/editorTokens.ts"), "utf8");
    expect(committed, "run `pnpm -C marketing run gen:tokens` and commit the result").toBe(renderEditorTokens(css));
  });
});

// The Marketing tab prints the site's own token values the same way.
describe("the design-system page's copy of the site tokens", () => {
  it("matches marketing/src/tokens.css", () => {
    const root = resolve(__dirname, "../../..");
    const css = readFileSync(resolve(root, "marketing/src/tokens.css"), "utf8");
    const committed = readFileSync(resolve(root, "marketing/src/data/siteTokens.ts"), "utf8");
    expect(committed, "run `pnpm -C marketing run gen:tokens` and commit the result").toBe(renderSiteTokens(css));
  });
});

describe("the design-system page's links into the repo", () => {
  it("every linked file exists", () => {
    const root = resolve(__dirname, "../../..");
    const missing = LINKED_PATHS.filter((p: string) => !existsSync(resolve(root, p)));
    expect(missing, "a component or doc the page links to was moved or deleted").toEqual([]);
  });
});
