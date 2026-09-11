//! Does picking a typeface actually reach the PIXELS?
//!
//! ADR-051 is explicit about what a test of this feature has to assert:
//!
//! > Any test must assert the rendered text changed — a composite hash or ink
//! > extents — not that an option appeared in a dropdown. The current selector
//! > would pass that weaker test today.
//!
//! That is not a style note. The twelve-entry font dropdown this feature
//! replaces was inert for the whole of its life and would have passed every
//! test that checked the UI rather than the output. So every assertion here
//! reads the composite the engine produced.
//!
//! The faces come from `app/public/fonts` — the same bytes the app serves —
//! so a test cannot pass against a font the app does not ship.

use stamp_tool::ImageHorseTool;

const SERIF: &str = "app/public/fonts/LiberationSerif-Regular.ttf";
const SERIF_BOLD: &str = "app/public/fonts/LiberationSerif-Bold.ttf";
const MONO: &str = "app/public/fonts/LiberationMono-Regular.ttf";

fn face(path: &str) -> Vec<u8> {
    std::fs::read(path).unwrap_or_else(|e| panic!("{path}: {e} — the app ships this asset"))
}

/// Ink for the same string on the EMBEDDED face, for the tests below to
/// contrast against.
///
/// ⚠️ Every "the face survives X" test is vacuous without this. Under a
/// mutation that made `set_text_font` store the id but render on Liberation
/// Sans, three of them stayed green — they were comparing the default face
/// against itself and could not tell. Each now asserts the face it is
/// preserving is one the renderer can actually distinguish.
fn fallback_ink(
    text: &str,
    w: u32,
    h: u32,
    bold: bool,
    x: i32,
    y: i32,
) -> (u32, u32, u32, u32, usize) {
    let mut t = white_tool(w, h);
    t.add_text_annotation(
        text, 40.0, 0, 0, 0, bold, x, y, 0.0, 0, 0, 0, 0, 0, 0, 0, 0, "",
    );
    t.recomposite();
    ink(&t, w, h)
}

fn white_tool(w: u32, h: u32) -> ImageHorseTool {
    let mut t = ImageHorseTool::new(w, h);
    t.load_image(&vec![255u8; (w * h * 4) as usize]);
    t.recomposite();
    t
}

/// Bounding box of every non-white pixel in the composite, and how many there
/// are. Ink extents plus ink mass: a face swap moves at least one of them, and
/// reading both means a change that only shifts weight is still caught.
fn ink(t: &ImageHorseTool, w: u32, h: u32) -> (u32, u32, u32, u32, usize) {
    let px = t.get_image_data();
    let (mut x0, mut y0, mut x1, mut y1, mut n) = (u32::MAX, u32::MAX, 0u32, 0u32, 0usize);
    for y in 0..h {
        for x in 0..w {
            let i = ((y * w + x) * 4) as usize;
            if px[i] < 200 || px[i + 1] < 200 || px[i + 2] < 200 {
                x0 = x0.min(x);
                y0 = y0.min(y);
                x1 = x1.max(x);
                y1 = y1.max(y);
                n += 1;
            }
        }
    }
    (x0, y0, x1, y1, n)
}

#[test]
fn switching_the_face_changes_the_rendered_pixels() {
    let (w, h) = (420u32, 140u32);
    let mut t = white_tool(w, h);
    t.register_font("liberation-serif", false, &face(SERIF))
        .expect("the shipped serif asset is a readable TTF");

    let id = t.add_text_annotation(
        "Hamburgefonstiv",
        40.0,
        0,
        0,
        0,
        false,
        20,
        40,
        0.0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        "",
    );
    t.recomposite();
    let sans = ink(&t, w, h);
    assert!(sans.4 > 0, "nothing was drawn at all");

    assert!(t.set_text_font(id, "liberation-serif"), "id not found");
    t.recomposite();
    let serif = ink(&t, w, h);

    assert_ne!(
        sans, serif,
        "THE FACE DID NOT REACH THE PIXELS. Same ink extents and the same ink \
         mass after switching Liberation Sans -> Liberation Serif is the exact \
         failure ADR-051 describes: a control that renders and does not apply."
    );
    // Both faces start at the same left inset, so the WIDTH is the honest
    // signal — Serif is Times-metric, Sans is Arial-metric, and they disagree.
    assert_ne!(sans.2 - sans.0, serif.2 - serif.0, "same ink width");
}

#[test]
fn an_unregistered_face_renders_in_the_fallback_rather_than_failing() {
    // A document naming a face this binary does not have must still draw — in
    // Liberation Sans, visibly, rather than silently producing nothing. This
    // is the "opened on another machine" case in ADR-051's owed list.
    let (w, h) = (420u32, 140u32);
    let mut t = white_tool(w, h);
    let id = t.add_text_annotation(
        "Hamburgefonstiv",
        40.0,
        0,
        0,
        0,
        false,
        20,
        40,
        0.0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        "",
    );
    t.recomposite();
    let sans = ink(&t, w, h);

    assert!(t.set_text_font(id, "a-face-nobody-shipped"));
    t.recomposite();
    let missing = ink(&t, w, h);

    assert_eq!(
        sans, missing,
        "an unknown face should fall back to the embedded Liberation Sans"
    );
    assert!(!t.has_font("a-face-nobody-shipped", false));
}

#[test]
fn the_face_survives_editing_the_text() {
    // Fixing a typo must not silently reset the annotation to Liberation Sans.
    // `update_text_annotation` takes no font parameter — it preserves the one
    // already on the annotation, exactly like the wrap width and box height.
    let (w, h) = (460u32, 140u32);
    let mut t = white_tool(w, h);
    t.register_font("liberation-mono", false, &face(MONO))
        .expect("readable");

    let id = t.add_text_annotation(
        "Hamburgefonstiv",
        40.0,
        0,
        0,
        0,
        false,
        20,
        40,
        0.0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        "",
    );
    assert!(t.set_text_font(id, "liberation-mono"));
    t.recomposite();
    let before = ink(&t, w, h);
    assert_ne!(
        before,
        fallback_ink("Hamburgefonstiv", w, h, false, 20, 40),
        "mono rendered identically to the fallback, so this test could not \
         tell a preserved face from a dropped one"
    );

    // Re-commit the SAME text through the edit path.
    assert!(t.update_text_annotation(
        id,
        "Hamburgefonstiv",
        40.0,
        0,
        0,
        0,
        false,
        20,
        40,
        0.0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
    ));
    t.recomposite();
    assert_eq!(
        before,
        ink(&t, w, h),
        "editing the text dropped the typeface back to Liberation Sans"
    );
}

#[test]
fn a_duplicate_carries_the_face() {
    let (w, h) = (460u32, 220u32);
    let mut t = white_tool(w, h);
    t.register_font("liberation-serif", false, &face(SERIF))
        .expect("readable");
    let id = t.add_text_annotation(
        "Hamburgefonstiv",
        40.0,
        0,
        0,
        0,
        false,
        20,
        20,
        0.0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        "",
    );
    assert!(t.set_text_font(id, "liberation-serif"));
    t.recomposite();
    let one = ink(&t, w, h);
    assert_ne!(
        one,
        fallback_ink("Hamburgefonstiv", w, h, false, 20, 20),
        "serif rendered identically to the fallback — see fallback_ink"
    );

    let copy = t.duplicate_text_annotation(id, 0, 90);
    assert!(copy > 0, "duplicate failed");
    t.recomposite();
    let two = ink(&t, w, h);

    // The copy is 90px below, so the box grows down but keeps its WIDTH — and
    // the width is what carries the typeface. A copy rendered in Liberation
    // Sans would be a different width and widen the union.
    assert_eq!(
        one.2 - one.0,
        two.2 - two.0,
        "the duplicate rendered in a different face"
    );
    assert!(
        two.3 > one.3,
        "the duplicate did not land below the original"
    );
}

#[test]
fn bold_uses_the_family_bold_when_it_is_registered() {
    let (w, h) = (460u32, 140u32);
    let mut t = white_tool(w, h);
    t.register_font("liberation-serif", false, &face(SERIF))
        .expect("readable");
    t.register_font("liberation-serif", true, &face(SERIF_BOLD))
        .expect("readable");
    assert!(t.has_font("liberation-serif", true));

    let regular = {
        let mut t = white_tool(w, h);
        t.register_font("liberation-serif", false, &face(SERIF))
            .unwrap();
        let id = t.add_text_annotation(
            "Hamburgefonstiv",
            40.0,
            0,
            0,
            0,
            false,
            20,
            40,
            0.0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            "",
        );
        t.set_text_font(id, "liberation-serif");
        t.recomposite();
        ink(&t, w, h)
    };

    let id = t.add_text_annotation(
        "Hamburgefonstiv",
        40.0,
        0,
        0,
        0,
        true,
        20,
        40,
        0.0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        "",
    );
    assert!(t.set_text_font(id, "liberation-serif"));
    t.recomposite();
    let bold = ink(&t, w, h);

    assert_ne!(
        regular,
        fallback_ink("Hamburgefonstiv", w, h, false, 20, 40),
        "serif regular rendered identically to the fallback — see fallback_ink"
    );
    assert!(
        bold.4 > regular.4,
        "bold serif laid down no more ink than regular serif ({} vs {}) — the \
         bold weight is not being consulted",
        bold.4,
        regular.4
    );
}

#[test]
fn a_hostile_or_truncated_file_is_refused_without_taking_the_engine_down() {
    let mut t = white_tool(64, 64);
    // Not a font: a PNG header, then noise. `ab_glyph` must reject it and the
    // engine must report rather than panic across the wasm boundary.
    let mut junk = vec![0x89, 0x50, 0x4e, 0x47];
    junk.extend(std::iter::repeat_n(0xABu8, 4096));
    assert!(t.register_font("hostile", false, &junk).is_err());
    assert!(!t.has_font("hostile", false));

    // A real face truncated mid-table.
    let short = face(SERIF)[..512].to_vec();
    assert!(t.register_font("truncated", false, &short).is_err());

    // And the engine still works afterwards.
    let id = t.add_text_annotation(
        "ok", 16.0, 0, 0, 0, false, 4, 4, 0.0, 0, 0, 0, 0, 0, 0, 0, 0, "",
    );
    assert!(id > 0);
}
