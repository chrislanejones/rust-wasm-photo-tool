// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Button } from "./button";

// Plan B §2 — `Button` grew a second axis (`variant`) so that `ghost`, `link`
// and `secondary` exist at all, and 14 hand-rolled `<button>` tags can stop
// being hand-rolled.
//
// ⚠️ THE RISK IS NOT THE NEW VARIANTS, IT IS THE 70 EXISTING CALL SITES.
// The elevated surface used to live ON the size axis; it had to move off so a
// variant axis could exist. It is applied back through `compoundVariants` to
// exactly the two size/variant pairs that had it — so every combination that
// existed before must render the SAME SET of classes it always did, or 70
// buttons across 24 files change appearance at once.
//
// Compared as a SET, not as a string: splitting one list into two changes the
// order the classes are concatenated in, and order only matters to
// tailwind-merge when two classes fight over the same property. None here do.

const classesOf = (el: HTMLElement) => new Set(el.className.split(/\s+/).filter(Boolean));
const btn = (ui: React.ReactElement) => {
  const { container } = render(ui);
  return classesOf(container.querySelector("button")!);
};

describe("the four combinations that existed before are unchanged", () => {
  // Captured from the build BEFORE the variant axis was added.
  const BEFORE: Record<string, string> = {
    xs: "btn-icon btn-icon-xs",
    tiny: "btn-icon",
    default:
      "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold " +
      "text-text-primary transition-all [&_svg]:size-[1em] bg-bg-elevated border border-border " +
      "hover:border-border-active hover:brightness-110 disabled:cursor-not-allowed " +
      "disabled:bg-bg-tertiary disabled:text-text-muted disabled:border-transparent " +
      "disabled:hover:brightness-100 disabled:hover:border-transparent",
    large:
      "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold " +
      "text-text-primary transition-all [&_svg]:size-[1em] bg-bg-elevated border border-border " +
      "hover:border-border-active hover:brightness-110 disabled:cursor-not-allowed " +
      "disabled:bg-bg-tertiary disabled:text-text-muted disabled:border-transparent " +
      "disabled:hover:brightness-100 disabled:hover:border-transparent",
  };

  it.each(["xs", "tiny", "default", "large"] as const)("size=%s renders what it always did", (size) => {
    expect(btn(<Button size={size}>x</Button>)).toEqual(new Set(BEFORE[size]!.split(/\s+/)));
  });

  it("an explicit variant=\"default\" is the same as omitting it", () => {
    expect(btn(<Button size="large">x</Button>)).toEqual(btn(<Button size="large" variant="default">x</Button>));
  });
});

describe("the icon sizes take their surface from CSS, and must not get a second one", () => {
  it("xs and tiny stay bare class names at the default variant", () => {
    // `.btn-icon` already sets background, border and colour. Adding the
    // elevated utility surface on top would double the border and fight the
    // 24x24 geometry — which is why the surface is applied by compound pair
    // rather than by variant alone.
    expect(btn(<Button size="tiny">x</Button>)).toEqual(new Set(["btn-icon"]));
    expect(btn(<Button size="xs">x</Button>)).toEqual(new Set(["btn-icon", "btn-icon-xs"]));
  });

  it("an icon ghost is a CSS modifier, not utilities", () => {
    // Utilities are not a reliable override for the plain-CSS properties on
    // `.btn-icon`, so ghost at an icon size adds `.btn-icon-ghost` instead.
    expect(btn(<Button size="tiny" variant="ghost">x</Button>)).toEqual(
      new Set(["btn-icon", "btn-icon-ghost"]),
    );
    expect(btn(<Button size="xs" variant="ghost">x</Button>)).toEqual(
      new Set(["btn-icon", "btn-icon-xs", "btn-icon-ghost"]),
    );
  });
});

describe("the new variants are actually different from default", () => {
  it.each(["ghost", "secondary", "link"] as const)("%s does not wear the elevated surface", (variant) => {
    const c = btn(<Button size="default" variant={variant}>x</Button>);
    // The one thing every new variant must NOT have: the default's filled,
    // bordered surface. A variant that silently fell through to it would look
    // right in isolation and wrong beside a real default button.
    expect(c.has("bg-bg-elevated")).toBe(false);
    expect(c.has("border-border")).toBe(false);
    // ...while keeping the shared geometry, so it still lines up in a row.
    expect(c.has("inline-flex")).toBe(true);
  });

  it("each new variant is distinct from the others", () => {
    const sets = (["default", "ghost", "secondary", "link"] as const).map((v) =>
      [...btn(<Button size="default" variant={v}>x</Button>)].sort().join(" "),
    );
    expect(new Set(sets).size).toBe(4);
  });

  it("link drops the button box entirely", () => {
    const c = btn(<Button variant="link">x</Button>);
    expect(c.has("px-0")).toBe(true);
    expect(c.has("border-0")).toBe(true);
  });
});
