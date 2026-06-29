# IndexedDB for Larger Storage — Investigation

> Part of the [Image Horse](../README.md) docs. See also: [State Management](State-Management.md) · [Service Workers & Caching](Service-Workers-Caching.md) · [Architecture](Architecture.md).
>
> **Status:** the three IndexedDB databases described in §2 are **live in production**. The Zustand ↔ IndexedDB persistence adapter (§3–§4) landed on the `zustand-build` branch (`app/src/stores/storage/idbStorage.ts`). Service-worker caching (referenced in §8) is still investigation-only.

As Image Horse grows — images, undo/redo history, annotations, gallery manifests, working copies — `localStorage` stops being viable. This note records **why** we use IndexedDB, **what we already store there**, and **how** Zustand persistence plugs into it.

---

## 1. Why IndexedDB?

| Feature | localStorage | IndexedDB | Winner for Image Horse |
| --- | --- | --- | --- |
| Storage limit | ~5–10 MB | 100s of MB → several GB | **IndexedDB** |
| Data types | Strings only | Objects, Blobs, Files, ArrayBuffers, typed arrays | **IndexedDB** |
| Async / non-blocking | Synchronous (blocks the main thread) | Fully asynchronous | **IndexedDB** |
| Structured queries | No | Yes (keys + indexes + cursors) | **IndexedDB** |
| Performance with large data | Poor (sync JSON serialize) | Good (structured clone, no re-parse) | **IndexedDB** |
| Complexity | Trivial | More ceremony (open / upgrade / tx) | **localStorage** (for tiny data) |

**Conclusion for Image Horse:**

- **`localStorage`** → small UI preferences & session flags (tiny, sync-read-on-boot is fine).
- **IndexedDB** → images, thumbnails, undo/redo history, gallery manifests, working copies — anything binary or large.

A photo editor is the textbook case: a single 12-megapixel original is ~5–30 MB encoded and ~48 MB as raw RGBA. One photo can blow the entire `localStorage` budget; IndexedDB stores it as a `Blob`/`ArrayBuffer` without stringifying.

---

## 2. Current state in this codebase

We are **already IndexedDB-first for heavy data** — three hand-rolled databases, each a thin native-`IDBDatabase` wrapper (no library). App/React state only ever holds light handles (content keys, thumbnails, ids).

| DB name | File | Stores | Key |
| --- | --- | --- | --- |
| `image-horse-originals` | [`app/src/lib/originalsStore.ts`](../app/src/lib/originalsStore.ts) | Original photo bytes (`ArrayBuffer`) + mime/name/dims, content-addressed | **SHA-256 of the bytes** (dedupes identical uploads) |
| `image-horse-edits` | [`app/src/lib/editPersistence.ts`](../app/src/lib/editPersistence.ts) | Per-photo current canvas + **full undo/redo history** as PNG blobs | photo id |
| `image-horse-gallery` | [`app/src/lib/galleryManifest.ts`](../app/src/lib/galleryManifest.ts) | The lightweight gallery **manifest** — `PhotoEntry[]` (thumbnails + content keys + metadata) + active id | `"current"` (singleton) |

Plus two non-IDB persistence layers:

- **`localStorage`** (`image-horse-prefs`, [`app/src/lib/preferences.ts`](../app/src/lib/preferences.ts)) — the Settings blob (theme, history depth, idle timeout, rulers/grid, reduce-motion, EXIF-keep, reopen-last-session). Tiny, read synchronously at boot, so `localStorage` is the right tool.
- **Convex** (`users` row) — when signed in, the same preferences blob is mirrored server-side as JSON + its SHA-256, so settings follow the user across devices. Logged-out users stay `localStorage`-only. See [Architecture](Architecture.md).

**Design invariant:** the gallery *list* is React/Zustand state, but the *bytes it points at* live in `image-horse-originals` / `image-horse-edits`. The manifest (`image-horse-gallery`) is what lets an anonymous tab survive a close/reload — without it those bytes would be orphaned and the app would boot empty. This is exactly the "keep heavy data out of the JS heap, keep handles in state" pattern.

---

## 3. Zustand + IndexedDB integration

Zustand's `persist` middleware accepts a **custom storage adapter** (`StateStorage`: `getItem` / `setItem` / `removeItem`, each optionally async). That is the seam we use to back a store with IndexedDB instead of `localStorage`:

```ts
// app/src/stores/storage/idbStorage.ts  (shape)
export const idbStorage: StateStorage = {
  getItem:    async (name) => (await idbGet<string>(name)) ?? null,
  setItem:    async (name, value) => { await idbSet(name, value); },
  removeItem: async (name) => { await idbDel(name); },
};
```

```ts
// usage in a store
import { persist, createJSONStorage } from "zustand/middleware";
import { idbStorage } from "./storage/idbStorage";

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({ /* … */ }),
    {
      name: "image-horse-ui-v1",
      storage: createJSONStorage(() => idbStorage),
      version: 1,
      // Persist only durable "remember my choice" prefs — never transient
      // dialog flags (those would re-open a modal on reload).
      partialize: (s) => ({
        masterTab: s.masterTab,
        smallNoticeDismissed: s.smallNoticeDismissed,
        tabletNoticeDismissed: s.tabletNoticeDismissed,
      }),
    },
  ),
);
```

---

## 4. Adapter decision — hand-rolled vs `idb-keyval` vs Dexie

We **hand-roll** the adapter with the native IndexedDB API rather than add a library. Rationale:

| Option | Verdict | Why |
| --- | --- | --- |
| **Hand-rolled native IDB keyval** ✅ chosen | Adopted | Zero new dependency; ~40 LOC; identical in style to the three stores we already maintain (`originalsStore` / `editPersistence` / `galleryManifest`); sidesteps the pnpm **store-v11 install gotcha** (see below). A keyval store is all `persist` needs. |
| `idb-keyval` | Rejected (for now) | Pleasant API, but it is one more dep for ~40 LOC we can own. Reconsider only if we need its multi-store / cursor helpers. |
| Dexie.js | Not for the persist adapter; **adopted for the content layer** | Overkill for a keyval prefs blob, so the Zustand persist adapter stays hand-rolled. But for the **heavy content data** (originals / working copies / gallery), Dexie's typed schema, migrations, and live queries do earn their keep — see the new Dexie module below. |

> **Scope note:** the table above is specifically the **Zustand `persist` adapter** decision (a tiny string keyval store → hand-rolled wins). Separately, the **content layer** (images, working copies, gallery metadata) now has a **Dexie** implementation — a new, parallel `image-horse-dexie` database in [`app/src/lib/dexie/db.ts`](../app/src/lib/dexie/db.ts) (schema: `originals` / `workingCopies` / `photos`), with its API mirroring the legacy `originalsStore` names so the three live hand-rolled stores can be migrated incrementally and reversibly. Full usage + migration path: [`app/src/lib/dexie/USAGE.md`](../app/src/lib/dexie/USAGE.md).

> **pnpm store-v11 install gotcha:** the active pnpm is 10.x but `node_modules` was built with **pnpm 11.7.0** (store v11), so a plain `pnpm add` fails `ERR_PNPM_UNEXPECTED_STORE`. Adding a dependency requires
> `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm@11.7.0 --pm-on-fail=ignore --filter stamp-tool add <pkg>`.
> Hand-rolling the adapter avoids touching the lockfile at all — another point in its favour.

The adapter lives in its **own** database (`image-horse-zustand`, object store `kv`), kept separate from the three content databases so a corrupt/cleared preferences cache can never take down originals or edit history.

---

## 5. What to persist, and where

| Use case | Storage | Reason |
| --- | --- | --- |
| UI preferences, last-used tool, panel layout | `localStorage` **or** Zustand→IndexedDB | Small; sync read at boot is fine for prefs, IDB fine for Zustand-managed bits |
| Original images & thumbnails | `originalsStore` (IndexedDB) | Large binary; content-addressed dedupe |
| Per-photo edit history | `editPersistence` (IndexedDB) | Large (history of PNG blobs) |
| Gallery manifest / session | `galleryManifest` (IndexedDB) | Grows with the gallery; needs Blob support |
| Live undo/redo working state | **Rust / WASM memory** + selective IDB snapshot on photo switch | Performance-critical; the WASM engine owns the canonical history |
| Large working copies | IndexedDB (existing stores) | Already doing this |

**Anti-patterns to avoid:**

- ❌ Don't persist the **entire gallery** or **full edit history** through Zustand `persist`. Keep the heavy data in the dedicated IDB stores / WASM memory; persist only handles and light prefs.
- ❌ Don't persist transient dialog flags (`deleteAllOpen`, `exportDialogOpen`, …) — they'd re-open modals on reload. `partialize` them out.
- ❌ Don't put Blobs through `createJSONStorage` — JSON can't represent a Blob. For binary, write to the dedicated IDB stores directly (as we do), not through `persist`.

---

## 6. Versioning & migration

Zustand `persist` supports schema evolution so a shape change doesn't crash returning users:

```ts
{
  name: "image-horse-ui-v1",
  version: 2,
  migrate: (persisted, fromVersion) => {
    if (fromVersion < 2) {
      // e.g. a field was renamed / added a default
      return { ...(persisted as object), masterTab: "tools" };
    }
    return persisted as UIState;
  },
}
```

Rules of thumb:

- Bump `version` whenever the **persisted** shape changes (after `partialize`).
- Provide a `migrate` that is total — handle every prior version, fall through to the current shape.
- For the three content DBs, schema changes go through `onupgradeneeded` + a bumped `VERSION` (classic IndexedDB migration), independent of the Zustand version.

---

## 7. Async hydration caveats

IndexedDB is async, so a `persist`-backed store **hydrates after first paint**. Consequences and mitigations:

- **Flash of default state.** A field reads its in-code default, then snaps to the stored value a tick later. Fine for panel layout / "notice dismissed"; *not* fine for anything that drives a destructive action or a jarring layout jump. Keep the persisted set small and cosmetic.
- **`skipHydration`** lets you defer hydration and call `useUIStore.persist.rehydrate()` yourself (e.g. after the boot gate) if a flash is unacceptable.
- **`onRehydrateStorage`** gives a hook to run once the stored state is applied (telemetry, post-hydrate reconciliation).
- **Don't gate first render on hydration** for non-critical prefs — it would add latency to boot for no real benefit.

---

## 8. Recommended architecture going forward

1. Keep the three dedicated IDB stores (`originals` / `edits` / `gallery`) for raw bytes — they are the source of truth for heavy data.
2. Back **Zustand `useUIStore`** (and, selectively, last-used `useToolStore` settings) with the IndexedDB adapter for "remember my choice" prefs — `partialize`d to durable fields only.
3. Leave undo/redo history in **WASM memory**; snapshot to `editPersistence` on photo switch (already the design).
4. Pair this with a **service worker** to cache the app shell + the large WASM binary for instant repeat loads and offline editing — see [Service Workers & Caching](Service-Workers-Caching.md).

### Pros / cons of leaning harder on IndexedDB

**Pros:** much higher capacity; native Blob storage (perfect for images); async (never blocks paint/scroll); scales with the gallery.
**Cons:** more ceremony than `localStorage`; async hydration to reason about; slightly more code. Browser support is universal today, so compatibility is a non-issue.

---

## 9. Status & next steps

- [x] Three content databases live (`originals` / `edits` / `gallery`).
- [x] `localStorage` + Convex preferences sync live.
- [x] Hand-rolled Zustand IndexedDB adapter (`app/src/stores/storage/idbStorage.ts`).
- [x] `useUIStore` persisted (durable prefs only) via the adapter.
- [x] Dexie content-layer module (`app/src/lib/dexie/db.ts` + `USAGE.md`) — parallel `image-horse-dexie` DB, not yet wired into call sites.
- [ ] Backfill + cut the four `originalsStore` call sites over to Dexie (see USAGE.md migration path).
- [ ] Selectively persist last-used `useToolStore` settings (brush size, last effect) — candidate follow-up.
- [ ] Service-worker caching of the app shell + WASM binary — see [Service Workers & Caching](Service-Workers-Caching.md).
