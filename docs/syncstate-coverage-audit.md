# syncState coverage audit — two real gaps in 121 mutation sites

Measured 2026-08-05 against `v7.67` (`a599e1a`). Reproduce with:

```bash
node scripts/syncstate-audit.mjs .
```

## Why this was worth doing

`useEngineCore` publishes the JS-side mirror of engine truth from exactly one
place, `syncState()`. Nothing invokes it structurally — it is called by hand
**71 times across 12 files**. A mutation whose call site forgets leaves the
mirror stale, and the mirror is what the whole UI renders from.

That is a live correctness question today, independent of any worker migration.

## Method, and why classification comes from the Rust

A method is a mutator if its Rust receiver is `&mut self`. Guessing from name
prefixes would be wrong in both directions: `push_compress_marker` mutates,
`export_png` does not, and neither is obvious.

| | count |
| --- | ---: |
| Engine methods exported to JS | 192 |
| Mutators (`&mut self`) | 122 |
| Reads (`&self`) | 102 |
| Mutators that snapshot (call `self.snap`/`snap_selection`) | 42 |
| `syncState()` call sites | 71 |
| Mutator call sites in `app/src` | 121 |
| …followed by a sync | 56 |
| …not followed by a sync | 65 |

The 65 are not 65 bugs. **Tier 1** is the subset calling a *snapshotting*
mutator — those demonstrably change `undo_count()`, a field `syncState`
publishes and the History panel renders. That narrowed 65 → 8, and hand-checking
the 8 narrowed it to **2**.

## The six false positives, and what they teach

Worth recording, because they are the shapes a static scan cannot see:

| site | why it is fine |
| --- | --- |
| `lib/exportImage.ts:104` | Operates on a **throwaway instance** — `new ImageHorseTool` at :81, `tool.free()` at :113. The live engine is never touched. |
| `lib/openraster/export.ts:34` | Does mutate the live document, but returns `flattenedAnnotations` and `ExportPane.tsx:61-66` checks it and calls `syncState()`. The sync is in the **caller**. |
| `useTransforms.ts:130` `crop` | Routes through `commitGeometryChange()` → `flushToCanvas(); syncState(); broadcast…` |
| `useTransforms.ts:153` `resize_with_filter` | same helper |
| `useTransforms.ts:197` `set_artboard_border` | same helper |
| `useEngineCore.ts:385` `set_artboard_border` | Runs on a fresh `new Tool(width, height)` during load, and deliberately clears the snapshot it pushed so a loaded doc has `undoCount` 0. |

Two blind spots, then: **a sync in the caller**, and **a sync inside a shared
helper**. Any future version of this audit should resolve one level of
indirection before reporting.

## The two real gaps

Both in `app/src/app/session/useSelectionActions.ts`, and both confirmed against
`src/selection.rs`.

### 1. `handleSelectAll` — `select_all` pushes "Select All", nothing syncs

```ts
const handleSelectAll = useCallback(() => {
  const tool = stamp.toolRef.current;
  if (!tool) return;
  const mask = tool.select_all();
  setSelectionMask(mask.length ? mask : null);
}, [stamp]);
```

`selection.rs:475` → `snap_selection("Select All")` at :481.

### 2. `handleDeselect` — `clear_selection` pushes "Deselect", nothing syncs

```ts
const handleDeselect = useCallback(() => {
  stamp.toolRef.current?.lasso_cancel();
  stamp.toolRef.current?.clear_selection();
  setLassoCommitted(null);
  …
}, [stamp]);
```

`selection.rs:503` → `snap_selection("Deselect")` at :507.

The contrast is right there in the same file — `handleDeleteSelection`, twenty
lines below, does call `stamp.flushToCanvas(); stamp.syncState();`. These two
were missed, not decided.

## What it actually costs

The engine's `undo_count()` increments; `stamp.state.undoCount` does not, until
some *other* action happens to sync. Until then:

1. **The History panel under-reports by a step.** `syncState` builds
   `state.history` from `history_labels()`, so the "Select All" / "Deselect"
   entry is simply absent from the list.
2. **Undo affordance can be wrong** — the count the UI gates on is stale.
3. **The photo is not marked dirty.** `useImageSession` sets
   `dirtyRef.current = stamp.state.undoCount > 0 || hasBeenModified`. A photo
   whose only change is a Select All or a Deselect reads as clean, so the
   autosave debounce does not arm and a photo switch does not save it.

(3) is the one that matters and it is narrow but real: it needs a selection
action to be the *only* change since load. Any subsequent paint stroke syncs and
the count catches up. Nothing is corrupted — a selection-only history step can be
lost, and the undo list is briefly a step short.

## The fix

Two lines, mirroring what `handleDeleteSelection` already does:

```ts
// handleSelectAll, after select_all()
stamp.syncState();

// handleDeselect, after clear_selection()
stamp.syncState();
```

Not applied here. This run was scoped to an audit, and a behaviour change —
even a correct two-line one — is not something to slip in unasked at 4am at the
end of this particular night.

## Open

- **Nothing enforces mutation → sync.** That is the root condition; these two
  are symptoms. A structural fix (the engine handle only reachable through a
  wrapper that syncs, or a dev-mode assertion that `undo_count()` matches
  `state.undoCount` after every handler) would retire the whole class. That is
  a design decision, not a cleanup.
- **The 57 Tier-2 sites are unexamined** — non-snapshotting mutators with no
  following sync (`set_editing_shape` ×7, `load_image` ×7,
  `set_selection_combine` ×3 …). They may or may not touch a published field.
  Lower confidence, lower stakes, worth a pass if the class is being fixed
  properly.
- **This audit cannot see one level of indirection.** Six of its eight Tier-1
  hits were syncs in a caller or a shared helper. Resolving one hop would make
  it sharp enough to run in CI.
