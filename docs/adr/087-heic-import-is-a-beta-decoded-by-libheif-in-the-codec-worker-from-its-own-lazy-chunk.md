# ADR-087: HEIC import is a Beta, decoded by libheif in the codec worker from its own lazy chunk
Date: 2026-10-06   Status: draft   Relates to: ADR-064, ADR-074, ADR-049

## Context

Every iPhone shoots HEIC, and only Safari's `createImageBitmap` can decode it.
In Chrome or Firefox a `.heic` either arrives with an empty mime and is
filtered out without a word, or arrives as `image/heic` and fails with
"Couldn't open <name>." A branch of 09-11-2026 (`claude/festive-cori-inzcau`,
#130) built the fix and was never merged; it fell ~215 commits behind. This
ports its design onto master, behind a Beta. It is the app's first LGPL
dependency, and Chris approved that license for this use.

## Decision

**libheif-js 1.23.5** (LGPL-3.0, libheif + libde265 compiled to WASM), the
`libheif-wasm/libheif-bundle.mjs` entry, **unmodified**.

- **Beta, off by default.** `ih_heic_import`, `?beta=heic-import`,
  Settings › Beta. Off, every import funnel is master's check exactly
  (`lib/importBoundary.ts` reduces to the old mime-or-SVG test) and libheif
  is never requested (e2e `heic-import.spec.ts` watches the network).
- **Converted at the door, like SVG.** On, a `.heic/.heif/.hif` (by mime or
  name) is sniffed by its `ftyp` brands. AVIF, which shares the container
  and the `mif1` brand, is vetoed, and so is a JPEG named `.heic`. Safari
  decodes natively first; everyone else decodes in the **codec worker**,
  because libheif compiles its WASM synchronously, which browsers forbid on
  the main thread above 4 KB. The result is re-encoded to WebP (q 0.92) and
  that WebP is the stored original.
- **EXIF carried over.** Read from the HEIF item table (`meta → iinf →
  iloc`) and transplanted with the existing `applyExifToReencoded`. GPS and
  camera survive, and Settings › Security scrubs on export as for any JPEG.
  Orientation is reset to 1, because libheif has already applied the
  container's `irot`.
- **LGPL handling.** libheif is its own file (`assets/libheif-bundle-<hash>.js`),
  reached by one dynamic `import()` inside the worker, kept out of the SW
  precache. Its license ships at `/licenses/libheif-js.LICENSE.txt` (a test
  holds it byte-identical to the package's), and `docs/THIRD-PARTY-NOTICES.md`
  names it, its version and its source.

## Consequences

+ iPhone photos open, EXIF included, for anyone who opts in.
+ Sessions without the Beta pay nothing: libheif ~2.0 MB raw / ~0.71 MB gzip
  is never fetched. With the Beta on, a HEIC fetches it once.
- First-load JS grows ~2.1 KB (0.06%). The new dynamic import also makes
  rolldown split `preload-helper` and `diagnosticsLog` into two tiny
  modulepreload chunks, so two more requests at boot.
- A HEIC is stored as WebP, not as itself. A verbatim export hands back the
  WebP, and HDR or depth data in the HEIC is dropped.
- LGPL obligations now apply to the build: the file must stay separate and
  replaceable, and the license must ship with it.
- HEVC is a patented codec. The decoder runs on the user's machine and we do
  not sell it, but that question has not been looked at by anyone qualified.

## Alternatives rejected

- **Keep the `.heic` bytes as the original.** Every reopen would rerun a ~1 s
  WASM decode, and the export would be a file most software can't open.
- **libheif-js's pure-JS build on the main thread.** ~3 MB of JS and
  double-digit seconds per iPhone photo.
- **Ship it to everyone now.** Its EXIF reader has only been checked against
  a fixture made with libheif's own writer, never a real iPhone file.

## Pre-mortem
It is six months later and this was a mistake. Most likely reason: a real
iPhone file (a Live Photo, a grid-tiled 48 MP shot, or HDR gain-map HEIC)
decodes wrong or slowly, and the WebP-at-the-door choice threw away the data
needed to fix it after the fact.
Early warning sign to watch for: a Beta user reporting a sideways, washed-out
or failed iPhone photo, or the worker dying on a 48 MP HEIC.
