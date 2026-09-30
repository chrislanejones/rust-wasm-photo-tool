import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/* Night 5 §7 — the dialog contract, read from source.
 *
 * Each rule below is the fix for a defect measured in a real browser on
 * 09-26-2026, pinned so it cannot come back quietly.
 *
 * ── Why the comment stripping matters ─────────────────────────────────────
 * The first survey for rule 2 matched ONE hand-built dialog, and it was the
 * comment explaining that the old one used to be hand-built — prose inside a
 * JSX `{/* ... *\/}` block. This repo has turned CI red on a sentence twice
 * already (`role="button"` inside an explanation of the role="button" rule).
 * A check that reads prose as code is the failure it exists to prevent, so
 * every rule matches against source with comments removed.
 */

const SRC = join(__dirname, "..", "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Source with `//`, `/* *\/` and JSX `{/* *\/}` comments blanked out. Line
 *  breaks are kept so a failure still points at the right line. */
export function stripComments(src: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, " ");
  return src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, blank) // JSX {/* ... */}
    .replace(/\/\*[\s\S]*?\*\//g, blank) //        /* ... */
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (_m, pre: string) => pre); // // ...
}

const files = walk(SRC).map((p) => ({
  path: relative(SRC, p),
  code: stripComments(readFileSync(p, "utf8")),
}));

const UI_PRIMITIVES = /^components[\\/]ui[\\/]/;

describe("stripComments — the helper every rule depends on", () => {
  it("removes a JSX comment block, which is what fooled the first survey", () => {
    const src = `<div>{/* a createPortal'd <div role="dialog"> */}</div>`;
    expect(stripComments(src)).not.toContain('role="dialog"');
  });
  it("keeps real code that merely sits next to a comment", () => {
    const src = `<div role="dialog" /> // not a comment about role="x"`;
    expect(stripComments(src)).toContain('role="dialog"');
  });
  it("does not eat a URL's // as a comment", () => {
    expect(stripComments(`const u = "https://x.test";`)).toContain("https://x.test");
  });
});

describe("rule 1 — DialogDescription's colour is decided in one place", () => {
  it("the primitive uses text-secondary, not text-muted", () => {
    // Measured from computed styles on a real build: text-muted is 3.65:1 on
    // the light dialog surface, under AA's 4.5:1 for 14px text. secondary is
    // 6.99:1 light and 8.56:1 dark. Reverting to muted fails this.
    const dialog = files.find((f) => f.path.replace(/\\/g, "/") === "components/ui/dialog.tsx")!;
    const desc = dialog.code.slice(dialog.code.indexOf("const DialogDescription"));
    expect(desc).toMatch(/text-text-secondary/);
    expect(desc.slice(0, desc.indexOf("DialogDescription.displayName"))).not.toMatch(/text-text-muted/);
  });

  it("no call site overrides the description colour", () => {
    // Two did (the mobile settings sheet and the parked screen), each patching
    // the same contrast bug locally. A third patch is how the source of truth
    // splits again.
    const offenders = files
      .filter((f) => !UI_PRIMITIVES.test(f.path))
      .flatMap((f) =>
        [...f.code.matchAll(/<DialogDescription\b[^>]*className="([^"]*)"/g)]
          .filter((m) => /\btext-(text|theme)-[a-z-]+/.test(m[1]))
          .map((m) => `${f.path}: ${m[1]}`),
      );
    expect(offenders).toEqual([]);
  });
});

describe("rule 2 — no hand-built dialogs", () => {
  it("nothing outside components/ui writes role=\"dialog\" by hand", () => {
    // The restore confirm was a createPortal'd <div role="dialog">. It was not
    // in Radix's layer stack, so Escape closed SETTINGS underneath it and left
    // it orphaned over the editor; it had no focus trap, so Settings' trap
    // pulled focus straight back out of it. Every symptom came from being
    // hand-built. Use ui/dialog or ui/confirm-dialog.
    const offenders = files
      .filter((f) => !UI_PRIMITIVES.test(f.path))
      .filter((f) => /role=["'](alert)?dialog["']/.test(f.code))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it("no dialog listens for Escape on the window", () => {
    // UploadDialog did. A window listener fires on EVERY Escape regardless of
    // what is on top, which is the opposite of what a layered modal needs.
    // Radix already routes Escape to the topmost layer.
    const offenders = files
      .filter((f) => /Dialog/.test(f.path))
      .filter((f) => /window\.addEventListener\(\s*["']keydown["'][\s\S]{0,200}Escape/.test(f.code))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });
});

describe("rule 3 — UploadDialog is a real dialog", () => {
  const upload = files.find((f) => /features[\\/]upload[\\/]UploadDialog\.tsx$/.test(f.path))!;

  it("is built on ui/dialog", () => {
    expect(upload.code).toMatch(/from "@\/components\/ui\/dialog"/);
    expect(upload.code).toMatch(/<DialogContent\b/);
  });

  it("always renders a DialogTitle, so it is never announced as just 'dialog'", () => {
    // blankMode hides the logo header; the title must survive it.
    const titles = [...upload.code.matchAll(/<DialogTitle\b/g)].length;
    expect(titles).toBeGreaterThanOrEqual(2); // one per branch of blankMode
  });

  it("names its close button", () => {
    expect(upload.code).toMatch(/aria-label="Close"/);
  });

  it("routes every way out through handleTryClose, keeping the blocked-close shake", () => {
    // Escape, the backdrop and the ✕ all arrive at onOpenChange(false). If
    // this stops calling handleTryClose, a blocked close (canClose=false,
    // right after Delete All) would let the dialog go. Verified in a browser:
    // all three are refused.
    expect(upload.code).toMatch(/onOpenChange=\{\(next\)\s*=>\s*\{\s*if \(!next\) handleTryClose\(\);/);
  });
});
