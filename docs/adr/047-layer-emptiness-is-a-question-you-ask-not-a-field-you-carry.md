# ADR-047: Layer emptiness is a question you ask, not a field you carry
Date: 2026-09-05   Status: draft

## Context

The Color Overlay tints a layer clipped to its own alpha (ADR-041, "tints,
never fills"). On a layer with no pixels it is therefore a no-op: the swatch
lights up and nothing happens. Disabling the swatches there needed one fact the
engine did not expose — does this layer contain anything? — and #71 sat blocked
on it for three sessions.

It was blocked on a **design** question, not a missing capability, and the
question was answered by measuring rather than arguing: the alpha scan costs
**4.0 ms in wasm** on the empty-layer worst case (a photo layer exits at pixel
0), against a ~10 ms bar. So there is no cache to build and no dirty flag to
keep coherent. What remained was *where the answer lives*.

Two shapes were available and both were wrong.

**A field on `get_layers()`** — the shape #63's annotation counts correctly
used, days earlier. `get_layers()` runs inside `capture_ui_state`, which
`syncState` reaches from **199 call sites including per-stroke paths**. The
counts could ride there because `Vec::len()` is O(1). A 4 ms scan at that rate
is a per-stroke cost, and it would be invisible until someone painted a long
stroke on a large image. #63 and #71 look like one change and are not; the
engine doc and the `.d.ts` now say so at the point of temptation.

**Reusing `begin_layer_resize_preview`**, which already scans alpha. It is
unusable as a probe twice over: it needs the tight bounding box, so it cannot
stop at the first opaque pixel, and it **sets `paste_preview` as a side
effect**. Answering a question must not move the document.

## Decision

Export a new primitive: `layer_is_empty(&self, index: usize) -> bool`.

| Property | Choice | Why |
|---|---|---|
| Receiver | `&self` | compile-time proof it cannot mutate — the failure `begin_layer_resize_preview` has |
| Addressing | stack **index**, bottom → top | the order `get_layers()` already emits, so the UI passes an array index it holds |
| Out of range | `true` | a layer that is not there holds nothing |
| Scan | 8 bytes at a time, both alpha lanes in one mask, early exit | a transparent layer costs a word read per two pixels |
| Mask | **ignored** | a hiding mask makes a layer invisible, not empty; the overlay is clipped to the layer's own alpha and applied BEFORE the mask (ADR-041), so un-masking must not change the answer |

It is a **different algorithm from the bbox scan, not an extraction of it.**
The two stay separate deliberately; merging them would reintroduce the side
effect or lose the early exit.

On the UI side the answer is a **query, not derived state**:
`useLayerIsEmpty` asks about the ONE selected layer and re-asks when the
document changes. The tempting shape — a map of emptiness by layer id — is
precisely the shape that caused the **v7.81 batch-export data loss**, where a
derived "which photos have edits" list went stale and silently dropped edits.
`undefined` means not-yet-known and disables nothing, so a slow or failed
answer never greys out a working control.

## Consequences

+ #71 unblocks, and with it the Color Overlay disable that was decided long ago.
+ The engine gains a cheap, pure predicate other callers can use — "is this
  layer worth compositing / exporting / showing a thumbnail for" are all the
  same question.
+ The reason is shown, not just the grey. A disabled control with no stated
  cause is the thing this repo's a11y passes keep finding.
- **+258 B** of wasm, inside the 800,000–840,000 band (ADR-045).
- One more awaited engine site (127 → 128 in the Stage 3.5 ratchet). It is
  value-consuming and born awaited: an un-awaited Promise is truthy, which
  would disable the swatches on every layer and claim each one was blank.
- The index addressing is a real hazard: an index is only meaningful against a
  particular stack order, so `useLayerIsEmpty` keys on the active layer's **id**
  as well as its index — reordering changes which layer an index means without
  changing the index. A future caller that forgets this gets a confidently
  wrong answer.

## Alternatives rejected

1. **A field on `get_layers()`.** See Context — 199 call sites, per-stroke
   paths. This is the one that looks obviously right because #63 did it.
2. **Reuse `begin_layer_resize_preview`.** Cannot early-exit, and mutates.
3. **Address layers by id instead of index.** Safer against reordering, and
   rejected for consistency: every other per-layer engine call in this crate
   that the UI drives from the layer array is index- or id-shaped to match its
   own neighbours, and `get_layers()` hands the UI an ordered array. Revisit if
   a second caller appears that does not hold that array.
4. **Cache the answer with a dirty flag.** The measurement says there is
   nothing to cache. A cache here would be pure invalidation risk for 4 ms.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: somebody
needed emptiness for *every* layer at once — a Layers-panel badge, say — called
this in a loop over the stack, and turned an O(1)-per-frame panel into an
O(pixels × layers) one. **The warning sign is `layer_is_empty` appearing inside
a `.map()` over `layers`.** If that is genuinely wanted, it needs a different
primitive that scans the stack once, not this one called N times.

Second most likely: the index/id hazard above bites after a reorder, and the
fix applied is to make the hook re-render more rather than to address by id.
