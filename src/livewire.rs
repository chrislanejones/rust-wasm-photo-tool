//! Live-wire (intelligent scissors) — the magnetic lasso's path finder.
//!
//! Given two points, find the cheapest 8-connected path between them over the
//! shared edge cost map (`edges::edge_cost_map`). Because a strong edge is
//! CHEAP and flat ground is EXPENSIVE, "cheapest path" and "the path a human
//! would trace along the outline" are the same path — that is the whole trick.
//! Drop anchors loosely and the wire falls into the edge between them.
//!
//! Two properties this module exists to guarantee:
//!
//! 1. **Bounded.** The search is confined to a window around the segment, so
//!    cost is a function of how far you dragged, not of how big the image is.
//!    A 6000px photo does not make the lasso lag; only a 600px drag does.
//! 2. **Deterministic.** Integer costs, and a total order on the frontier
//!    (cost, index) so ties pop in one fixed order regardless of heap
//!    internals. The same anchors over the same image give a byte-identical
//!    path, every run, every platform. A selection kernel that wanders is one
//!    nobody can debug or test.
//!
//! Scalar. The Dijkstra frontier is inherently sequential, but see the note in
//! SESSION_LOG: the per-segment searches between independent anchor pairs are
//! bounded, independent work units — that is where a rayon path would drop in
//! once browser threading clears its COOP/COEP check.

use std::cmp::Reverse;
use std::collections::BinaryHeap;

/// How far outside the anchor→cursor bounding box the search may roam, in
/// pixels. The wire needs room to bow out to an edge that bulges away from the
/// straight line between the anchors; it does not need the whole image.
const MARGIN: usize = 32;

/// Hard ceiling on the search window, in pixels (~500×500). Past this, a
/// Dijkstra sweep stops being frame-rate work and the tool starts to feel
/// broken — so beyond the cap we return the straight line instead (see
/// [`min_cost_path`]). Predictable and honest beats laggy: the user drops
/// another anchor and gets snapping back.
const MAX_SEARCH_PIXELS: usize = 250_000;

/// Orthogonal step weight. Diagonals are ×√2 — 10/14 is that ratio in
/// integers (1.4 vs 1.41421…), which keeps the whole search in `u32` and off
/// the floats. Without it, a diagonal staircase would cost the same as the
/// straight run it approximates and the wire would prefer ugly zig-zags.
const STEP_ORTHO: u32 = 10;
const STEP_DIAG: u32 = 14;

/// The 8 neighbours: (dx, dy, step weight).
const NEIGHBOURS: [(i32, i32, u32); 8] = [
    (1, 0, STEP_ORTHO),
    (-1, 0, STEP_ORTHO),
    (0, 1, STEP_ORTHO),
    (0, -1, STEP_ORTHO),
    (1, 1, STEP_DIAG),
    (1, -1, STEP_DIAG),
    (-1, 1, STEP_DIAG),
    (-1, -1, STEP_DIAG),
];

// Two invariants the wire's behaviour rests on, checked at COMPILE time so
// they can't be "simplified" away in a later refactor:
//   · a diagonal must cost more than an orthogonal step, or the wire zig-zags
//     instead of running straight;
//   · the cheapest pixel must still cost something, or the frontier can travel
//     along an edge for free and ties fall to heap order (see COST_MIN).
const _: () = assert!(STEP_DIAG > STEP_ORTHO);
const _: () = assert!(crate::edges::COST_MIN > 0);

/// An in-progress magnetic-lasso session.
///
/// Lives on the tool between `lasso_begin` and `lasso_close`/`lasso_cancel`.
/// The cost map is computed **once, at begin** — a Sobel pass per mouse-move
/// would make the tool unusable, and it is also the reason the wire is stable:
/// the ground under the path doesn't shift while you're drawing on it.
pub(crate) struct LassoState {
    /// Edge cost map of the composite as it was when the lasso began.
    /// `w * h` `u16`s — ~8 MB on a 2048² working copy, held only for the life
    /// of the session and dropped on close/cancel.
    pub cost: Vec<u16>,
    pub w: usize,
    pub h: usize,
    /// Anchors, in click order.
    pub anchors: Vec<(u32, u32)>,
    /// The dense committed pixel path, anchor 0 → last anchor.
    pub path: Vec<(u32, u32)>,
}

/// 8-connected Bresenham line, inclusive of both endpoints. The fallback when
/// the search window is over the cap, and the degenerate-case answer.
pub(crate) fn line_points(a: (u32, u32), b: (u32, u32)) -> Vec<(u32, u32)> {
    let (mut x0, mut y0) = (a.0 as i64, a.1 as i64);
    let (x1, y1) = (b.0 as i64, b.1 as i64);
    let dx = (x1 - x0).abs();
    let dy = -(y1 - y0).abs();
    let sx = if x0 < x1 { 1 } else { -1 };
    let sy = if y0 < y1 { 1 } else { -1 };
    let mut err = dx + dy;
    let mut out = Vec::new();
    loop {
        out.push((x0 as u32, y0 as u32));
        if x0 == x1 && y0 == y1 {
            break;
        }
        let e2 = 2 * err;
        if e2 >= dy {
            err += dy;
            x0 += sx;
        }
        if e2 <= dx {
            err += dx;
            y0 += sy;
        }
    }
    out
}

/// Minimum-cost 8-connected path from `start` to `goal` over the edge cost
/// map, searched only inside a bounded window around the two points. Returns
/// the dense pixel polyline, `start` first and `goal` last, both inclusive.
///
/// Falls back to a straight line when the window would exceed
/// [`MAX_SEARCH_PIXELS`] (see the const), when either point is out of bounds,
/// or when the cost map doesn't match the image — never panics, never returns
/// empty for valid input, so the UI always has something to draw.
pub(crate) fn min_cost_path(
    cost: &[u16],
    w: usize,
    h: usize,
    start: (u32, u32),
    goal: (u32, u32),
) -> Vec<(u32, u32)> {
    // Guards: a bad cost map or an out-of-bounds point degrades to a line
    // rather than panicking across the wasm boundary.
    if w == 0 || h == 0 || cost.len() != w * h {
        return line_points(start, goal);
    }
    let (sx, sy) = (start.0 as usize, start.1 as usize);
    let (gx, gy) = (goal.0 as usize, goal.1 as usize);
    if sx >= w || sy >= h || gx >= w || gy >= h {
        return line_points(start, goal);
    }
    if start == goal {
        return vec![start]; // anchor == cursor: a one-point path, not a panic
    }

    // ── The bound: a window around the segment, clamped to the image ────────
    let x0 = sx.min(gx).saturating_sub(MARGIN);
    let y0 = sy.min(gy).saturating_sub(MARGIN);
    let x1 = (sx.max(gx) + MARGIN).min(w - 1);
    let y1 = (sy.max(gy) + MARGIN).min(h - 1);
    let (ww, wh) = (x1 - x0 + 1, y1 - y0 + 1);
    if ww * wh > MAX_SEARCH_PIXELS {
        return line_points(start, goal);
    }

    // Window-local indexing: the search allocates on the window, not the image.
    let li = |x: usize, y: usize| (y - y0) * ww + (x - x0);
    let n = ww * wh;
    const UNREACHED: u32 = u32::MAX;
    let mut dist = vec![UNREACHED; n];
    let mut prev = vec![UNREACHED; n];
    let mut done = vec![false; n];

    // Frontier ordered by (dist, local index). The index tiebreak is what makes
    // this deterministic: equal-cost pixels pop in one fixed order instead of
    // whatever order the heap happens to hold them in.
    let mut heap: BinaryHeap<Reverse<(u32, u32)>> = BinaryHeap::new();
    let s = li(sx, sy);
    let g = li(gx, gy);
    dist[s] = 0;
    heap.push(Reverse((0, s as u32)));

    while let Some(Reverse((d, u))) = heap.pop() {
        let u = u as usize;
        if done[u] {
            continue; // stale heap entry — the cheap way to skip decrease-key
        }
        done[u] = true;
        if u == g {
            break;
        }
        let (ux, uy) = (x0 + u % ww, y0 + u / ww);
        for &(dx, dy, step) in &NEIGHBOURS {
            let nx = ux as i64 + dx as i64;
            let ny = uy as i64 + dy as i64;
            if nx < x0 as i64 || ny < y0 as i64 || nx > x1 as i64 || ny > y1 as i64 {
                continue;
            }
            let (nx, ny) = (nx as usize, ny as usize);
            let v = li(nx, ny);
            if done[v] {
                continue;
            }
            // Cost of ENTERING the neighbour, scaled by the step length. Cheap
            // pixels are edges, so the frontier flows along them.
            let nd = d + step * cost[ny * w + nx] as u32;
            if nd < dist[v] {
                dist[v] = nd;
                prev[v] = u as u32;
                heap.push(Reverse((nd, v as u32)));
            }
        }
    }

    // Unreachable inside the window shouldn't happen (the grid is fully
    // connected — every pixel has a finite cost), but degrade to a line rather
    // than trust that.
    if dist[g] == UNREACHED {
        return line_points(start, goal);
    }

    // Walk `prev` back from the goal, then reverse: start → goal.
    let mut path = Vec::new();
    let mut cur = g;
    loop {
        path.push(((x0 + cur % ww) as u32, (y0 + cur / ww) as u32));
        if cur == s {
            break;
        }
        cur = prev[cur] as usize;
    }
    path.reverse();
    path
}

/// A closed pixel loop → a filled selection mask (one `bool` per pixel,
/// row-major — the SAME representation the wands produce).
///
/// Not a scanline/even-odd polygon fill: `loop_px` is a *dense* pixel path, so
/// long collinear runs and self-touching vertices make crossing-counting
/// fragile. Instead, exploit the connectivity duality — a closed **8-connected**
/// curve (which is exactly what [`min_cost_path`] returns) cannot be leaked
/// through by a **4-connected** flood. So: rasterize the loop as a barrier,
/// flood the image border inward, and invert. The loop pixels themselves count
/// as selected.
pub(crate) fn mask_from_loop(loop_px: &[(u32, u32)], w: usize, h: usize) -> Vec<bool> {
    let mut barrier = vec![false; w * h];
    if w == 0 || h == 0 {
        return barrier;
    }
    for &(x, y) in loop_px {
        let (x, y) = (x as usize, y as usize);
        if x < w && y < h {
            barrier[y * w + x] = true;
        }
    }

    // Seed the flood from every border pixel that isn't already on the loop.
    let mut seeds = Vec::new();
    for x in 0..w {
        seeds.push(x); // top row
        seeds.push((h - 1) * w + x); // bottom row
    }
    for y in 0..h {
        seeds.push(y * w); // left column
        seeds.push(y * w + w - 1); // right column
    }

    let mut outside = vec![false; w * h];
    let mut stack = Vec::new();
    crate::selection::flood_barrier_into(
        &mut outside,
        w,
        &seeds,
        (0, 0, w - 1, h - 1),
        &mut stack,
        |i| !barrier[i],
    );

    // Everything the outside couldn't reach — interior plus the loop itself.
    outside.iter().map(|&o| !o).collect()
}

/// Flatten a polyline to the `[x0, y0, x1, y1, …]` `i32` pairs the JS overlay
/// draws. One allocation per call; this is a pointer-event-rate path (~60/s),
/// not the per-frame zero-copy flush path, and the polyline is bounded by the
/// search window's perimeter. See SESSION_LOG for the persistent-buffer
/// optimization if it ever shows up in a profile.
pub(crate) fn flatten(path: &[(u32, u32)]) -> Vec<i32> {
    let mut out = Vec::with_capacity(path.len() * 2);
    for &(x, y) in path {
        out.push(x as i32);
        out.push(y as i32);
    }
    out
}

/// Total cost of a path — its own price, ignoring how it got started. Test
/// helper and the honest way to compare "did the wire find the edge".
#[cfg(test)]
fn path_cost(cost: &[u16], w: usize, path: &[(u32, u32)]) -> u32 {
    path.iter()
        .skip(1)
        .map(|&(x, y)| cost[y as usize * w + x as usize] as u32)
        .sum()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::edges::{edge_cost_map, sobel_magnitude, COST_MAX};

    /// A dark disc on a light field: a curved edge with an analytically known
    /// location, which is what lets the "does the path hug the edge" assertion
    /// be exact instead of a vibe.
    const CX: f64 = 40.0;
    const CY: f64 = 40.0;
    const R: f64 = 25.0;

    fn disc(w: usize, h: usize) -> Vec<u8> {
        let mut v = vec![0u8; w * h * 4];
        for y in 0..h {
            for x in 0..w {
                let dx = x as f64 - CX;
                let dy = y as f64 - CY;
                let inside = (dx * dx + dy * dy).sqrt() <= R;
                let c: [u8; 4] = if inside {
                    [20, 20, 20, 255]
                } else {
                    [230, 230, 230, 255]
                };
                v[(y * w + x) * 4..(y * w + x) * 4 + 4].copy_from_slice(&c);
            }
        }
        v
    }

    /// Distance from the disc's boundary ring. 0 = exactly on the edge.
    fn ring_offset(p: (u32, u32)) -> f64 {
        let dx = p.0 as f64 - CX;
        let dy = p.1 as f64 - CY;
        ((dx * dx + dy * dy).sqrt() - R).abs()
    }

    fn disc_cost(w: usize, h: usize) -> Vec<u16> {
        edge_cost_map(&sobel_magnitude(&disc(w, h), w, h))
    }

    #[test]
    fn a_loose_anchor_set_snaps_to_the_curved_edge() {
        let (w, h) = (80, 80);
        let cost = disc_cost(w, h);

        // Two anchors placed LOOSELY — deliberately 3px off the true ring, the
        // way a human drops them. The wire has to find the edge itself.
        let start = (40u32, 12u32); // above the disc (ring is at y=15)
        let goal = (68u32, 40u32); // right of the disc (ring is at x=65)
        let path = min_cost_path(&cost, w, h, start, goal);

        assert_eq!(path.first(), Some(&start), "path must start at the anchor");
        assert_eq!(path.last(), Some(&goal), "path must end at the cursor");

        // The anchors themselves are off the edge, so the first/last few steps
        // are legitimately the wire diving toward it. Judge the MIDDLE: every
        // point more than 6 steps from either end must be hugging the ring.
        let mid = &path[6..path.len().saturating_sub(6)];
        assert!(!mid.is_empty(), "path should be more than a dozen pixels");
        let strays: Vec<_> = mid.iter().filter(|&&p| ring_offset(p) > 2.0).collect();
        assert!(
            strays.is_empty(),
            "the wire must hug the edge: {} of {} mid-path points strayed >2px from the ring (worst {:.1}px)",
            strays.len(),
            mid.len(),
            mid.iter().map(|&p| ring_offset(p)).fold(0.0, f64::max),
        );

        // And it must genuinely be cheaper than the naive straight line — the
        // property the whole tool rests on.
        let straight = line_points(start, goal);
        assert!(
            path_cost(&cost, w, path.as_slice()) < path_cost(&cost, w, straight.as_slice()),
            "the edge-hugging path must cost less than cutting straight across"
        );
    }

    #[test]
    fn the_same_anchors_give_a_byte_identical_path() {
        let (w, h) = (80, 80);
        let cost = disc_cost(w, h);
        let a = min_cost_path(&cost, w, h, (40, 12), (68, 40));
        let b = min_cost_path(&cost, w, h, (40, 12), (68, 40));
        assert_eq!(a, b, "a wandering selection kernel is an undebuggable one");
    }

    #[test]
    fn a_closed_loop_produces_the_expected_mask_region() {
        let (w, h) = (80, 80);
        let cost = disc_cost(w, h);

        // Four loose anchors around the disc, live-wired into a closed loop —
        // exactly what lasso_close() does.
        let anchors = [(40u32, 12u32), (68, 40), (40, 68), (12, 40)];
        let mut loop_px = Vec::new();
        for i in 0..anchors.len() {
            let a = anchors[i];
            let b = anchors[(i + 1) % anchors.len()];
            let seg = min_cost_path(&cost, w, h, a, b);
            loop_px.extend_from_slice(&seg[..seg.len() - 1]); // drop the shared endpoint
        }
        let mask = mask_from_loop(&loop_px, w, h);

        // The disc's centre is in.
        assert!(mask[40 * w + 40], "the disc centre must be selected");
        // The far background corners are out.
        assert!(!mask[2 * w + 2], "background corner must not be selected");
        assert!(!mask[77 * w + 77], "background corner must not be selected");

        // And the selected area is the disc's area (πR² ≈ 1963) — within 12%,
        // which is the honest tolerance for a pixel-rasterized circle traced by
        // a wire that rides one pixel to either side of the true boundary.
        let area = mask.iter().filter(|&&m| m).count() as f64;
        let expect = std::f64::consts::PI * R * R;
        assert!(
            (area - expect).abs() / expect < 0.12,
            "selected area {area} should be within 12% of the disc's {expect:.0}px"
        );
    }

    #[test]
    fn degenerate_cases_do_not_panic() {
        let (w, h) = (80, 80);
        let cost = disc_cost(w, h);

        // Anchor == cursor.
        let p = min_cost_path(&cost, w, h, (40, 40), (40, 40));
        assert_eq!(p, vec![(40, 40)]);

        // Out of bounds → straight line, no panic, no empty.
        assert!(!min_cost_path(&cost, w, h, (0, 0), (999, 999)).is_empty());

        // Cost map that doesn't match the image → straight line, no panic.
        assert!(!min_cost_path(&[], w, h, (0, 0), (10, 10)).is_empty());

        // Zero-size image.
        assert!(!min_cost_path(&[], 0, 0, (0, 0), (0, 0)).is_empty());

        // An empty loop can't select anything, but it must not panic either.
        assert!(mask_from_loop(&[], w, h).iter().all(|&m| !m));
        assert!(mask_from_loop(&[(1, 1)], 0, 0).is_empty());
    }

    #[test]
    fn a_straight_line_across_a_flat_area_stays_straight() {
        // Uniform cost (no edges anywhere): with nothing to snap to, the wire
        // must not wander — it takes the direct route.
        let (w, h) = (60, 60);
        let cost = vec![COST_MAX; w * h];
        let path = min_cost_path(&cost, w, h, (10, 30), (50, 30));

        assert_eq!(path.first(), Some(&(10, 30)));
        assert_eq!(path.last(), Some(&(50, 30)));
        assert_eq!(
            path.len(),
            41,
            "a horizontal run should be 41 pixels, not a detour"
        );
        assert!(
            path.iter().all(|&(_, y)| y == 30),
            "with no edge to follow, the wire must not wander off the straight line"
        );
    }

    #[test]
    fn the_diagonal_weight_approximates_root_two() {
        // STEP_DIAG > STEP_ORTHO is asserted at compile time above. What a
        // const assert can't check is that the RATIO is right: if it drifts
        // from √2, a diagonal run and the staircase approximating it stop
        // costing the same and the wire develops a direction bias.
        assert!(
            (STEP_DIAG as f64 / STEP_ORTHO as f64 - std::f64::consts::SQRT_2).abs() < 0.02,
            "the diagonal weight must approximate sqrt(2)"
        );
    }

    #[test]
    fn line_points_is_inclusive_and_eight_connected() {
        let p = line_points((0, 0), (3, 1));
        assert_eq!(p.first(), Some(&(0, 0)));
        assert_eq!(p.last(), Some(&(3, 1)));
        // Every consecutive pair must be an 8-neighbour, or mask_from_loop's
        // barrier leaks and the whole selection inverts.
        for pair in p.windows(2) {
            let dx = (pair[1].0 as i32 - pair[0].0 as i32).abs();
            let dy = (pair[1].1 as i32 - pair[0].1 as i32).abs();
            assert!(dx <= 1 && dy <= 1 && (dx + dy) > 0);
        }
        assert_eq!(line_points((5, 5), (5, 5)), vec![(5, 5)]);
    }

    #[test]
    fn min_cost_path_is_eight_connected_and_contiguous() {
        // mask_from_loop's correctness DEPENDS on this (8-connected loop vs
        // 4-connected flood). If the path could jump, the barrier would leak.
        let (w, h) = (80, 80);
        let cost = disc_cost(w, h);
        let path = min_cost_path(&cost, w, h, (40, 12), (40, 68));
        for pair in path.windows(2) {
            let dx = (pair[1].0 as i32 - pair[0].0 as i32).abs();
            let dy = (pair[1].1 as i32 - pair[0].1 as i32).abs();
            assert!(
                dx <= 1 && dy <= 1 && (dx + dy) > 0,
                "path must step to an 8-neighbour every time, got {:?}",
                pair
            );
        }
    }
}
