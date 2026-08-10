# The capture sweep — ADR-024 Stage 3.5, step a6

**Run 2026-08-09 against the tree at v7.90 (gate 93).** One pass over every
`.ts`/`.tsx` under `app/src`, looking only for the ATOMIC CAPTURE shape. Nothing
was converted; this is the list.

## The headline

**The capture seam is nearly exhausted.** a3, a4 and a5 removed ~52 sites
between them because each found a large capture. The sweep finds **four
remaining captures worth converting, covering ~11 sites**, plus two low-stakes
ones. Everything else is ordinary one-at-a-time work, hot-path work deferred to
a10, or reads that dissolve at Stage 4.

That is the useful answer, and it is the opposite of the last two sessions'
experience. Expect the gate to move slowly from here — not because progress
stalled, but because the compressible part is gone.

## The shape being looked for

> N reads that describe one document state and are consumed together — passed to
> the same function, stored in the same record, published as the same object, or
> where one is interpreted at another (pixels at dimensions).

A cluster of **mutations** is not a capture. Neither are reads in different
functions that merely sit near each other.

## Captures found

| # | Site | Reads | Consumed as | Stakes |
|---|---|---|---|---|
| 1 | `lib/openraster/export.ts:56-59` | `layer_count` + `width` + `height` + `get_layers` | one `stack.xml` describing one document | **high** — written into the `.ora` archive |
| 2 | `lib/openraster/export.ts:22-24` | `active_layer_id` + `layer_count` + `get_layers` | the stack to iterate and flatten | **high** — also read-modify-write |
| 3 | `app/AppShell.tsx:852-859` | `shape_annotation_at` → id, then `get_shape_annotations` | id looked up in the list | medium — ✅ **DONE v7.94**, `capture_pen_hit` |
| 4 | ~~`hooks/useTextTool.ts:461-470`~~ | `text_annotation_at` → id, then `get_text_annotations` | id looked up in the list | ⚠️ **NOT A CAPTURE — withdrawn 2026-08-10**, see below |

### A pattern worth naming: HIT-TEST THEN LOOK UP

> ⚠️ **CORRECTED 2026-08-10 (v7.94).** This section said captures 3 and 4 were
> "the same shape in two places". They are not, and the paragraph about
> `useTextTool` below was wrong — see **Capture 4 is withdrawn** at the end of
> this section. Capture 3 is real and shipped; capture 4 must not be converted.

Capture 3 is this shape, and it is not the pixels-at-dimensions shape the
earlier ones were:

```ts
const id = tool.text_annotation_at(x, y);      // read 1: which one?
const list = JSON.parse(tool.get_text_annotations());  // read 2: all of them
const ann = list.find((a) => a.id === id);     // read 1 indexes into read 2
```

An id is only meaningful against the list it was drawn from. If an annotation is
deleted between the two reads, `find` returns `undefined` and the click silently
does nothing. Today the two reads cannot be separated; behind the worker they
can.

An engine call taking the coordinates and returning the annotation itself
removes the id-then-lookup entirely, which is a smaller change than it sounds.
That is `capture_pen_hit(x, y)`, shipped in v7.94 — and note it is deliberately
TOPMOST-THEN-CHECK, not find-a-bezier: `shape_annotation_at` returns the newest
shape of ANY kind and the kind check happens after, so a rectangle over a pen
path still means "no pen path here" rather than reaching through it.

### Capture 4 is withdrawn — `useTextTool` is not this pattern

The original text here read `useTextTool:466`'s comment — *"Parse fresh list so
we pick up the latest geometry"* — as "the freshness is deliberate, but the
pairing is assumed". **The pairing is not assumed. There is a mutation between
the two reads**, and the sweep missed it:

```ts
const hitId = tool.text_annotation_at(x, y);   // read 1, PRE-commit state
if (hitId >= 0) {
  if (textInputRef.current) commitText();      // <- MUTATES: can remove_text_annotation
  list = JSON.parse(tool.get_text_annotations());   // read 2, POST-commit state
  const ann = list.find((a) => a.id === hitId);
```

Two consequences, both fatal to converting it:

1. The id is read from the pre-commit state and the geometry from the
   post-commit state **on purpose**. A single atomic call would have to sit on
   one side of `commitText` or the other, and both change behaviour.
2. `find` returning `undefined` is a **handled** case here, not a silent
   failure. It falls through to opening a fresh text input — which is the
   correct response to emptying a text and clicking where it used to be.

So this site needs ordinary await-restructuring, not a capture. A mirrored
`capture_text_hit` built "for symmetry" would have been two conventions for one
problem, which is the mistake this document exists to prevent.

**The general lesson, which is the reason this correction is kept rather than
edited away: two call sites with the same *read sequence* are not the same
problem. What sits between the reads is part of the pattern.**

## Captures found but NOT worth converting

| Site | Reads | Why not |
|---|---|---|
| `BatchSettings.tsx:496-502`, `:1183-1187` | `width` + `height` after `load_image` | **Throwaway engine** (the one-port allowlist) — nothing can mutate it mid-read, so there is no correctness risk. 2 sites → 1 each is available if someone is in the file anyway |
| `lib/tilesFlush.ts:145-146` | `layer_count` + `content_layer_count` | Part of an 8-read diagnostics object, but it feeds a debug gauge. A torn read means a briefly inconsistent panel |

## Everything else, by file

| File | Sites | Verdict |
|---|---|---|
| `app/session/useSelectionActions.ts` | 11 | **HOT PATH** — per-pointermove; a10, last, with its own reasoning |
| `lib/openraster/export.ts` | 11 | **CAPTURES 1–2**, plus the rest needs a **DECISION**: the file mutates the live document mid-export (`set_active_layer` + `flatten_text_annotations`) between its reads. Pre-existing, not introduced by 3.5 |
| `app/AppShell.tsx` | 8 | **CAPTURE 3**, remainder ordinary single reads |
| `hooks/useEngineCore.ts` | 8 | Mostly `flushToCanvas` (`width`/`height`/`data_ptr`/`data_len`/`get_image_data`) — **DISSOLVES at Stage 4, do not convert**; remainder ordinary |
| `hooks/useTextTool.ts` | 7 | **CAPTURE 4**, remainder ordinary |
| `hooks/useDrawingTools.ts` | 6 | Mutation sequences (`set_editing_shape` + one edit). Ordinary/hot |
| `features/tools/settings/BatchSettings.tsx` | 5 | Two throwaway-engine captures (above); ordinary |
| `hooks/useHistory.ts` | 5 | Ordinary — all `toolRef.current?.x()` truthy guards |
| `app/session/useCanvasActions.ts` | 4 | Ordinary — four reads in four different functions |
| `hooks/useExport.ts` | 4 | Ordinary — its two captures shipped in v7.88 |
| `hooks/useTransforms.ts` | 3 | Ordinary — mutation then a single read |
| `lib/engine/textMetricsCache.ts` | 3 | Ordinary — pure functions, already cached (a2) |
| `AISettings.tsx` · `useColorPicker.ts` · `usePaintTool.ts` · `exportImage.ts` · `oplogPersistence.ts` · `tilesFlush.ts` | 2 each | Ordinary. `oplogPersistence` is a **feature-detect fallback chain** — only one of its two calls ever runs |
| `useCopyRegionAction` · `useExportDimensions` · `TextSettings` · `useCloneStamp` · `useEditPersistence` · `editPersistence` | 1 each | Ordinary by definition — a capture needs ≥2 reads |

## Method, and its own blind spot

Clusters were found mechanically (≥2 d.ts-declared engine methods within 6 lines,
comments stripped, per-file aliases of `toolRef.current` resolved), then every
cluster was read and judged by hand. Two checks on the method itself:

| Check | Result |
|---|---|
| Widen the window to 15 and 30 lines | Surfaced 8 more files, **all false positives** — reads in different functions, not consumed together |
| Compare per-file totals against `engine-call-audit.mjs` | Found a **blind spot in this sweep**: `useHistory` scanned as 0 against the audit's 5 |

**The sweep's own detector missed optional chaining.** `toolRef.current?.undo()`
did not match a `receiver.method(` pattern, which hid all five of `useHistory`'s
sites and any cluster containing one. Fixed and re-run; two further clusters
appeared (both mutation sequences, neither a capture).

That is the fourth time on this arc that a detector has been defeated by
formatting — after the alias undercount (93 sites), the multi-line `async (`
head (16 misfiled), and the multi-line receiver (1). The lesson is not "be
careful"; it is that **any scan of this codebase should be cross-checked against
a second one before its output is trusted**, which is what caught this.

## What this re-scopes

| Batch | Before the sweep | After |
|---|---|---|
| a7–a9 | "ordinary conversions, batched by file, size unknown" | ~4 capture conversions first (~11 sites), then genuinely one-at-a-time |
| a10 | 27 hot-path sites | unchanged — `useSelectionActions` confirmed as the bulk |
| `openraster/export.ts` | "needs its own design call" | confirmed, and now it is clear *which* part: captures 1–2 are ordinary capture work, the mutate-mid-export behaviour is the part needing a decision |
