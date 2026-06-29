# State Management (Zustand)

> Part of the [Image Horse](../README.md) docs. See also: [IndexedDB Investigation](IndexedDB-Investigation.md) · [File Map](File-Map.md) · [Architecture](Architecture.md).
>
> **Status:** stores live under `app/src/stores/` on the `zustand-build` branch. AppShell is being migrated off local `useState` onto these stores, store-by-store, typecheck-gated.

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

Stores that hold "remember my choice" preferences are backed by **IndexedDB** via a hand-rolled Zustand adapter — see [IndexedDB Investigation](IndexedDB-Investigation.md).

- `useUIStore` persists a **`partialize`d** subset (`masterTab`, the notice-dismissed flags) through `app/src/stores/storage/idbStorage.ts` (DB `image-horse-zustand`).
- Transient flags (dialog open/closed, celebration, diagnostics) are **never** persisted — they'd re-open on reload.
- Heavy data (photos, edit history) is **never** persisted through Zustand; it lives in the dedicated content databases / WASM memory.

---

## 7. Status

- [x] `zustand@5` added to the `app` (`stamp-tool`) package.
- [x] `useUIStore` / `useToolStore` / `useGalleryStore` + `_shared.ts` created, types mined from the real AppShell.
- [x] `@stores` path alias (`tsconfig.json` + `vite.config.ts`).
- [x] IndexedDB persist adapter (`storage/idbStorage.ts`) + `useUIStore` persisted.
- [ ] AppShell wiring (useState → selector swap), store-by-store.
- [ ] Hook extraction per the `/zustand` blueprint.
- [ ] `useAnnotationStore` (with the tool-hook extraction).
