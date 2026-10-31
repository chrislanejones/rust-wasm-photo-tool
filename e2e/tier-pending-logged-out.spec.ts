import { test, expect } from "./guard/test";
import { join } from "node:path";
import { blockExternalNetwork } from "./gallery-skeleton-harness";

// Night 10-27 — tier pending. A signed-in user whose `users.me` is in flight
// now sees a skeleton where the gallery max goes, instead of the free "24".
// The signed-in half is covered in vitest (app/session/useUserMode.pending.test.tsx:
// this harness has no Clerk session to sign in with). THIS spec pins the other
// half in the real production build: logged out, nothing is pending, ever.
// The count reads "12 max" and the pending box never appears, not even for a
// frame — a MutationObserver installed before the app records every max the
// header ever showed.

test.setTimeout(120_000);

const fx = (p: string) => join(__dirname, "fixtures", p);

test("logged out: the gallery max is 12 from the first frame and never pending", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await blockExternalNetwork(page);
  await page.addInitScript(() => {
    const seen = { pending: 0, maxes: [] as string[] };
    (window as unknown as { __tierSeen: typeof seen }).__tierSeen = seen;
    const look = () => {
      if (document.querySelector('[data-testid="gallery-max-pending"]')) seen.pending++;
      for (const h of document.querySelectorAll("h2")) {
        const m = /(\d+)\s*max/.exec(h.textContent ?? "");
        if (m && seen.maxes[seen.maxes.length - 1] !== m[1]) seen.maxes.push(m[1]);
      }
    };
    new MutationObserver(look).observe(document, { subtree: true, childList: true, characterData: true });
  });
  await page.goto("/");
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: "attached" });
  await input.setInputFiles([fx("checker.png"), fx("sky-building.png")]);

  const count = page.locator("h2", { hasText: /photos?/ }).first();
  await expect(count).toContainText(/2\s*photos\s*·\s*12\s*max/, { timeout: 60_000 });
  // Hold a while past the 300 ms grace and the 1.2 s boot auth window.
  await page.waitForTimeout(2_000);
  await expect(count).toContainText(/2\s*photos\s*·\s*12\s*max/);

  const seen = await page.evaluate(() => (window as unknown as { __tierSeen: { pending: number; maxes: string[] } }).__tierSeen);
  expect(seen.pending, "the pending box never appeared").toBe(0);
  expect(seen.maxes, "the only max ever shown is the logged-out 12").toEqual(["12"]);
});
