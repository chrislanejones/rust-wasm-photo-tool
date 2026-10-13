import { test, expect } from "./guard/test";
import { join } from "node:path";
import { blockExternalNetwork } from "./gallery-skeleton-harness";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 });
  await blockExternalNetwork(page);
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(join(__dirname, "fixtures/checker.png"));
  await expect(page.locator("canvas.main-canvas")).toBeVisible();
  const notice = page.getByRole("button", { name: "Continue", exact: true });
  if (await notice.isVisible()) await notice.click();
  await page.getByRole("button", { name: /^Settings/ }).first().click();
});

test("Settings has a linked vertical tab rail with roving keyboard focus", async ({ page }, info) => {
  for (const theme of ['light', 'dark']) {
    await page.evaluate(d => document.documentElement.classList.toggle('dark', d), theme === 'dark');
    await page.getByRole('dialog').screenshot({ path: info.outputPath(`settings-${theme}.png`), animations: 'disabled' });
  }
  const rail = page.getByRole('tablist', { name: 'Settings sections' });
  await expect(rail).toHaveAttribute('aria-orientation', 'vertical');
  const first = rail.getByRole('tab').first();
  await first.focus();
  await page.keyboard.press('ArrowDown');
  await expect(rail.getByRole('tab').nth(1)).toBeFocused();
  await expect(rail.getByRole('tab').nth(1)).toHaveAttribute('aria-selected', 'true');
  const selected = rail.getByRole('tab', { selected: true });
  await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', (await selected.getAttribute('id'))!);
  await page.keyboard.press('End');
  await expect(rail.getByRole('tab').last()).toBeFocused();
  await page.keyboard.press('Home');
  await expect(first).toBeFocused();
  await expect(rail.locator('[tabindex="0"]')).toHaveCount(1);
});

test("muted text and shortcut headings meet AA on their actual surface tokens", async ({ page }, info) => {
  const results: { theme: string; surface: string; ratio: number }[] = [];
  for (const theme of ['light', 'dark']) {
    await page.evaluate(d => document.documentElement.classList.toggle('dark', d), theme === 'dark');
    const samples = await page.evaluate(() => {
      const ratio = (a: string, b: string) => {
        const lum = (rgb: string) => rgb.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(c => c / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4).reduce((n,c,i) => n + c * [0.2126,0.7152,0.0722][i]!,0);
        const x = lum(a), y = lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
      };
      return ['secondary','tertiary','elevated'].map(surface => {
        const probe = document.createElement('span');
        probe.style.color = 'var(--text-muted)'; probe.style.backgroundColor = `var(--bg-${surface})`;
        document.body.append(probe); const s = getComputedStyle(probe);
        const result = { surface, ratio: ratio(s.color,s.backgroundColor) }; probe.remove(); return result;
      }).concat((() => {
        const probe = document.createElement('span'); probe.className = 'shortcut-group-title'; probe.style.backgroundColor = 'var(--bg-secondary)'; document.body.append(probe); const s = getComputedStyle(probe); const r = {surface:'shortcut heading',ratio:ratio(s.color,s.backgroundColor)}; probe.remove();return [r];
      })());
    });
    results.push(...samples.map(s => ({theme,...s})));
  }
  await info.attach('contrast', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
  console.log(JSON.stringify(results));
  for (const sample of results) expect(sample.ratio, `${sample.theme} ${sample.surface}`).toBeGreaterThanOrEqual(4.5);
});
