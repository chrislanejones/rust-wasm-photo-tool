// In-memory LRU of decoded working copies, keyed by the original's content hash.
//
// Clicking a photo used to re-read the original bytes from IndexedDB and run two
// full-resolution `createImageBitmap` decodes (probe + downscale) in
// `makeWorkingCopy` on EVERY select — even when revisiting a photo seen seconds
// ago — which is why switching felt slow. Because the key is a content hash
// (immutable bytes → a deterministic decode), a cached working copy is ALWAYS
// valid: no invalidation is ever needed; we only evict to bound memory (LRU by
// byte budget). Consumers READ the pixels (canvas + a WASM `load_image` copy)
// and never mutate them, so one buffer can back many selections.
import type { WorkingCopy } from "./workingCopy";

// ~160 MB of decoded RGBA. A 2048-long-edge working copy is ≤16 MB, so this
// holds ~10 large photos — enough to make gallery browsing feel instant while
// staying well within a tab's budget.
const MAX_BYTES = 160 * 1024 * 1024;

// Map insertion order doubles as the LRU order (oldest entry first).
const cache = new Map<string, WorkingCopy>();
let totalBytes = 0;

const sizeOf = (w: WorkingCopy): number => w.pixels.byteLength;

/** Look up a working copy, marking it most-recently-used on a hit. */
export function getWorkingCopy(key: string): WorkingCopy | undefined {
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit); // re-insert as newest
  }
  return hit;
}

/** Cache a working copy, evicting the oldest entries until under the budget. */
export function putWorkingCopy(key: string, value: WorkingCopy): void {
  const existing = cache.get(key);
  if (existing) {
    totalBytes -= sizeOf(existing);
    cache.delete(key);
  }
  cache.set(key, value);
  totalBytes += sizeOf(value);

  for (const [k, v] of cache) {
    if (totalBytes <= MAX_BYTES || cache.size <= 1) break;
    if (k === key) continue; // never evict the entry we just added
    cache.delete(k);
    totalBytes -= sizeOf(v);
  }
}

/** Drop everything (e.g. on "Delete all"). */
export function clearWorkingCopyCache(): void {
  cache.clear();
  totalBytes = 0;
}
