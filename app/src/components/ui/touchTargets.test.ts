import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* Night 5 §6 — dialog controls are 44px targets on a phone.
 *
 * Measured live at 390px on a real build, before and after:
 *   dialog close   24×24  →  44×44   (all four edges hit by elementFromPoint)
 *   footer button  38 tall →  44 tall
 *   desktop close  24×24  →  24×24   (unchanged — the rule is phone-only)
 *   UploadDialog   position absolute, pinned 17px — unchanged
 *
 * The measurement itself needs a browser. What these pin is the SHAPE of the
 * rule, because both traps it was written around are invisible to tsc, eslint
 * and the rest of the suite.
 */

const SRC = join(__dirname, "..", "..");
const css = readFileSync(join(SRC, "styles.css"), "utf8");
const dialog = readFileSync(join(SRC, "components/ui/dialog.tsx"), "utf8");
const upload = readFileSync(join(SRC, "features/upload/UploadDialog.tsx"), "utf8");

const block = (() => {
  const i = css.indexOf('.btn-icon[data-slot="dialog-close"]');
  const media = css.lastIndexOf("@media", i);
  const end = css.indexOf("\n}\n", i);
  return css.slice(media, end + 2);
})();

describe("the phone-width dialog target rule", () => {
  it("exists, and is scoped to phone width", () => {
    expect(block).toMatch(/@media \(max-width: 639\.98px\)/);
  });

  it("makes the dialog close 44×44", () => {
    expect(block).toMatch(/\.btn-icon\[data-slot="dialog-close"\]\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/);
  });

  it("gives footer buttons a 44px minimum height", () => {
    expect(block).toMatch(/\[data-slot="dialog-footer"\] button\s*\{[^}]*min-height:\s*44px;/);
  });

  it("NEVER sets position — that would out-rank UploadDialog's `absolute`", () => {
    // UploadDialog pins its close with the `absolute` utility. A position in
    // this rule would win and pull the button out of its corner.
    expect(block).not.toMatch(/position\s*:/);
  });

  it("is one attribute more specific than .btn-icon, which is un-layered", () => {
    // .btn-icon sits outside every @layer, so it beats any Tailwind utility
    // regardless of specificity. A `max-sm:size-11` would have lost silently;
    // this rule competes on specificity instead, as un-layered CSS.
    expect(block).toMatch(/\.btn-icon\[data-slot="dialog-close"\]/);
    const before = css.slice(0, css.indexOf(block));
    const opens = (before.match(/\{/g) || []).length;
    const closes = (before.match(/\}/g) || []).length;
    expect(opens - closes).toBe(0); // the @media is at top level: un-layered
  });

  it("does not touch .btn-icon everywhere — the zoom controls stay dense", () => {
    // Only the tagged dialog close grows. A bare `.btn-icon` in this block
    // would enlarge every icon button in the app on a phone.
    expect(block).not.toMatch(/(^|\s|,)\.btn-icon\s*\{/);
  });
});

describe("both dialog close buttons carry the tag the rule targets", () => {
  it("the shared DialogHeader close", () => {
    expect(dialog).toMatch(/aria-label="Close" data-slot="dialog-close"/);
  });
  it("UploadDialog's own close", () => {
    expect(upload).toMatch(/aria-label="Close" data-slot="dialog-close"/);
  });
  it("the shared DialogFooter", () => {
    expect(dialog).toMatch(/data-slot="dialog-footer"/);
  });
});
