//! EXIF / metadata muxing for the export pipeline — a byte-for-byte port of the
//! TS module `app/src/lib/exif/` (codecs.ts, gps.ts, index.ts), which stays the
//! ORACLE. `tests/exif_oracle.rs` and `app/src/lib/exif/exifOracle.test.ts` hold
//! the two sides to identical output on every committed fixture.
//!
//! Not wired into the app yet: the export path still calls the TS module. The
//! two run side by side behind the oracle test; switching the export path over
//! is an attended decision.
//!
//! What it does (see the TS module for the policy notes, which apply verbatim):
//!   • strip "all"      — JPEG APP1 (EXIF/XMP) + APP13 (IPTC); PNG eXIf, tEXt,
//!                        zTXt, iTXt, tIME; WebP EXIF + "XMP " (and their VP8X
//!                        flag bits). ICC is deliberately kept.
//!   • strip "location" — zero the GPS sub-IFD in place (same length), and the
//!                        IFD0 entry that points at it; PNG CRC recomputed.
//!   • keep, re-encoded — transplant a source TIFF block into a JPEG (APP1 after
//!                        SOI) or WebP (EXIF chunk last, upgrading to VP8X).
//!   • read             — the raw TIFF block from JPEG APP1 / PNG eXIf / WebP EXIF.
//!
//! FAIL-SAFE, like the oracle: every parse is bounds-checked, never indexed
//! blind, and a failed parse returns the input unchanged. Nothing here panics —
//! where the TS DataView would throw (and its caller would fall back to an
//! unchanged copy) this returns `None` internally and falls back the same way.
//!
//! All offset arithmetic is done in `u64`: the TS does it in doubles, and on
//! wasm32 a `usize` sum of a file offset and a 32-bit length can overflow.
use wasm_bindgen::prelude::*;

const EXIF_ID: &[u8; 6] = b"Exif\0\0";
const PNG_SIG: &[u8; 8] = &[137, 80, 78, 71, 13, 10, 26, 10];
const GPS_IFD_TAG: u16 = 0x8825;

// ── bounds-checked helpers ─────────────────────────────────────────────────

/// `b[s..e]` as `Some` only when the whole range is in bounds.
fn range(b: &[u8], s: u64, e: u64) -> Option<&[u8]> {
    let (s, e) = (usize::try_from(s).ok()?, usize::try_from(e).ok()?);
    b.get(s..e)
}

/// JS `Uint8Array.prototype.slice(s, e)` for `0 <= s`, `e <= len`: empty when
/// `s >= e` rather than failing.
fn js_slice(b: &[u8], s: u64, e: u64) -> Vec<u8> {
    range(b, s, e).map(<[u8]>::to_vec).unwrap_or_default()
}

fn byte(b: &[u8], o: u64) -> Option<u8> {
    b.get(usize::try_from(o).ok()?).copied()
}

fn arr<const N: usize>(b: &[u8], o: u64) -> Option<[u8; N]> {
    range(b, o, o + N as u64)?.try_into().ok()
}

fn be16(b: &[u8], o: u64) -> Option<u16> {
    arr(b, o).map(u16::from_be_bytes)
}

fn be32(b: &[u8], o: u64) -> Option<u32> {
    arr(b, o).map(u32::from_be_bytes)
}

fn le32(b: &[u8], o: u64) -> Option<u32> {
    arr(b, o).map(u32::from_le_bytes)
}

// ── JPEG ───────────────────────────────────────────────────────────────────

fn is_jpeg(b: &[u8]) -> bool {
    matches!(b, [0xff, 0xd8, _, _, ..])
}

/// `(tiff_start, seg_end)` of the EXIF APP1 segment. `tiff_start` can exceed
/// `seg_end` for an APP1 shorter than its identifier — the oracle reads the
/// identifier past the segment end, and so does this.
fn find_jpeg_exif_segment(b: &[u8]) -> Option<(u64, u64)> {
    let len = b.len() as u64;
    let mut pos: u64 = 2;
    while pos + 4 <= len {
        if byte(b, pos)? != 0xff {
            return None;
        }
        let marker = byte(b, pos + 1)?;
        if marker == 0xda || marker == 0xd9 {
            return None;
        }
        if (0xd0..=0xd7).contains(&marker) {
            pos += 2;
            continue;
        }
        let seg_len = u64::from(be16(b, pos + 2)?);
        if seg_len < 2 {
            return None;
        }
        let seg_start = pos + 4;
        let seg_end = pos + 2 + seg_len;
        if seg_end > len {
            return None;
        }
        if marker == 0xe1 && range(b, seg_start, seg_start + 6) == Some(&EXIF_ID[..]) {
            return Some((seg_start + 6, seg_end));
        }
        pos = seg_end;
    }
    None
}

fn extract_jpeg_exif_tiff(b: &[u8]) -> Option<Vec<u8>> {
    if !is_jpeg(b) {
        return None;
    }
    find_jpeg_exif_segment(b).map(|(s, e)| js_slice(b, s, e))
}

/// Drop APP1 (EXIF/XMP) and APP13 (IPTC); keep JFIF, ICC and the scan.
fn strip_jpeg_metadata(b: &[u8]) -> Vec<u8> {
    if !is_jpeg(b) {
        return b.to_vec();
    }
    let len = b.len() as u64;
    let mut out = Vec::with_capacity(b.len());
    out.extend_from_slice(&b[..2]);
    let tail =
        |out: &mut Vec<u8>, from: u64| out.extend_from_slice(range(b, from, len).unwrap_or(&[]));
    let mut pos: u64 = 2;
    while pos + 4 <= len {
        let (Some(ff), Some(marker)) = (byte(b, pos), byte(b, pos + 1)) else {
            break;
        };
        if ff != 0xff || marker == 0xda {
            // Not a marker, or SOS: everything from here on is kept verbatim.
            tail(&mut out, pos);
            return out;
        }
        if marker == 0xd9 || (0xd0..=0xd7).contains(&marker) {
            out.extend_from_slice(range(b, pos, pos + 2).unwrap_or(&[]));
            if marker == 0xd9 {
                break;
            }
            pos += 2;
            continue;
        }
        let seg_len = be16(b, pos + 2).map_or(0, u64::from);
        let seg_end = pos + 2 + seg_len;
        if seg_len < 2 || seg_end > len {
            tail(&mut out, pos);
            return out;
        }
        if marker != 0xe1 && marker != 0xed {
            out.extend_from_slice(range(b, pos, seg_end).unwrap_or(&[]));
        }
        pos = seg_end;
    }
    out
}

/// Insert an EXIF APP1 segment (built from a TIFF block) right after SOI.
fn inject_jpeg_exif(jpeg: &[u8], tiff: &[u8]) -> Vec<u8> {
    if !is_jpeg(jpeg) {
        return jpeg.to_vec();
    }
    let clean = strip_jpeg_metadata(jpeg);
    let seg_len = 2 + EXIF_ID.len() + tiff.len();
    if seg_len > 0xffff || clean.len() < 2 {
        return clean;
    }
    let mut out = Vec::with_capacity(clean.len() + 2 + seg_len);
    out.extend_from_slice(&clean[..2]);
    out.extend_from_slice(&[0xff, 0xe1]);
    out.extend_from_slice(&(seg_len as u16).to_be_bytes());
    out.extend_from_slice(EXIF_ID);
    out.extend_from_slice(tiff);
    out.extend_from_slice(&clean[2..]);
    out
}

// ── PNG ────────────────────────────────────────────────────────────────────

fn is_png(b: &[u8]) -> bool {
    b.len() > 8 && b.starts_with(PNG_SIG)
}

/// `(data_start, data_end)` of the first chunk of `kind`, stopping at IEND.
fn find_png_chunk(b: &[u8], kind: &[u8; 4]) -> Option<(u64, u64)> {
    let len = b.len() as u64;
    let mut pos: u64 = 8;
    while pos + 12 <= len {
        let chunk_len = u64::from(be32(b, pos)?);
        let t: [u8; 4] = arr(b, pos + 4)?;
        let data_start = pos + 8;
        let data_end = data_start + chunk_len;
        let end = data_end + 4;
        if end > len {
            return None;
        }
        if &t == kind {
            return Some((data_start, data_end));
        }
        if &t == b"IEND" {
            return None;
        }
        pos = end;
    }
    None
}

fn extract_png_exif_tiff(b: &[u8]) -> Option<Vec<u8>> {
    if !is_png(b) {
        return None;
    }
    find_png_chunk(b, b"eXIf").map(|(s, e)| js_slice(b, s, e))
}

/// Drop eXIf, tEXt, zTXt, iTXt and tIME. Bytes after IEND are dropped too.
fn strip_png_metadata(b: &[u8]) -> Vec<u8> {
    if !is_png(b) {
        return b.to_vec();
    }
    const DROP: [&[u8; 4]; 5] = [b"eXIf", b"tEXt", b"zTXt", b"iTXt", b"tIME"];
    let len = b.len() as u64;
    let mut out = Vec::with_capacity(b.len());
    out.extend_from_slice(PNG_SIG);
    let mut pos: u64 = 8;
    while pos + 12 <= len {
        let (Some(chunk_len), Some(t)) = (be32(b, pos), arr::<4>(b, pos + 4)) else {
            break;
        };
        let end = pos + 12 + u64::from(chunk_len);
        if end > len {
            out.extend_from_slice(range(b, pos, len).unwrap_or(&[]));
            break;
        }
        if !DROP.contains(&&t) {
            out.extend_from_slice(range(b, pos, end).unwrap_or(&[]));
        }
        pos = end;
        if &t == b"IEND" {
            break;
        }
    }
    out
}

/// PNG / zlib CRC-32, bitwise. The eXIf chunk is the only thing it ever sees,
/// so a 1 KB lookup table would cost more wasm bytes than it saves time.
fn png_crc32(bytes: &[u8]) -> u32 {
    let mut c = 0xffff_ffffu32;
    for &x in bytes {
        c ^= u32::from(x);
        for _ in 0..8 {
            c = if c & 1 != 0 {
                0xedb8_8320 ^ (c >> 1)
            } else {
                c >> 1
            };
        }
    }
    !c
}

// ── WebP ───────────────────────────────────────────────────────────────────

fn is_webp(b: &[u8]) -> bool {
    b.len() > 16 && b.starts_with(b"RIFF") && b.get(8..12) == Some(&b"WEBP"[..])
}

#[derive(Clone, Copy)]
struct WebpChunk {
    fourcc: [u8; 4],
    data_start: u64,
    data_end: u64,
}

/// Every chunk after the 12-byte header, or `None` when one overruns the file.
/// A tail too short for a chunk header (< 8 bytes) is ignored, as in the oracle.
fn parse_webp_chunks(b: &[u8]) -> Option<Vec<WebpChunk>> {
    if !is_webp(b) {
        return None;
    }
    let len = b.len() as u64;
    let mut chunks = Vec::new();
    let mut pos: u64 = 12;
    while pos + 8 <= len {
        let fourcc: [u8; 4] = arr(b, pos)?;
        let size = u64::from(le32(b, pos + 4)?);
        let data_start = pos + 8;
        let data_end = data_start + size;
        if data_end > len {
            return None;
        }
        chunks.push(WebpChunk {
            fourcc,
            data_start,
            data_end,
        });
        pos = data_end + (size & 1);
    }
    Some(chunks)
}

/// One chunk of an output container. `byte0` overrides the first data byte
/// (the VP8X flag edit) without copying the payload.
struct Part<'a> {
    fourcc: [u8; 4],
    data: &'a [u8],
    byte0: Option<u8>,
}

fn build_webp(parts: &[Part<'_>]) -> Vec<u8> {
    let body: u64 = 4 + parts
        .iter()
        .map(|p| 8 + p.data.len() as u64 + (p.data.len() as u64 & 1))
        .sum::<u64>();
    let mut out = Vec::with_capacity(usize::try_from(8 + body).unwrap_or(0));
    out.extend_from_slice(b"RIFF");
    out.extend_from_slice(&(body as u32).to_le_bytes());
    out.extend_from_slice(b"WEBP");
    for p in parts {
        out.extend_from_slice(&p.fourcc);
        out.extend_from_slice(&(p.data.len() as u32).to_le_bytes());
        let at = out.len();
        out.extend_from_slice(p.data);
        if let (Some(v), Some(slot)) = (p.byte0, out.get_mut(at)) {
            if !p.data.is_empty() {
                *slot = v;
            }
        }
        if p.data.len() & 1 == 1 {
            out.push(0);
        }
    }
    out
}

fn chunk_part<'a>(b: &'a [u8], c: &WebpChunk) -> Part<'a> {
    Part {
        fourcc: c.fourcc,
        data: range(b, c.data_start, c.data_end).unwrap_or(&[]),
        byte0: None,
    }
}

fn extract_webp_exif_tiff(b: &[u8]) -> Option<Vec<u8>> {
    let chunks = parse_webp_chunks(b)?;
    let c = chunks.iter().find(|c| &c.fourcc == b"EXIF")?;
    Some(js_slice(b, c.data_start, c.data_end))
}

/// Drop EXIF + XMP chunks and clear their VP8X flag bits.
fn strip_webp_metadata(b: &[u8]) -> Vec<u8> {
    let Some(chunks) = parse_webp_chunks(b) else {
        return b.to_vec();
    };
    let parts: Vec<Part<'_>> = chunks
        .iter()
        .filter(|c| &c.fourcc != b"EXIF" && &c.fourcc != b"XMP ")
        .map(|c| {
            let mut p = chunk_part(b, c);
            if &c.fourcc == b"VP8X" {
                p.byte0 = p.data.first().map(|f| f & !0x0c);
            }
            p
        })
        .collect();
    build_webp(&parts)
}

/// Alpha flag of a VP8L bitstream: the bit after the two 14-bit dimensions.
fn vp8l_has_alpha(data: &[u8]) -> bool {
    match data {
        [0x2f, a, b, c, d, ..] => (u32::from_le_bytes([*a, *b, *c, *d]) >> 28) & 1 == 1,
        _ => false,
    }
}

/// Inject EXIF into a WebP, upgrading a simple VP8/VP8L file to VP8X.
fn inject_webp_exif(b: &[u8], tiff: &[u8], width: u32, height: u32) -> Vec<u8> {
    let Some(chunks) = parse_webp_chunks(b) else {
        return b.to_vec();
    };
    let has_vp8x = chunks.iter().any(|c| &c.fourcc == b"VP8X");
    let mut vp8x = [0u8; 10];
    let mut parts: Vec<Part<'_>> = Vec::with_capacity(chunks.len() + 2);
    if !has_vp8x {
        let Some(bitstream) = chunks
            .iter()
            .find(|c| &c.fourcc == b"VP8 " || &c.fourcc == b"VP8L")
        else {
            return b.to_vec();
        };
        if width == 0 || height == 0 {
            return b.to_vec();
        }
        vp8x[0] = 0x08; // EXIF
        if &bitstream.fourcc == b"VP8L" && vp8l_has_alpha(chunk_part(b, bitstream).data) {
            vp8x[0] |= 0x10; // alpha
        }
        vp8x[4..7].copy_from_slice(&(width - 1).to_le_bytes()[..3]);
        vp8x[7..10].copy_from_slice(&(height - 1).to_le_bytes()[..3]);
    }
    if !has_vp8x {
        parts.push(Part {
            fourcc: *b"VP8X",
            data: &vp8x,
            byte0: None,
        });
    }
    for c in chunks.iter().filter(|c| &c.fourcc != b"EXIF") {
        let mut p = chunk_part(b, c);
        if &c.fourcc == b"VP8X" {
            p.byte0 = p.data.first().map(|f| f | 0x08);
        }
        parts.push(p);
    }
    // EXIF goes last (after the image data), per the WebP container spec.
    parts.push(Part {
        fourcc: *b"EXIF",
        data: tiff,
        byte0: None,
    });
    build_webp(&parts)
}

// ── GPS-only stripping (mode "location") ───────────────────────────────────

/// Byte width of a TIFF field type.
fn tiff_type_size(t: u16) -> u64 {
    match t {
        3 | 8 => 2,
        4 | 9 | 11 => 4,
        5 | 10 | 12 => 8,
        _ => 1,
    }
}

struct Tiff {
    le: bool,
}

impl Tiff {
    fn u16(&self, b: &[u8], o: u64) -> Option<u16> {
        let a = arr(b, o)?;
        Some(if self.le {
            u16::from_le_bytes(a)
        } else {
            u16::from_be_bytes(a)
        })
    }
    fn u32(&self, b: &[u8], o: u64) -> Option<u32> {
        let a = arr(b, o)?;
        Some(if self.le {
            u32::from_le_bytes(a)
        } else {
            u32::from_be_bytes(a)
        })
    }
}

/// Zero `count` bytes at `off`; no-op when the range is out of bounds.
fn zero_range(b: &mut [u8], off: u64, count: u64) {
    if count == 0 {
        return;
    }
    let (Ok(s), Ok(e)) = (usize::try_from(off), usize::try_from(off + count)) else {
        return;
    };
    if let Some(r) = b.get_mut(s..e) {
        r.fill(0);
    }
}

/// Zero a GPS sub-IFD's entry table plus the external values its entries point
/// at. Reads from the buffer AS IT IS BEING ZEROED, exactly like the oracle.
fn zero_gps_sub_ifd(out: &mut [u8], t: &Tiff, gps_ptr: u64) -> Option<()> {
    let len = out.len() as u64;
    if gps_ptr == 0 || gps_ptr + 2 > len {
        return Some(());
    }
    let gn = u64::from(t.u16(out, gps_ptr)?);
    let entries_start = gps_ptr + 2;
    if entries_start + gn * 12 > len {
        return Some(());
    }
    for j in 0..gn {
        let gp = entries_start + j * 12;
        let size = tiff_type_size(t.u16(out, gp + 2)?) * u64::from(t.u32(out, gp + 4)?);
        if size > 4 {
            let at = u64::from(t.u32(out, gp + 8)?);
            zero_range(out, at, size);
        }
    }
    zero_range(out, gps_ptr, 2 + gn * 12 + 4);
    Some(())
}

/// Strip the GPS sub-IFD from a raw TIFF block, in place (same length).
fn strip_gps_from_tiff(out: &mut [u8]) -> Option<()> {
    let len = out.len() as u64;
    if len < 8 {
        return Some(());
    }
    let bom = be16(out, 0)?;
    let t = Tiff { le: bom == 0x4949 };
    if !t.le && bom != 0x4d4d {
        return Some(());
    }
    if t.u16(out, 2)? != 42 {
        return Some(());
    }
    let ifd0 = u64::from(t.u32(out, 4)?);
    if ifd0 == 0 || ifd0 + 2 > len {
        return Some(());
    }
    let n = u64::from(t.u16(out, ifd0)?);
    let entries_start = ifd0 + 2;
    if entries_start + n * 12 > len {
        return Some(());
    }
    for i in 0..n {
        let p = entries_start + i * 12;
        if t.u16(out, p)? != GPS_IFD_TAG {
            continue;
        }
        // GPSInfo is LONG/1; anything else is malformed — neutralize the entry
        // without following it, as the oracle does.
        let gps_ptr = if t.u16(out, p + 2)? == 4 && t.u32(out, p + 4)? == 1 {
            u64::from(t.u32(out, p + 8)?)
        } else {
            0
        };
        zero_gps_sub_ifd(out, &t, gps_ptr)?;
        zero_range(out, p, 12);
        break;
    }
    Some(())
}

/// Scrub the TIFF block at `[s, e)` of a copy of `b`. An empty or inverted
/// range is a no-op on the copy, which is what the oracle's result amounts to.
fn with_tiff_scrubbed(b: &[u8], s: u64, e: u64) -> Option<Vec<u8>> {
    let mut out = b.to_vec();
    if s < e {
        let (s, e) = (usize::try_from(s).ok()?, usize::try_from(e).ok()?);
        strip_gps_from_tiff(out.get_mut(s..e)?)?;
    }
    Some(out)
}

fn strip_jpeg_gps(b: &[u8]) -> Option<Vec<u8>> {
    match find_jpeg_exif_segment(b) {
        Some((s, e)) => with_tiff_scrubbed(b, s, e),
        None => Some(b.to_vec()),
    }
}

fn strip_png_gps(b: &[u8]) -> Option<Vec<u8>> {
    let Some((s, e)) = find_png_chunk(b, b"eXIf") else {
        return Some(b.to_vec());
    };
    let mut out = with_tiff_scrubbed(b, s, e)?;
    // CRC covers the chunk type (4 bytes before the data) plus the data.
    let crc = png_crc32(range(&out, s - 4, e)?);
    let (at, end) = (usize::try_from(e).ok()?, usize::try_from(e + 4).ok()?);
    out.get_mut(at..end)?.copy_from_slice(&crc.to_be_bytes());
    Some(out)
}

fn strip_webp_gps(b: &[u8]) -> Option<Vec<u8>> {
    let Some(chunks) = parse_webp_chunks(b) else {
        return Some(b.to_vec());
    };
    match chunks.iter().find(|c| &c.fourcc == b"EXIF") {
        Some(c) => with_tiff_scrubbed(b, c.data_start, c.data_end),
        None => Some(b.to_vec()),
    }
}

// ── policy (index.ts) ──────────────────────────────────────────────────────

/// Format-aware scrub, detected from the signature bytes. `location` = GPS only.
/// Unknown formats (AVIF, …) and any parse failure return the input unchanged.
pub fn strip_metadata(b: &[u8], location: bool) -> Vec<u8> {
    let out = if is_jpeg(b) {
        if location {
            strip_jpeg_gps(b)
        } else {
            Some(strip_jpeg_metadata(b))
        }
    } else if is_png(b) {
        if location {
            strip_png_gps(b)
        } else {
            Some(strip_png_metadata(b))
        }
    } else if is_webp(b) {
        if location {
            strip_webp_gps(b)
        } else {
            Some(strip_webp_metadata(b))
        }
    } else {
        None
    };
    out.unwrap_or_else(|| b.to_vec())
}

/// The reusable TIFF/Exif block of a stored original, by MIME type.
pub fn read_exif_tiff(b: &[u8], mime: &str) -> Option<Vec<u8>> {
    match mime {
        "image/jpeg" => extract_jpeg_exif_tiff(b),
        "image/webp" => extract_webp_exif_tiff(b),
        "image/png" => extract_png_exif_tiff(b),
        _ => None,
    }
}

/// EXIF policy for a RE-ENCODED export: strip is a no-op (re-encoded bytes
/// carry no source EXIF); keep transplants `source_tiff` into JPEG/WebP.
pub fn apply_exif_to_reencoded(
    encoded: &[u8],
    format: &str,
    keep: bool,
    source_tiff: Option<&[u8]>,
    width: u32,
    height: u32,
) -> Vec<u8> {
    match (keep, source_tiff, format) {
        (true, Some(t), "jpeg") => inject_jpeg_exif(encoded, t),
        (true, Some(t), "webp") => inject_webp_exif(encoded, t, width, height),
        _ => encoded.to_vec(),
    }
}

/// EXIF policy for a VERBATIM original: keep passes it through; strip scrubs
/// JPEG/PNG/WebP ("all", or GPS only when `location`).
pub fn apply_exif_to_verbatim(b: &[u8], mime: &str, keep: bool, location: bool) -> Vec<u8> {
    if keep || !matches!(mime, "image/jpeg" | "image/png" | "image/webp") {
        return b.to_vec();
    }
    strip_metadata(b, location)
}

// ── wasm surface — string modes, mirroring the TS signatures ────────────────

/// `stripMetadata(bytes, mode)`: `mode` is `"all"`; anything else is location.
#[wasm_bindgen]
pub fn exif_strip_metadata(bytes: &[u8], mode: &str) -> Vec<u8> {
    strip_metadata(bytes, mode != "all")
}

/// `readExifTiff(bytes, mime)`: `undefined` when there is no EXIF block.
#[wasm_bindgen]
pub fn exif_read_tiff(bytes: &[u8], mime: &str) -> Option<Vec<u8>> {
    read_exif_tiff(bytes, mime)
}

/// `applyExifToVerbatim(bytes, mime, mode, stripMode)`: `mode` `"keep"` |
/// `"strip"`, `strip_mode` `"all"` | `"location"`.
#[wasm_bindgen]
pub fn exif_apply_verbatim(bytes: &[u8], mime: &str, mode: &str, strip_mode: &str) -> Vec<u8> {
    apply_exif_to_verbatim(bytes, mime, mode == "keep", strip_mode != "all")
}

/// `applyExifToReencoded(encoded, format, mode, sourceTiff, width, height)`.
#[wasm_bindgen]
pub fn exif_apply_reencoded(
    encoded: &[u8],
    format: &str,
    mode: &str,
    source_tiff: Option<Vec<u8>>,
    width: u32,
    height: u32,
) -> Vec<u8> {
    apply_exif_to_reencoded(
        encoded,
        format,
        mode != "strip",
        source_tiff.as_deref(),
        width,
        height,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crc32_matches_the_png_check_value() {
        // The standard CRC-32 check value for "123456789".
        assert_eq!(png_crc32(b"123456789"), 0xcbf4_3926);
    }

    #[test]
    fn unknown_bytes_pass_through_every_path() {
        let junk = [1u8, 2, 3, 4, 5];
        assert_eq!(strip_metadata(&junk, false), junk);
        assert_eq!(strip_metadata(&junk, true), junk);
        assert_eq!(read_exif_tiff(&junk, "image/jpeg"), None);
        assert_eq!(
            apply_exif_to_reencoded(&junk, "jpeg", true, Some(&[1]), 1, 1),
            junk
        );
    }

    #[test]
    fn huge_declared_lengths_do_not_overflow() {
        // A PNG chunk and a WebP chunk each declaring a u32::MAX length.
        let mut png = PNG_SIG.to_vec();
        png.extend_from_slice(&[0xff, 0xff, 0xff, 0xff]);
        png.extend_from_slice(b"eXIf");
        png.extend_from_slice(&[0; 8]);
        assert_eq!(strip_metadata(&png, true), png);
        let mut webp = b"RIFF\0\0\0\0WEBPEXIF".to_vec();
        webp.extend_from_slice(&[0xff; 4]);
        webp.extend_from_slice(&[0; 4]);
        assert_eq!(strip_metadata(&webp, false), webp);
    }
}
