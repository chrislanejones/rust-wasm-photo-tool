//! The paint brush honours the Stroke Stabilizer — the WIRING, not the math.
//!
//! `src/stabilizer.rs` has unit tests for the leash itself, and they stayed
//! green through the bug this file exists for. #122 (v8.75) moved the leash
//! into `Stabilizer` and left `paint_move` reading `let leash = 0.0`, so its
//! stabilized branch could never run:
//!
//!   press    `paint_down` anchored the tip at the press point
//!   move     every move painted the RAW path; the tip never moved
//!   release  `paint_up`'s catch-up flush drew tip → release point, i.e. a
//!            straight line from where the stroke STARTED to where it ended
//!
//! An L came out as a triangle and a U as a box, on every level, not just
//! High (Chris, 2026-09-15, on v8.77: "making boxes when I don't want it").
//! The replay parity tests could not see it: they paint with "off".
//!
//! The eraser, mask paint and Magic Eraser brush all continue through
//! `paint_move`, so the eraser is pinned here too. Clone stamp and blur drive
//! their own stabilizers and have their own files.
use stamp_tool::ImageHorseTool;

const W: u32 = 160;
const H: u32 = 160;
const WHITE: [u8; 4] = [255, 255, 255, 255];

fn white_tool() -> ImageHorseTool {
    let px = vec![255u8; (W * H * 4) as usize];
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&px);
    t
}

/// FNV-1a over the composite, as in `clone_stabilized.rs` — no `tiles` needed.
fn hash(t: &mut ImageHorseTool) -> u64 {
    t.recomposite();
    let mut h: u64 = 0xcbf29ce484222325;
    for b in t.get_image_data() {
        h ^= b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    h
}

fn px_at(t: &mut ImageHorseTool, x: u32, y: u32) -> [u8; 4] {
    t.recomposite();
    let d = t.get_image_data();
    let i = ((y * W + x) * 4) as usize;
    [d[i], d[i + 1], d[i + 2], d[i + 3]]
}

/// An L: right along y = 20 from x = 20 to 140, then down x = 140 to y = 140.
/// Its closing diagonal (20,20) → (140,140) passes through (80,80), which no
/// part of the L comes within 60px of.
fn l_path() -> Vec<(f64, f64)> {
    let mut p: Vec<(f64, f64)> = (0..=30).map(|i| (20.0 + 4.0 * i as f64, 20.0)).collect();
    p.extend((1..=30).map(|i| (140.0, 20.0 + 4.0 * i as f64)));
    p
}

fn paint_l(t: &mut ImageHorseTool, stab: &str) {
    let path = l_path();
    t.paint_down(path[0].0, path[0].1, 6.0, "#000000", 1.0, 1.0, stab);
    for &(x, y) in &path[1..] {
        t.paint_move(x, y);
    }
    t.paint_up();
}

#[test]
fn off_an_l_stroke_leaves_the_diagonal_untouched() {
    // Control: without the stabilizer the stroke is just the L.
    let mut t = white_tool();
    paint_l(&mut t, "off");
    assert_ne!(px_at(&mut t, 80, 20), WHITE, "the L itself was painted");
    assert_eq!(px_at(&mut t, 80, 80), WHITE, "nothing on the diagonal");
}

#[test]
fn a_stabilized_l_stroke_never_closes_itself_with_a_straight_line() {
    for stab in ["low", "med", "high"] {
        let mut t = white_tool();
        paint_l(&mut t, stab);
        // Anti-vacuous: the stroke really painted, so a blank canvas can't pass.
        assert_ne!(
            px_at(&mut t, 80, 20),
            WHITE,
            "{stab}: the L itself was painted"
        );
        assert_eq!(
            px_at(&mut t, 80, 80),
            WHITE,
            "{stab}: release drew a line from the PRESS point — the stroke closed itself"
        );
    }
}

#[test]
fn a_move_inside_the_leash_paints_nothing() {
    let mut t = white_tool();
    t.paint_down(100.0, 100.0, 6.0, "#000000", 1.0, 1.0, "high"); // leash 36
    let after_down = hash(&mut t);
    assert!(!t.paint_move(110.0, 100.0), "10px < 36px leash");
    assert!(!t.paint_move(130.0, 100.0), "30px < 36px leash");
    assert_eq!(
        hash(&mut t),
        after_down,
        "a leashed move must not touch a pixel"
    );
}

#[test]
fn a_pull_past_the_leash_paints_up_to_the_trailing_tip() {
    let mut t = white_tool();
    t.paint_down(20.0, 100.0, 6.0, "#000000", 1.0, 1.0, "high"); // leash 36
    assert!(t.paint_move(100.0, 100.0), "80px > 36px leash");
    // Tip lands at 100 - 36 = 64: painted up to it, not beyond.
    assert_ne!(
        px_at(&mut t, 50, 100),
        WHITE,
        "painted along the way to the tip"
    );
    assert_eq!(
        px_at(&mut t, 90, 100),
        WHITE,
        "not past the trailing tip yet"
    );
}

#[test]
fn off_paints_on_every_move_exactly_as_before() {
    let mut t = white_tool();
    t.paint_down(20.0, 60.0, 6.0, "#000000", 1.0, 1.0, "off");
    let after_down = hash(&mut t);
    assert!(t.paint_move(30.0, 60.0), "off means no leash");
    assert_ne!(hash(&mut t), after_down);
}

#[test]
fn the_eraser_never_closes_itself_either() {
    let mut t = white_tool();
    let path = l_path();
    t.erase_down(path[0].0, path[0].1, 6.0, 1.0, 1.0, "high");
    for &(x, y) in &path[1..] {
        t.erase_move(x, y);
    }
    t.erase_up();
    assert_ne!(px_at(&mut t, 80, 20), WHITE, "the L was erased");
    assert_eq!(
        px_at(&mut t, 80, 80),
        WHITE,
        "nothing erased on the diagonal"
    );
}
