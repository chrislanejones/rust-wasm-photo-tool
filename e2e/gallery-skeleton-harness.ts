// Shared harness for e2e/gallery-skeleton-region.spec.ts (UI Night 8 §1).
//
// Thumbnail decodes are fast — a small WebP lands far inside the 300 ms grace —
// so the skeleton is only reachable when a decode is held open ON PURPOSE.
// This wraps `window.Image` (the same technique as phone-grid-thumbs) so every
// `blob:` load is either delayed by a fixed time ("delay"), held until the test
// releases it ("hold"), or left alone ("off"). The mode lives in
// sessionStorage so it survives the reload a restore needs, and can be changed
// live through `window.__blobHold`.
//
// It also starts a frame watcher at document start: a skeleton that flashes
// for two frames is invisible to a polling test driver, so the peak is
// recorded from a rAF loop INSIDE the page.
import type { Page } from "@playwright/test";

export type HoldMode = { mode: "off" } | { mode: "delay"; ms: number } | { mode: "hold" };

export async function installHarness(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Cfg = { mode: "off" } | { mode: "delay"; ms: number } | { mode: "hold" };
    const w = window as unknown as {
      __blobHold: Cfg;
      __held: { img: HTMLImageElement; v: string }[];
      __releaseBlobs: (keepLast?: number) => number;
      __watch: { region: number; tiles: number; frames: number };
      Image: unknown;
    };
    try {
      w.__blobHold = JSON.parse(sessionStorage.getItem("__blobHold") || '{"mode":"off"}') as Cfg;
    } catch {
      w.__blobHold = { mode: "off" };
    }
    w.__held = [];
    const srcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src")!;
    w.__releaseBlobs = (keepLast = 0) => {
      const n = Math.max(0, w.__held.length - keepLast);
      for (const { img, v } of w.__held.splice(0, n)) srcDesc.set!.call(img, v);
      return n;
    };
    const Native = window.Image;
    function Delayed(this: unknown, ...args: unknown[]) {
      const img = new (Native as unknown as new (...a: unknown[]) => HTMLImageElement)(...args);
      Object.defineProperty(img, "src", {
        configurable: true,
        get() {
          return srcDesc.get!.call(img);
        },
        set(v: string) {
          const cfg = w.__blobHold;
          if (typeof v === "string" && v.startsWith("blob:") && cfg.mode !== "off") {
            if (cfg.mode === "delay") window.setTimeout(() => srcDesc.set!.call(img, v), cfg.ms);
            else w.__held.push({ img, v });
            return;
          }
          srcDesc.set!.call(img, v);
        },
      });
      return img;
    }
    Delayed.prototype = Native.prototype;
    w.Image = Delayed;

    // Reachable = not under an `inert` ancestor (the phone layer makes the
    // editor under it inert, and that editor has a gallery of its own).
    w.__watch = { region: 0, tiles: 0, frames: 0 };
    const tick = () => {
      const reach = (sel: string) => [...document.querySelectorAll(sel)].filter((e) => !e.closest("[inert]")).length;
      w.__watch.region = Math.max(w.__watch.region, reach('[data-skeleton-region="gallery"]'));
      w.__watch.tiles = Math.max(w.__watch.tiles, reach("[data-skeleton-skip] .skeleton"));
      w.__watch.frames++;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** Set the hold mode now AND for the next load (a reload for Resume). */
export async function setHold(page: Page, cfg: HoldMode): Promise<void> {
  await page.evaluate((c) => {
    sessionStorage.setItem("__blobHold", JSON.stringify(c));
    (window as unknown as { __blobHold: unknown }).__blobHold = c;
  }, cfg);
}

export async function resetWatch(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __watch: object }).__watch = { region: 0, tiles: 0, frames: 0 };
  });
}

export async function readWatch(page: Page): Promise<{ region: number; tiles: number; frames: number }> {
  return page.evaluate(() => (window as unknown as { __watch: { region: number; tiles: number; frames: number } }).__watch);
}

export async function releaseBlobs(page: Page, keepLast = 0): Promise<number> {
  return page.evaluate((k) => (window as unknown as { __releaseBlobs: (k: number) => number }).__releaseBlobs(k), keepLast);
}

export async function blockExternalNetwork(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
      return route.continue();
    }
    return route.abort();
  });
}

/**
 * The gallery card's state in ONE evaluate (under a hold, state can move
 * between two separate locator calls). `root` is the reachable region element:
 * the desktop card's region or the phone's.
 */
export async function probe(page: Page) {
  return page.evaluate(() => {
    const reach = <T extends Element>(sel: string) =>
      [...document.querySelectorAll<T>(sel)].filter((e) => !e.closest("[inert]") && (e as unknown as HTMLElement).offsetParent !== null);
    const strip = reach<HTMLElement>("[data-skeleton-skip]")[0] ?? null;
    const region = document.querySelector<HTMLElement>('[data-skeleton-region="gallery"]:not([inert] *)');
    const sr = strip?.getBoundingClientRect();
    const tiles = strip
      ? [...strip.querySelectorAll<HTMLElement>("[data-id]")].map((t) => {
          const r = t.getBoundingClientRect();
          const inView = !!sr && r.right > sr.left && r.left < sr.right && r.bottom > sr.top && r.top < sr.bottom;
          return {
            id: t.dataset.id!,
            inView,
            hasImg: !!t.querySelector("img"),
            skeleton: !!t.querySelector(".skeleton"),
            // LAYOUT size (offset*) and the painted CENTER relative to the
            // strip: a restored tile runs its enter animation (a scale about
            // its center), which is not a layout shift — and offsetLeft would
            // change with the offsetParent, which the region's
            // `position: relative` is while it shows.
            box: [
              Math.round(r.left + r.width / 2 - (sr?.left ?? 0)),
              Math.round(r.top + r.height / 2 - (sr?.top ?? 0)),
              t.offsetWidth,
              t.offsetHeight,
            ],
          };
        })
      : [];
    const gallery = strip?.closest("[data-gallery-card]") as HTMLElement | null;
    // The card's own box: the bordered bar on desktop (the region's parent),
    // the region itself on the phone, where it fills the layer.
    const cardBox = (gallery?.parentElement?.closest(".group") ?? gallery)?.getBoundingClientRect();
    // Chrome pieces = the inert-able elements inside the gallery card.
    const chrome = gallery ? [...gallery.querySelectorAll<HTMLElement>("[data-gallery-chrome]")] : [];
    return {
      loading: !!region,
      statuses: gallery ? [...gallery.querySelectorAll('[role="status"]')].map((s) => s.textContent) : [],
      busy: gallery ? gallery.querySelectorAll('[aria-busy="true"]').length : 0,
      chromeInert: chrome.length > 0 && chrome.every((c) => c.inert),
      chromeCount: chrome.length,
      chromeBoxes: chrome.map((c) => {
        const r = c.getBoundingClientRect();
        return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
      }),
      card: cardBox ? [Math.round(cardBox.x), Math.round(cardBox.y), Math.round(cardBox.width), Math.round(cardBox.height)] : null,
      tiles,
    };
  });
}
