//! PatchMatch nearest-neighbor field (NNF) — the correspondence core behind
//! object removal (day 1 of the flagship feature; see docs/adr for the
//! numbered decision record).
//!
//! Scalar, single-resolution, Barnes et al.-style: for every pixel inside the
//! masked (hole) region, find a similar 7×7 patch elsewhere in the image
//! (the *source* region — everything NOT masked) via random init + iterative
//! propagation + random search. Two stages, both here:
//!
//! - [`compute_nnf`] computes ONLY the field — `nnf[i] = (x, y)` of the
//!   best-matching source patch *center* for masked pixel `i`, or an
//!   identity self-pointer for unmasked pixels (never meaningfully read, but
//!   always a defined, in-bounds, non-panicking value).
//! - [`fill_from_nnf`] turns that field into actual pixels, by voting: every
//!   hole pixel is the average of what every patch covering it believes
//!   belongs there. [`inpaint`] composes the two into the one entry point
//!   Task C wires behind the `ih_patchmatch` flag.
//!
//! Deliberately NOT parallel today (`rayon` is day 2) and NOT multi-resolution
//! (a pyramid is day 3 — single-res will look coarse/smeary on a real photo,
//! which is expected). What today's structure buys ahead of that: every
//! per-pixel/per-row computation here is a pure function of explicit
//! arguments — no method reaches into shared mutable state, and the one
//! piece of read-only, per-call context every function needs is bundled into
//! [`MatchCtx`], which is trivially `Sync` (shared slices + `Copy` scalars
//! only). A day-2 rayon pass is a rewrite of the row-iteration DRIVER (split
//! `nnf` into a read buffer and a write buffer so rows no longer have an
//! in-pass ordering dependency, then `par_iter` over rows) — the distance,
//! propagation-candidate, and random-search logic in this file does not need
//! to change at all.
//!
//! Randomness is seeded and deterministic throughout (no `rand`/`getrandom`
//! dependency — see the `patchmatch` feature comment in Cargo.toml for why):
//! every random draw is independently derived from `(seed, x, y, salt)` via
//! [`splitmix64`], so it does not matter what order pixels are visited in —
//! another property day 2's parallel rewrite gets for free rather than having
//! to engineer later.

/// Patch half-width: patches are `(2*PATCH_RADIUS+1)²` = 7×7 by default.
pub const PATCH_RADIUS: usize = 3;
/// PatchMatch iterations (propagation + random search each). Barnes et al.
/// converge good matches in a handful of passes; 5 is the brief's own number.
const NUM_ITERATIONS: usize = 5;
/// Random-search radius decay per step (halves each time, per Barnes et al.).
const ALPHA: f64 = 0.5;
/// RNG salt for the initial random pick, kept distinct from the random-search
/// salts (`1000 + iter*100 + step`) so the two draws for the same pixel never
/// collide on the same SplitMix64 stream.
const INIT_SALT: u32 = 0;

// ── Deterministic, dependency-free PRNG ─────────────────────────────────────

/// SplitMix64 mixing function. Not cryptographic — good enough for patch
/// search — and crucially callable independently per `(seed, x, y, salt)`
/// tuple with no shared, threaded-through mutable state, which is what keeps
/// every caller here a pure function (see the module doc comment).
#[inline]
fn splitmix64(mut x: u64) -> u64 {
    x = x.wrapping_add(0x9E37_79B9_7F4A_7C15);
    let mut z = x;
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    z ^ (z >> 31)
}

/// A short-lived RNG stream, freshly derived per call site from
/// `(seed, x, y, salt)`. Two calls with the same four inputs always produce
/// the same draws — that IS the determinism guarantee (rule: no unseeded
/// randomness), and it holds regardless of what order pixels are visited in.
struct PixelRng(u64);

impl PixelRng {
    fn new(seed: u64, x: u32, y: u32, salt: u32) -> Self {
        let mixed = splitmix64(seed)
            ^ splitmix64(x as u64)
            ^ splitmix64((y as u64) << 32)
            ^ splitmix64(salt as u64);
        PixelRng(splitmix64(mixed))
    }

    fn next_u64(&mut self) -> u64 {
        self.0 = splitmix64(self.0);
        self.0
    }

    /// Uniform-ish integer in `[0, bound)`. A plain modulo has a small bias
    /// near the top of the range; at these bound sizes (image-dimension
    /// scale, not cryptographic) that bias is irrelevant.
    fn next_below(&mut self, bound: u32) -> u32 {
        if bound == 0 {
            return 0;
        }
        (self.next_u64() % bound as u64) as u32
    }

    /// Uniform float in `[0, 1)`.
    fn next_f64(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 * (1.0 / (1u64 << 53) as f64)
    }
}

// ── Shared read-only context ─────────────────────────────────────────────

/// Read-only inputs every per-pixel match computation needs, bundled into one
/// reference instead of six separate parameters. Every field is a shared
/// slice or a `Copy` scalar, so `&MatchCtx` is trivially `Sync` — the shape a
/// future `par_iter` (day 2) needs to capture it across threads without
/// touching the functions that use it.
struct MatchCtx<'a> {
    image: &'a [u8],
    w: usize,
    h: usize,
    mask: &'a [bool],
    valid: &'a [bool],
    radius: i64,
    search_radius_max: f64,
    seed: u64,
}

// ── Source-region geometry ──────────────────────────────────────────────

/// Which pixels are valid SOURCE patch *centers*: every pixel of their
/// `(2*radius+1)²` footprint is in-bounds AND unmasked. Guarantees any patch
/// built around a valid center is fully known, real image data — never a
/// hole pixel, never out of bounds — which is what lets [`patch_distance`]
/// and every candidate check downstream skip re-deriving that guarantee.
///
/// Pure function of `(mask, w, h, radius)`; each row is independent of every
/// other row, which is the day-2 `par_iter` seam for this precompute too.
pub fn valid_source_centers(mask: &[bool], w: usize, h: usize, radius: usize) -> Vec<bool> {
    let mut out = vec![false; w * h];
    if w == 0 || h == 0 || mask.len() != w * h {
        return out;
    }
    let r = radius as i64;
    for y in 0..h {
        let cy = y as i64;
        if cy - r < 0 || cy + r >= h as i64 {
            continue;
        }
        for x in 0..w {
            let cx = x as i64;
            if cx - r < 0 || cx + r >= w as i64 {
                continue;
            }
            let mut ok = true;
            'window: for dy in -r..=r {
                for dx in -r..=r {
                    let i = ((cy + dy) as usize) * w + (cx + dx) as usize;
                    if mask[i] {
                        ok = false;
                        break 'window;
                    }
                }
            }
            out[y * w + x] = ok;
        }
    }
    out
}

/// Flatten a validity grid into the list of `(x, y)` coordinates it marks —
/// so [`init_nnf`] can pick a uniformly random valid center in O(1) (index
/// into this list) instead of rejection-sampling the whole grid per pixel.
fn source_center_list(valid: &[bool], w: usize) -> Vec<(u32, u32)> {
    valid
        .iter()
        .enumerate()
        .filter(|(_, &v)| v)
        .map(|(i, _)| ((i % w) as u32, (i / w) as u32))
        .collect()
}

// ── Initialization ──────────────────────────────────────────────────────

/// Seed the field: every masked pixel gets a uniformly random valid source
/// center (deterministic — see [`PixelRng`]); every unmasked pixel gets an
/// identity self-pointer (never read for anything meaningful, but always
/// in-bounds and never inside the hole). If `source_list` is empty — no
/// unmasked pixel exists anywhere, the fully degenerate "select-all then
/// remove" case — masked pixels also fall back to an identity self-pointer;
/// see [`compute_nnf`]'s doc comment for why that one case is the sole,
/// understood exception to "NNF never points into the hole."
fn init_nnf(
    mask: &[bool],
    w: usize,
    h: usize,
    source_list: &[(u32, u32)],
    seed: u64,
) -> Vec<(u32, u32)> {
    let mut nnf = vec![(0u32, 0u32); w * h];
    for y in 0..h {
        for x in 0..w {
            let i = y * w + x;
            if !mask[i] || source_list.is_empty() {
                nnf[i] = (x as u32, y as u32);
                continue;
            }
            let mut rng = PixelRng::new(seed, x as u32, y as u32, INIT_SALT);
            let idx = rng.next_below(source_list.len() as u32) as usize;
            nnf[i] = source_list[idx];
        }
    }
    nnf
}

// ── Patch distance ──────────────────────────────────────────────────────

/// Average squared per-channel (RGBA) difference between the patch centered
/// at `p` and the patch centered at `q`, over the `(2*radius+1)²` window.
///
/// Only offsets where BOTH sides are in-bounds and unmasked contribute — the
/// target patch `p` is normally centered inside the hole, so most of its own
/// neighbourhood is unknown; comparing against only the KNOWN slice of it is
/// the standard PatchMatch-for-inpainting move (Barnes et al. §5.3), and it's
/// what makes propagation do real work: a target pixel deep inside a big hole
/// starts with zero known neighbours (distance defined as `0.0` — no basis to
/// prefer any candidate yet) and only gets a meaningful match once a
/// neighbour with a real match propagates one in. `q` is a "valid center" by
/// construction from [`valid_source_centers`] at the caller's chosen radius
/// tier, but this function re-checks both sides defensively rather than
/// trusting that — the lenient (radius-0) fallback tier only guarantees the
/// CENTER pixel is unmasked, not the whole footprint, so trusting the
/// caller's tier here would be a live bug waiting for the fallback path.
fn patch_distance(ctx: &MatchCtx, p: (u32, u32), q: (u32, u32)) -> f64 {
    let (px, py) = (p.0 as i64, p.1 as i64);
    let (qx, qy) = (q.0 as i64, q.1 as i64);
    let (w, h) = (ctx.w as i64, ctx.h as i64);
    let mut sum = 0.0f64;
    let mut count = 0u32;
    for dy in -ctx.radius..=ctx.radius {
        for dx in -ctx.radius..=ctx.radius {
            let (tx, ty) = (px + dx, py + dy);
            let (sx, sy) = (qx + dx, qy + dy);
            if tx < 0 || ty < 0 || tx >= w || ty >= h || sx < 0 || sy < 0 || sx >= w || sy >= h {
                continue;
            }
            let ti = ty as usize * ctx.w + tx as usize;
            let si = sy as usize * ctx.w + sx as usize;
            if ctx.mask[ti] || ctx.mask[si] {
                continue;
            }
            let tp = &ctx.image[ti * 4..ti * 4 + 4];
            let sp = &ctx.image[si * 4..si * 4 + 4];
            let mut d = 0i64;
            for c in 0..4 {
                let diff = tp[c] as i64 - sp[c] as i64;
                d += diff * diff;
            }
            sum += d as f64;
            count += 1;
        }
    }
    if count == 0 {
        0.0
    } else {
        sum / count as f64
    }
}

// ── Per-pixel update: propagation + random search ───────────────────────

/// The classic PatchMatch per-pixel step: start from the pixel's current
/// match, try the two propagation candidates inherited from whichever
/// neighbours this scan direction has already visited, then random-search
/// around the best-so-far at a shrinking radius. Returns the new best match
/// (never worse than the pixel's current one).
///
/// A pure function of `(ctx, nnf, x, y, iter, reverse)` — `nnf` is read-only
/// here (the caller writes the result back); nothing here mutates shared
/// state, which is the property the module doc comment is about.
#[allow(clippy::too_many_arguments)]
fn best_match_for_pixel(
    ctx: &MatchCtx,
    nnf: &[(u32, u32)],
    x: usize,
    y: usize,
    iter: u32,
    reverse: bool,
) -> (u32, u32) {
    let p = (x as u32, y as u32);
    let mut best = nnf[y * ctx.w + x];
    let mut best_d = patch_distance(ctx, p, best);

    // Propagation: the two neighbours already updated in this pass, shifted
    // by the same relative offset that separates them from `p`. Forward
    // passes (even iterations) look left/up; reverse passes look right/down.
    let neighbors: [(i64, i64, i64, i64); 2] = if reverse {
        [(1, 0, -1, 0), (0, 1, 0, -1)]
    } else {
        [(-1, 0, 1, 0), (0, -1, 0, 1)]
    };
    for (nx_off, ny_off, sx_off, sy_off) in neighbors {
        let (nx, ny) = (x as i64 + nx_off, y as i64 + ny_off);
        if nx < 0 || ny < 0 || nx >= ctx.w as i64 || ny >= ctx.h as i64 {
            continue;
        }
        let (nqx, nqy) = nnf[ny as usize * ctx.w + nx as usize];
        let (cx, cy) = (nqx as i64 + sx_off, nqy as i64 + sy_off);
        if cx < 0 || cy < 0 || cx >= ctx.w as i64 || cy >= ctx.h as i64 {
            continue;
        }
        let (cx, cy) = (cx as u32, cy as u32);
        if !ctx.valid[cy as usize * ctx.w + cx as usize] {
            continue;
        }
        let d = patch_distance(ctx, p, (cx, cy));
        if d < best_d {
            best_d = d;
            best = (cx, cy);
        }
    }

    // Random search: shrinking-radius offsets around the best match found so
    // far (a common, simpler variant of "around the match at the start of
    // this phase" — still convergent, and it means this function needs no
    // extra bookkeeping to track a separate search-origin).
    let mut radius = ctx.search_radius_max;
    let mut step = 0u32;
    while radius >= 1.0 {
        let mut rng = PixelRng::new(ctx.seed, x as u32, y as u32, 1000 + iter * 100 + step);
        let dx = ((rng.next_f64() * 2.0) - 1.0) * radius;
        let dy = ((rng.next_f64() * 2.0) - 1.0) * radius;
        let cx = best.0 as i64 + dx.round() as i64;
        let cy = best.1 as i64 + dy.round() as i64;
        if cx >= 0 && cy >= 0 && (cx as usize) < ctx.w && (cy as usize) < ctx.h {
            let (cx, cy) = (cx as u32, cy as u32);
            if ctx.valid[cy as usize * ctx.w + cx as usize] {
                let d = patch_distance(ctx, p, (cx, cy));
                if d < best_d {
                    best_d = d;
                    best = (cx, cy);
                }
            }
        }
        radius *= ALPHA;
        step += 1;
    }

    best
}

/// One row's worth of propagation + random search, in scan order (`reverse`
/// flips both the column order and which neighbours count as "already
/// visited" — see [`best_match_for_pixel`]). In-place (Gauss-Seidel): a pixel
/// later in this row sees this row's own already-updated neighbour, which is
/// what makes one pass spread a good match fast. Unmasked pixels are
/// skipped — there is nothing to search for outside the hole.
///
/// This row loop — not the per-pixel logic above — is the piece a day-2
/// rayon rewrite touches: swap the in-place `nnf` for a `nnf_prev`/`nnf_next`
/// pair (read old values everywhere, including for "already visited"
/// neighbours) and this becomes embarrassingly parallel per row.
fn propagate_and_search_row(
    ctx: &MatchCtx,
    nnf: &mut [(u32, u32)],
    y: usize,
    reverse: bool,
    iter: u32,
) {
    for step in 0..ctx.w {
        let x = if reverse { ctx.w - 1 - step } else { step };
        let i = y * ctx.w + x;
        if !ctx.mask[i] {
            continue;
        }
        let best = best_match_for_pixel(ctx, nnf, x, y, iter, reverse);
        nnf[i] = best;
    }
}

// ── Public entry point ───────────────────────────────────────────────────

/// Compute the nearest-neighbor field for `mask` over `image` (`w*h*4` RGBA).
///
/// Returns a `w*h` field: `nnf[y*w+x]` is the `(x, y)` of the best-matching
/// SOURCE (unmasked) patch center for a masked pixel, or an identity
/// self-pointer for an unmasked one. Empty on any malformed input (dimension
/// mismatch, zero-sized image) — never panics.
///
/// **The one documented exception to "never points into the hole":** if the
/// mask covers the ENTIRE image (no source pixel exists anywhere to point
/// at — e.g. a select-all before Remove Object), every masked pixel falls
/// back to an identity self-pointer, which trivially IS inside the mask.
/// There is no valid alternative when no source exists; the caller (the
/// eventual fill step) is expected to treat an empty `source_center_list`
/// result as a safe no-op rather than trying to read a fabricated match.
pub fn compute_nnf(image: &[u8], w: usize, h: usize, mask: &[bool], seed: u64) -> Vec<(u32, u32)> {
    if w == 0 || h == 0 || mask.len() != w * h || image.len() != w * h * 4 {
        return Vec::new();
    }

    let mut valid = valid_source_centers(mask, w, h, PATCH_RADIUS);
    if !valid.iter().any(|&v| v) {
        // No position has a full (2R+1)² unmasked footprint — a tiny image,
        // or a hole that eats nearly everything. Fall back to the lenient
        // tier (center pixel unmasked only) so there is still *something*
        // to point at whenever any source pixel exists at all.
        valid = valid_source_centers(mask, w, h, 0);
    }
    let source_list = source_center_list(&valid, w);

    let mut nnf = init_nnf(mask, w, h, &source_list, seed);
    if source_list.is_empty() {
        // No source pixels anywhere — see the doc comment above. Nothing to
        // propagate or search for; every masked pixel already got the
        // documented self-pointer fallback from `init_nnf`.
        return nnf;
    }

    let ctx = MatchCtx {
        image,
        w,
        h,
        mask,
        valid: &valid,
        radius: PATCH_RADIUS as i64,
        search_radius_max: w.max(h) as f64,
        seed,
    };

    // Sequential today (day 1 scope) — see the module doc comment and
    // `propagate_and_search_row` for exactly where day 2's rayon rewrite
    // lands.
    for iter in 0..NUM_ITERATIONS {
        let reverse = iter % 2 == 1;
        if reverse {
            for y in (0..h).rev() {
                propagate_and_search_row(&ctx, &mut nnf, y, true, iter as u32);
            }
        } else {
            for y in 0..h {
                propagate_and_search_row(&ctx, &mut nnf, y, false, iter as u32);
            }
        }
    }

    nnf
}

// ── Fill: turning the field into pixels ─────────────────────────────────

/// Reconstruct the masked region of `image` from `nnf` (as returned by
/// [`compute_nnf`]) by patch voting: every pixel `p` in the hole is the
/// (uniform) average, over every masked patch center `p'` within
/// `PATCH_RADIUS` of `p`, of the source pixel `nnf[p'] + (p - p')` — i.e.
/// the pixel each covering patch's OWN match believes belongs at `p`. A
/// masked `p'` always covers itself (`p' == p`, offset `(0, 0)`), so every
/// masked pixel with a real match gets at least one vote; pixels with no
/// valid vote at all (the fully-degenerate "no source anywhere" case from
/// [`compute_nnf`]'s doc comment) are left byte-identical to the input — a
/// safe no-op rather than a fabricated colour.
///
/// Returns a NEW `w*h*4` RGBA buffer, same dimensions as `image`; unmasked
/// pixels are copied through unchanged. Malformed input (dimension
/// mismatch) returns `image` unchanged rather than panicking.
///
/// Single-resolution (day 1) — see [`inpaint`]'s doc comment for the day-3
/// pyramid TODO. Pure function of `(image, w, h, mask, nnf)`; the outer
/// `y`/`x` loop is the same day-2 rayon seam as `compute_nnf`'s row loop
/// (each output pixel's vote is independent of every other output pixel —
/// this one is actually easier to parallelize than the NNF search itself,
/// since it only ever READS `nnf`, never mutates it).
pub fn fill_from_nnf(
    image: &[u8],
    w: usize,
    h: usize,
    mask: &[bool],
    nnf: &[(u32, u32)],
) -> Vec<u8> {
    let mut out = image.to_vec();
    if w == 0 || h == 0 || mask.len() != w * h || image.len() != w * h * 4 || nnf.len() != w * h {
        return out;
    }
    let r = PATCH_RADIUS as i64;
    for y in 0..h {
        for x in 0..w {
            let i = y * w + x;
            if !mask[i] {
                continue;
            }
            let (px, py) = (x as i64, y as i64);
            let mut sum = [0.0f64; 4];
            let mut count = 0u32;
            for dy in -r..=r {
                for dx in -r..=r {
                    // p' = the patch center that covers (x,y) via this
                    // offset, i.e. p' + (dx,dy) == (x,y).
                    let (pcx, pcy) = (px - dx, py - dy);
                    if pcx < 0 || pcy < 0 || pcx >= w as i64 || pcy >= h as i64 {
                        continue;
                    }
                    let pci = pcy as usize * w + pcx as usize;
                    if !mask[pci] {
                        // Only vote from patches that themselves got a real
                        // match — an unmasked p' has no `nnf` entry worth
                        // reading (identity, unused).
                        continue;
                    }
                    let (mx, my) = nnf[pci];
                    let (sx, sy) = (mx as i64 + dx, my as i64 + dy);
                    if sx < 0 || sy < 0 || sx >= w as i64 || sy >= h as i64 {
                        continue;
                    }
                    let si = sy as usize * w + sx as usize;
                    if mask[si] {
                        // Defensive, mirrors `patch_distance`: the lenient
                        // fallback validity tier only guarantees a center's
                        // OWN pixel is unmasked, not its whole footprint.
                        continue;
                    }
                    let sp = &image[si * 4..si * 4 + 4];
                    for (c, acc) in sum.iter_mut().enumerate() {
                        *acc += sp[c] as f64;
                    }
                    count += 1;
                }
            }
            if count > 0 {
                let oi = i * 4;
                for c in 0..4 {
                    out[oi + c] = (sum[c] / count as f64).round().clamp(0.0, 255.0) as u8;
                }
            }
            // count == 0: no valid vote anywhere for this pixel — leave it
            // byte-identical to the input (see the doc comment above).
        }
    }
    out
}

/// Compute the NNF and fill the hole in one call — the entry point Task C
/// wires behind the `ih_patchmatch` flag.
///
/// TODO(day 3): multi-resolution pyramid. A single pass at native
/// resolution converges each hole pixel to a locally-plausible 7x7 patch,
/// but with no coarse-to-fine guidance the result will look coarse/smeary
/// on a real photo — coherent large-scale structure (a straight fence line,
/// a horizon) isn't something one scale of small patches can reconstruct on
/// its own. Expected for day 1; the pyramid is what fixes it.
pub fn inpaint(image: &[u8], w: usize, h: usize, mask: &[bool], seed: u64) -> Vec<u8> {
    let nnf = compute_nnf(image, w, h, mask, seed);
    fill_from_nnf(image, w, h, mask, &nnf)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Flat-fill an RGBA buffer, pixel by pixel, from a coordinate function —
    /// same fixture idiom as `edges.rs`'s test module.
    fn rgba(w: usize, h: usize, f: impl Fn(usize, usize) -> [u8; 4]) -> Vec<u8> {
        let mut v = vec![0u8; w * h * 4];
        for y in 0..h {
            for x in 0..w {
                v[(y * w + x) * 4..(y * w + x) * 4 + 4].copy_from_slice(&f(x, y));
            }
        }
        v
    }

    /// A rectangular hole `[x0,x1) x [y0,y1)` as a `w*h` selection mask.
    fn rect_mask(w: usize, h: usize, x0: usize, y0: usize, x1: usize, y1: usize) -> Vec<bool> {
        let mut m = vec![false; w * h];
        for y in y0..y1 {
            for x in x0..x1 {
                m[y * w + x] = true;
            }
        }
        m
    }

    #[test]
    fn nnf_never_points_into_the_hole() {
        // 20x20 image, a 6x6 hole well clear of the border — plenty of
        // source region left, so every masked pixel has real candidates.
        let (w, h) = (20, 20);
        let image = rgba(w, h, |x, y| {
            [(x * 7 % 256) as u8, (y * 11 % 256) as u8, 90, 255]
        });
        let mask = rect_mask(w, h, 7, 7, 13, 13);
        let nnf = compute_nnf(&image, w, h, &mask, 42);
        assert_eq!(nnf.len(), w * h);
        for y in 0..h {
            for x in 0..w {
                let i = y * w + x;
                if !mask[i] {
                    continue;
                }
                let (mx, my) = nnf[i];
                assert!(
                    (mx as usize) < w && (my as usize) < h,
                    "match must stay in bounds"
                );
                let mi = my as usize * w + mx as usize;
                assert!(
                    !mask[mi],
                    "masked pixel ({x},{y}) matched into the hole at ({mx},{my})"
                );
            }
        }
    }

    #[test]
    fn deterministic_with_a_fixed_seed() {
        let (w, h) = (16, 16);
        let image = rgba(w, h, |x, y| [(x * 13) as u8, (y * 17) as u8, 200, 255]);
        let mask = rect_mask(w, h, 5, 5, 10, 10);
        let a = compute_nnf(&image, w, h, &mask, 7);
        let b = compute_nnf(&image, w, h, &mask, 7);
        assert_eq!(
            a, b,
            "same input + same seed must give a byte-identical NNF"
        );
    }

    #[test]
    fn different_seeds_are_free_to_differ() {
        // Not a hard requirement, but a sanity check that the seed is
        // actually threaded through and not silently ignored.
        let (w, h) = (24, 24);
        let image = rgba(w, h, |x, y| {
            [(x * 5) as u8, (y * 3) as u8, (x ^ y) as u8, 255]
        });
        let mask = rect_mask(w, h, 6, 6, 18, 18);
        let a = compute_nnf(&image, w, h, &mask, 1);
        let b = compute_nnf(&image, w, h, &mask, 2);
        assert_ne!(
            a, b,
            "different seeds should (almost certainly) diverge somewhere \
             — a suspicious pass here would mean the seed isn't wired in"
        );
    }

    #[test]
    fn flat_color_source_converges_to_that_color() {
        // The whole image is flat blue, EXCEPT the hole itself is filled with
        // a garbage colour standing in for "the object being removed" — its
        // value must never leak into the match (masked pixels are skipped on
        // both sides of every distance comparison). If the NNF is correct,
        // every masked pixel's match lands on a genuinely blue source pixel.
        const BLUE: [u8; 4] = [10, 20, 200, 255];
        const GARBAGE: [u8; 4] = [255, 0, 255, 255];
        let (w, h) = (24, 24);
        let mask = rect_mask(w, h, 8, 8, 16, 16);
        let image = rgba(w, h, |x, y| if mask[y * w + x] { GARBAGE } else { BLUE });
        let nnf = compute_nnf(&image, w, h, &mask, 99);
        for y in 0..h {
            for x in 0..w {
                let i = y * w + x;
                if !mask[i] {
                    continue;
                }
                let (mx, my) = nnf[i];
                let mi = my as usize * w + mx as usize;
                let px = &image[mi * 4..mi * 4 + 4];
                assert_eq!(
                    px, &BLUE,
                    "masked pixel ({x},{y}) should converge on the flat blue \
                     source, not the garbage hole colour"
                );
            }
        }
    }

    #[test]
    fn one_pixel_mask_does_not_panic_and_matches_outside_itself() {
        let (w, h) = (10, 10);
        let image = rgba(w, h, |x, y| [(x * 20) as u8, (y * 20) as u8, 128, 255]);
        let mut mask = vec![false; w * h];
        mask[5 * w + 5] = true;
        let nnf = compute_nnf(&image, w, h, &mask, 3);
        assert_eq!(nnf.len(), w * h);
        let (mx, my) = nnf[5 * w + 5];
        assert!(
            !mask[my as usize * w + mx as usize],
            "must not match itself"
        );
    }

    #[test]
    fn mask_touching_the_image_edge_does_not_panic() {
        let (w, h) = (12, 12);
        let image = rgba(w, h, |x, y| [(x * 9) as u8, (y * 9) as u8, 60, 255]);
        // Hole hugs the top-left corner, including the literal border.
        let mask = rect_mask(w, h, 0, 0, 4, 4);
        let nnf = compute_nnf(&image, w, h, &mask, 5);
        assert_eq!(nnf.len(), w * h);
        for y in 0..h {
            for x in 0..w {
                let i = y * w + x;
                if !mask[i] {
                    continue;
                }
                let (mx, my) = nnf[i];
                assert!((mx as usize) < w && (my as usize) < h);
                assert!(!mask[my as usize * w + mx as usize]);
            }
        }
    }

    #[test]
    fn whole_image_masked_is_a_safe_no_op_not_a_panic() {
        // No source pixel exists anywhere — the one documented exception to
        // "never points into the hole" (see `compute_nnf`'s doc comment).
        let (w, h) = (6, 6);
        let image = rgba(w, h, |_, _| [1, 2, 3, 255]);
        let mask = vec![true; w * h];
        let nnf = compute_nnf(&image, w, h, &mask, 11);
        assert_eq!(nnf.len(), w * h);
        for (i, &(mx, my)) in nnf.iter().enumerate() {
            assert_eq!(
                (mx as usize, my as usize),
                (i % w, i / w),
                "with no source anywhere, every pixel must fall back to its own identity"
            );
        }
    }

    #[test]
    fn degenerate_empty_image_does_not_panic() {
        assert_eq!(compute_nnf(&[], 0, 0, &[], 1).len(), 0);
        assert_eq!(compute_nnf(&[1, 2, 3, 4], 1, 1, &[false], 1).len(), 1);
    }

    #[test]
    fn mismatched_buffer_lengths_return_empty_instead_of_panicking() {
        // Mask length disagrees with w*h — a caller bug, not something the
        // kernel should ever panic across the wasm boundary over.
        assert_eq!(compute_nnf(&[0; 400], 10, 10, &[false; 5], 1).len(), 0);
        assert_eq!(compute_nnf(&[0; 4], 10, 10, &[false; 100], 1).len(), 0);
    }

    #[test]
    fn valid_source_centers_excludes_any_footprint_touching_the_mask() {
        let (w, h) = (20, 20);
        let mask = rect_mask(w, h, 4, 4, 6, 6); // a 2x2 hole
        let valid = valid_source_centers(&mask, w, h, PATCH_RADIUS);
        assert!(!valid[4 * w + 4], "the hole itself is never a valid center");
        assert!(
            !valid[6 * w + 6],
            "in bounds, but its 7x7 footprint still reaches into the hole"
        );
        assert!(
            valid[14 * w + 14],
            "far from the hole, with room for the full footprint, is valid"
        );
    }

    // ── Fill (Task B) ────────────────────────────────────────────────────

    #[test]
    fn filled_region_contains_zero_original_hole_pixels() {
        // Every masked pixel starts as an obvious garbage colour; after
        // inpainting, NONE of them may still hold that exact colour — every
        // one must have actually changed.
        const GARBAGE: [u8; 4] = [255, 0, 255, 255];
        let (w, h) = (24, 24);
        let mask = rect_mask(w, h, 8, 8, 16, 16);
        let image = rgba(w, h, |x, y| {
            if mask[y * w + x] {
                GARBAGE
            } else {
                [10, 20, 200, 255]
            }
        });
        let out = inpaint(&image, w, h, &mask, 21);
        for y in 0..h {
            for x in 0..w {
                let i = y * w + x;
                if !mask[i] {
                    continue;
                }
                let px = &out[i * 4..i * 4 + 4];
                assert_ne!(
                    px, &GARBAGE,
                    "masked pixel ({x},{y}) still holds its original garbage colour"
                );
            }
        }
    }

    #[test]
    fn output_dimensions_are_unchanged() {
        let (w, h) = (17, 13); // deliberately non-square, no patch-radius alignment
        let mask = rect_mask(w, h, 3, 3, 9, 9);
        let image = rgba(w, h, |x, y| [(x * 7) as u8, (y * 5) as u8, 30, 255]);
        let out = inpaint(&image, w, h, &mask, 4);
        assert_eq!(out.len(), image.len());
        assert_eq!(out.len(), w * h * 4);
    }

    #[test]
    fn deterministic_fill_same_seed_is_byte_identical() {
        let (w, h) = (20, 20);
        let mask = rect_mask(w, h, 6, 6, 14, 14);
        let image = rgba(w, h, |x, y| {
            [(x * 11) as u8, (y * 13) as u8, (x ^ y) as u8, 255]
        });
        let a = inpaint(&image, w, h, &mask, 55);
        let b = inpaint(&image, w, h, &mask, 55);
        assert_eq!(
            a, b,
            "same input + same seed must give a byte-identical fill"
        );
    }

    #[test]
    fn unmasked_pixels_pass_through_byte_identical() {
        let (w, h) = (18, 18);
        let mask = rect_mask(w, h, 5, 5, 11, 11);
        let image = rgba(w, h, |x, y| [(x * 3) as u8, (y * 9) as u8, 77, 255]);
        let out = inpaint(&image, w, h, &mask, 8);
        for y in 0..h {
            for x in 0..w {
                let i = y * w + x;
                if mask[i] {
                    continue;
                }
                assert_eq!(
                    &out[i * 4..i * 4 + 4],
                    &image[i * 4..i * 4 + 4],
                    "unmasked pixel ({x},{y}) must be untouched"
                );
            }
        }
    }

    #[test]
    fn flat_color_source_fills_exactly_that_color() {
        const BLUE: [u8; 4] = [10, 20, 200, 255];
        const GARBAGE: [u8; 4] = [255, 0, 255, 255];
        let (w, h) = (24, 24);
        let mask = rect_mask(w, h, 8, 8, 16, 16);
        let image = rgba(w, h, |x, y| if mask[y * w + x] { GARBAGE } else { BLUE });
        let out = inpaint(&image, w, h, &mask, 3);
        for y in 0..h {
            for x in 0..w {
                let i = y * w + x;
                if !mask[i] {
                    continue;
                }
                assert_eq!(
                    &out[i * 4..i * 4 + 4],
                    &BLUE,
                    "masked pixel ({x},{y}) should fill to EXACTLY the flat blue \
                     — every contributing vote agrees, so no rounding drift either"
                );
            }
        }
    }

    #[test]
    fn whole_image_masked_is_a_safe_no_op_fill() {
        // No source pixel exists anywhere — `compute_nnf`'s one documented
        // exception. `fill_from_nnf` must leave every pixel exactly as it
        // was rather than fabricate a colour from nothing.
        let (w, h) = (6, 6);
        let image = rgba(w, h, |x, y| [(x * 40) as u8, (y * 40) as u8, 5, 255]);
        let mask = vec![true; w * h];
        let out = inpaint(&image, w, h, &mask, 12);
        assert_eq!(out, image, "no source anywhere ⇒ untouched, not fabricated");
    }

    #[test]
    fn degenerate_inputs_do_not_panic() {
        assert_eq!(inpaint(&[], 0, 0, &[], 1).len(), 0);
        // Mismatched mask/image lengths — an internal-API caller bug, not
        // something that should ever panic across the eventual wasm
        // boundary.
        assert_eq!(
            fill_from_nnf(&[0; 400], 10, 10, &[false; 5], &[(0, 0); 100]).len(),
            400
        );
        assert_eq!(
            fill_from_nnf(&[0; 4], 10, 10, &[false; 100], &[(0, 0); 100]).len(),
            4
        );
        // A 1px mask and a mask touching the image edge, end to end.
        let (w, h) = (10, 10);
        let image = rgba(w, h, |x, y| [(x * 20) as u8, (y * 20) as u8, 128, 255]);
        let mut one_px = vec![false; w * h];
        one_px[5 * w + 5] = true;
        assert_eq!(inpaint(&image, w, h, &one_px, 2).len(), image.len());
        let edge_mask = rect_mask(w, h, 0, 0, 3, 3);
        assert_eq!(inpaint(&image, w, h, &edge_mask, 2).len(), image.len());
    }

    #[test]
    fn fill_from_nnf_matches_exactly_for_a_single_isolated_hole_pixel() {
        // Only ONE pixel is masked, so the only patch that "covers" it is
        // its own (dx=dy=0) — no neighbouring masked pixel exists to also
        // vote. The expected output is therefore EXACTLY the colour at its
        // own nnf match, not an average of several contributions — a
        // maximally precise check of the voting arithmetic, decoupled from
        // `compute_nnf`'s randomness (this test hand-builds the NNF).
        let (w, h) = (10, 10);
        let mut image = rgba(w, h, |x, y| [(x * 10) as u8, (y * 10) as u8, 50, 255]);
        let hole_i = 5 * w + 5;
        image[hole_i * 4..hole_i * 4 + 4].copy_from_slice(&[9, 9, 9, 9]);
        let mut mask = vec![false; w * h];
        mask[hole_i] = true;
        let mut nnf = vec![(0u32, 0u32); w * h];
        for y in 0..h {
            for x in 0..w {
                nnf[y * w + x] = (x as u32, y as u32);
            }
        }
        let source = (1u32, 1u32);
        nnf[hole_i] = source;
        let out = fill_from_nnf(&image, w, h, &mask, &nnf);
        let source_i = source.1 as usize * w + source.0 as usize;
        assert_eq!(
            &out[hole_i * 4..hole_i * 4 + 4],
            &image[source_i * 4..source_i * 4 + 4]
        );
    }

    #[test]
    fn fill_from_nnf_blends_multiple_covering_patches() {
        let (w, h) = (10, 10);
        // R is a simple x-ramp so every candidate's expected contribution is
        // easy to predict by hand; G/B/A stay flat so only R needs checking.
        let image = rgba(w, h, |x, _| [(x * 10) as u8, 100, 100, 255]);
        let (p0, p1) = ((5usize, 5usize), (6usize, 5usize)); // adjacent hole pixels
        let mut mask = vec![false; w * h];
        mask[p0.1 * w + p0.0] = true;
        mask[p1.1 * w + p1.0] = true;
        let mut nnf = vec![(0u32, 0u32); w * h];
        for y in 0..h {
            for x in 0..w {
                nnf[y * w + x] = (x as u32, y as u32);
            }
        }
        nnf[p0.1 * w + p0.0] = (1, 1); // R = 10
        nnf[p1.1 * w + p1.0] = (3, 1); // R = 30
        let out = fill_from_nnf(&image, w, h, &mask, &nnf);
        // p0 blends two votes: its own match ((1,1), R=10, offset (0,0)) and
        // p1's match shifted by the offset from p1 to p0 ((3,1) + (-1,0) =
        // (2,1), R=20). Average of 10 and 20 is 15 — exact, no rounding.
        let out_r0 = out[(p0.1 * w + p0.0) * 4];
        assert_eq!(
            out_r0, 15,
            "average of R=10 (own match) and R=20 (neighbour's shifted match)"
        );
    }
}
