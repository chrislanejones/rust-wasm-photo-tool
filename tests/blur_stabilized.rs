//! The blur brush honours the Stroke Stabilizer (plan §5.2, Phase 2), and a
//! stabilized stroke still records an op log that replays to the same pixels.
//!
//! The op-log half is safe by construction — `Op::Blur.points` is documented
//! as "the EXACT dab centres in stamp order" and `apply_effect_dab` pushes
//! each centre as it stamps, so a stabilized stroke records its POST-leash
//! centres and replay needs no knowledge of the stabilizer at all. This file
//! is what turns that argument into a check.
use stamp_tool::ImageHorseTool;

const W: u32 = 120;
const H: u32 = 120;

/// A gradient, so a blur actually changes bytes — blurring flat colour is a
/// no-op and every assertion below would pass vacuously.
fn tool() -> ImageHorseTool {
    let mut px = vec![0u8; (W * H * 4) as usize];
    for y in 0..H {
        for x in 0..W {
            let i = ((y * W + x) * 4) as usize;
            px[i] = (x * 2) as u8;
            px[i + 1] = (y * 2) as u8;
            px[i + 2] = ((x + y) % 256) as u8;
            px[i + 3] = 255;
        }
    }
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&px);
    t
}

fn blur_down(t: &mut ImageHorseTool, x: f64, y: f64, stab: &str) {
    t.effect_down(x, y, 16.0, "gaussian", 8, 8, "#000000", stab);
}

#[test]
fn a_move_inside_the_leash_stamps_nothing_and_reports_false() {
    let mut t = tool();
    blur_down(&mut t, 20.0, 20.0, "high"); // leash 36
    let after_down = t.composite_hash_hex();

    assert!(!t.effect_move(30.0, 20.0), "10px < 36px leash");
    assert!(!t.effect_move(50.0, 20.0), "30px < 36px leash");
    assert_eq!(
        t.composite_hash_hex(),
        after_down,
        "a leashed move must not touch a single pixel"
    );
}

#[test]
fn a_pull_past_the_leash_stamps_and_reports_true() {
    let mut t = tool();
    blur_down(&mut t, 20.0, 60.0, "high");
    let after_down = t.composite_hash_hex();

    assert!(t.effect_move(100.0, 60.0), "80px > 36px leash");
    assert_ne!(
        t.composite_hash_hex(),
        after_down,
        "clearing the leash must actually blur something"
    );
}

/// Off must behave exactly as before the stabilizer existed: every move
/// stamps. This is the regression guard for the whole feature — the default
/// is off, so this is the path almost every user is on.
#[test]
fn with_the_stabilizer_off_every_move_stamps() {
    let mut t = tool();
    blur_down(&mut t, 20.0, 90.0, "off");
    let after_down = t.composite_hash_hex();
    assert!(t.effect_move(23.0, 90.0), "3px, and off means no leash");
    assert_ne!(t.composite_hash_hex(), after_down);
}

/// The bug this file caught during the build: `effect_last` briefly stored
/// the stabilized TIP rather than the raw cursor, which made the flush in
/// `effect_up` compare the tip against itself and do nothing — silently
/// dropping the last leash-length of every stabilized stroke.
#[test]
fn effect_up_flushes_the_slack_the_leash_was_still_holding() {
    let mut t = tool();
    blur_down(&mut t, 20.0, 30.0, "high"); // leash 36, tip anchored at x=20
                                           // One big pull: 20 -> 100 is 80, so the tip advances to 100 - 36 = 64.
    assert!(t.effect_move(100.0, 30.0));
    // THE LEASH IS MEASURED FROM THE TIP, NOT FROM THE LAST CURSOR. The tip
    // is at 64, so anything short of 64 + 36 = 100 is still inside it. 95 is
    // 31 from the tip and stamps nothing — but it leaves 31px of slack the
    // stroke has not drawn yet, which is exactly what effect_up must close.
    assert!(!t.effect_move(95.0, 30.0), "31px from the tip is inside 36");
    let before_up = t.composite_hash_hex();

    t.effect_up();
    assert_ne!(
        t.composite_hash_hex(),
        before_up,
        "effect_up must stamp the slack, or the stroke ends a leash short"
    );
}

#[test]
fn a_stabilized_stroke_leaves_no_tip_for_the_next_one() {
    let mut t = tool();
    blur_down(&mut t, 10.0, 10.0, "high");
    assert!(t.effect_move(90.0, 10.0));
    t.effect_up();

    // A fresh UNSTABILIZED stroke must not inherit anything from the last.
    blur_down(&mut t, 10.0, 110.0, "off");
    let after_down = t.composite_hash_hex();
    assert!(t.effect_move(14.0, 110.0), "off: a 4px move still stamps");
    assert_ne!(t.composite_hash_hex(), after_down);
}
