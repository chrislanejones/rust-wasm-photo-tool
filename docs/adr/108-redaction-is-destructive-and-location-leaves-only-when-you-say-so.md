# ADR-108: Redaction is destructive, and location leaves only when you say so
Date: 2026-11-21   Status: draft (`feat/batch-redact`, `feat/export-camera-info`; Night 11-21, tickets 230 + 231)   Relates to: ADR-010, ADR-052, ADR-061, ADR-079, ADR-088, ADR-100, ADR-102, ADR-105

## Context

Two privacy jobs people do on every screenshot set and phone photo, and both
were by hand:

1. **The same secret in the same place on every screenshot.** A nav bar's
   email, an account number, a face in a header. Shapes › Fill › Pixelate
   could hide one photo at a time; twelve screenshots were twelve boxes.
2. **Where a photo was taken.** Exports transplant the original's EXIF into
   JPEG/WebP when "Keep EXIF" is on (`lib/exif`, with the Rust port behind
   the `exif-rust` Beta). That carries GPS. Settings › Security had Keep /
   Strip and, under Strip, a "Location only" scope, but the scope only
   reached ONE path (a Download All entry copied verbatim). The single
   Download, edited ZIP entries and recipes ignored it.

Measured while building it: **today's default is not "Keep all".** The
preferences default to `exifKeep: false` + `exifStripMode: "all"`
(`lib/preferences.ts:125-128`), so an export made by someone who never
opened Security already carries **no EXIF**. The night plan's premise ("Keep
all, today's behaviour") was wrong; the default kept here is the real one.

Also found: **Keep EXIF wrote sideways photos.** Every re-encoded export is
upright (pixels are decoded with `createImageBitmap`, which applies the EXIF
orientation), but the transplant copied the source TIFF unchanged, so a
portrait phone photo (Orientation 6) was exported as upright pixels that
said "rotate 90°". No fixture had an orientation other than 1.

## Decision

### Batch › Redact (230, PR A)

1. **A Batch tile, Redact.** Drag boxes on the open photo (up to **10**),
   pick **Pixelate · Blur · Solid**, and every photo in the batch is
   redacted in the same place. Main | Exceptions per ADR-079: each group has
   its own boxes, and **a group with no boxes is skipped**, so ticking a
   photo as an Exception keeps it out until boxes are drawn for it.
2. **A box is stored in the drawn-on photo's ORIGINAL pixels**, with that
   photo's original size. Two ways to carry it to another photo, per group:
   - **Same spot (relative), the default:** the same fractions of width and
     height. Screenshots of one screen at different densities (1440 × 900
     and its 2x 2880 × 1800) are the common screenshot-set case, and the one
     where pixels would be wrong by exactly 2×.
   - **Pinned to a corner (anchored):** the same size in pixels and the same
     distance from one of the Placement grid's nine cells. For windows of
     different sizes at the same density, where a header does not scale.
   Original pixels, not the canvas's, because the open photo is a working
   copy of at most 2048 px and an anchored "24 px" must mean the same thing
   on it as on a full-size stored file.
3. **No new engine code and no new op.** Pixelate and Solid are the
   rectangle shape with its mosaic / solid fill, recorded as `ShapeAdd`, the
   same "redaction box" Shapes › Fill › Pixelate draws. Blur is the Blur
   brush's own stroke (`effect_down/move/up`, recorded as `Op::Blur`) walked
   over the box in rows 0.9 × radius apart, with the outermost dabs centered
   on the box edge so it reaches every corner. Radius `clamp(min(w,h)/4, 4,
   12)`, so the blur feathers at most 12 px past the box. `OP_FORMAT_VERSION`
   is untouched.
4. **The minimum strength is what makes it a redaction.** Block size ≥ **12**
   (default 16, ≤ 64); Blur strength ≥ **20** (default 30, the brush's top).
   Measured on the built engine (`lib/redactEngine.test.ts`) over 12 px
   glyph ink: at the floors no pixel darker than 96 survives where the ink
   was 0, and the box's standard deviation falls below a quarter of the
   text's. A blur at 4 fails the same test, which is why the slider starts at
   20. `safeStrength` clamps whatever is stored.
5. **The open photo is ONE undo step**, every box sent in one tick with
   `continue_step` before each after the first (the `applyLookAsOneStep`
   rule). It stays an editable box on the canvas until export; the export is
   where its pixels are gone.
6. **Photos not open follow Batch Resize's rule:** decoded from the stored
   original at full resolution, redacted in a throwaway engine, encoded in
   their own format, written back, one at a time, **no undo**, and the
   panel says so above the button.
7. **Two refusals, both for the same reason: a box that looks done but hides
   nothing is the worst outcome.**
   - A not-open photo **with edits of its own is skipped** (Paste look's
     rule, not Resize's). A saved edit carries its own pixels and restores on
     top of the stored file, so the redaction would be painted over.
   - The open photo is redacted **on its photo layer only when it has one
     content layer**. A mosaic or blur works on the layer it is drawn on; the
     text to hide could sit on another.

### Camera info on export (231, PR B)

8. **One choice, three answers: Keep all · Remove location · Remove all.**
   In the Export dialog's Selected and All panes, in recipes, and in the
   phone's Settings sheet for Save. It is stored in the two preferences
   Security already had: Keep all = `exifKeep`; Remove location = not keep +
   `location`; Remove all = not keep + `all`. So it is remembered, syncs
   (ADR-061), and needs **no new field and no prefs-format bump**; Security
   and the dialog can never disagree.
9. **Re-encoded exports** (single Download, edited ZIP entries, recipes):
   - Keep all transplants the source TIFF with **Orientation set to 1**.
   - Remove location does the same with the **GPS IFD scrubbed** (the
     existing same-length scrub, now exported: `stripGpsFromTiff`).
   - Remove all writes none.
   For an upright original, Keep all is **byte-identical** to before. For a
   turned one it is the sideways bug, fixed.
10. **Verbatim exports and stored copies** (Download All of an untouched
    photo in its own format, the phone's Save, Batch › Strip info):
    - Remove location: GPS only, same length.
    - Remove all: everything.
    - **A turned JPEG under Remove all keeps one tag, its Orientation,** in a
      26-byte TIFF. Its pixels are as the camera wrote them; without the tag
      it would be sideways. Re-encoding an untouched JPEG to bake the turn in
      would cost quality for a metadata choice, and on the phone it would
      need the engine. "No camera info except what is needed to show the
      photo the right way up" is the ticket's own definition of Remove all.
    - WebP and PNG verbatim files get no orientation tag back (WebP needs the
      canvas size to grow a VP8X header; PNG viewers mostly ignore eXIf
      orientation). This is a documented gap.
11. **Both EXIF paths, same bytes.** `prepareExifTiff` and the
    orientation-only rule are in `src/exif.rs` too (`exif_prepare_tiff`,
    `apply_exif_to_verbatim`), and the oracle holds them identical. It goes
    from **281 to 373 rows**: two ops (`prepare_keep`, `prepare_location`)
    plus three turned fixtures. All 281 old goldens are unchanged. Engine
    969,240 → **971,432 B (+2,192)**.
12. **A recipe carries the choice it was saved with** (`ExportRecipe.cameraInfo`,
    optional). Built-ins have none and use the dialog's. A device older than
    the field drops it on its next save, which degrades to that same "use the
    dialog's choice".
13. **Batch › Strip info**, a Batch tile that applies Remove location or
    Remove all to every photo's **stored copy**, so later exports, the phone's
    Save and computer-to-phone pairing sends (which send `originalKey`)
    carry the stripped file. It is lossless: a metadata scrub of the stored
    bytes, with no decode, so pixels never change and the open photo needs
    no engine step. It replaces stored files, so it **asks first**: "This
    removes location from 12 photos. It can't be undone." Exceptions start on
    "Leave as is".
    - **It rewrites `uploadKey` too.** `uploadKey` is documented as never
      replaced: it is the Compare baseline and the source every Keep-all
      export reads EXIF from. Leaving it alone would let a later Keep-all
      export put the location straight back, the one thing this tool
      promises cannot happen. Its pixels are untouched, so it is still the
      same baseline; only its metadata is gone. This is the one exception.
    - Transfer (phone → editor, ADR-102) is not reached: the phone sends the
      file it picked, before any of this.
14. **The default stays where it is tonight: Remove all.** The question is
    Chris's (below).

## The default question, for Chris

The night plan asked for the case for making **Remove location** the default.
With the measured default being Remove all, the question is really "loosen
to Remove location, or keep Remove all".

**For Remove location as the default:**
- It removes the one field that is a danger on its own: the coordinates of a
  home, a school, a kid's playground. The date, camera, lens and exposure
  are what photographers expect to survive, and what photo libraries sort by.
- Someone exporting for a portfolio or a client loses their capture date
  today without knowing it was ever there. Remove location keeps it.
- Every big sharing service strips location on upload anyway, so Remove
  location matches what people already expect from "sharing a photo".

**For keeping Remove all:**
- It is what everyone has had. Changing a privacy default toward MORE data
  leaving, even only camera and date, is the direction that needs the better
  reason.
- The date and camera are a weak fingerprint: one camera serial or a
  distinctive lens across a set of anonymous posts can tie them together.
- Remove all is what a screenshot needs, and screenshots are a large part of
  what this app exports.

**Recommendation:** Remove location, with the dialog's Camera info row
visible on every export, so the choice is in front of people rather than in
Settings. That is a one-line change to `DEFAULT_PREFERENCES` plus a note in
the release, and it only affects people who never chose.

## Consequences

- Redact on the open photo is an editable box until export. Anyone who saves
  the project keeps the original pixels under it, by design (it is undoable);
  exports and every not-open photo are pixel-destructive.
- Blur reveals the RHYTHM of what it hides (word lengths, line breaks), which
  the crops show. It passes the glyph and flatness test, but Solid is the
  strongest of the three (the panel keeps the ticket's order, Pixelate ·
  Blur · Solid).
- Batch › Redact and Strip info rewrite stored originals; neither changes the
  Dexie schema. Paste look's `hasOwnEdits` is now shared.
- The engine-async contract count goes 236 → 247 (Redact's 11 awaited reads),
  and `lib/redactEngine.ts` is a listed throwaway engine.
- AppShell lost lines (the two EXIF props) and gained none; the Redact
  overlay rides `BatchCropOverlay`'s mount.

## Alternatives rejected

- **A rectangle blur in the engine, or a "blur" shape fill.** Either is new
  engine code and a new fill kind or op (an `OP_FORMAT_VERSION` question);
  the brush covers the box with the code and op that already exist.
- **Boxes in absolute pixels by default.** Wrong by 2× on the commonest
  screenshot set (1x and 2x of one screen).
- **Baking orientation into verbatim JPEGs by re-encoding.** Costs quality on
  files no one edited, and needs the engine on the phone.
- **A third preference field for the choice.** Two fields already said it;
  a third would be a prefs-format bump and a second source of truth.
- **Strip info that leaves `uploadKey` alone.** Keep-all exports and the
  Diagnostics panel would still read the location from it.

## Pre-mortem

Six months on, this failed because… a Redact on a photo whose secret was on
a second layer, or under a saved edit, exported with the secret showing. Both
are refused today with a reason in the results list. **Warning sign:** a
Redact results row of "redacted" on a photo that has more than one content
layer, or any change that drops the `hasOwnEdits` check.
