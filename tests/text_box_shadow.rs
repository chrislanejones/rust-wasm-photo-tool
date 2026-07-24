//! Does the text-annotation BACKGROUND BOX cast a drop shadow at the engine
//! level? Bug report: "drop shadow in text → bg not working." This drives the
//! exact public path the UI uses — add_text_annotation (with a background) then
//! set_text_shadow(on_box=true) — and checks the composite for shadow pixels.

use stamp_tool::ImageHorseTool;

#[test]
fn background_box_casts_a_visible_drop_shadow() {
    let (w, h) = (200u32, 120u32);
    let mut t = ImageHorseTool::new(w, h);
    // White base so a coloured shadow stands out.
    let base = vec![255u8; (w * h * 4) as usize];
    t.load_image(&base);
    t.recomposite();

    // Opaque GREEN rect background box; text black. (bg args: kind=1 rect,
    // r,g,b,a, padding, corner_radius, tail)
    let id = t.add_text_annotation(
        "Hi", 32.0, 0, 0, 0, false, 40, 40, 0.0, 1, 0, 200, 0, 255, 10, 6, 0,
    );

    // Box shadow only, RED, fully opaque, offset +14/+14 so it clears the box.
    let changed = t.set_text_shadow(id, true, false, "#ff0000", 255, 14, 14, 2);
    assert!(changed, "set_text_shadow reported no change");
    t.recomposite();

    let px = t.get_image_data();
    let at = |x: u32, y: u32| {
        let i = ((y * w + x) * 4) as usize;
        (px[i], px[i + 1], px[i + 2])
    };

    // Count RED (shadow) and GREEN (box) pixels across the composite.
    let mut red = 0u32;
    let mut green = 0u32;
    for y in 0..h {
        for x in 0..w {
            let (r, g, b) = at(x, y);
            if r > 150 && g < 100 && b < 100 {
                red += 1;
            }
            if g > 120 && r < 120 && b < 120 {
                green += 1;
            }
        }
    }
    println!("composite: red(shadow)={red}  green(box)={green}");
    assert!(green > 0, "the green background box didn't render at all");
    assert!(
        red > 0,
        "NO red shadow pixels — the background box casts no drop shadow (bug reproduced in the engine)"
    );
}

#[test]
fn box_shadow_with_no_background_falls_back_to_the_text_silhouette() {
    // The reported bug: pick "Box" shadow with Background = None → nothing.
    // With no box, "Box" must fall back to casting from the glyphs.
    let (w, h) = (200u32, 120u32);
    let mut t = ImageHorseTool::new(w, h);
    t.load_image(&vec![255u8; (w * h * 4) as usize]);
    t.recomposite();

    // background_kind = 0 (None); black text.
    let id = t.add_text_annotation(
        "Hi", 40.0, 0, 0, 0, false, 40, 40, 0.0, 0, 0, 0, 0, 0, 0, 0, 0,
    );
    // shadow_box = true, shadow_text = FALSE — the exact "Box, no background" case.
    assert!(t.set_text_shadow(id, true, false, "#ff0000", 255, 14, 14, 2));
    t.recomposite();

    let px = t.get_image_data();
    let mut red = 0u32;
    for p in px.chunks_exact(4) {
        if p[0] > 150 && p[1] < 100 && p[2] < 100 {
            red += 1;
        }
    }
    println!("no-bg box shadow: red(shadow)={red}");
    assert!(
        red > 0,
        "'Box' shadow with no background produced NO shadow — should fall back to the text silhouette"
    );
}
