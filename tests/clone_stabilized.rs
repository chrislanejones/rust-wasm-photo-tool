//! The clone stamp honours the Stroke Stabilizer (plan §5.2, Phase 3), and
//! the two claims that plan makes about it hold:
//!
//!   1. THE OFFSET SURVIVES. `offset = dest - source` is fixed at
//!      `begin_stroke`, so a lagging tip samples a source that lags by the
//!      same vector — the clone relationship is preserved and only the path
//!      is smoothed. The plan calls this "the one thing a reader will worry
//!      about", which is why it is pinned here rather than argued.
//!   2. ONE UNDO STEP. A whole stabilized stroke, catch-up flush included, is
//!      exactly one history entry, and undoing it restores the pre-stroke
//!      pixels exactly.
//!
//! ⚠️ CORRECTION TO THE PLAN. §9 lists "undo granularity on the clone stamp —
//! flush before the history push, or a stabilized stroke's tail lands outside
//! its own undo step" as a risk. It is not one. `push_stroke` pushes the
//! PRE-stroke snapshot built back at `begin_stroke` and never reads the layer,
//! so the flush's dabs are unaffected by which side of the push they land on,
//! and undo restores pre-stroke pixels either way. Verified by mutation:
//! moving the flush after the push leaves every test here green.
//!
//! The flush still runs first, because "finish the stroke, then file it" is
//! the order that stays correct if the snapshot ever becomes a post-snapshot.
//! But no test below pins that ordering, and none pretends to.
use stamp_tool::ImageHorseTool;

const W: u32 = 160;
const H: u32 = 160;

/// Left half red, right half blue, so cloning across the seam moves an
/// unmistakable colour. Flat fills would let a wrong offset pass unnoticed.
fn tool() -> ImageHorseTool {
    let mut px = vec![0u8; (W * H * 4) as usize];
    for y in 0..H {
        for x in 0..W {
            let i = ((y * W + x) * 4) as usize;
            let red = x < W / 2;
            px[i] = if red { 220 } else { 20 };
            px[i + 1] = 20;
            px[i + 2] = if red { 20 } else { 220 };
            px[i + 3] = 255;
        }
    }
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&px);
    t
}

/// FNV-1a over the composite. `composite_hash_hex` is gated behind the
/// `tiles` feature and nothing here needs tiles, so the test does its own
/// rather than dragging a feature in to compare two byte arrays.
fn hash(t: &mut ImageHorseTool) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in t.get_image_data() {
        h ^= b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    h
}

fn px_at(t: &mut ImageHorseTool, x: u32, y: u32) -> [u8; 4] {
    let d = t.get_image_data();
    let i = ((y * W + x) * 4) as usize;
    [d[i], d[i + 1], d[i + 2], d[i + 3]]
}

#[test]
fn a_move_inside_the_leash_stamps_nothing() {
    let mut t = tool();
    t.set_source(30, 30);
    t.begin_stroke(100.0, 30.0, "high"); // leash 36
    let after_down = hash(&mut t);

    assert!(!t.continue_stroke(110.0, 30.0), "10px < 36px leash");
    assert!(!t.continue_stroke(130.0, 30.0), "30px < 36px leash");
    assert_eq!(
        hash(&mut t),
        after_down,
        "a leashed move must not touch a pixel"
    );
}

#[test]
fn off_stamps_on_every_move_exactly_as_before() {
    let mut t = tool();
    t.set_source(30, 60);
    t.begin_stroke(100.0, 60.0, "off");
    let after_down = hash(&mut t);
    assert!(t.continue_stroke(104.0, 60.0), "off means no leash");
    assert_ne!(hash(&mut t), after_down);
}

/// Claim 1. With a leash on, the pixel written at the stabilized tip must
/// equal the SOURCE pixel one offset away — not the pixel under the cursor.
#[test]
fn the_clone_offset_survives_the_leash() {
    let mut t = tool();
    // Source in the red half, first stamp in the blue half: offset = +70.
    t.set_source(30, 100);
    t.begin_stroke(100.0, 100.0, "high");
    assert!(t.continue_stroke(156.0, 100.0), "56 > 36, so the tip moves");

    // Tip lands at 156 - 36 = 120. Its source is 120 - 70 = 50, still red.
    let tip = px_at(&mut t, 120, 100);
    assert!(
        tip[0] > 150 && tip[2] < 100,
        "tip should carry RED from x=50, got {tip:?} — the offset was not preserved"
    );
}

/// Claim 2. A whole stabilized stroke, flush included, is ONE undo entry,
/// and undoing it restores the original pixels exactly.
#[test]
fn a_stabilized_stroke_is_one_undo_step_and_undo_restores_the_pixels() {
    let mut t = tool();
    let before = hash(&mut t);
    let undos_before = t.undo_count();

    t.set_source(30, 130);
    // Leash 36. 100 -> 150 is 50, so the tip advances to 150 - 36 = 114.
    t.begin_stroke(100.0, 130.0, "high");
    assert!(t.continue_stroke(150.0, 130.0));
    // MEASURED FROM THE TIP (114), NOT THE LAST CURSOR (150): 145 is 31 away
    // and stays inside the leash, leaving slack for end_stroke to flush.
    assert!(
        !t.continue_stroke(145.0, 130.0),
        "31 from the tip, inside 36"
    );
    t.end_stroke(145.0, 130.0);

    assert_eq!(
        t.undo_count(),
        undos_before + 1,
        "a stroke must be exactly ONE history entry, flush and all"
    );
    assert_ne!(hash(&mut t), before, "the stroke did something");

    t.undo();
    assert_eq!(
        hash(&mut t),
        before,
        "undo must restore the pre-stroke pixels exactly"
    );
}

#[test]
fn end_stroke_flushes_the_slack_the_leash_was_holding() {
    let mut t = tool();
    t.set_source(30, 80);
    t.begin_stroke(100.0, 80.0, "high");
    // Tip advances to 114.
    assert!(t.continue_stroke(150.0, 80.0));
    assert!(
        !t.continue_stroke(145.0, 80.0),
        "31 from the tip, inside 36"
    );
    let before_up = hash(&mut t);

    t.end_stroke(145.0, 80.0);
    assert_ne!(
        hash(&mut t),
        before_up,
        "end_stroke must stamp the slack, or the stroke ends a leash short"
    );
}

#[test]
fn a_stabilized_stroke_leaves_no_tip_for_the_next_one() {
    let mut t = tool();
    t.set_source(30, 40);
    t.begin_stroke(100.0, 40.0, "high");
    assert!(t.continue_stroke(150.0, 40.0));
    t.end_stroke(150.0, 40.0);

    t.set_source(30, 140);
    t.begin_stroke(100.0, 140.0, "off");
    let after_down = hash(&mut t);
    assert!(
        t.continue_stroke(104.0, 140.0),
        "off: a 4px move still stamps"
    );
    assert_ne!(hash(&mut t), after_down);
}
