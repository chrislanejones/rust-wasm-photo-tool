# ADR-112: Saved undo steps keep their layers, and photos keep their fingerprints and file date
Date: 2026-11-28   Status: **Proposed**, Chris decides (`adr/112-stored-fields`, carried by `feat/243-archive-keeps-shapes`)   Relates to: ADR-031, ADR-060, ADR-086, ADR-088, ADR-093, ticket #243

## Context

Ticket #243 is four parked bugs that each wait on a stored field:

| Bug (PARKING_LOT) | Where it lives |
|---|---|
| The saved undo steps (`SnapEntry`) keep pixels and texts but **no shapes**, and restored texts get **fresh ids**. `e2e/text-placement-undo.spec.ts` case 4 is a `test.fixme` for it | the saved edit: `lib/editPersistence.ts` (local) and `lib/editArchive.ts` (cloud) |
| After an op-log resume, the next saved edit has **no undo history** (qc-1113 Q2d/Q2e) | the same record, filled from `capture_state` |
| Duplicate fingerprints aren't saved, and an edited photo stops matching its original | `features/gallery/photoFingerprints.ts` |
| `{date}` loses the file's date after a reload | `lib/photoNameFacts.ts` |

ADR-093 (draft, 10-25) already described the first one exactly, so this ADR
does not repeat its reading of the code. The short version, re-checked this
morning on `6440463`:

- A saved step is ONE PNG of the **composite** (`Snapshot::encoded_png`), with
  shapes and texts already baked into the pixels, plus the active layer's text
  list. `inject_undo_snapshot` rebuilds a single layer from that PNG; shapes are
  never pushed back. One fallback undo after a reload turns shapes into ink.
- After `oplog_restore` the engine's snapshot stacks are **empty on purpose**
  (`hist.clear()`, `src/lib.rs`); the log holds the history and undo walks it.
  `capture_state` reads the snapshot stacks, so the next save writes
  `undo_count = 0`. Retire the log and the reload has nothing to undo.
- There are **two** copies of a saved edit. Local: a structured-clone
  `SavedEdit` in the raw IndexedDB store `image-horse-edits`. Cloud: the binary
  archive, `editArchive.ts` **version 6**. The local one has no version number.

The shapes are not missing from the engine: every `Snapshot` holds the whole
layer stack, overlays included (`src/history.rs`). They are lost in transport,
because `capture_state` flattens each step before the JS sees it.

## Decision

### 1. The archive record: version 7, and each step carries its layers

**Cloud archive v7** (`editArchive.ts`). Everything v6 had stays, in the same
place, so the v7 reader is the v6 reader plus a tail. The header gains one
word:

```text
  magic(4) version(4)=7 compat(4)=7 canvas_w(4) canvas_h(4)
  … the v6 body, byte for byte (canvas, undo/redo steps with label, composite
    PNG and text JSON, live texts, live shapes, layer stack, active id,
    qualities) …
  section_count(4) { tag(4) len(4) bytes(len) } × N
```

v7 defines one section, **`STEP`**:

```text
  pool_count(4) { png } × P                 -- each distinct layer PNG once
  for each undo step, then each redo step:
    layer_count(4)                          -- 0 = this step carries no layers
    { id(4) name visible(4) opacity(f64) png_ref(4) texts_json shapes_json } × n
    active_layer_id(4)
```

`png_ref` indexes the pool. Each step's layers use **the same encoding as the
live layer stack** (`PersistedLayer`: pixels as PNG, texts as
`annotations_to_json`, shapes as `shapes_to_json`, the op log's and the layer
JSON's existing encodings). There is no third one.

**The local record** gets the same data as optional fields:
`SnapEntry.layers?: PersistedLayer[]`, `SnapEntry.activeLayerId?: number`, and
`SavedEdit.archiveVersion?: 7`. A step layer whose pixels are the same as
another step's (a shape edit does not change the pixels under it) is the
**same `Uint8Array` object**, and structured clone stores a shared object once,
so the local copy dedups for free. Optional and not indexed: **no Dexie
`.version()` bump** (the store isn't Dexie at all), the reasoning `font_id`
states in `editPersistence.ts`.

The composite PNG stays on every step. It costs bytes, and it is what keeps an
older build able to read a newer **local** record (see 4).

**Stable text ids.** `annotations_to_json` already writes each text's `id`. On a
v7 restore that id is kept (`set_text_restore_id`, then
`restore_text_annotation`); `next_text_id` moves past the largest id seen, so a
new text never collides. Shapes still get fresh ids (nothing keys on a shape id
across a reload; case 4 compares objects, not ids).

**The transport frame** (`capture_state`, Rust) goes **v2 → v3**: the same
`STEP` data, appended. It is transport only; the JS still owns what lands on
disk (ADR-024). A layer's PNG is encoded once per distinct pixels: each
snapshot caches its layers' pixel prints, and the engine keeps the encoded
PNGs between saves the way `SavePngs` already does for the live layers. A step
whose single layer has no overlays reuses its own composite PNG
(`png_ref = u32::MAX`), because the two are the same pixels.

**Restore** (`useEngineCore.loadFromSaved`). An archive that carries step
layers rebuilds each step as a real document (`begin_layer_restore_keep_history`,
the layers, `finish_layer_restore`), then moves it into history
(`stash_live_as_snapshot`), oldest first, and builds the live document last.
An archive without step layers takes **today's path, unchanged**.

### 2. Undo after an op-log resume: rebuilt from the log at write time

When the op log is the source (resumed, in scope, not broken) and it holds
gestures older than the oldest snapshot, `capture_state` replays the log once,
forward from its base, and writes a step for each of those gestures: the
document before it, labelled with its name. The same for redo past the cursor
when the redo stack is empty. Rebuilt **at write time**, not carried and not at
resume: resume behavior, undo and the History panel stay exactly as they are
today, and the archive gets what the log knew.

**Cap.** The rebuilt steps share the **512 MB** undo budget (`max_bytes`,
ADR-086) with the snapshots the engine already holds, counted the same way
(`Snapshot::bytes`), and the step cap (`max_history`). Newest steps are kept;
the oldest go first. A restore pushes through the same trim, so a reload
cannot hold more than a live session could.

**Cost.** A save rebuilds those steps once, then reuses them (keyed by the
log's id, generation and op position) until the log changes. The measured
numbers are in "Measured" below.

### 3. Reading old archives

| Record | Read as |
|---|---|
| Cloud v1–v6 | Exactly as today: flattened steps, texts only, fresh ids. `decodeArchive` is the v6 reader with a tail added after it |
| Local, no `archiveVersion` | Exactly as today, through the old restore path |
| Either, v7 | Real layers per step, text ids kept |

An old record is **never rewritten in place**. It turns into v7 only when the
next normal save happens to write the photo.

### 4. An older build meeting newer data

| What the old build has | What it does |
|---|---|
| v9.83 (or older) reading a v7 **cloud** archive | Throws "Unknown archive version", logs "Cloud archive for this photo could not be read", and falls back to the local copy. On a device with no local copy, **the photo opens with no edit.** Not a crash and not a silent half-read, but the edit isn't there on that device until it runs v9.84 |
| v9.83 reading a v7 **local** record | Works: it reads the composite PNG and text list it always read and ignores the new fields. Undo is today's flattened undo |
| v9.84 reading a future **v8+** cloud archive | If its `compat` word is 7 or lower, v9.84 reads what it knows and skips unknown sections. Otherwise `readArchive` returns `{ kind: "newer", version }` (no throw), the app logs "made by a newer version of Image Horse", and falls back to the local copy, changing nothing |

The first row is the one hard-to-undo cost of choosing a version bump over
ADR-093's 1b (a trailer the v6 reader would skip). With 1b, v9.83 would open
the photo with flattened undo instead of no edit. The plan for today chose
the bump; 1b is one change to `encodeArchive` (write 6 and no `compat` word)
if Chris prefers it. Everything else in this ADR is the same either way.

### 5. Photo fields

On `PhotoEntry`, the gallery manifest row (`image-horse-gallery`, a plain
structured-clone store, not Dexie):

| Field | Written | Read by |
|---|---|---|
| `fingerprintOriginal?: Fingerprint` | **once**, at import, from the first thumbnail | Find duplicates |
| `fingerprintCurrent?: Fingerprint` | every time the thumbnail is rewritten (an edit, crop, resize, Paste look), beside it | Find duplicates; skips the engine call on gallery open when it is still current |
| `fileDate?: number` | at import: the `File.lastModified` | `{date}` when there is no EXIF date |

All optional, not indexed, **no Dexie bump** (Dexie stays at `.version(2)`,
IDB version 20). A match between two photos is the closer of
{original, current} × {original, current}, with the limits the 11-23 day log
set (6 bits straight, 5 through a turn).

### 6. Older photos

No backfill. A photo saved before this has no `fingerprintOriginal`; the first
time it is hashed, its **current** fingerprint is stored as its original too.
That cannot recover a pre-edit original: a photo edited before v9.84 matches
its original only as well as it does today. A photo with no `fileDate` uses
today's `{date}` (the EXIF date, else today).

### 7. What Time Machine (ADR-113) adds later

History forks (ADR-086) keep abandoned timelines as `Branch { fork_node, steps }`,
in memory only. To save them without redesigning this record:

- A **`BRCH`** section, next to `STEP`, using the same pool and the same per-step
  layer encoding: `branch_count { id, label, fork_ref, step_count, steps… }`.
- `fork_ref` names a step by **position in this archive** (undo index, redo
  index or "the live document"), not by `Snapshot::node`, which is per
  session.
- A writer that adds `BRCH` and nothing else writes `version 8, compat 7`, so
  v9.84 still reads the archive and drops only the branches (they are
  evicted first anyway, ADR-086).
- Locally: `SavedEdit.branches?`, same shape as the section.

Nothing in v7 writes or reads `BRCH`; the section table is what reserves it.

## Tests (red first)

| Test | Red on master because |
|---|---|
| e2e `text-placement-undo.spec.ts:308` case 4, `fixme` → `test`: log forced broken, reload, two undos, no object lost | saved steps have no shapes |
| e2e: shape + text, op-log resume, save, retire the log, reload: undo count > 0, and the shape comes back on undo (qc-1113 Q2d/Q2e path) | undo is 0 |
| unit `editArchive.test.ts`: a step with 2 shapes, a callout and a boxed text round-trips identical, text ids the same | no shapes field; ids regenerate |
| unit: archives written by **master's encoder** (checked in as fixtures) decode with the v7 reader | can't be red (the reader only grows); kept as a guard, and said so |
| unit: a v8 archive with `compat` 8 → `{ kind: "newer" }`, no throw, input unchanged | master throws a generic "Unknown archive version" |
| Rust: the capture's rebuilt steps respect the undo budget, oldest first out | new path |
| Rust: `capture_state` v3 carries each step's shapes, and step pixels are pooled | v2 has no step layers |
| PR B: `{date}` after reload; edited photo still groups with its original; old photos open and hash once; fingerprints not recomputed when stored; Dexie still v20 | see PR B |

## Measured (11-28, cloud box, 4 cores, release wasm under Node 22)

`capture_state` on a 2078 × 2078 photo (the size `strokeGate.ts` uses), master
`6440463` against `feat/243-archive-keeps-shapes`. "First save" encodes every
step; "next save" is the same document saved again (everything cached).

| Document | Frame bytes | First save | Next save |
|---|---|---|---|
| 10 shapes | 66,675,747 → 66,693,705 (**+0.03%**) | 1,225 → 1,307 ms | 84 → 83 ms |
| 5 brush strokes | 38,650,580 → 38,650,854 (+274 B) | 621 → 666 ms | 48 → 50 ms |
| 5 shapes, then 5 strokes | 66,197,447 → 93,965,853 (**+42%**) | 1,222 → 1,778 ms (**+46%**) | 91 → 127 ms |

What the three rows say:

- **Shape and text edits cost nothing extra.** A shape edit doesn't change the
  layer's pixels, so all ten steps name ONE pooled PNG, and that PNG is the live
  layer's, already in the frame (`POOL_LIVE_LAYER`).
- **Pixel edits on a layer with no overlays cost nothing extra.** The step's
  composite IS its layer, so the step names its own composite
  (`SAME_AS_COMPOSITE`) and nothing is encoded twice.
- **The cost is pixel edits made while overlays are on the layer**: each such
  step carries its raw layer beside its composite. That is the row ADR-093's
  pre-mortem was about, measured: +42% bytes, +46% on a cold save, +36 ms on a
  warm one, at 2078². The local record pays it in IndexedDB bytes; structured
  clone stores a pooled PNG once, so shape-only history adds nothing there
  either.

**Engine size:** 980,598 → 1,005,963 B (**+25,365 B**). Of that, the log
rebuild (§2) is 17,008 B (measured by building with it switched off: 988,955 B)
and the STEP trailer, `stash_live_as_snapshot`, `begin_layer_restore_keep_history`
and `set_text_restore_id` the other 8,357 B. Keeping the three rebuild helpers
out of line saved 30 B, so it wasn't kept. The deploy sentinel has a floor
(800,000 B) and no ceiling, so nothing trips.

**Not measured:** a save straight after an op-log resume (the rebuild's cold
cost) on a big photo, and memory after a v7 restore of a multi-layer document.
Both are bounded by the 512 MB budget, but neither number exists yet.

## Consequences

+ A fallback undo after a reload gives back real shapes and layers, on every
  path, not only when the log survived. Case 4 comes off `fixme`.
+ An archive written after an op-log resume keeps its undo history.
+ Text ids survive a reload.
+ Find duplicates survives edits and reloads; `{date}` survives a reload.
- Saves are bigger: a step that changed pixels and has overlays stores its
  layer PNG beside its composite PNG.
- A save after an op-log resume rebuilds older steps once (cached after).
- v9.83 and older can't read a v7 cloud archive (section 4, row 1).
- One more restore path (`stash_live_as_snapshot`) to keep tested at v1–v7.

## Pre-mortem

It is six months later and this was a mistake. Most likely: the extra layer PNG
per step made saves slow on big multi-layer photos, and strokes lagged behind
autosave (`strokeGate.ts`). Second: a v9.83 tab left open on a second machine
opened a photo with no edit, the user re-edited it there, and the older save
won. Early warning sign: capture bytes per save on the `strokeGate.ts` 2078²
test doc up by more than one layer PNG per changed step, or "Cloud archive for
this photo could not be read" in a Diagnostics report after v9.84.
