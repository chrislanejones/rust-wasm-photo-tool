import type { Page } from "@playwright/test";
import type { ImageHorseTool } from "../pkg/stamp_tool";

export interface DragSample {
  eventToDomMs: number;
  eventToFrameOpportunityMs: number;
}

declare global {
  interface Window {
    __annotationTool: ImageHorseTool;
    __annotationDragSamples: DragSample[];
  }
}

// Same read-only React-fiber probe as shape-oval.spec.ts. Production exposes no
// test engine handle. Await all calls because the worker port is asynchronous.
export async function installAnnotationProbe(page: Page) {
  await page.evaluate(() => {
    const root = document.querySelector("#root") as unknown as Record<string, unknown>;
    const key = Object.keys(root).find((k) => k.startsWith("__reactContainer"));
    if (!key) throw new Error("No React container");
    const seen = new Set<unknown>();
    const probe = (v: unknown, depth: number): unknown => {
      if (!v || typeof v !== "object" || depth > 6 || seen.has(v)) return null;
      seen.add(v);
      const o = v as Record<string, unknown>;
      if (typeof o.get_shape_annotations === "function" && typeof o.undo_count === "function") return v;
      for (const k of ["current", "toolRef", "memoizedState", "memoizedProps", "next", "baseState"]) {
        const found = probe(o[k], depth + 1);
        if (found) return found;
      }
      return null;
    };
    const fibers = new Set<unknown>();
    const stack: unknown[] = [root[key]];
    while (stack.length) {
      const f = stack.pop() as Record<string, unknown> | null;
      if (!f || fibers.has(f)) continue;
      fibers.add(f);
      for (const slot of ["memoizedState", "memoizedProps"]) {
        let hook = f[slot] as Record<string, unknown> | null;
        for (let i = 0; hook && i < 64; i++) {
          const found = probe(hook, 0);
          if (found) { window.__annotationTool = found as ImageHorseTool; return; }
          hook = hook.next as Record<string, unknown> | null;
        }
      }
      if (f.child) stack.push(f.child);
      if (f.sibling) stack.push(f.sibling);
    }
    throw new Error("Live annotation engine not found");
  });
}

export async function screenPoint(page: Page, x: number, y: number) {
  return page.evaluate(([cx, cy]) => {
    const canvas = document.querySelector<HTMLCanvasElement>("canvas.main-canvas")!;
    const r = canvas.getBoundingClientRect();
    return { x: r.left + cx / canvas.width * r.width, y: r.top + cy / canvas.height * r.height };
  }, [x, y]);
}

export async function observeDrag(page: Page) {
  await page.evaluate(() => {
    const overlay = document.querySelector("svg[data-draw-overlay]");
    if (!overlay) throw new Error("No editable shape overlay");
    window.__annotationDragSamples = [];
    let pending: number | null = null;
    window.addEventListener("pointermove", (event) => {
      if (event.buttons === 1) pending = event.timeStamp;
    }, true);
    new MutationObserver(() => {
      if (pending === null) return;
      const start = pending;
      pending = null;
      const eventToDomMs = performance.now() - start;
      // A RAF is a rendering opportunity, not proof that the display has
      // presented pixels. Keep that distinction in the exported metric name.
      requestAnimationFrame(() => {
        window.__annotationDragSamples.push({
          eventToDomMs,
          eventToFrameOpportunityMs: performance.now() - start,
        });
      });
    }).observe(overlay, { attributes: true, childList: true, subtree: true });
  });
}
