import { test, expect } from "./guard/test";
import type { Page } from "@playwright/test";

// Plan A §2 — a lit tile must be readable in BOTH themes.
//
//   text   ≥ 4.5:1   (WCAG 2.1 AA, normal text)
//   border ≥ 3:1     (AA non-text contrast, against the surface behind it)
//
// Before this, light theme measured 2.24:1 text and 2.67:1 border on every
// selected tile in the app. Dark measured 8.05 and 13.93 and is untouched.
//
// ⚠️ MEASURED FROM COMPUTED STYLES, NOT FROM THE TOKENS. A test that reads
// `--primary-strong` out of the stylesheet and does the arithmetic would pass
// while the utility class that is supposed to use it emits no rule at all —
// the inert-class failure mode CLAUDE.md describes, where `bg-theme-nope`
// produces no CSS, no warning, and an element with no background. So this
// renders the real `activeCls` and asks the browser what colour it ended up.

const THEMES = ["light", "dark"] as const;

/**
 * Contrast of the real lit-tile classes against a real surface.
 *
 * Tailwind v4 computes a `/20` tint to `oklab(... / 0.2)`, which no rgb regex
 * can read, so every colour is normalised by painting it into a 1×1 canvas and
 * reading the pixel back. That also gives the alpha needed to composite the
 * tint over the surface underneath it.
 */
async function measure(page: Page, theme: "light" | "dark") {
  return page.evaluate((themeName) => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 1;
    const ctx = cv.getContext("2d", { willReadFrequently: true })!;
    const rgba = (css: string) => {
      ctx.fillStyle = "#000";
      ctx.fillStyle = css;
      ctx.globalCompositeOperation = "copy";
      ctx.fillRect(0, 0, 1, 1);
      ctx.globalCompositeOperation = "source-over";
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return { r: d[0]!, g: d[1]!, b: d[2]!, a: d[3]! / 255 };
    };
    type C = { r: number; g: number; b: number; a: number };
    const over = (f: C, b: C): C => ({
      r: f.r * f.a + b.r * (1 - f.a),
      g: f.g * f.a + b.g * (1 - f.a),
      b: f.b * f.a + b.b * (1 - f.a),
      a: 1,
    });
    const lum = (c: C) => {
      const f = (v: number) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const ratio = (a: C, b: C) => {
      const l1 = lum(a);
      const l2 = lum(b);
      return +(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2));
    };

    const html = document.documentElement;
    const had = html.classList.contains("dark");
    if (themeName === "dark") html.classList.add("dark");
    else html.classList.remove("dark");

    const host = document.createElement("div");
    host.style.position = "fixed";
    host.style.left = "-9999px";
    // The two surfaces a tile actually sits on: a panel and an elevated card.
    host.innerHTML = `
      <div id="c-surf" class="bg-bg-secondary">
        <div id="c-tile" class="border-theme-primary-strong bg-theme-primary/20 text-theme-primary-strong">Aa</div>
      </div>
      <div id="e-surf" class="bg-bg-elevated">
        <div id="e-tile" class="border-theme-primary-strong bg-theme-primary/20 text-theme-primary-strong">Aa</div>
      </div>`;
    document.body.appendChild(host);

    const one = (tileId: string, surfId: string) => {
      const t = getComputedStyle(document.getElementById(tileId)!);
      const surface = rgba(getComputedStyle(document.getElementById(surfId)!).backgroundColor);
      const fill = rgba(t.backgroundColor);
      return {
        // An inert utility paints nothing, so the tint would come back fully
        // transparent. Reported so a silent no-op cannot read as a pass.
        fillAlpha: +fill.a.toFixed(3),
        text: ratio(rgba(t.color), over(fill, surface)),
        border: ratio(rgba(t.borderTopColor), surface),
      };
    };

    const out = { panel: one("c-tile", "c-surf"), elevated: one("e-tile", "e-surf") };
    host.remove();
    if (had) html.classList.add("dark");
    else html.classList.remove("dark");
    return out;
  }, theme);
}

test.setTimeout(120_000);

for (const theme of THEMES) {
  test(`a lit tile is readable in ${theme} theme`, async ({ page }) => {
    await page.goto("/");
    const m = await measure(page, theme);
    console.log(`${theme}: panel ${JSON.stringify(m.panel)} elevated ${JSON.stringify(m.elevated)}`);

    for (const [where, v] of Object.entries(m)) {
      // Guards the inert-class trap: a class that emits no rule leaves the
      // tint transparent, and every ratio would then be measured against the
      // bare surface and look fine.
      expect(v.fillAlpha, `${where}: the tint utility actually emits a rule`).toBeGreaterThan(0.1);
      expect(v.fillAlpha, `${where}: the tint is a tint, not a solid fill`).toBeLessThan(0.5);
      expect(v.text, `${where}: lit-tile label ≥ 4.5:1 (AA)`).toBeGreaterThanOrEqual(4.5);
      expect(v.border, `${where}: lit-tile border ≥ 3:1 (AA non-text)`).toBeGreaterThanOrEqual(3);
    }
  });
}
