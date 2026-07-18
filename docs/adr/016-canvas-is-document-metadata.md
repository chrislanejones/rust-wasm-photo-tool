# ADR-016: The Canvas is document metadata, not a logged layer
Date: 2026-07-13   Status: Accepted (2026-07-17 — the real-gallery check
this ADR was waiting on: a default Canvas + Photo document round-tripped
persist→restore with the Canvas rebuilt from metadata, byte-exact
composite; the 7/17 "canvas gone" report was a checkerboard-backdrop
rendering bug, not data loss)

## Context
`canvasArtboard: true` is the DEFAULT (app/src/lib/preferences.ts:100),
so every import lands as TWO layers: a fill ("Background",
src/lib.rs:849) plus the image ("Photo", src/lib.rs:860). A pad of 0
still yields two (src/lib.rs:2460-2471). But the op log refuses
multi-layer documents at BOTH levels: the engine drops the op and
marks the log broken when `layers.len() != 1`
(src/lib.rs:1119-1136), and persistence calls the log untrustworthy
when `layer_count() > 1` (app/src/lib/oplogPersistence.ts:105-109).
**So op-log undo and persistence can never activate on a default
document.** Flipping `ih_oplog_persist` on today ships nothing to
anyone using defaults. ADR-003/006/012/013 and the v7.24 data-loss
fixes are dark by construction, not by flag.

## Decision
Reclassify the artboard fill OUT of the document:
- **Canvas** — a fill (colour or blank), present on every document.
  DOCUMENT METADATA: size, pad, colour. Not a logged pixel layer.
- **Background** — the imported/pasted image (empty on a new canvas).
- **Layer 3+** — pastes, shapes, text, everything else.

The op log operates on Background and above; the Canvas fill is
metadata it carries, not content it records. A default 2-layer
document therefore has exactly ONE pixel layer and re-enters op-log
scope — retiring the single-layer-only limit without auto-flatten and
without a multi-layer op-log rewrite.

The Canvas identity MUST be an explicit `kind` field on the engine's
`Layer` struct (src/layer.rs:24), set at creation and serialized. It
must NOT be a name match — see Pre-mortem.

## Consequences
+ Op-log undo + persistence activate on the DEFAULT document. The
  entire ADR-003/006/012/013 arc becomes reachable by users.
+ Kills the "Background means two things" bug latent in the engine
  today (below): one name, one meaning, one flag.
- **Every name check must move to the flag, and there are four**:
  src/lib.rs:672, :2361, :2471 and src/layer.rs:695. Miss one and it
  silently reads the wrong layer.
- **"Background" INVERTS meaning.** Today the engine calls the FILL
  "Background" in artboard mode (src/lib.rs:849) but calls the PHOTO
  "Background" in single-layer mode (src/lib.rs:791), and in
  `flatten_all` (src/layer.rs:1085) and `finish_layer_restore`
  (src/layer.rs:1333). This model keeps only the second meaning. Any
  persisted document naming its fill "Background" needs a migration
  read (name → kind) or it restores with the wrong layer as content.
- Two ADRs need clause amendments (below); the persisted document
  format gains a canvas-metadata field.

## Amends prior ADRs — verified, not assumed
**ADR-012 (document model): CONSISTENT, one additive amendment.**
Its `Document` is ONE pixel plane + annotation lists. Canvas-as-metadata
does not grow that model to multi-layer — it removes a layer from the
document, leaving exactly one pixel plane. Its clause "ops the document
model can't express (masks, multi-layer structure) stay unrecordable
until the model grows" is **unchanged**: multi-layer stays unrecordable.
Amendment needed only to `Document`, which must gain a `canvas`
metadata field (pad, size, RGBA) so replay reconstructs the full visual.
That lands under ADR-012's own frozen-contract clause — additive field,
version byte guards decode.

**ADR-006 (render cache disposable): CLAUSE AMENDMENT REQUIRED.** Two
clauses name multi-layer as the log-retirement trigger — Consequences
("unrecorded edit → broken; multi-layer → out of scope") and
real-gallery check item 3 ("Add a layer to a photo that has a log,
reload → the LAYERS come back"). Both must be restated as **">1 PIXEL
layer (Canvas excluded)"**. Check 3 stays valid for a genuine third
layer.

**ADR-013: CLAUSE AMENDMENT REQUIRED.** "Recording is passive and
always-on for single-layer docs" → "single-PIXEL-layer docs (Canvas
excluded)".

## Also settled here (same decision)
**Export. CONFIRMED BY CHRIS, 2026-07-13: Canvas ships ON by default on
export.** This knowingly **REVERSES a shipped default** —
`exportCanvasBackground` was `false` (app/src/lib/preferences.ts:104-106)
with the rationale "the backing canvas is a compositional guide, not real
content". The reversal was put to Chris explicitly, with the consequence
named: existing users get padded, coloured exports where they previously
got a tight crop. He confirmed. It does not follow from the layer model —
it is an independent product call, recorded here because it belongs to the
same decision surface.
Background downloads unless X'd out in the Layers panel — that half
already holds (hidden layers are skipped by `composite_layers_into`)
and is hereby canonical.

**Where the Canvas sits. CONFIRMED BY CHRIS, 2026-07-13:** the Canvas is
**layer index 0** — the bottom of the stack, which is where
`set_artboard_border` already puts it — and it stays **visible in the
Layers panel** as a layer the user can see and toggle. The distinction
this ADR turns on is not visibility, it is *what the op log counts*: the
Canvas is a FILL carrying `LayerKind::Canvas`, and the log counts only
**pixel** layers. So a default document (Canvas + Photo) is ONE pixel
layer, the log activates, and the feature stops being dark. A layer to the
user; metadata to the log.

**Naming.** The create dialog ALREADY reads "New Canvas" /
"Create Canvas" (app/src/features/upload/NewActions.tsx:419-421,
:459-464). No display rename is outstanding. What remains is internal:
`blankMode` / `createBlank` / `blank-canvas.png` in NewActions.tsx, and
the engine's fill-layer name. "Canvas" means exactly one thing — the
fill layer. Internal ids do not churn (CLAUDE.md reserves renames for
the registry migration).

## Alternatives rejected
1. **Auto-flatten on edit** — activates the log, destroys layer intent.
2. **Full multi-layer op log** — correct end state, but an engine
   rewrite (ops, replay, keyframes, parity tests) for what a
   reclassification buys today.
3. **Keep single-layer-only** — honest, and ships the limitation
   permanently: the op-log work stays dark forever.
4. **Default `canvasArtboard` OFF** — one-line fix that activates the
   log, but reverses the deliberate v6.0 Canvas+photo UX default.

## Pre-mortem
It is six months later and this was a mistake. Most likely reason: the
Canvas was identified BY NAME. A user renames a layer to "Background",
or opens a legacy document whose fill is named "Background", and the
engine mistakes a content layer for the Canvas — so the op log skips
the layer it should record, or records the one it should treat as
metadata. Restore then replays confidently into the wrong document and
hands the user back an older image, silently. That is precisely the
failure shape ADR-006's pre-mortem already names as the sharp one, and
name-matching is how we walk into it. The name is ALREADY overloaded
today (fill in artboard mode, photo in single-layer mode), so this is
not hypothetical — it is the current code one rename away from biting.

Prevention: an explicit `kind: LayerKind { Canvas, Content }` on the
`Layer` struct, set at creation, serialized with the layer, never
inferred from a string. **This is IN SCOPE, not a follow-up** — the
whole model rests on "is this layer the Canvas?" being answerable, and
a name cannot answer it. It is step 1 below.

Early warning sign: any layer named "Background" that is not the fill —
including a user simply renaming one — or a restore whose layer count
disagrees with the persisted manifest.

## Implementation checklist
Engine (Rust) — must land first, in order:
1. `LayerKind { Canvas, Content }` on `Layer` (src/layer.rs:24); set in
   `load_image_artboard` / `set_artboard_border`; default `Content`.
2. Replace all four name checks with `kind` — src/lib.rs:672, :2361,
   :2471; src/layer.rs:695. Grep `"Background"` to zero.
3. Rename the fill layer "Background" → "Canvas"; `load_image` /
   `flatten_all` / `finish_layer_restore` keep "Background" for content.
4. `oplog_record` (src/lib.rs:1123) counts CONTENT layers, not
   `layers.len()`. Same for `layer_count()` exposure.
5. ADR-012 `Document` gains `canvas: CanvasParams`; bump the format
   version byte; extend the parity test to a Canvas+Background doc.
6. Legacy read: a persisted layer 0 named "Background" in a >1-layer
   doc decodes as `kind: Canvas`.

UI (TypeScript):
7. `isLogTrustworthy` (app/src/lib/oplogPersistence.ts:105-109) reads
   content-layer count.
8. Layers panel labels the fill "Canvas"; internal `blankMode` /
   `createBlank` vocabulary follows.
9. `exportCanvasBackground` default → `true` — ONLY on Chris's explicit
   confirmation (see Export above).
10. Re-run ADR-006's real-gallery check on a DEFAULT (2-layer) document
    — it has never been run on one, because it could not be.

## Implementation notes (2026-07-13) — READ BEFORE ACCEPTING
Steps 1-8 landed. Two deliberate deviations from the checklist, and one
thing the checklist missed:

**The log INDEXED layers, not just counted them.** Six more sites read or
wrote `layers[0]` as "the content layer": `oplog_doc_from_engine`,
`oplog_sync_annotations`, `oplog_restore_into_engine`, `oplog_maybe_start`,
`try_oplog_undo`/`redo`, `oplog_active`. Counting content layers alone
would have recorded the photo's strokes into the CANVAS's pixel plane and
replayed them back onto the wrong layer — a silent corrupting undo, the
exact failure the pre-mortem names. All now route through `content_idx()`.

**`CanvasParams` is `{r,g,b,a,visible,opacity}`, not `(pad, size, RGBA)`.**
Size is the document's own dims and pad isn't needed to render a
full-document fill; storing either creates a second source of truth that can
disagree with the layer geometry. `visible`/`opacity` ARE needed — the
engine composites the Canvas through them, so the log's composite must too
or the sync hash mismatches on a canvas toggle.

**The legacy read (step 6) checks pixels, not just the name.** The
checklist's rule — layer 0 named "Background" in a >1-layer doc ⇒ Canvas —
misfires on a document this ADR itself describes: artboard OFF, so
`load_image` named the PHOTO "Background", plus one pasted layer. By name
that is indistinguishable from an artboard document, and reading it as a
Canvas hands the op log the wrong content plane. The restore therefore also
requires the layer to be a **uniform fill** (which every artboard fill is by
construction and a photo is not). Its only misfire — a bottom content layer
that is a perfectly solid colour — is harmless, since the Canvas metadata
reproduces that exact plane at composite.

**Found and fixed in passing (it was live):** `composite_excluding_background`
dropped the PHOTO from the export of any artboard-OFF document that had
gained a second layer, and AppShell's "Remove Canvas" (a FIFTH name check,
not in the checklist — app/src/app/AppShell.tsx:1813) would have deleted the
user's photo on that same document.

**Still open:** the binary archive does not persist `kind` — restored
documents recover it via the legacy read above. A document whose Canvas has
been PAINTED on is no longer a uniform fill, so it restores as content (out
of op-log scope, fill included in exports). Conservative and lossless, but
the real fix is an archive field, which is a schema change (`dexie-migration`
skill). Step 9 (`exportCanvasBackground`) landed separately on master in
v7.26 (`073448e`). Step 10 — the real-gallery check on a DEFAULT document —
is NOT done and is the gate before either flag is flipped.

## Amendment (2026-07-14) — the pre-mortem's failure shipped anyway, through a different door

**What happened.** The 2026-07-14 flag-flip attempt A/B-proved data loss on the
EXACT shape this ADR's pre-mortem predicted ("restore then replays confidently
into the wrong document and hands the user back an older image, silently"):
same build, only localStorage flags differing. Import a 200×150 photo (default
artboard → 220×170 document with the Canvas fill), edit NOTHING, reload,
Resume. Flags OFF: 220×170. Flags ON: **200×150 — the Canvas silently
destroyed.** On-disk state at that point: a Dexie `keyframes` row
{width: 200, height: 150} and a manifest {opCount: 0, stale: false}.

**What was and wasn't built.** The canvas-metadata half of this ADR WAS built
(df5ee04, 2026-07-13): `CanvasParams` rides the version-prefixed annotations
blob (`encode_annotations`, OP_FORMAT_VERSION 2), `oplog_restore` rebuilds the
fill via `restore_canvas_layer`, and the persist round trip was parity-tested
(`canvas_document_persist_restore_round_trip_rebuilds_the_fill`). The failure
came in beside it, not instead of it:

1. **The empty log's base predated the import's own artboard call.** The base
   is captured lazily at `snap()`, which runs BEFORE the mutation it precedes —
   and `set_artboard_border` (the app's real import path: `load_image` then
   border) is a snap-without-record mutator. So an edit-free default import
   left an armed, in-scope, EMPTY log whose base was the PRE-artboard photo:
   200×150, no Canvas. "An empty log rebases at the next snap()" was the design
   answer; with zero edits, no next snap ever came.
2. **Persistence wrote that empty log as a restorable document**, and the
   restore path validated it (nothing was torn), replayed base + 0 ops,
   reported success — and `useImageSession` therefore skipped `loadPhotoEdit`,
   the archive-v5 working copy that restores the full stack correctly. The
   safety net existed and the code jumped over it.

**Fixes (fix/oplog-canvas-metadata, 2026-07-14).**
- Engine: `oplog_rebase_stale_empty()` at `recomposite()` — an empty, in-scope
  log whose base dims ≠ engine dims is rebased from the engine, so the base
  can never again describe a pre-import document (parity tests:
  `the_apps_own_import_path_arms_with_the_post_artboard_base`,
  `a_zero_op_persisted_base_restores_the_full_artboard_document`).
- TS (`oplogPersistence.ts`): incomplete restore ≠ success. Zero-op logs are
  never persisted (an empty live log instead RETIRES any on-disk manifest —
  stale flag, rows kept, reversible), and `restoreOplog` returns "none" for
  zero-op manifests — which also neutralizes the pre-fix rows already on user
  disks. Legacy v1 annotation blobs (no Canvas field) were already rejected by
  the version byte → "failed" → working-copy fallback; now pinned by test.
  No Dexie schema change: the Canvas rides the existing opaque
  `KeyframeRecord.annotations` bytes.
- e2e: `e2e/oplog-canvas-restore.spec.ts` pins the A/B (flags ON must equal
  flags OFF after resume, dims + pixels) and the paint-stroke-plus-Canvas
  resume the dogfooding missed (AI results ride a keyframe; strokes ride the
  log).

Step 10 (the real-gallery check on a DEFAULT document) REMAINS the gate before
any flag flips — this amendment does not discharge it.
