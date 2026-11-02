import { test, expect } from '../guard/test';
import { join } from 'node:path';
import { installAnnotationProbe, screenPoint } from '../annotation-benchmark-harness';

// Run with a temporary config extending playwright.config, testDir e2e/archive,
// testIgnore [], and testMatch /release-1102\.spec\.ts$/.
// Production-build release QC: v9.46's text outline and v9.51's banner removal.
test('text outline survives commit, undo/redo and reload; seasonal artwork is gone', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.route('**/*', route => {
    const u = new URL(route.request().url());
    return ['localhost', '127.0.0.1'].includes(u.hostname) || ['blob:', 'data:'].includes(u.protocol)
      ? route.continue() : route.abort();
  });
  await page.addInitScript(() => localStorage.setItem('image-horse-prefs', JSON.stringify({ canvasArtboard: false })));
  await page.goto('/');
  await expect(page.getByRole('img', { name: /Fall back: clocks/i })).toHaveCount(0);
  await page.locator('input[type="file"]').first().setInputFiles(join(__dirname, '../fixtures/paper-1200x900.png'));
  await expect.poll(() => page.locator('canvas.main-canvas').getAttribute('width')).toBe('1200');
  await installAnnotationProbe(page);
  const hash = () => page.evaluate(() => window.__annotationTool.composite_hash_hex());
  const texts = () => page.evaluate(async () => JSON.parse(await window.__annotationTool.get_text_annotations()));
  const before = await hash();
  await page.getByRole('button', { name: 'Create', exact: true }).first().click();
  await page.getByRole('button', { name: 'Text', exact: true }).first().click();
  const panel = page.getByRole('region', { name: 'Tool options' });
  const disclosure = panel.locator('button[aria-expanded]').filter({ hasText: /^Stroke/ });
  await disclosure.focus();
  await page.keyboard.press('Enter');
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  const slider = panel.getByRole('slider', { name: /Stroke Width/ });
  await slider.focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveValue('4');
  const p = await screenPoint(page, 400, 400);
  await page.mouse.click(p.x, p.y);
  await page.locator('textarea[data-text-overlay]').fill('Outline QC');
  const away = await screenPoint(page, 1100, 120);
  await page.mouse.click(away.x, away.y);
  await expect.poll(async () => (await texts()).length).toBe(1);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await texts())[0]?.stroke_width).toBe(4);
  const after = await hash();
  expect(after).not.toBe(before);
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  // Text Stroke is a separate history operation from Add Text.
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await texts())[0]?.stroke_width).toBe(0);
  await page.keyboard.press('Control+z');
  await expect.poll(hash).toBe(before);
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(async () => (await texts()).length).toBe(1);
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(hash).toBe(after);
  await page.waitForTimeout(6000);
  await page.reload();
  await page.getByRole('button', { name: /Resume editing/i }).click();
  await expect.poll(() => page.locator('canvas.main-canvas').getAttribute('width')).toBe('1200');
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await installAnnotationProbe(page);
  await expect.poll(hash).toBe(after);
  await expect.poll(async () => (await texts())[0]?.stroke_width).toBe(4);
  expect(errors.filter(e => !/clerk|ERR_FAILED/.test(e))).toEqual([]);
});
