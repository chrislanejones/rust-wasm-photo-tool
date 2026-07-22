//! Regression: `remove_object` used to no-op silently on a cold composite
//! cache, returning the same `false` it returns for "nothing selected".
//!
//! In the browser the path was unreachable — JS calls `recomposite()` before
//! every blit, so the cache is warm long before a user can brush. That is
//! exactly why it survived: it only ever fired for headless callers, where it
//! looked like a wiring bug and cost a diagnostic session chasing one.
//!
//! Exercises `patchmatch`-gated engine methods, so the whole file compiles
//! away without the feature — `cargo test --features patchmatch`.
#![cfg(feature = "patchmatch")]

use stamp_tool::ImageHorseTool;

const W: u32 = 64;
const H: u32 = 48;

fn flat_image() -> Vec<u8> {
    let mut v = vec![0u8; (W * H * 4) as usize];
    for px in v.chunks_exact_mut(4) {
        px.copy_from_slice(&[90, 140, 200, 255]);
    }
    // A dark blob to remove, so the selection has something to be about.
    for y in 18..30 {
        for x in 24..40 {
            let i = ((y * W + x) * 4) as usize;
            v[i..i + 4].copy_from_slice(&[20, 20, 24, 255]);
        }
    }
    v
}

fn brush_the_blob(t: &mut ImageHorseTool) {
    t.magic_eraser_brush_down(24.0, 24.0, 16.0, 1.0, "off");
    let mut x = 24.0;
    while x <= 40.0 {
        t.magic_eraser_brush_move(x, 24.0);
        x += 2.0;
    }
    assert!(t.magic_eraser_brush_up(), "the stroke marked nothing");
}

#[test]
fn remove_object_warms_a_cold_composite_cache_instead_of_refusing() {
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&flat_image());
    // Deliberately NO `recomposite()` — this is the cold path.
    brush_the_blob(&mut t);

    assert!(
        t.remove_object(),
        "remove_object refused on a cold composite cache — the silent no-op is back"
    );

    let png = t.export_png();
    let out = stamp_tool::decode_png_to_rgba(&png)
        .expect("engine's own PNG should decode")
        .rgba;
    let centre = ((24 * W + 32) * 4) as usize;
    assert!(
        out[centre] > 60 && out[centre + 2] > 120,
        "blob still present after a cold-cache removal: {:?}",
        &out[centre..centre + 3]
    );
}

#[test]
fn remove_object_still_refuses_when_nothing_is_selected() {
    let mut t = ImageHorseTool::new(W, H);
    t.load_image(&flat_image());
    t.recomposite();
    assert!(
        !t.remove_object(),
        "an empty selection must still be a no-op — the fix must not make \
         remove_object succeed unconditionally"
    );
}
