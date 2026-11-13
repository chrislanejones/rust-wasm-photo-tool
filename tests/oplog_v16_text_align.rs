//! Op log v16 (ADR-104): a text's line alignment. Two captured logs:
//!
//! * `v15-text-wrap` — written by the v15 engine (master `a83c8b70`): a text
//!   in a 180 px box, then an unboxed two-line label. It must still open,
//!   every text Left. It is also the 33a oracle: the v15 engine that wrote it
//!   could not replay its own wrapped box (`oplog_coverage` was 0 at capture,
//!   see the sidecar), so a resume came back from the archive instead. Opened
//!   now, it replays to exactly the pixels that engine showed the user.
//! * `v16-text-align` — the same session, then Center on the boxed text and
//!   Right on the label.
//!
//! Generator: `fixtures/oplog/capture-text-align.rs.txt`, run against each
//! crate. Engine-written frames, the same bytes the app persists; not driven
//! through the UI, unlike the v7/v8 captures.

use stamp_tool::ImageHorseTool;

const BASE_PNG: &[u8] = include_bytes!("fixtures/oplog/base-keyframe-320x200.png");
const V15_FRAMES: &[u8] = include_bytes!("fixtures/oplog/v15-text-wrap.frames.bin");
const V15_ANNOTATIONS: &[u8] = include_bytes!("fixtures/oplog/v15-text-wrap.annotations.bin");
const V15_OPS: u32 = 4;
/// FNV-1a of the v15 engine's own composite when it wrote the log.
const V15_COMPOSITE: u64 = 0x5fd8_3740_6a6b_07f6;
const V16_FRAMES: &[u8] = include_bytes!("fixtures/oplog/v16-text-align.frames.bin");
const V16_ANNOTATIONS: &[u8] = include_bytes!("fixtures/oplog/v16-text-align.annotations.bin");
const V16_OPS: u32 = 6;
const V16_COMPOSITE: u64 = 0xd436_3f5f_dd7e_a4f6;

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

fn aligns(t: &ImageHorseTool) -> Vec<u64> {
    let json = t.get_text_annotations();
    json.match_indices("\"align\":")
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
fn the_fixtures_carry_the_version_bytes_they_claim() {
    // Frame layout: [u32 LE length][version u8] postcard(op).
    assert_eq!(V15_FRAMES[4], 15, "v15 frames");
    assert_eq!(V15_ANNOTATIONS[0], 15, "v15 base annotations");
    assert_eq!(V16_FRAMES[4], 16, "v16 frames");
    assert_eq!(V16_ANNOTATIONS[0], 16, "v16 base annotations");
}

#[test]
fn a_v15_log_still_opens_every_text_left_and_replays_what_its_engine_showed() {
    let mut t = resume(V15_ANNOTATIONS, V15_FRAMES, V15_OPS);
    assert_eq!(aligns(&t), vec![0, 0], "a v15 text was left-aligned");
    assert!(t.get_text_annotations().contains("\"wrap_width\":180"));
    assert!(!t.oplog_is_broken());
    assert_eq!(t.oplog_coverage(), 1, "the log covers the document now");
    assert_eq!(
        fnv(&t.get_image_data()),
        V15_COMPOSITE,
        "the boxed text replays wrapped, exactly as the v15 engine drew it live"
    );
}

#[test]
fn a_v16_log_round_trips_the_alignment() {
    let mut t = resume(V16_ANNOTATIONS, V16_FRAMES, V16_OPS);
    assert_eq!(aligns(&t), vec![1, 2], "center, then right");
    assert_eq!(t.oplog_coverage(), 1);
    assert_eq!(
        fnv(&t.get_image_data()),
        V16_COMPOSITE,
        "the pixels it was written with"
    );
    // Re-encoding what was read gives back the same bytes.
    assert_eq!(t.oplog_encoded_ops(0, V16_OPS), V16_FRAMES);

    // Back two ops: before Center and Right, both Left again.
    let t = resume(V16_ANNOTATIONS, V16_FRAMES, V16_OPS - 2);
    assert_eq!(aligns(&t), vec![0, 0]);
}
