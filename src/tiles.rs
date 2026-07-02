//! Tile engine core — a sparse, tiled RGBA canvas.
//!
//! This module is **feature-gated behind `tiles`** and is *not* part of the
//! wasm build. It is a self-contained core proven by `cargo test` + criterion,
//! separate from the flat-buffer [`crate::core::ImageBuffer`] world. The two
//! interoperate through [`TileBuffer::blit_from_flat`] /
//! [`TileBuffer::blit_to_flat`], which are byte-exact round-trips.
//!
//! ## Model
//! - The canvas is divided into [`TILE_EDGE`]×[`TILE_EDGE`] tiles.
//! - Storage is **sparse**: a tile that has never been written does not exist;
//!   reads inside it return transparent (`[0, 0, 0, 0]`).
//! - Tiles are keyed by *tile coordinates* `(tx, ty)` computed with Euclidean
//!   division so negative pixel coordinates are handled cleanly.

use std::collections::HashMap;

/// Edge length of a square tile, in pixels.
pub const TILE_EDGE: u32 = 256;
/// Bytes in one tile: `TILE_EDGE * TILE_EDGE * 4` (RGBA).
pub const TILE_BYTES: usize = (TILE_EDGE as usize) * (TILE_EDGE as usize) * 4;

/// A single tile: an owned, heap-allocated RGBA block plus bookkeeping.
///
/// The pixel block is boxed so that a `Tile` is cheap to move and a
/// `TileBuffer` full of them does not blow the stack. `Clone` is derived so
/// the op-log can take cheap-to-reason-about keyframe snapshots.
#[derive(Clone)]
pub struct Tile {
    pixels: Box<[u8; TILE_BYTES]>,
    /// Set on every write; cleared by [`TileBuffer::clear_dirty`].
    dirty: bool,
    /// Monotonic write counter — bumped on every mutation. Cheap change-detect
    /// for callers that want to know "did this tile change since I last looked"
    /// without hashing.
    generation: u64,
}

impl Tile {
    /// A fresh, fully-transparent tile.
    fn new() -> Self {
        Self {
            pixels: Box::new([0u8; TILE_BYTES]),
            dirty: false,
            generation: 0,
        }
    }

    /// Raw pixel bytes (RGBA, row-major, `TILE_EDGE` wide).
    pub fn pixels(&self) -> &[u8; TILE_BYTES] {
        &self.pixels
    }

    /// Whether this tile has unflushed writes.
    pub fn is_dirty(&self) -> bool {
        self.dirty
    }

    /// Write generation counter.
    pub fn generation(&self) -> u64 {
        self.generation
    }

    /// Deterministic FNV-1a/64 content hash over the pixel bytes only.
    ///
    /// Stable across runs and machines (unlike `DefaultHasher`), so it is
    /// suitable as a content address for future de-duplicated persistence.
    pub fn content_hash(&self) -> u64 {
        fnv1a64(self.pixels.as_slice())
    }
}

/// FNV-1a 64-bit. Hand-rolled to stay dependency-free and deterministic.
fn fnv1a64(bytes: &[u8]) -> u64 {
    const OFFSET: u64 = 0xcbf2_9ce4_8422_2325;
    const PRIME: u64 = 0x0000_0100_0000_01b3;
    let mut h = OFFSET;
    for &b in bytes {
        h ^= b as u64;
        h = h.wrapping_mul(PRIME);
    }
    h
}

/// A sparse, tiled RGBA canvas with fixed logical bounds.
///
/// `width`/`height` are the logical image dimensions. Tiles on the right/bottom
/// edges may extend past those bounds; the out-of-bounds pixels are never read
/// or written by the region/blit API and stay transparent.
#[derive(Default, Clone)]
pub struct TileBuffer {
    tiles: HashMap<(i32, i32), Tile>,
    width: u32,
    height: u32,
}

impl TileBuffer {
    /// A new, empty (all-transparent) buffer with the given logical bounds.
    pub fn new(width: u32, height: u32) -> Self {
        Self {
            tiles: HashMap::new(),
            width,
            height,
        }
    }

    /// Logical width in pixels.
    pub fn width(&self) -> u32 {
        self.width
    }

    /// Logical height in pixels.
    pub fn height(&self) -> u32 {
        self.height
    }

    /// Number of materialised (non-transparent-by-omission) tiles.
    pub fn tile_count(&self) -> usize {
        self.tiles.len()
    }

    /// Tile coordinate + intra-tile offset for a pixel. Uses Euclidean
    /// division so negative coordinates map correctly.
    #[inline]
    fn tile_of(x: i32, y: i32) -> ((i32, i32), usize) {
        let edge = TILE_EDGE as i32;
        let tx = x.div_euclid(edge);
        let ty = y.div_euclid(edge);
        let lx = x.rem_euclid(edge) as usize;
        let ly = y.rem_euclid(edge) as usize;
        ((tx, ty), (ly * TILE_EDGE as usize + lx) * 4)
    }

    /// Read a single pixel. Out-of-tile (absent) pixels are transparent.
    pub fn get_pixel(&self, x: i32, y: i32) -> [u8; 4] {
        let (key, off) = Self::tile_of(x, y);
        match self.tiles.get(&key) {
            Some(t) => [
                t.pixels[off],
                t.pixels[off + 1],
                t.pixels[off + 2],
                t.pixels[off + 3],
            ],
            None => [0, 0, 0, 0],
        }
    }

    /// Write a single pixel, materialising the tile if needed and marking it
    /// dirty.
    pub fn set_pixel(&mut self, x: i32, y: i32, rgba: [u8; 4]) {
        let (key, off) = Self::tile_of(x, y);
        let tile = self.tiles.entry(key).or_insert_with(Tile::new);
        tile.pixels[off..off + 4].copy_from_slice(&rgba);
        tile.dirty = true;
        tile.generation = tile.generation.wrapping_add(1);
    }

    /// Read a rectangular region into a freshly-allocated flat RGBA buffer of
    /// `w * h * 4` bytes. Pixels outside materialised tiles are transparent.
    pub fn get_region(&self, x: i32, y: i32, w: u32, h: u32) -> Vec<u8> {
        let mut out = vec![0u8; (w as usize) * (h as usize) * 4];
        for ry in 0..h as i32 {
            for rx in 0..w as i32 {
                let px = self.get_pixel(x + rx, y + ry);
                let di = ((ry as usize) * (w as usize) + rx as usize) * 4;
                out[di..di + 4].copy_from_slice(&px);
            }
        }
        out
    }

    /// Write a rectangular region from a flat RGBA buffer (`w * h * 4` bytes).
    /// Materialises exactly the intersecting tiles and marks them dirty.
    ///
    /// Returns `false` (writing nothing) if `src` is the wrong length.
    pub fn set_region(&mut self, x: i32, y: i32, w: u32, h: u32, src: &[u8]) -> bool {
        if src.len() != (w as usize) * (h as usize) * 4 {
            return false;
        }
        for ry in 0..h as i32 {
            for rx in 0..w as i32 {
                let si = ((ry as usize) * (w as usize) + rx as usize) * 4;
                let mut rgba = [0u8; 4];
                rgba.copy_from_slice(&src[si..si + 4]);
                self.set_pixel(x + rx, y + ry, rgba);
            }
        }
        true
    }

    /// Load a flat RGBA buffer (`w * h`) into the tiles, replacing the logical
    /// bounds with `w`×`h`. Existing tiles are cleared first so the result is a
    /// faithful representation of `src` alone.
    ///
    /// Returns `false` (doing nothing) if `src` is the wrong length.
    pub fn blit_from_flat(&mut self, src: &[u8], w: u32, h: u32) -> bool {
        if src.len() != (w as usize) * (h as usize) * 4 {
            return false;
        }
        self.tiles.clear();
        self.width = w;
        self.height = h;
        self.set_region(0, 0, w, h, src)
    }

    /// Write the whole logical canvas into `dst` (`width * height * 4` bytes).
    /// Absent tiles read as transparent. This is the inverse of
    /// [`Self::blit_from_flat`] and is byte-exact.
    ///
    /// Returns `false` (writing nothing) if `dst` is the wrong length.
    pub fn blit_to_flat(&self, dst: &mut [u8]) -> bool {
        if dst.len() != (self.width as usize) * (self.height as usize) * 4 {
            return false;
        }
        for y in 0..self.height as i32 {
            for x in 0..self.width as i32 {
                let px = self.get_pixel(x, y);
                let di = ((y as usize) * (self.width as usize) + x as usize) * 4;
                dst[di..di + 4].copy_from_slice(&px);
            }
        }
        true
    }

    /// Visit every pixel of every materialised tile, replacing it with the
    /// closure's return value. All visited tiles are marked dirty. Used by
    /// pure per-pixel ops (e.g. Levels). Absent tiles stay absent — this does
    /// not materialise transparent space.
    pub fn map_pixels_mut<F: FnMut([u8; 4]) -> [u8; 4]>(&mut self, mut f: F) {
        for t in self.tiles.values_mut() {
            for px in t.pixels.chunks_exact_mut(4) {
                let new = f([px[0], px[1], px[2], px[3]]);
                px.copy_from_slice(&new);
            }
            t.dirty = true;
            t.generation = t.generation.wrapping_add(1);
        }
    }

    /// Iterator over the coordinates of currently-dirty tiles.
    pub fn dirty_tiles(&self) -> impl Iterator<Item = (i32, i32)> + '_ {
        self.tiles.iter().filter(|(_, t)| t.dirty).map(|(&k, _)| k)
    }

    /// Clear the dirty flag on every tile (call after a flush/persist).
    pub fn clear_dirty(&mut self) {
        for t in self.tiles.values_mut() {
            t.dirty = false;
        }
    }

    /// Borrow a materialised tile by coordinate, if present.
    pub fn tile(&self, tx: i32, ty: i32) -> Option<&Tile> {
        self.tiles.get(&(tx, ty))
    }

    /// Deterministic content hash of the whole buffer: dimensions plus each
    /// materialised, non-empty tile's coordinate and content hash, folded in a
    /// coordinate-sorted order so it is independent of `HashMap` iteration.
    ///
    /// Fully-transparent tiles are skipped so a sparse buffer and a
    /// materialised-but-empty one hash identically.
    pub fn content_hash(&self) -> u64 {
        const EMPTY: u64 = 0x0f0f_0f0f_0f0f_0f0f;
        let mut entries: Vec<((i32, i32), u64)> = self
            .tiles
            .iter()
            .filter(|(_, t)| t.pixels.iter().any(|&b| b != 0))
            .map(|(&k, t)| (k, t.content_hash()))
            .collect();
        entries.sort_unstable_by_key(|(k, _)| *k);

        let mut buf = Vec::with_capacity(8 + entries.len() * 16);
        buf.extend_from_slice(&self.width.to_le_bytes());
        buf.extend_from_slice(&self.height.to_le_bytes());
        for ((tx, ty), h) in entries {
            buf.extend_from_slice(&tx.to_le_bytes());
            buf.extend_from_slice(&ty.to_le_bytes());
            buf.extend_from_slice(&h.to_le_bytes());
        }
        if buf.len() == 8 {
            // dimensions only, no content
            return fnv1a64(&buf) ^ EMPTY;
        }
        fnv1a64(&buf)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Deterministic pseudo-random flat RGBA buffer of `w * h`.
    fn make_flat(w: u32, h: u32, seed: u64) -> Vec<u8> {
        let n = (w as usize) * (h as usize) * 4;
        let mut out = Vec::with_capacity(n);
        let mut s = seed.wrapping_add(0x9e37_79b9_7f4a_7c15);
        for _ in 0..n {
            // xorshift64*
            s ^= s >> 12;
            s ^= s << 25;
            s ^= s >> 27;
            out.push((s.wrapping_mul(0x2545_F491_4F6C_DD1D) >> 33) as u8);
        }
        out
    }

    #[test]
    fn round_trip_byte_identical_various_sizes() {
        // Includes non-multiples of 256, exact multiples, tall/wide, and 1x1.
        let sizes = [
            (1u32, 1u32),
            (255, 255),
            (256, 256),
            (257, 257),
            (300, 200),
            (512, 64),
            (1, 400),
            (513, 1),
        ];
        for (i, &(w, h)) in sizes.iter().enumerate() {
            let flat = make_flat(w, h, 100 + i as u64);
            let mut tb = TileBuffer::new(0, 0);
            assert!(tb.blit_from_flat(&flat, w, h), "blit_from_flat {w}x{h}");
            assert_eq!(tb.width(), w);
            assert_eq!(tb.height(), h);

            let mut out = vec![0u8; flat.len()];
            assert!(tb.blit_to_flat(&mut out), "blit_to_flat {w}x{h}");
            assert_eq!(out, flat, "round-trip mismatch at {w}x{h}");
        }
    }

    #[test]
    fn region_write_marks_exactly_intersecting_tiles_dirty() {
        // 3x3 tiles worth of canvas.
        let side = TILE_EDGE * 3;
        let mut tb = TileBuffer::new(side, side);

        // A write that straddles the boundary of tiles (0,0),(1,0),(0,1),(1,1):
        // a 4x4 block centred on (256,256).
        let (rx, ry, rw, rh) = (254i32, 254i32, 4u32, 4u32);
        let src = vec![200u8; (rw as usize) * (rh as usize) * 4];
        assert!(tb.set_region(rx, ry, rw, rh, &src));

        let mut dirty: Vec<(i32, i32)> = tb.dirty_tiles().collect();
        dirty.sort_unstable();
        assert_eq!(dirty, vec![(0, 0), (0, 1), (1, 0), (1, 1)]);

        tb.clear_dirty();
        assert_eq!(tb.dirty_tiles().count(), 0);

        // A write fully inside a single tile marks exactly that one.
        let one = vec![10u8; 4];
        assert!(tb.set_region(600, 300, 1, 1, &one)); // tile (2,1)
        let dirty2: Vec<(i32, i32)> = tb.dirty_tiles().collect();
        assert_eq!(dirty2, vec![(2, 1)]);
    }

    #[test]
    fn sparse_reads_outside_written_area_are_transparent() {
        let mut tb = TileBuffer::new(1024, 1024);
        // Touch only one far tile.
        tb.set_pixel(800, 800, [1, 2, 3, 4]);
        assert_eq!(tb.tile_count(), 1);

        // Everything else reads transparent.
        assert_eq!(tb.get_pixel(0, 0), [0, 0, 0, 0]);
        assert_eq!(tb.get_pixel(799, 800), [0, 0, 0, 0]);
        assert_eq!(tb.get_pixel(800, 800), [1, 2, 3, 4]);

        // A region straddling written/unwritten space is mostly transparent.
        let reg = tb.get_region(799, 799, 3, 3);
        for (i, chunk) in reg.chunks_exact(4).enumerate() {
            // index 4 == local (1,1) == pixel (800,800)
            if i == 4 {
                assert_eq!(chunk, [1, 2, 3, 4]);
            } else {
                assert_eq!(chunk, [0, 0, 0, 0], "pixel {i} should be transparent");
            }
        }
    }

    #[test]
    fn wrong_length_blits_are_rejected() {
        let mut tb = TileBuffer::new(0, 0);
        assert!(!tb.blit_from_flat(&[0u8; 3], 1, 1));
        let mut tb2 = TileBuffer::new(2, 2);
        assert!(!tb2.blit_to_flat(&mut [0u8; 3]));
        assert!(!tb2.set_region(0, 0, 1, 1, &[0u8; 3]));
    }

    #[test]
    fn content_hash_reflects_content_not_iteration_order() {
        let flat = make_flat(300, 300, 7);
        let mut a = TileBuffer::new(0, 0);
        let mut b = TileBuffer::new(0, 0);
        a.blit_from_flat(&flat, 300, 300);
        b.blit_from_flat(&flat, 300, 300);
        assert_eq!(a.content_hash(), b.content_hash());

        // A single changed pixel changes the hash.
        b.set_pixel(0, 0, [255, 255, 255, 255]);
        assert_ne!(a.content_hash(), b.content_hash());
    }

    #[test]
    fn empty_and_sparse_empty_hash_identically() {
        let a = TileBuffer::new(500, 500);
        let mut b = TileBuffer::new(500, 500);
        // Materialise a tile but leave it transparent.
        b.set_pixel(10, 10, [0, 0, 0, 0]);
        assert!(b.tile_count() >= 1);
        assert_eq!(a.content_hash(), b.content_hash());
    }

    #[test]
    fn generation_bumps_on_write() {
        let mut tb = TileBuffer::new(256, 256);
        tb.set_pixel(5, 5, [1, 1, 1, 1]);
        let g1 = tb.tile(0, 0).unwrap().generation();
        tb.set_pixel(6, 6, [2, 2, 2, 2]);
        let g2 = tb.tile(0, 0).unwrap().generation();
        assert!(g2 > g1);
    }
}
