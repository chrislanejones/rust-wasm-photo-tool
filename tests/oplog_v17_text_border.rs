//! Op log v17 (ADR-109): a text's box border, what a stamp is made of.
//!
//! * `v17-text-border` — a stamp (APPROVED, bold green, transparent box,
//!   tilted -5°, centered, 3 px border) placed as one step, then a white
//!   speech bubble and a 2 px red border on it as a step of its own.
//!   Generator: `fixtures/oplog/capture-text-border.rs.txt`.
//! * The v16 fixtures (`oplog_v16_text_align.rs`) are the older side: they
//!   open under v17 with every text unbordered, which that file asserts by
//!   replaying to the exact pixels the v16 engine drew.

use stamp_tool::ImageHorseTool;

const BASE_PNG: &[u8] = include_bytes!("fixtures/oplog/base-keyframe-320x200.png");
const FRAMES: &[u8] = include_bytes!("fixtures/oplog/v17-text-border.frames.bin");
const ANNOTATIONS: &[u8] = include_bytes!("fixtures/oplog/v17-text-border.annotations.bin");
const OPS: u32 = 7;
/// FNV-1a of the engine's own composite when it wrote the log.
const COMPOSITE: u64 = 0x75ba_0896_b2c2_c6f4;
const V16_FRAMES: &[u8] = include_bytes!("fixtures/oplog/v16-text-align.frames.bin");
const V16_ANNOTATIONS: &[u8] = include_bytes!("fixtures/oplog/v16-text-align.annotations.bin");
const V16_OPS: u32 = 6;

fn fnv(bytes: &[u8]) -> u64 {
    bytes.iter().fold(0xcbf2_9ce4_8422_2325u64, |h, &b| {
        (h ^ b as u64).wrapping_mul(0x0000_0100_0000_01b3)
    })
}

fn resume(annotations: &[u8], frames: &[u8], cursor: u32) -> ImageHorseTool {
    let mut t = ImageHorseTool::new(320, 200);
    assert!(
        t.oplog_restore_png(BASE_PNG, annotations, frames, cursor),
        "the log restores at cursor {cursor}"
    );
    t
}

fn border_widths(t: &ImageHorseTool) -> Vec<u64> {
    let json = t.get_text_annotations();
    json.match_indices("\"border_width\":")
        .map(|(i, m)| {
            json[i + m.len()..]
                .chars()
                .take_while(|c| c.is_ascii_digit())
                .collect::<String>()
                .parse()
                .unwrap() // allow: rust-panic
        })
        .collect()
}

#[test]
fn the_fixture_carries_the_version_bytes_it_claims() {
    // Frame layout: [u32 LE length][version u8] postcard(op).
    assert_eq!(FRAMES[4], 17, "v17 frames");
    assert_eq!(ANNOTATIONS[0], 17, "v17 base annotations");
}

#[test]
fn a_v17_log_round_trips_the_border_and_its_pixels() {
    let mut t = resume(ANNOTATIONS, FRAMES, OPS);
    assert_eq!(
        border_widths(&t),
        vec![3, 2],
        "the stamp's, then the bubble's"
    );
    let json = t.get_text_annotations();
    assert!(json.contains("\"text\":\"APPROVED\""), "{json}");
    assert!(
        json.contains("\"rotation_deg\":-5"),
        "the stamp keeps its tilt"
    );
    assert!(!t.oplog_is_broken());
    assert_eq!(t.oplog_coverage(), 1);
    assert_eq!(
        fnv(&t.get_image_data()),
        COMPOSITE,
        "the pixels it was written with"
    );
    assert_eq!(
        t.oplog_encoded_ops(0, OPS),
        FRAMES,
        "re-encodes to the same bytes"
    );

    // Back one op: the bubble is there, unbordered; the stamp keeps its own.
    let t = resume(ANNOTATIONS, FRAMES, OPS - 1);
    assert_eq!(border_widths(&t), vec![3, 0]);
}

#[test]
fn a_v16_log_opens_with_no_borders() {
    let t = resume(V16_ANNOTATIONS, V16_FRAMES, V16_OPS);
    assert_eq!(border_widths(&t), vec![0, 0], "a v16 text had no border");
    assert!(!t.oplog_is_broken());
}
