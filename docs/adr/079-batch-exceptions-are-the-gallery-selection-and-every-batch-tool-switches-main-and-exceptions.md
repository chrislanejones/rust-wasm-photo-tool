# ADR-079: Batch exceptions are the gallery's own selection, and every Batch tool switches between Main and Exceptions

Date: 2026-10-04   Status: draft   Supersedes: ADR-078

## Context

v9.10 (#290, ADR-078) renamed Batch › Crop to **Bulk** and gave its panel
`BulkHeldPicker`, a second grid of thumbnails that held photos OUT of the
crop pass. Chris rejected it on two counts: it was a second place the photos
show up, and a held photo got no treatment at all. The real case was "ten
photos, one crop, but 4 and 6 need a different one", and that applies to
Logo, Text and Rename as much as to Crop.

## Decision

The exceptions are `useGalleryStore.selectedIds`, the gallery's existing
checkboxes. While Batch is open each one reads "Exception", and the canvas
shows a matching checkbox (`BatchExceptionCheckbox`) that writes the same set.
Every Batch tool (Logo, Text, Crop, Rename, AI Rename) opens with a
Main | Exceptions switch (`BatchGroupToggle`, `ToggleButtonGroup mode="select"`,
the same control as the top bar's Tools | Gallery | Review). The switch
follows the photo on screen. `useBatchGroupStore` holds only which group is
showing, and `splitGroups` divides the gallery in gallery order. Crop keeps
one look per group (`useBatchCropStore.looks.main` / `.exceptions`) and a
single pass does both ("Crop 8 to 1:1 · 2 to 4:5"). The other tools run on
whichever group is showing. The tile is named Crop again, and
`BulkHeldPicker` plus the `held` / `bulkPhotos` API are deleted.

## Consequences

+ One mark, one place: there's no second picker, and the gallery thumbs and
  the canvas show the same truth.
+ Exceptions get their own treatment, not just a skip, on every Batch tool.
+ No IndexedDB change and no Rust change, so the wasm hash and the Dexie
  gate stay where they are.
- Same selection, two meanings. Ticking exceptions also lights up the
  gallery's Delete Selected / Export bar, so a delete there acts on the
  exceptions. ADR-078 rejected this option for exactly that reason.
- Only Crop runs both groups in one pass. Logo, Text and Rename need two
  runs, one per group.
- The group and the looks are session state, so a reload keeps the ticks
  (the gallery's) but resets the exception crop to its defaults.

## Alternatives rejected

- **The v9.10 picker grid (ADR-078).** A second place the images show up,
  and it could only skip a photo, never treat it.
- **A second per-thumb mark, separate from the selection.** Fixes the
  Delete-bar overlap, but adds one more mark to every thumbnail.
- **A canvas-only checkbox.** You can't see or set the group from the
  gallery, which is where people pick photos.

## Pre-mortem

It is six months later and this decision was a mistake. Most likely reason:
someone ticks three exceptions, forgets they're still ticked, and later hits
Delete Selected or Export expecting the gallery's normal selection. They lose
or ship the wrong photos because one set carries two meanings. Batch made the
selection sticky and important, and the gallery bar still treats it as
throwaway.
Early warning sign to watch for: a bug report or e2e failure where Delete
Selected or Export acted on photos that had been ticked as Batch exceptions.
