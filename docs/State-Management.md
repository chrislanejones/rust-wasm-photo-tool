# State Management (Zustand)

> Part of the [Image Horse](../README.md) docs. See also: [IndexedDB Investigation](IndexedDB-Investigation.md) · [File Map](File-Map.md) · [Architecture](Architecture.md).
>
> **Status:** stores live under `app/src/stores/`; the `zustand-build` branch merged to `master` in v5.8 (9e614fc). AppShell's `useState`s that map to the three stores below have been fully swapped for selector bindings — verified 2026-06-30 via grep (all §2 "Replaces" entries are bound in `AppShell.tsx`; zero duplicate local `useState`s remain for them). What's still open is hook extraction and `useAnnotationStore` — see §8.

---

## 1. Why

`app/src/app/AppShell.tsx` had grown to **~3,245 lines** — a god-component holding dozens of `useState`s for UI chrome, tool modes, and the gallery, then prop-drilling them into the master bar, sidebars, status bar, canvas hooks, and dialogs. That makes the file hard to read, hard to test, and forces unrelated re-renders.

[Zustand](https://github.com/pmndrs/zustand) lets any component subscribe **directly** to the slice of state it needs, with a stable selector, no provider, and no prop-drilling. The goal: lift cross-cutting state out of AppShell so the component shrinks toward orchestration-only, following the blueprint sketches in the repo's top-level [`/zustand`](../zustand) directory.

---

## 2. The stores

All three live in `app/src/stores/` and are plain `create()` stores (no provider needed).

| Store | File | Owns | Replaces (AppShell `useState`) |
| --- | --- | --- | --- |
| **`useUIStore`** | `useUIStore.ts` | Panel/dialog visibility + the compact master-bar tab | `showUpload`, `showTopBar`, `masterTab`, `showTools/Gallery/History`, the notice-dismissed flags, `showShortcutModal`, `showCelebration`, `showDiagnostics`, the delete/export dialog flags |
| **`useToolStore`** | `useToolStore.ts` | Active tool + every tool-mode flag & settings blob | `activeTool`, `brushMode`, crop/move/mask flags, `effectsMode`, `colorPickerActive`, `stampSubMode`, `shapesMode`, `cropRatio`, selection state, `stampSettings`, `toolSettings` |
| **`useGalleryStore`** | `useGalleryStore.ts` | Photo list + selection + per-photo bookkeeping | `photos`, `activePhotoId`, `selectedIds`, `imageSavings`, `modifiedPhotos`, `maxPhotos`, `resumeManifest` |

**Deferred:** `useAnnotationStore` — the real annotation state lives inside the tool hooks (`usePaintTool`, `useTextTool`, …), so it is extracted with those hooks, not ahead of them.

### Stays local in AppShell (intentionally)

- **Lifecycle flags** `booting` / `firstRun` — wired to boot effects, not UI chrome.
- **Refs** (`lastPanelRef`, canvas refs, …) — refs aren't state; they stay `useRef`.

---

## 3. The drop-in pattern (`SetArg`)

The migration is deliberately a **verbatim swap**: each `useState` line becomes two same-name selector bindings, so **zero downstream code changes**.

```ts
// before
const [showTools, setShowTools] = useState(false);

// after — identical names, identical call sites
const showTools = useUIStore((s) => s.showTools);
const setShowTools = useUIStore((s) => s.setShowTools);
```

For that to be truly drop-in, the store setters must accept **exactly** what React's `setState` does — a value *or* an updater `(prev) => next` — because AppShell has ~30 functional-updater call sites (`setShowTools((v) => !v)`, `setToolSettings((p) => ({ ...p, brushSize }))`). That is what `app/src/stores/_shared.ts` provides:

```ts
export type SetArg<T> = T | ((prev: T) => T);
export function resolveSet<T>(arg: SetArg<T>, prev: T): T {
  return typeof arg === "function" ? (arg as (prev: T) => T)(prev) : arg;
}
```

Every store action is `setX: (v) => set((s) => ({ x: resolveSet(v, s.x) }))`. Setters are **stable references** (created once), so binding them via selector adds no extra re-renders. Store action names mirror AppShell's former setter names exactly, so call sites don't change.

> **Caveat (same as React's):** if a piece of state were *itself* a function we couldn't tell a value from an updater. None of our state is a function, so this is safe.

---

## 4. Migration strategy

1. One store at a time (UI → tool → gallery).
2. Replace each `useState` with the two same-name selector bindings.
3. **Typecheck after every store**: `cd app && pnpm exec tsc -b` (the project-references build the pre-push hook runs) must stay green.
4. Build-gate before committing: `pnpm --filter stamp-tool build`.
5. Because AppShell is a singleton (one instance, never unmounts in practice), lifting its state to module-level stores is behaviour-preserving — the only change is that state is now global rather than per-instance, which is exactly what lets sibling components read it without props.

---

## 5. The `/zustand` blueprint (planned hook extraction)

The top-level [`/zustand`](../zustand) directory holds architectural **sketches** (typo-ridden, not compiled) for the end state: a ~75-line AppShell plus extracted hooks —

- `useTextTool`, `usePaintTool`, `useDrawingTools` — annotation/stroke tools
- `useImageActions`, `usePhotoLoader`, `useUploadHandler` — gallery/image lifecycle
- `useEffectiveTool` — derived active-tool resolution

These come **after** the store migration: once state lives in stores, the big effect/handler blocks in AppShell can move into focused hooks that read the stores directly. Treat `/zustand` as direction, not code to merge.

---

## 6. Persistence

Stores that hold "remember my choice" preferences are backed by **IndexedDB** via a hand-rolled Zustand adapter (`app/src/stores/storage/idbStorage.ts`, DB `image-horse-zustand`) — see [IndexedDB Investigation](IndexedDB-Investigation.md). The adapter de-dupes writes (§7.5).

- **`useUIStore`** persists **`masterTab`** (a pure "remember my last view" pref) plus **`recentCommands`/`commandUsage`** (the command-palette recency/usage prefs). The notice-dismissed flags are **not** persisted: they're session/stretch-scoped by design (re-armed on resize), so persisting them would contradict that. Transient flags (dialogs, celebration, diagnostics, upload) are never persisted — they'd re-open on reload.
- **`useToolStore`** persists only the **pure sub-mode prefs** (`brushMode`, `stampSubMode`, `shapesMode`, `eraserMode`) — UI routing flags with no engine coupling, so no rehydrate→WASM sync is needed.
  - **Not yet persisted (engine-coupled):** `stampSettings` / `toolSettings` push into the WASM engine (`stamp.setBrushSize/…`), so persisting them needs a one-time sync of the rehydrated value into the engine (via `persist`'s `onRehydrateStorage`, or an effect after hydration). Deferred to the AppShell wiring.
  - **Never persisted:** `activeTool` (start on the default tool, not mid-edit), `selectionMask` / `selectionMode` (transient).
- **`useGalleryStore`** persists only **`imageSavings`** (the Zap-savings badge, keyed by photo id) through Zustand. The photo list itself is **not** persisted here — it's rebuilt from the gallery manifest / dedicated content databases (and, going forward, the [Dexie](IndexedDB-Investigation.md) `photos` table), which stay the source of truth for anything beyond that one badge.

### 6.1 Hydration is validated, not trusted

IndexedDB is same-origin-writable — another tab, a stale cached build, or a
future rename/narrowing of one of the union types above can leave a
rehydrated blob carrying a value the running code doesn't recognize. All
three persisted stores guard against this in their `persist` config's
`merge` (not `migrate` — `migrate` only runs on a version bump; `merge` runs
on **every** rehydrate, which is what a standing guard needs): each
partialized field is checked against its current allowed values
(`validated`/`validatedStringArray`/`validatedNumberRecord`/`validatedRecord`
in `stores/_shared.ts`) and falls back to the freshly-constructed default
rather than rehydrating as-is. See `stores/persistence.test.ts` for the
partialize-contract + fallback-behavior tests.

---

## 7. Performance

Zustand is the performance play here, not just a tidiness one. The wins, in order of impact:

### 7.1 Atomic selectors are the headline win

Today a single `useState` change anywhere in AppShell re-renders the **entire ~3,245-line component** and everything it returns. Replacing those with **atomic selectors** means a component only re-renders when the *one field it reads* changes:

```ts
// ✅ atomic — re-renders only when showTools flips
const showTools = useUIStore((s) => s.showTools);

// ❌ object selector — new object every render → re-renders on EVERY store change
const { showTools, showGallery } = useUIStore((s) => ({
  showTools: s.showTools,
  showGallery: s.showGallery,
}));
```

The migration in §3 binds one selector per field, so it gets this for free. **Keep it that way** — don't collapse multiple fields into an object selector.

### 7.2 `useShallow` when you genuinely need several fields

If a component truly needs a handful of fields together, wrap the object selector in `useShallow` so it re-renders only when one of those values changes (shallow-compared), not on every store write:

```ts
import { useShallow } from "zustand/react/shallow";

const { brushMode, effectsMode } = useToolStore(
  useShallow((s) => ({ brushMode: s.brushMode, effectsMode: s.effectsMode })),
);
```

### 7.3 Transient updates for hot paths (no re-render at all)

For continuous, high-frequency state — pan offset, brush cursor position, live stroke — **don't** drive React state per pointer-move. Read/write through the store imperatively and let the canvas/WASM consume it without re-rendering React:

```ts
// write without subscribing: no re-render
useToolStore.getState().setToolSettings(next);

// subscribe imperatively (e.g. push to the WASM engine) — also no re-render
const unsub = useToolStore.subscribe((s) => s.toolSettings, syncToWasm);
```

`store.subscribe(selector, cb)` needs the `subscribeWithSelector` middleware; add it to a store only when a hot path actually wants it (don't add speculatively). This is how the WASM sync in `handleStampSettingsChange` (which today calls both `setStampSettings` *and* `stamp.setBrushSize/...`) can become a single subscription.

### 7.4 Stable setters = free

Store actions are created once, so binding `setShowTools` via selector never changes identity — passing it to children adds no re-renders and needs no `useCallback`. (Several `useCallback`s in AppShell that only exist to stabilize a setState wrapper can be deleted as the wiring lands.)

### 7.5 Persistence write-cost

`persist` subscribes to the **whole** store and writes on every state change, so a store that mixes frequently-toggling flags with rarely-changing prefs (exactly `useUIStore`) would hammer IndexedDB. Two guards:

- **`partialize`** to the durable prefs only (done) — keeps the serialized blob tiny.
- **Write de-dup** in the adapter (`idbStorage.ts`) — identical consecutive writes are skipped, so toggling a (non-persisted) dialog flag no longer re-writes the unchanged prefs blob. Net: one IDB write per *actual* pref change.

If a persisted store ever needs to persist a frequently-changing field, split that field into its own small store rather than debouncing — the subscription cost is per-store.

## 8. Status

- [x] `zustand@5` added to the `app` (`stamp-tool`) package.
- [x] `useUIStore` / `useToolStore` / `useGalleryStore` + `_shared.ts` created, types mined from the real AppShell.
- [x] `@stores` path alias (`tsconfig.json` + `vite.config.ts`).
- [x] IndexedDB persist adapter (`storage/idbStorage.ts`) + `useUIStore` persisted.
- [x] AppShell wiring (useState → selector swap), store-by-store — confirmed complete 2026-06-30: every `useState` named in the §2 "Replaces" column is now a `useUIStore`/`useToolStore`/`useGalleryStore` selector pair in `AppShell.tsx` (79 store-hook call sites). The 17 `useState`s still in `AppShell.tsx` at that point were all out of this migration's scope: `booting`/`firstRun` (intentionally local, §2) plus lifecycle/one-off state the §2 table never claimed for a store (`originalUrl`, `compareActive`, `hasBeenModified`, `isImageLoading`, `loadProgress`, `isPanning`, `userMode`, `authResolved`, `devTierOverride`, `exportFormat`, `quality`, `selectedObject`, `isDraggingImage`, `importImage`). None of those were migration debt.
- [x] `useAnnotationStore` — done 2026-06-30, scoped to what's real rather than the `/zustand` sketch's fictional `annotations: Annotation[]` array (the real text/shape annotation list lives in the Rust/WASM engine and is read on demand via `textTool.annotations`/`drawingTools.shapes`, not duplicated into a JS store). What the store actually needed to own: `selectedObject: ReselectObject | null` — the Align-row / Reselect-list selection, which was the one piece of annotation-adjacent state still local to `AppShell.tsx`. Migrated verbatim (same `SetArg` pattern as the other 3 stores); not persisted (selection is per-photo and already reset on `activePhotoId` change).
- [x] `useEffectiveTool` — done 2026-06-30: `AppShell`'s `effectiveStamp` IIFE (~110 lines resolving which tool's mouse handlers the canvas gets, given `activeTool` + every sub-mode flag) moved verbatim into `app/src/hooks/useEffectiveTool.ts`. Deliberately not memoized — it recomputes every render exactly as the inline IIFE did, so this is a pure relocation, not a perf change.
- [ ] `useImageActions` / `usePhotoLoader` / `useUploadHandler` — still open. `app/src/hooks/usePaintTool.ts`, `useTextTool.ts`, and `useDrawingTools.ts` exist but predate the store work (present since the original tool commits, e.g. `ba06728`/`10fc3f3`/`f3a2b8b`) and don't import any store — they are not the extracted hooks the blueprint describes, just same-domain hooks that happen to share a name. The image-action / photo-load / upload-handling logic these three would wrap is deeply threaded through `AppShell.tsx` (spanning `loadPhotoFromEntry`, the upload dialog flow, and several handlers with 5+ dependencies each) — a larger, riskier extraction than `useEffectiveTool` was, deferred rather than rushed.

**What's genuinely left:** the store layer, AppShell wiring, `useAnnotationStore`, and `useEffectiveTool` are all done. The remaining work is extracting `useImageActions`/`usePhotoLoader`/`useUploadHandler` from `AppShell.tsx` — a bigger, more entangled pass than the other two hooks.
