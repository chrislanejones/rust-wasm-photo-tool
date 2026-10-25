# ADR-093: Saved undo steps keep their shapes and layers, not a flattened picture
Date: 2026-10-25   Status: draft — proposed, Chris decides (`fix/text-placement-undo`, night 10-24)   Relates to: ADR-031, ADR-060, ADR-086, ADR-088, ADR-092

## Context

After a reload, undo has two paths. With a healthy saved op log, undo replays
the log and every object comes back. Without one, the engine falls back to the
saved undo steps, and those steps are **flat pictures**:

- Each step is saved as one PNG, `Snapshot::encoded_png` (`src/history.rs`
  ~line 72), which is `composite_layers(...)` of the whole stack. Shapes and
  texts are baked into its pixels. Next to it: the label and the text list
  (`capture_state`, `src/capture.rs` ~line 121, `CAPTURE_VERSION` 2).
- On restore, `useEngineCore.ts` (~line 722) calls `inject_undo_snapshot`
  (`src/history.rs` ~line 679): **one** layer from that PNG, then texts pushed
  back one by one with `push_annotation_to_undo_snapshot`, which carries no
  shadow, perspective, wrap width or box height. Shapes are never pushed back.

So one fallback undo after a reload turns shapes into ink
(`get_shape_annotations()` returns `[]`), collapses the layers to one, and
lays each text over its own baked copy.

The fallback runs when the document has more than one content layer, when the
log broke before the save (a broken log is never saved,
`oplogPersistence.ts` ~line 137 / ~398), or when undo goes past what the log
covers. Night 10-24's trigger (PARKING_LOT, "Undoing a text's Placement with
the Text tool open breaks the op log") lost a callout's pin and leader this
way. Tonight's PR removes that trigger without a format change. The flattening
itself stays: `e2e/text-placement-undo.spec.ts` case **4** is `test.fixme`
(log forced broken, reload, two undos: **0** shapes back, expected pin +
leader).

Two copies are saved, and they differ (checked tonight):

- **Local:** a structured-clone `SavedEdit` object in raw IndexedDB
  (`edit-<id>`, `editPersistence.ts`). New optional fields need no
  `.version()` bump (ADR-031, ADR-060 precedent). Older builds ignore them.
- **Cloud:** the binary archive, `editArchive.ts` `VERSION = 6`. An older
  build that meets a higher version throws "Unknown archive version" (~line
  146), logs it, and opens the photo **with no edit** when it has no local
  copy (a second device). The v6 reader does not check that it read every
  byte, so a trailing section is ignored.

## Options

| | What | Fixes case 4? | Multi-layer docs? | Format change | Main cost |
|---|---|---|---|---|---|
| **1a** | Save each step's full state: shape JSON, full text JSON (the live serializer), per-layer PNG + overlays. New `inject_*` rebuilds real layers. Archive **v7**, capture **v3** | Yes | Yes | Yes, both | An older build on a second device opens the photo with no edit. Bigger saves |
| **1b** | Same data, but the cloud archive stays **v6** and the new data goes in a trailing section the v6 reader skips | Yes | Yes | Capture v3 only | Version 6 no longer says what is in the file. The next bump has to step around the trailer |
| **2** | No format change. At restore, walk the saved log back a gesture at a time, and swap an injected step for the log's document only when its composite is byte-identical to the step's PNG | No (no log is saved) | No (out of log scope) | No | Partial. A second restore path that only helps where the log already works |
| **3** | Do nothing more. Tonight's fix removes the known trigger. Keep the `inject_undo_snapshot` comment and the `fixme` | No | No | No | Multi-layer docs keep flattening on any undo past a reload |

## Recommendation

**Option 1, starting with 1b, in a daytime session, not tonight.** Tonight's PR
ships as option 3. Option 2 is rejected: it adds a second restore path and
still misses both cases that reach the fallback.

Measure first:

1. **Bytes per undo step**, before and after, on a 1-content-layer doc and a
   3-layer doc. A layer that did not change between steps should not be saved
   twice. Today's capture is already **29.5 MB** on a 2078² photo
   (`strokeGate.ts`).
2. **Save time on the engine worker.** Autosave already holds strokes back
   (`strokeGate.ts`). A slower capture makes drawing feel worse for everyone.
3. **Memory after a reload.** Rebuilt steps hold every layer, not one, so
   fewer steps fit in the **512 MB** undo budget (ADR-086).
4. **The 1b trailer against the last deployed build**, with a real cloud
   archive, before relying on "the v6 reader skips it".

Per the `dexie-migration` skill (it covers any storage change, not only a
`.version()` bump): fixtures of v1–v6 saved edits must still load, a fresh
install must work, nothing already saved gets rewritten, and it is not an
overnight job because fixture judgment needs a person awake. `imagehorse-qc`
before the release.

## Consequences (of option 1)

+ Undo after a reload gives back real objects and layers on every path, not
  only when the log survived. Case 4 can come off `fixme`.
+ One serializer for live and saved text, so the four missing text fields stop
  being a second, smaller copy of the truth.
- Bigger and slower saves, size unknown until measured.
- 1a: older builds can't read the cloud copy. 1b: a version number that lies a
  little, and a trailer every later format change has to know about.
- More engine surface: new inject calls, and a restore path tested at v1–v7.

## Pre-mortem
It is six months later and option 1 was a mistake. Most likely reason: saving
every layer of every step made autosave heavier for every user, to fix a path
few users reach now that the Placement trigger is gone. Strokes lag behind
saves, and the fix shipped for a bug we never counted. Second: a 1b trailer
gets misread by a later format bump, and a cloud copy fails to load.
Early warning sign to watch for: capture bytes per save on the `strokeGate.ts`
2078² test doc going up by more than the measured per-step estimate, or "Cloud
archive for this photo could not be read" showing up in Diagnostics.
