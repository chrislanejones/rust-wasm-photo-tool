# ADR-039: A transparent artboard is left out of a format that has no alpha

Date: 2026-08-18   Status: draft

## Context

Every photo imports onto a two-layer artboard (ADR-016): a backing Canvas layer
plus the Photo, with `canvasPadding` of 10px per side by default and a fill that
defaults to the "transparent" swatch. ADR-016 also reversed the export default
to **Include canvas** — what is on screen is what you get.

JPEG has no alpha channel. The browser encoder is not asked what to do with the
pixels it cannot represent; it writes them **opaque black**. Measured in Chrome:
a transparent margin round-trips out of `convertToBlob` as

| Format | Corner pixel after a round trip |
|---|---|
| `image/jpeg` | **rgba(0,0,5,255)** — opaque black |
| `image/webp` | rgba(0,0,0,0) |
| `image/png`  | rgba(0,0,0,0) |
| `image/avif` | `blob.type` returns `image/png` — no encoder here, silent fallback |

So every JPEG export carried a black frame the width of the canvas border, on a
setting nobody chose. Reported from the field with a 15px border; the default is
10px and the setting goes higher.

Two things made it survive: PNG keeps alpha, so the same padding is invisible
there and nothing looked wrong, and the Settings copy claimed *"Photo only …
the default"* — text written before ADR-016 reversed it and never updated. The
UI said the padding was off. The code said it was on. Both were read as agreeing.

## Decision

When the target format has no alpha channel AND the backing fill is
transparent, **leave the backing canvas out of the export.** One predicate,
`includeCanvasInExport`, consulted by all three surfaces — the single Download,
the batch ZIP, and the export dialog's predicted size.

This is deliberately the narrowest possible exception to ADR-016:

| Case | Behaviour |
|---|---|
| Opaque fill, JPEG | **unchanged** — that border is visible content |
| Transparent fill, PNG / WebP / AVIF | **unchanged** — the format can carry it |
| "Photo only" | **unchanged** |
| Transparent fill, JPEG | **canvas dropped** — this ADR |

The rationale is that "include" has no meaning here. A transparent artboard
shows as checkerboard, which is the UI for *nothing*. Asked to bake nothing into
a format that cannot express nothing, the honest answers are to drop it or to
invent a colour; dropping it is the one that matches what was on the screen.

The Settings copy is corrected to state the real default rather than flipping
the default to match the stale text — the default is ADR-016's decision, not a
typo, and reversing it belongs in its own ADR.

## Consequences

+ A JPEG export is the photo, at the photo's dimensions, with no invented pixels.
+ The rule lives in one function, so the dialog's predicted size cannot disagree
  with the file that gets written.
+ Verified in the running app under the real defaults: PNG 320×240 with a
  transparent border, JPEG 240×160 with the photo's own colour in the corner.
- **A JPEG export can now differ in DIMENSIONS from a PNG export of the same
  document**, silently. That is the cost: the format now changes the framing,
  not just the compression.
- Interior transparency is NOT covered. An erased hole in the middle of a photo
  still encodes as black, because cropping cannot reach it. Fixing that needs a
  matte flatten over the buffer — real per-pixel work, belonging in
  `src/simd/color.rs` — and is filed, not built.

## Alternatives rejected

1. **Flatten onto a white matte.** Turns a black border into a white border. The
   complaint was the border, not its colour.
2. **Flip the export default back to "Photo only".** Fixes the symptom for JPEG
   by changing behaviour for every format, and silently reverses an accepted
   ADR. If that default is wrong it deserves its own decision.
3. **Refuse to export, or warn.** A dialog explaining alpha to someone who
   wanted a JPEG.

## Pre-mortem

It is six months later and this was a mistake. The most likely reason: someone
resizes to exact dimensions with the artboard on, exports JPEG, and gets a file
that is not the size the document said — because the canvas was dropped and
nothing announced it. The dimensions readout in the status bar still shows the
padded document, and this rule is invisible until you compare two files.

Early warning sign to watch for: a bug report of the form "my JPEG is smaller
than my PNG", or anyone adding a fifth export format without touching
`ALPHA_CAPABLE_FORMATS` — the test that names the set exists to make that
impossible to do by accident.
