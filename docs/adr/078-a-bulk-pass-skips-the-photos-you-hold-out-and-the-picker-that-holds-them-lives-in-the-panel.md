# ADR-078: A bulk pass skips the photos you hold out, and the picker that holds them lives in the panel

Date: 2026-10-03   Status: draft

## Context

Batch's five sub-tools each did one thing to EVERY loaded photo. Ten photos, one
crop ratio: photos 2 and 5 were cropped too, and the only ways to keep one out
were to delete it from the gallery or to run a second pass over everything
again. "Most of these, but not that one" had no control anywhere in the app.
The gallery's `selectedIds` is the only multi-photo set that exists, and it
means *the selection* — the one behind Delete All, Duplicate and Export ZIP.

## Decision

`useBatchCropStore.held` — a `Record<photoId, true>` of the photos held OUT of
the pass. Absent key means in, so a gallery nobody has touched behaves exactly
as it did before. The Batch tile is called **Bulk** (the mode id stays `crop`:
routes, `BATCH_MODES` and the persisted `batchMode` all read it) and its panel
opens with a picker of the gallery's own thumbnails, numbered in gallery order;
clicking one holds it out. `bulkPhotos()` is the ONE list that decides who
moves, so the button, the progress total and the pass cannot disagree — and it
says "Crop 8 of 10 to 1:1" the moment anything is held. A held photo carries
no crop shade and no preview frame, because neither is true any more.

## Consequences

+ A photo can be given a different attribute than the rest without being
  deleted, re-added, or put through a second whole-gallery pass.
+ `held` is orthogonal to the attribute: Logo, Text and Rename can read the same
  set with no change to their panels' shape.
+ No IndexedDB change, so no Dexie migration and no sync contract to version.
- `selectedIds` and `held` are two multi-photo concepts in one app, and nothing
  on a thumbnail says "held" — the panel is the only place that reads.
- The tile says Bulk and still only crops. The label is honest about the
  concept and ahead of the capability until another panel reads `held`.
- One sub-tool's label now lives in three tables (toolGroups, toolModes' legacy
  `emoji` row, `BATCH_TOOL_MODES`); that duplication is pre-existing, and a
  rename now has to move all three or the palette answers to a second name.
- `held` is session state like the rest of that store, so a reload re-admits
  every photo.

## Alternatives rejected

- **Reuse the gallery's checkboxes as the pass's set.** One set, two meanings:
  holding a photo back from a crop is not the same act as ticking it to delete,
  and Delete All would then act on the crop's exceptions.
- **Per-photo exceptions inside the crop math** (a rect per photo id). The hold
  is not a fact about the crop, it is a fact about the pass, and it has to
  outlive a ratio change to be worth anything.
- **Leave the tile called Crop behind an "Exclude…" button.** Hides the one
  thing the tool is for behind the panel's last row.

## Pre-mortem

It is six months later and this decision was a mistake. The workflow people
actually wanted — "10 photos, but 2 and 5 want their own crop" — is served by
the per-photo FRAME that already existed: switch to photo 2, drag its frame,
and the rest follow the last one. The picker was built for a case nobody had,
so the hold-out count sits at zero, the "Bulk" label describes a tool that is
still just a crop, and the panel has spent a year carrying a grid of thumbnails
that exists to be ignored. The honest version of this feature was the frame
count, one line, already shipped. Early warning sign to watch for: two
releases in a row where nobody has used "Put them all back" and no photo is
ever held out — the picker is decoration at that point and should be deleted
rather than kept warm.