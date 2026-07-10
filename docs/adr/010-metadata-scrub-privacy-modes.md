# ADR-010 — Export metadata scrub gets a GPS-only mode alongside the existing full strip

- **Status:** Draft
- **Date:** 2026-07-10
- **Deciders:** Chris
- **Supersedes:** —

## Context

Settings → Security already had a binary EXIF policy (`exifKeep: boolean`,
default `false`) applied to every export path (Export, Export All, Export
Selected) via `lib/exif.ts`'s `applyExifToVerbatim`/`applyExifToReencoded`.
"Strip" already removed EXIF, GPS, maker notes, embedded thumbnails, and
XMP/IPTC from JPEG/PNG/WebP — this was comprehensive, tested-by-shipping, and
NOT rebuilt here. The gap: it was all-or-nothing. A user who wants to keep
their camera/lens/timestamp (useful metadata, e.g. for a portfolio) but not
their home GPS coordinates had no option between "leaks everything" and
"leaks nothing." This ADR covers the added `'location'` scrub mode and
documents the pre-existing ICC and format-coverage decisions in one place
(neither was previously written down).

## Decision

`lib/exif.ts` gains a `MetadataStripMode = "all" | "location"` and a
`stripMetadata(bytes, mode)` entry point, format-auto-detected (JPEG/PNG/
WebP) from the file's own signature bytes:

- **`'all'`** (pre-existing behavior, now formalized under this name): drops
  EXIF, GPS, maker notes, the embedded EXIF thumbnail, XMP, and IPTC
  (JPEG APP13/Photoshop). **DECISION: ICC is kept even under `'all'`** —
  dropping the color profile can visibly shift rendered colors in viewers
  that don't assume sRGB, and a generic embedded ICC profile isn't
  personally identifying (unlike EXIF/GPS). A bespoke/rare ICC profile is a
  very weak device fingerprint; a future "paranoid" mode could offer
  ICC-strip as an explicit opt-in, but the default trade favors color
  fidelity. Not implemented here.
- **`'location'`** (new): removes only the TIFF GPS sub-IFD — camera, lens,
  timestamp, and software tags survive. Implemented by neutralizing the
  IFD0 entry that points at the GPS sub-IFD (tag → 0, so no reader finds it)
  and zeroing the GPS sub-IFD's own entries plus any external values they
  reference (the lat/lon RATIONAL triples), in place, same byte length.
- **Format coverage**: JPEG and PNG (the "at minimum" formats) and WebP are
  all supported for both modes. PNG gained EXIF **read** support
  (`extractPngExifTiff`) to match the write support (`stripPngMetadata`)
  that already existed — the Diagnostics panel could strip a PNG's EXIF but
  not display it; that asymmetry is now closed.
- **UI**: Settings → Security's existing Keep/Strip toggle gains a second,
  conditional row ("Location only" / "All metadata") when Strip is selected.
  New preference `exifStripMode`, default `'all'` — the existing default
  strip behavior is byte-for-byte unchanged unless the user opts into
  `'location'`.
- **Confirmation**: Export All shows a toast ("EXIF + GPS removed" /
  "GPS removed — camera info kept") after a strip export completes.

**Known gap (by design, not oversight):** GPS embedded in XMP (RDF/XML,
e.g. `exif:GPSLatitude` inside an iTXt/APP1-XMP block) is not parsed or
touched by `'location'` mode — only the binary EXIF TIFF GPS IFD is scrubbed.
`'all'` mode is unaffected (it drops the whole XMP block regardless of
contents). AVIF and other unrecognized formats are a no-op passthrough for
both modes — not yet supported, not guessed at.

## Alternatives considered

- **Parse and selectively strip XMP RDF too** — rejected for this pass: XML/
  RDF parsing is a meaningfully larger, easier-to-get-subtly-wrong surface
  than the existing dependency-free binary format handling, and XMP-embedded
  GPS in real-world files is rare next to EXIF GPS. Logged as a gap rather
  than hand-rolled under time pressure; a real XMP parser (or a vetted small
  dependency) is the right fix if this proves common in practice.
- **A three-way enum on the single `exifKeep`-shaped preference** (`"keep" |
  "strip-all" | "strip-location"`) instead of two orthogonal preferences —
  rejected: the two-preference shape (`exifKeep: boolean` +
  `exifStripMode: MetadataStripMode`) meant zero changes to the
  already-shipped `exifKeep` semantics or its call sites; a single combined
  enum would have touched more surface for the same behavior.

## Pre-mortem (mandatory)

It is six months from now and this decision caused an incident: a user
picked "Location only," exported a JPEG, and posted it publicly — and their
home coordinates were still recoverable, because the photo's XMP sidecar
(written by an editing tool, not the camera) carried a duplicate
`exif:GPSLatitude`/`GPSLongitude` pair that `'location'` mode never touches.
The user reasonably assumed "GPS removed" meant *all* GPS, not "GPS removed
from the format we currently parse." That's exactly the risk called out in
the Known Gap above, and it's the most likely real failure of this decision.
Mitigation already in the Decision: the export toast and the Security pane
copy both say "GPS" specifically (not "all metadata"), and `'all'` mode —
which *does* fully remove XMP — remains the safer default recommendation for
anyone unsure. Early warning sign to watch for: a support report or an
external EXIF-checker tool (exiftool, etc.) finding GPS tags in a file this
tool reported as scrubbed — that would mean the XMP gap (or an unhandled
format) is live in practice, not theoretical, and the fix path is either the
XMP parser noted above or, at minimum, detecting-and-warning when an XMP
block is present alongside `'location'` mode.

## Consequences

+ Users can keep useful, non-identifying camera metadata while still
  removing the one field (GPS) that's actually a privacy risk.
+ The pre-existing full-strip default is provably unchanged (`exifStripMode`
  defaults to `'all'`; `applyExifToVerbatim`'s new 4th parameter defaults to
  `'all'` too) — no silent behavior change for existing users.
+ PNG EXIF reading is now symmetric with its existing write/strip support,
  closing a small pre-existing Diagnostics-panel gap.
- The XMP-GPS gap above is real, not hypothetical, for any file whose GPS
  lives in XMP rather than (or in addition to) binary EXIF — most common
  from GPS-tagging done by editing software rather than the camera itself.
- One additional exported-but-internal-only function set
  (`stripJpegGps`/`stripPngGps`/`stripWebpGps`) mirrors the existing
  `stripJpegMetadata`/`stripPngMetadata`/`stripWebpMetadata` pattern — same
  fallow "unused export" shape as those six pre-existing siblings, accepted
  for API symmetry/testability rather than narrowed to file-private.
