# QC — the ZIP honours "Photo only"

Branch `fix/zip-photo-only` (`d831e8e`), **committed and unpushed**. Master is
untouched. This changes the bytes a batch export writes, so it wants a human
before it merges.

## What changed

| File | Change |
|---|---|
| `lib/restoreLayerStack.ts` | **new** — the layer-restore loop, extracted so the editor and the export path share one copy |
| `hooks/useEngineCore.ts` | its inline 78-line restore block now calls that helper |
| `lib/exportImage.ts` | `compositeSavedEdit` restores layers, and takes `{ excludeBackground }` |
| `app/AppShell.tsx` | `exportPhotosToZip` passes `!exportCanvasBackground` and lists it as a dependency |

## Already measured — reproduce if you want, don't take it on faith

Two photos, A edited (Enhance → Adjustments → Vivid), B untouched, exported via
**Download All**, zip read back by parsing it in the page:

| Setting | A (edited) | B (untouched) |
|---|---|---|
| Include canvas | 1530×1030 | 1500×1125 |
| **Photo only** | **1500×1000** | 1500×1125 |

Source A is 1500×1000; the artboard border is 15px per side. The edit survives
the crop — saturation 0.366 → 0.463 against the source.

## The four cases to check

Settings → Layers and Canvas → *Exporting*. Load at least two photos so
**Download All** appears — it is hidden with one.

| # | Case | Expected |
|---|---|---|
| 1 | **Photo only**, edited photo | zip entry is the photo's own size; no border |
| 2 | **Include canvas**, edited photo | zip entry is photo + 2×`canvasPadding` |
| 3 | Transparent backing canvas, **Photo only**, export as **PNG** | no transparent margin; alpha only where the image really has it |
| 4 | A photo with **no edits at all** | unchanged either way — it ships its original bytes and never had a canvas |

Case 3 is the one worth doing carefully. JPEG has no alpha, so a transparent
border silently becomes black; PNG is where a wrong crop shows up as a fringe.

Case 4 is the regression guard: an untouched photo must not start going through
the composite path.

## What I could not check

- **A legacy pre-v5 archive** (no `layers` array). The code returns the flat
  canvas unchanged and skips the exclude branch, which is the intended
  behaviour, but I had no pre-v5 edit to test against. If you have an old photo
  in your gallery from before archive v5, exporting it is the real test.
- **Signed in.** The signed-in app hangs ~118s on a fresh origin (master too),
  so everything here was logged out. `compositeSavedEdit` doesn't touch auth,
  but `loadPhotoEdit` has a cloud branch that was never exercised.

## Also true, not fixed here

The pane's own help text says "Photo only … the default". It is not —
`preferences.ts:109` defaults `exportCanvasBackground` to `true` (include
canvas) per ADR-016. One-line copy fix, left alone so this branch stays one
change.
