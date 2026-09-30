# ADR-073: Document loads and archive saves share one serial queue, and engine getters answer empty mid-restore
Date: 2026-09-30   Status: draft

## Context
Fast PgDn/PgUp with an edited photo (`e2e/photo-switch-state.spec.ts`) left the
gallery on photo A while the canvas was black or showed photo B in ~4 of 6 runs
on master. A trace proved A's saved archive was written with B's pixels: B's
load had finished, but the ownership marker set by the caller after an `await`
still named A, so the next switch saved "A" from the engine. Separately, the
worker engine panicked (index out of bounds) in `get_text_annotations` /
`get_shape_annotations`: a saved-photo rebuild empties the layer stack
(`begin_layer_restore`) across many worker messages, UI polls share the worker
FIFO, and a panic poisons the wasm instance (black canvas, hung loads).

## Decision
Every engine document load and every edit-archive save runs through one serial
queue, `app/src/hooks/engineLoadQueue.ts` (`makeLoadQueue`, `isStale`,
`claimEngineDocument`, `LoadOpts {isCurrent, photoId}`), exposed as `serialize`
on `useEngineCore`. A load already stale (`isCurrent()` false) before it touches
the engine is skipped; one that has touched the engine always finishes. The
marker (`setEngineDocument`) moves inside the load, at the moment the document
is replaced. `flushEditArchive`'s `savePhotoEdit` and the switch's
`flushPendingOplogSave` run via `stamp.serialize`. In the engine, read-only
getters go through `active_layer() -> Option<&Layer>` (`src/layer.rs`) and answer
empty mid-restore. Builds on ADR-024 (engine in a worker).

Isolation, 30 runs each: queue alone 6/24 failed (panics present), engine guard
alone 11/30 failed (0 panics), both 0/30. Final: 35/35 with the race tests on by
default.

## Consequences
+ A photo's archive can no longer be written with another photo's pixels.
+ A mid-restore UI poll gets an empty answer instead of poisoning the engine.
+ The AI result now carries its `photoKey` and is dropped, with a toast, if a
  different photo is open.
+ Wasm 820,591 → 820,341 B.
- A hung engine call now blocks every later load and save. The queue makes a
  hang visible instead of silently racing, but it is a single point of stall.
- Stale engine proxies still reject with "engine document replaced" as
  unhandled rejections. Console noise, still open.
- `useEngineCore.ts` is 931 lines against the 900 soft cap (one lint warning).
- Only getters are guarded. The other 95 `self.layers[self.active]` index sites
  still panic if a mutating call lands mid-restore.

## Alternatives rejected
- **Token check only, no queue:** a stale load that has already reinitialized
  the shared worker still replaces the document.
- **Stage the Rust layer rebuild off to the side and swap at finish:** all six
  `restore_*` calls attach to the active layer mid-rebuild, so it is a much
  larger engine change. The read guard covers the panics we observed.
- **Guard every `self.layers[self.active]` site:** mutating calls come from user
  actions, and the planned switch lock (skeleton plan §3) covers those.

## Pre-mortem
It is six months later and this was a mistake. Most likely reason: the queue
turned a rare race into a common freeze. One engine call that never resolves (a
worker that dies without failing its pending calls, or an upload awaited inside
a save) wedges every later switch, and the user sees a gallery that no longer
loads anything. Before the queue, that same hang cost only the one photo. The
switch lock never landed either, so a mutating call during a restore still
panics through an unguarded index site.
Early warning sign to watch for: a load or save sitting in the queue longer than
a few seconds, or a new `await` inside a `serialize(...)` body that is not an
engine call.
