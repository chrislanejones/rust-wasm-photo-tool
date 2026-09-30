# ADR-074: AVIF export ships its own encoder, as a lazy wasm chunk beside the engine
Date: 2026-09-29   Status: draft

## Context

AVIF has been in `EXPORT_FORMATS` since the start and has never been written.
No browser can encode AVIF from a canvas: `convertToBlob({ type: "image/avif" })`
returns an `image/png` blob without a word (the spec's required fallback). The
honesty fix (`lib/encodeSupport.ts`, `useDownloadFormat.ts`) made the app say
so and name the file `.png`, and Chris kept AVIF in the list on 2026-08-06
because he wants real AVIF. `PARKING_LOT.md` listed three options:

1. `@jsquash/avif` (libavif + libaom from Squoosh), lazily imported.
2. A `ravif` feature in the crate, inside `stamp_tool`.
3. WebCodecs `VideoEncoder` av01 plus a hand-written ISOBMFF/AVIF muxer.

## Decision

Option 1. `app/src/lib/avifEncoder.ts` is the only module that names
`@jsquash/avif`, and it does so by dynamic `import()`, so nothing is fetched
until the first AVIF encode.

- The codec worker's `encodeImage` routes `image/avif` to `encodeAvif`, and so
  does `encodeRgba`'s main-thread fallback. Every export surface (Download,
  Download All/ZIP, Compress, Apply Resize, Auto Compress) already goes
  through one of those two, so none of them changed.
- If the encoder fails, both fall through to `convertToBlob`, which writes an
  honest `image/png`, and callers keep naming the file from `blob.type`.
- `canEncode("image/avif")` answers true whenever `WebAssembly` exists instead
  of probing the canvas. Probing by encoding would fetch the encoder just to
  open a dialog. The Download and Compress pickers stop saying AVIF falls back
  to PNG.
- Quality maps straight: the app's 0..1 slider becomes libavif's 0..100.
  Speed is fixed at 8. Measured 2026-09-29 on a 3000×2000 synthetic image in
  Node, single-threaded: speed 6 (library default) took 2.6–3.3 s, speed 8
  took 0.8–0.9 s, and the file was 1–22% larger. Auto Compress and the export
  size-fit loop encode more than once per save.

Verified in headless Chromium through the dev server: `encodeRgba(…, "avif", 0.8)`
on 1200×800 returned `image/avif` with an `ftypavif` brand in 676 ms, the
input buffer was detached (so the worker did it), it decoded back at
1200×800, and a transparent pixel stayed at alpha 0. In the same page a native
`convertToBlob({ type: "image/avif" })` still returned `image/png`.

## Consequences

+ "Download AVIF" writes AVIF. Transparency survives.
+ The engine wasm is unchanged, so the size band (ADR-037) is not involved.
- The build gains ~7 MB of wasm (single-threaded `avif_enc.wasm` 3.49 MB,
  1.14 MB gzipped, plus the `_mt` variant, used only when the page is
  cross-origin isolated, which it is not). One is fetched on first AVIF use.
- With `VITE_ENABLE_SW=1` the precache glob (`**/*.wasm`) takes both encoders,
  about 7 MB more for every installed client. Worth a `globIgnores` entry
  before the service worker ships on by default.
- A second wasm codec with its own libc, not built by `build-wasm.sh` and not
  pinned by it. The dependency is pinned in `pnpm-lock.yaml` only.
- Quality 92 in AVIF is not quality 92 in JPEG. A high slider can make an
  AVIF bigger than you'd expect, and "Smallest" stays true only at typical
  settings.

## Alternatives rejected

- **`ravif` in the crate.** One wasm, but every user downloads the AV1
  encoder with the editor, and ADR-037 already says it does not fit the band.
- **WebCodecs + a hand muxer.** No dependency, but AV1 `VideoEncoder` support
  varies by browser, and writing an AVIF container is a project of its own.

Pre-mortem warning sign: a static `import … from "@jsquash/avif…"` anywhere
but a test, or an `avif_enc` asset referenced from `index.html`.
