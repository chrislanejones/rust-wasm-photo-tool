# ADR-094: PNG export writes the smallest lossless layout, and Compress reduces a PNG's colors
Date: 2026-10-27   Status: draft (`fix/png-export-size`)   Relates to: ADR-031

## Context

`codec::export_png` always wrote 8-bit RGBA. Chris's 900×900, 66-color logo,
cropped to 728×606, exported at **28,683 B**, bigger than the 28,477 B
upload. A downscale is worse: Lanczos blends the logo's edges into 2,197
colors (450×450 RGBA = 43,496 B). Resize & Compress's Quality slider did
nothing for PNG, so a PNG had no way to shrink.

## Decision

1. **Lossless layout.** `export_png` writes Indexed (256 RGBA colors or
   fewer: palette + `tRNS`, `NoFilter`), else RGB (all opaque), else RGBA.
   Every layout decodes byte-identical through `decode_png`. Logo crop:
   28,683 → **14,182 B**. Opaque 2101×1254 screenshot: 1,628,690 →
   1,441,476 B.
2. **Quality applies to PNG** (Chris chose this on 10-27). Below 100, new
   `src/quantize.rs` reduces to N colors: median cut over a 5-bit/channel
   histogram, no dithering. N = 256 at q ≥ 75, 128 at 50–74, 64 at 25–49,
   32 below. Opaque, transparent and partial alpha never share a box.
   `encode_png_pixels_quality` returns min(reduced, lossless), so Compress
   never comes out bigger than lossless (smooth gradient: 471 B lossless vs
   4,532 B palette). Logo shrunk at 50%:
   ~42 KB → ~10 KB.
3. **Stored quality.** A PNG photo's existing `encodeQuality` field holds
   the quality its colors were reduced at; unset = lossless. Apply Resize
   keeps it. No IndexedDB schema or version change.
4. **Measurement mirrors the button.** With no quality change pending and
   the preview format equal to the photo's own, the panel measures as Apply
   Resize (`keepSourceEncoding`). Before, it measured at slider quality and
   wrote at stored quality (a JPEG showed 8 KB, wrote 11 KB). A PNG preview
   of a non-PNG photo measures lossless, because export never reduces colors.

## Consequences

+ Flat-art PNGs roughly halve with no pixel change; opaque PNGs drop ~11%.
+ PNG gets a real Compress path, and it can never come out bigger than lossless.
- No dithering: a PNG *photo* compressed below 100 can band in skies and
  gradients (parked in `docs/PARKING_LOT.md`).
- Engine +9,519 B (936,626 → 946,145), and every PNG export now scans for a
  palette (stops at the 257th color).
- The "≈" estimate ignores color reduction for the ~350 ms before the real
  measurement lands. Apply Resize on flat-art PNG still grows it, honestly;
  only dragging Quality shrinks it.

## Alternatives rejected

- **Hint-only panel line:** honest, but still no way to shrink a PNG.
- **`imagequant` / libimagequant:** GPL-3 licensing.
- **`color_quant` crate:** a new dependency for one median cut.
- **HashMap palette, `powf`, generic sorts:** binary size (see `src/fonts.rs`).
  The first quantizer cost +30,855 B wasm; sorted `Vec`, integer steps and a
  32-bin counting pass brought it to +9,519 B.

## Pre-mortem
It is six months later and this was a mistake. Most likely reason: users
compress PNG photos, not logos, and the undithered 32–128 color steps band
visibly. They read it as "Image Horse ruins my PNGs", and because the stored
`encodeQuality` survives Apply Resize, the reduced colors stick to the photo.
Adding dithering then costs bytes, which works against the reason this exists.
Early warning sign to watch for: a banding or "posterized" report on a PNG
with `encodeQuality` set, or a PNG whose Compress result equals its lossless
size (min() chose lossless, so the reduction bought nothing).
