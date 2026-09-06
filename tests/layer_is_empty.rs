//! `layer_is_empty` — the pure emptiness probe #71 asked for.
//!
//! The interesting cases are the two ends of the scan, because the function
//! exists to EARLY-EXIT: an opaque pixel at index 0 must stop it immediately,
//! and an opaque pixel at the very last position must still be found. A scan
//! that reads eight bytes at a time can drop a tail, and a test that only ever
//! puts content in the middle would never notice.
//!
//! Sizes are chosen so the buffer is NOT a whole number of 8-byte words where
//! that matters: an odd pixel count leaves a 4-byte remainder, which is the
//! path most likely to be wrong.
use stamp_tool::ImageHorseTool;

const W: u32 = 5; // odd on purpose: 5*3 = 15 pixels = 60 bytes = 7 words + 4
const H: u32 = 3;
const PX: usize = (W * H) as usize;

fn tool() -> ImageHorseTool {
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&[128u8; PX * 4]);
    t
}

/// A transparent buffer with alpha set at exactly one pixel.
fn one_opaque_at(i: usize) -> Vec<u8> {
    let mut v = vec![0u8; PX * 4];
    v[i * 4 + 3] = 255;
    v
}

/// Stack index of a layer id, as `get_layers()` orders them (bottom → top).
fn index_of(t: &ImageHorseTool, id: u32) -> usize {
    let json = t.get_layers();
    json.match_indices("\"id\":")
        .position(|(p, _)| {
            let rest = &json[p + 5..];
            let end = rest
                .find(|c: char| !c.is_ascii_digit())
                .unwrap_or(rest.len());
            rest[..end].parse::<u32>() == Ok(id)
        })
        .unwrap_or_else(|| panic!("layer id {id} not in get_layers(): {json}"))
}

#[test]
fn a_fully_transparent_layer_is_empty() {
    let mut t = tool();
    let id = t.push_restored_layer(&[0u8; PX * 4], W, H, "blank", true, 1.0);
    assert!(t.layer_is_empty(index_of(&t, id)));
}

#[test]
fn a_loaded_photo_layer_is_not_empty() {
    let t = tool();
    let id = t.active_layer_id();
    assert!(
        !t.layer_is_empty(index_of(&t, id)),
        "load_image writes opaque pixels; this is the control"
    );
}

#[test]
fn opaque_at_pixel_zero_is_not_empty() {
    let mut t = tool();
    let id = t.push_restored_layer(&one_opaque_at(0), W, H, "first", true, 1.0);
    assert!(!t.layer_is_empty(index_of(&t, id)), "the early-exit case");
}

/// The one a word scan gets wrong: 15 pixels is 7 whole words plus a 4-byte
/// remainder, and the last pixel lives in that remainder.
#[test]
fn opaque_at_the_very_last_pixel_is_not_empty() {
    let mut t = tool();
    let id = t.push_restored_layer(&one_opaque_at(PX - 1), W, H, "last", true, 1.0);
    assert!(
        !t.layer_is_empty(index_of(&t, id)),
        "the final pixel is in the 4-byte tail after 7 whole words — a scan \
         that drops the remainder reports this layer empty"
    );
}

/// And the pixel just before it, which is the last one inside a whole word.
#[test]
fn opaque_at_the_last_word_aligned_pixel_is_not_empty() {
    let mut t = tool();
    let id = t.push_restored_layer(&one_opaque_at(PX - 2), W, H, "penult", true, 1.0);
    assert!(!t.layer_is_empty(index_of(&t, id)));
}

/// Every position, so no lane of the word test can be silently ignored.
#[test]
fn a_single_opaque_pixel_is_found_at_every_position() {
    for i in 0..PX {
        let mut t = tool();
        let id = t.push_restored_layer(&one_opaque_at(i), W, H, "one", true, 1.0);
        assert!(
            !t.layer_is_empty(index_of(&t, id)),
            "a lone opaque pixel at index {i} was reported as empty"
        );
    }
}

/// Alpha only — a colour with zero alpha is still nothing.
#[test]
fn opaque_looking_colour_with_zero_alpha_is_still_empty() {
    let mut t = tool();
    let mut v = vec![0u8; PX * 4];
    for px in v.chunks_exact_mut(4) {
        px[0] = 255;
        px[1] = 200;
        px[2] = 50; // fully saturated RGB, alpha stays 0
    }
    let id = t.push_restored_layer(&v, W, H, "ghost", true, 1.0);
    assert!(
        t.layer_is_empty(index_of(&t, id)),
        "RGB must not be mistaken for content"
    );
}

/// Scoped to the layer asked about, not to the active one.
#[test]
fn the_answer_is_per_layer_not_per_selection() {
    let mut t = tool();
    let photo = t.active_layer_id();
    let blank = t.push_restored_layer(&[0u8; PX * 4], W, H, "blank", true, 1.0);

    let (i_photo, i_blank) = (index_of(&t, photo), index_of(&t, blank));
    assert!(!t.layer_is_empty(i_photo), "photo");
    assert!(t.layer_is_empty(i_blank), "blank");

    // Moving the selection must not move the answers.
    assert!(t.set_active_layer(blank), "control: blank layer exists");
    assert!(!t.layer_is_empty(i_photo), "photo changed when deselected");
    assert!(t.layer_is_empty(i_blank), "blank changed when selected");
}

/// A hiding mask makes a layer invisible, not empty. The Color Overlay this
/// gates is clipped to the layer's own alpha and applied BEFORE the mask
/// (ADR-041), so masking must not change the answer.
#[test]
fn a_fully_hiding_mask_does_not_make_a_layer_empty() {
    let mut t = tool();
    let id = t.active_layer_id();
    let i = index_of(&t, id);
    assert!(!t.layer_is_empty(i), "control: content before masking");
    // add_layer_mask starts fully-revealed (255); inverting it hides everything.
    assert!(t.add_layer_mask(id), "control: mask added");
    assert!(
        t.invert_layer_mask(id),
        "control: mask inverted to fully hide"
    );
    assert!(
        !t.layer_is_empty(i),
        "a hiding mask made the layer read as empty"
    );
}

#[test]
fn an_index_past_the_end_is_empty() {
    let t = tool();
    assert!(
        t.layer_is_empty(999),
        "a layer that is not there holds nothing"
    );
}

#[test]
fn it_does_not_mutate_the_document() {
    let mut t = tool();
    t.push_restored_layer(&one_opaque_at(3), W, H, "x", true, 1.0);
    // `get_image_data`, not `composite_hash_hex`: the hash is behind the
    // `tiles` feature, and this file must compile in the FEATURE-FREE config
    // too — that is the one `cargo clippy --all-targets` and the pre-push hook
    // build, and a test that only exists under a feature says nothing about it.
    let before_pixels = t.get_image_data();
    let before_layers = t.get_layers();
    let before_undo = t.undo_count();
    for i in 0..4 {
        let _ = t.layer_is_empty(i);
    }
    assert_eq!(t.get_image_data(), before_pixels, "pixels moved");
    assert_eq!(t.get_layers(), before_layers, "layer state moved");
    assert_eq!(
        t.undo_count(),
        before_undo,
        "it pushed history — begin_layer_resize_preview's side effect is \
         exactly what this function exists to avoid"
    );
}
