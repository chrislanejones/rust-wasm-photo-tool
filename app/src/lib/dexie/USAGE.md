# Dexie content layer — usage & migration

> The code: [`db.ts`](./db.ts). Background & decisions: [docs/IndexedDB-Investigation.md](../../../../docs/IndexedDB-Investigation.md) · [docs/State-Management.md](../../../../docs/State-Management.md).
>
> **Status:** new, parallel database (`image-horse-dexie`). The three live hand-rolled stores (`image-horse-originals` / `-edits` / `-gallery`) are untouched. This module is ready to adopt incrementally; nothing in the app imports it yet.

## Why Dexie

- First-class TypeScript; declarative schema; easy versioning & migrations.
- Powerful queries (indexes, `where`, `orderBy`) and **live queries** that re-render React on DB change.
- Far less boilerplate than raw IndexedDB; great performance for Blobs + structured data.

## Schema

```
originals      id                       // raw uploads (Blob), content-addressed (SHA-256)
workingCopies  id, photoId              // edited renders, one per photo
photos         id, updatedAt, originalId // lightweight gallery rows + references
```

This split gives **fast gallery loads** (read the small `photos` table, not the pixels), the **full original** on demand, and a **separate working copy** so originals are never overwritten.

## API (mirrors the legacy `originalsStore` names)

```ts
import {
  putOriginal, getOriginal, getOriginalAsBlobUrl, deleteOriginal,
  saveWorkingCopy, getWorkingCopy, getDisplayBlobUrl,
  upsertPhotoMetadata, getPhoto, getAllPhotos, deletePhoto, clearAll,
  db,
} from "@/lib/dexie/db";
```

### Load a photo for editing

```ts
const original = await getOriginal(photo.originalId);
const url = original ? URL.createObjectURL(original.blob) : null;
// …edit…  then persist the result:
await saveWorkingCopy(photo.id, editedBlob, width, height);
```

### Live-reactive gallery (auto re-render on DB change)

```tsx
import { useLiveQuery } from "dexie-react-hooks"; // optional add-on
import { db } from "@/lib/dexie/db";

function Gallery() {
  const photos = useLiveQuery(
    () => db.photos.orderBy("updatedAt").reverse().toArray(),
    [],
  );
  // `photos` updates automatically whenever any write touches `photos`.
}
```

> `useLiveQuery` needs `dexie-react-hooks` (not yet installed). Without it, call `getAllPhotos()` in an effect. Install with the corepack workaround:
> `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm@11.7.0 --pm-on-fail=ignore --filter stamp-tool add dexie-react-hooks`

## Recommended architecture

| Layer | Technology | What it stores |
| --- | --- | --- |
| UI state | Zustand + `persist` (IndexedDB adapter) | Tool settings, panel visibility, "remember my choice" prefs |
| Metadata + light data | Dexie (`photos` table) | Gallery list, references |
| Heavy binary data | Dexie (`originals` + `workingCopies`) | Actual images |
| Static assets | Service Worker (Workbox) | WASM, JS, fonts, icons |

## Migration path (incremental, reversible)

1. **Land the module** (this) — parallel DB, no call sites changed. ✅
2. **One-time backfill** — on first run after adopting, copy existing `image-horse-originals` records into `db.originals` and the `image-horse-gallery` manifest into `db.photos` (a small idempotent migrator keyed off a `migratedToDexie` flag in `localStorage`).
3. **Swap originals call sites** — the four importers of `originalsStore` (`AppShell`, `BatchSettings`, `ImageMetaPanel`, and `preferences.ts`'s `sha256Hex`) switch to `@/lib/dexie/db`. Names already match, so it's an import-path change.
4. **Fold in the gallery manifest** — replace `galleryManifest.ts` reads/writes with `db.photos` (the manifest becomes redundant — `photos` *is* the manifest).
5. **Edit history** — `editPersistence`'s per-photo undo/redo history is a separate concern; either keep it as-is or model it as a `historySnapshots` table (`id, photoId, step`). Defer until 1–4 are proven.
6. **Retire the hand-rolled stores** once their call sites are gone.

Each step is independently shippable and reversible; the legacy DBs stay readable throughout so a backfill can re-run.
