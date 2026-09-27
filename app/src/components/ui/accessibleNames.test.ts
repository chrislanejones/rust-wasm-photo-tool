import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* Night 5 §5 — no `title=` stands in for an accessible name.
 *
 * `title` is not read reliably by screen readers, so an icon-only control whose
 * ONLY name is its title is, to many of them, a button called "button".
 *
 * The classification behind this (150 `title=` in app/src, comments stripped):
 *   60  component props rendered as VISIBLE heading text — not tooltips at all
 *        (SectionHeader, PaneHeading, ConfirmDialog, FieldLabel, …)
 *   62  props forwarded to the DOM as a native tooltip
 *   28  raw DOM `title` attributes
 * ToolButton and IconButton always set aria-label, and ActionTile renders its
 * label as text — safe by construction. The defects were the generic Button and
 * raw <button>, used icon-only.
 *
 * Verified in a real build at 1280: "Remove image" and "Select image" sit on
 * every gallery thumbnail — with 12 photos that was 24 unnamed controls.
 */

const SRC = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

/** The attribute text of the element whose title is `title`. */
function elementWithTitle(src: string, title: string): string {
  const i = src.indexOf(title);
  expect(i, `title ${title} not found`).toBeGreaterThan(-1);
  const open = src.lastIndexOf("<", i);
  const close = src.indexOf(">", i);
  return src.slice(open, close + 1);
}

describe("icon-only controls carry a real name", () => {
  const review = read("features/canvas/ReviewPanel.tsx");
  const gallery = read("features/gallery/GalleryBar.tsx");
  const dims = read("components/DimensionFields.tsx");

  it.each([
    ["Undo", 'title="Undo"'],
    ["Redo", 'title="Redo"'],
    ["Open the Layers tool", 'title="Open the Layers tool (move, resize, mask)"'],
  ])("ReviewPanel %s", (name, title) => {
    expect(elementWithTitle(review, title)).toContain(`aria-label="${name}"`);
  });

  it("all three ReviewPanel 'Close section' buttons", () => {
    const n = review.split('aria-label="Close section"').length - 1;
    expect(n).toBe(3);
  });

  it("Add layer is named for what it does, not for why it is disabled", () => {
    // Its title is a disabled-reason ("Layer limit reached (8)"). That was the
    // only name, so a screen reader never learned the button adds a layer.
    const i = review.indexOf("onClick={onAddLayer}");
    expect(review.slice(i, i + 500)).toMatch(/aria-label="Add layer"/);
  });

  it("gallery Remove is named", () => {
    expect(elementWithTitle(gallery, 'title="Remove"')).toContain('aria-label="Remove image"');
  });
});

describe("toggles have a stable name and say which way they are", () => {
  // Night 2's toggle rule. A flipping title as the only name made a screen
  // reader say "Unlock aspect ratio, pressed" — which contradicts itself.
  it("aspect-ratio lock", () => {
    const el = elementWithTitle(read("components/DimensionFields.tsx"), 'title={lockAspect ? "Unlock aspect ratio" : "Lock aspect ratio"}');
    expect(el).toContain('aria-label="Lock aspect ratio"');
    expect(el).toContain("aria-pressed={lockAspect}");
  });

  it("gallery select", () => {
    const el = elementWithTitle(read("features/gallery/GalleryBar.tsx"), 'title={selected ? "Deselect" : "Select"}');
    expect(el).toContain('aria-label="Select image"');
    expect(el).toContain("aria-pressed={selected}");
  });
});

describe("responsive labels stay in the accessibility tree", () => {
  it("the gallery label is sr-only below sm, never display:none", () => {
    // `hidden` is display:none, which removes the text from the accessibility
    // tree as well as the screen. sr-only hides it visually only.
    const src = read("features/gallery/GalleryBar.tsx");
    expect(src).toMatch(/const label = vertical \? "inline" : "sr-only sm:not-sr-only";/);
    expect(src).not.toMatch(/const label = [^;]*"hidden sm:inline"/);
  });
});
