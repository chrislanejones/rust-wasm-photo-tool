// Moved out of src/lib.rs verbatim (Track A, docs/AppShell-Refactor-Plan.md):
// the test module lived inside the production file. `use super::*` still
// resolves to the same module, so nothing below changed.

use super::*;

use crate::test_util::solid;

fn px(tool: &ImageHorseTool, x: u32, y: u32) -> [u8; 4] {
    let data = tool.get_image_data();
    let i = ((y * tool.width + x) * 4) as usize;
    [data[i], data[i + 1], data[i + 2], data[i + 3]]
}

#[test]
fn restore_rebuilds_stack_and_active() {
    let mut t = ImageHorseTool::new(2, 2);
    t.begin_layer_restore();
    let id0 = t.push_restored_layer(
        &solid(2, 2, [10, 20, 30, 255]),
        2,
        2,
        "Background",
        true,
        1.0,
    );
    let id1 = t.push_restored_layer(&solid(2, 2, [0, 0, 0, 0]), 2, 2, "Top", true, 0.5);
    t.finish_layer_restore(1);
    assert_eq!(t.layer_count(), 2);
    assert_eq!(t.active, 1);
    assert_ne!(id0, id1);
    // Top layer transparent → bottom color shows through.
    assert_eq!(px(&t, 0, 0), [10, 20, 30, 255]);
    // Per-layer PNG serialization is non-empty.
    assert!(!t.get_layer_png(0).is_empty());
    assert!(!t.get_layer_png(1).is_empty());
}

#[test]
fn per_layer_annotation_serialization_is_isolated() {
    let mut t = ImageHorseTool::new(16, 16);
    t.load_image(&solid(16, 16, [0, 0, 0, 255]));
    // Shape on the base layer (active = 0).
    t.add_shape_annotation(
        0, 1.0, 1.0, 5.0, 5.0, "#ff0000", 2.0, 0, 0, "#000000", "#000000", 0, 0, 0,
    );
    // New empty top layer.
    t.add_layer("top");
    let s0 = t.get_layer_shape_annotations(0);
    let s1 = t.get_layer_shape_annotations(1);
    assert!(
        s0.contains("\"kind\":0"),
        "base layer should carry the shape: {s0}"
    );
    assert_eq!(s1, "[]", "top layer should have no shapes");
}

/// A layer mask is one byte per CANVAS pixel, so a resample has to carry it
/// too. `render_layer` skips a mask whose length no longer matches the
/// canvas, so before this was fixed a resize silently switched masking off
/// — no crash, no warning, the layer just stopped being masked.
#[test]
fn resize_resamples_the_layer_mask_to_the_new_canvas() {
    let mut t = ImageHorseTool::new(20, 20);
    t.load_image(&solid(20, 20, [255, 255, 255, 255]));
    let id = t.layers[t.active].id;
    assert!(t.add_layer_mask(id));
    // Make the mask non-uniform so a real resample is observable.
    if let Some(m) = t.layers[t.active].mask.as_mut() {
        for (i, v) in m.iter_mut().enumerate() {
            *v = if i % 20 < 10 { 0 } else { 255 };
        }
    }

    t.resize_with_filter(10, 10, 1);

    let mask = t.layers[t.active]
        .mask
        .as_ref()
        .expect("mask must survive the resize"); // allow: rust-panic — test assertion, panicking IS the failure mode
    assert_eq!(
        mask.len(),
        10 * 10,
        "mask must match the new canvas or render_layer silently drops it"
    );
    // The left half was hidden and the right revealed; that must still hold.
    assert!(mask[0] < 64, "left edge still hidden, got {}", mask[0]);
    assert!(mask[9] > 192, "right edge still revealed, got {}", mask[9]);
}

/// Pen/polyline paths keep their vertices in `points`, which is a separate
/// list from the bbox — scaling only the bbox would leave the drawn path
/// behind.
#[test]
fn resize_scales_pen_path_points_not_just_the_bbox() {
    let mut t = ImageHorseTool::new(200, 200);
    t.load_image(&solid(200, 200, [255, 255, 255, 255]));
    t.add_shape_annotation(
        6, 20.0, 40.0, 60.0, 80.0, "#000000", 2.0, 0, 0, "#000000", "#000000", 0, 0, 0,
    );
    t.layers[t.active].shape_annotations[0].points = vec![(20.0, 40.0), (60.0, 80.0)];

    t.resize_with_filter(100, 100, 1);

    let pts = &t.layers[t.active].shape_annotations[0].points;
    assert_eq!(pts[0], (10.0, 20.0), "first vertex");
    assert_eq!(pts[1], (30.0, 40.0), "second vertex");
}

#[test]
fn translate_active_layer_shifts_pixels_and_records_one_step() {
    let mut t = ImageHorseTool::new(4, 4);
    // Paint a single opaque red pixel at (1,1) on the background layer.
    {
        let buf = &mut t.layers[t.active].buf.data;
        let i = ((4 + 1) * 4) as usize;
        buf[i] = 255;
        buf[i + 3] = 255;
    }
    let undo_before = t.undo_count();
    t.translate_active_layer(1, 2); // → should land at (2,3)
    let buf = &t.layers[t.active].buf.data;
    let src = ((4 + 1) * 4) as usize;
    let dst = ((3 * 4 + 2) * 4) as usize;
    assert_eq!(buf[src + 3], 0, "original pixel cleared (now transparent)");
    assert_eq!(buf[dst], 255, "red moved to the shifted position");
    assert_eq!(buf[dst + 3], 255, "alpha moved with it");
    assert_eq!(
        t.undo_count(),
        undo_before + 1,
        "one Move Layer history step"
    );
}

#[test]
fn crop_offsets_text_and_shape_annotations() {
    let mut t = ImageHorseTool::new(20, 20);
    t.load_image(&solid(20, 20, [10, 20, 30, 255]));
    t.add_text_annotation(
        "hi", 12.0, 255, 255, 255, false, 15, 12, 0.0, 0, 0, 0, 0, 0, 0, 0, 0, "",
    );
    t.add_shape_annotation(
        1, 5.0, 5.0, 8.0, 8.0, "#ff0000", 2.0, 0, 0, "#000000", "#000000", 0, 0, 0,
    );
    // Crop a 10x10 rect starting at (5,5) — annotations must shift by
    // (-5,-5) to stay anchored to the same photo content, matching the
    // Move tool / resize_canvas offset pattern.
    t.crop(5, 5, 10, 10);
    let layer = &t.layers[t.active];
    assert_eq!(
        layer.text_annotations[0].x, 10,
        "text.x follows the crop origin"
    );
    assert_eq!(
        layer.text_annotations[0].y, 7,
        "text.y follows the crop origin"
    );
    let shape = &layer.shape_annotations[0];
    assert_eq!(
        (shape.x0, shape.y0, shape.x1, shape.y1),
        (0.0, 0.0, 3.0, 3.0)
    );
}

#[test]
fn translate_active_layer_zero_delta_is_a_noop() {
    let mut t = ImageHorseTool::new(4, 4);
    let undo_before = t.undo_count();
    t.set_move_preview(3, 3);
    t.translate_active_layer(0, 0); // clears preview, records nothing
    assert_eq!(t.undo_count(), undo_before, "zero move adds no history");
    assert!(t.move_preview.is_none(), "preview cleared");
}

#[test]
fn paste_preview_renders_live_without_touching_the_layer_buffer() {
    let mut t = ImageHorseTool::new(4, 4);
    t.load_image(&solid(4, 4, [0, 0, 0, 255]));
    t.begin_paste_preview(&solid(2, 2, [255, 255, 255, 255]), 2, 2, 0, 0, 2, 2);
    // The stored layer buffer is untouched — get_image_data() recomposites
    // straight from `layers`, bypassing the preview entirely.
    assert_eq!(px(&t, 0, 0), [0, 0, 0, 255], "layer buffer not baked yet");
    // recomposite() is what JS calls before each blit — it overlays the
    // live preview onto composite_cache without touching `layers`.
    t.recomposite();
    let i = 0usize; // (0,0) in the flattened composite
    assert_eq!(
        &t.composite_cache[i..i + 4],
        &[255u8, 255, 255, 255][..],
        "recomposite() renders the pending placement"
    );
    assert_eq!(
        t.layers[t.active].buf.data[0..4],
        [0, 0, 0, 255],
        "layer buffer still untouched after recomposite"
    );
}

#[test]
fn commit_paste_preview_bakes_active_layer_and_records_one_step() {
    let mut t = ImageHorseTool::new(4, 4);
    t.load_image(&solid(4, 4, [0, 0, 0, 255]));
    // Placement preview doesn't touch the layer buffer yet.
    t.begin_paste_preview(&solid(2, 2, [255, 255, 255, 255]), 2, 2, 0, 0, 2, 2);
    assert_eq!(
        px(&t, 0, 0),
        [0, 0, 0, 255],
        "preview is render-only, not baked"
    );
    let undo_before = t.undo_count();
    // Resize the placement to 4x4 (upscaling the 2x2 source) before commit.
    t.set_paste_preview_rect(0, 0, 4, 4);
    t.commit_paste_preview(0); // nearest, so the corners stay pure white
    assert_eq!(
        px(&t, 0, 0),
        [255, 255, 255, 255],
        "baked at the resized rect"
    );
    assert_eq!(px(&t, 3, 3), [255, 255, 255, 255]);
    assert_eq!(t.undo_count(), undo_before + 1, "one Paste history step");
    assert!(t.paste_preview.is_none(), "preview cleared after commit");
}

#[test]
fn cancel_paste_preview_discards_without_history() {
    let mut t = ImageHorseTool::new(4, 4);
    t.load_image(&solid(4, 4, [0, 0, 0, 255]));
    t.begin_paste_preview(&solid(2, 2, [255, 255, 255, 255]), 2, 2, 0, 0, 2, 2);
    let undo_before = t.undo_count();
    t.cancel_paste_preview();
    assert!(t.paste_preview.is_none());
    assert_eq!(t.undo_count(), undo_before, "cancel adds no history");
    assert_eq!(px(&t, 0, 0), [0, 0, 0, 255], "layer buffer untouched");
}

// 20x20 so a shrunk dest rect (10x10) stays above `PASTE_MIN_SIZE` (10)
// while still leaving pixels outside it to prove the original isn't
// doubled/left stale there.
#[test]
fn layer_resize_preview_hides_original_without_touching_the_buffer() {
    let mut t = ImageHorseTool::new(20, 20);
    t.load_image(&solid(20, 20, [10, 20, 30, 255]));
    t.begin_layer_resize_preview();
    assert_eq!(
        px(&t, 0, 0),
        [10, 20, 30, 255],
        "layer buffer untouched before recomposite"
    );
    t.set_paste_preview_rect(0, 0, 10, 10);
    t.recomposite();
    // Check `composite_cache` directly (what `recomposite` actually
    // renders) — `get_image_data()`/`px()` recomposite straight from
    // `layers`, bypassing `paste_preview` entirely, so they'd show the
    // stored (untouched) buffer either way and couldn't catch a doubling
    // bug here.
    assert_eq!(
        &t.composite_cache[0..4],
        &[10u8, 20, 30, 255][..],
        "preview itself renders inside the shrunk rect"
    );
    let corner = ((19 * 20 + 19) * 4) as usize;
    assert_eq!(
        &t.composite_cache[corner..corner + 4],
        &[0u8, 0, 0, 0][..],
        "original hidden (not doubled) outside the shrunk preview rect"
    );
    assert_eq!(
        t.layers[t.active].buf.data[0..4],
        [10, 20, 30, 255],
        "layer buffer still untouched after recomposite"
    );
}

#[test]
fn commit_layer_resize_preview_replaces_buffer_and_records_one_step() {
    let mut t = ImageHorseTool::new(20, 20);
    t.load_image(&solid(20, 20, [10, 20, 30, 255]));
    t.begin_layer_resize_preview();
    let undo_before = t.undo_count();
    // Shrink the layer's own content down to the top-left 10x10 quadrant.
    t.set_paste_preview_rect(0, 0, 10, 10);
    t.commit_paste_preview(0); // nearest
    assert_eq!(
        px(&t, 0, 0),
        [10, 20, 30, 255],
        "content kept in the shrunk rect"
    );
    assert_eq!(
        px(&t, 19, 19),
        [0, 0, 0, 0],
        "rest of the layer is now transparent, not the stale original"
    );
    assert_eq!(
        t.undo_count(),
        undo_before + 1,
        "one Resize Layer history step"
    );
    assert!(t.paste_preview.is_none(), "preview cleared after commit");
}

#[test]
fn cancel_layer_resize_preview_leaves_original_content_intact() {
    let mut t = ImageHorseTool::new(20, 20);
    t.load_image(&solid(20, 20, [10, 20, 30, 255]));
    t.begin_layer_resize_preview();
    t.set_paste_preview_rect(0, 0, 10, 10);
    t.cancel_paste_preview();
    assert!(t.paste_preview.is_none());
    assert_eq!(
        px(&t, 19, 19),
        [10, 20, 30, 255],
        "cancel restores the original full-size content (buffer was never touched)"
    );
}

#[test]
fn set_paste_preview_rect_is_noop_without_begin() {
    let mut t = ImageHorseTool::new(4, 4);
    assert!(!t.has_paste_preview());
    t.set_paste_preview_rect(1, 1, 3, 3); // no preview to update — safe no-op
    assert!(!t.has_paste_preview());
}

// v8.37 — the box must hug the CONTENT, and the caller must be told where
// that is. The old seeding gave three different answers at open (engine:
// full canvas; JS overlay: 8%-inset cosmetic rect; content: neither), and
// a 2 px handle nudge snapped the layer 26 px inward per edge on a
// 420×320 doc because the first set_paste_preview_rect was the first time
// the engine heard the overlay's rect.
#[test]
fn layer_resize_preview_seeds_at_content_bounds_and_returns_them() {
    let mut t = ImageHorseTool::new(20, 20);
    // Transparent buffer with an opaque 6×4 block at (3, 5).
    let mut px_data = solid(20, 20, [0, 0, 0, 0]);
    for y in 5..9 {
        for x in 3..9 {
            let o = (y * 20 + x) * 4;
            px_data[o..o + 4].copy_from_slice(&[200, 100, 50, 255]);
        }
    }
    t.load_image(&px_data);
    let rect = t.begin_layer_resize_preview();
    assert_eq!(rect, vec![3, 5, 6, 4], "returned rect = content bounds");
    let p = t.paste_preview.as_ref().unwrap(); // allow: rust-panic
    assert_eq!(
        (p.dest_x, p.dest_y, p.dest_w, p.dest_h),
        (3, 5, 6, 4),
        "engine preview rect = the SAME rect the caller was told"
    );
    assert_eq!(
        (p.src_w, p.src_h),
        (6, 4),
        "snapshot is the cropped content, not the padded buffer"
    );
    assert_eq!(
        &p.pixels[0..4],
        &[200, 100, 50, 255],
        "snapshot starts at the content's own top-left pixel"
    );
    // Commit at a moved rect: content lands there, everywhere else clear.
    t.set_paste_preview_rect(10, 10, 6, 4);
    t.commit_paste_preview(0);
    assert_eq!(px(&t, 10, 10), [200, 100, 50, 255], "content at new rect");
    assert_eq!(px(&t, 3, 5), [0, 0, 0, 0], "old location cleared");
}

#[test]
fn layer_resize_preview_noops_on_a_fully_transparent_layer() {
    let mut t = ImageHorseTool::new(8, 8);
    t.load_image(&solid(8, 8, [0, 0, 0, 0]));
    assert_eq!(t.begin_layer_resize_preview(), Vec::<i32>::new());
    assert!(!t.has_paste_preview(), "nothing to resize — no preview");
}

#[test]
fn restore_text_annotation_attaches_to_active_layer() {
    let mut t = ImageHorseTool::new(32, 32);
    t.begin_layer_restore();
    t.push_restored_layer(
        &solid(32, 32, [255, 255, 255, 255]),
        32,
        32,
        "bg",
        true,
        1.0,
    );
    t.restore_text_annotation(
        "hi",
        16.0,
        0,
        0,
        0,
        false,
        2,
        2,
        0.0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        // shadow params (box, text, r, g, b, a, dx, dy, blur)
        false,
        false,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        "",
        // font_id, then the box axes and the quad (ADR-060). An empty
        // slice is the "no quad recorded" case every pre-v8.81 archive
        // hits.
        0,
        0,
        &[],
    );
    t.finish_layer_restore(0);
    let json = t.get_layer_text_annotations(0);
    assert!(json.contains("\"text\":\"hi\""), "got {json}");
    // No history pushed by the restore path.
    assert_eq!(t.undo_count(), 0);
}

// ── ADR-031: export quality rides the Snapshot ──────────────────────────
//
// The bug these pin: a quality-only Apply pushed a "Compress" step, but
// snap() captures pixels and a quality-only apply changes none, so undo
// consumed a step and reversed nothing.

#[test]
fn export_quality_defaults_to_the_ui_default() {
    // Two defaults that disagree would show one value and hold another.
    let t = ImageHorseTool::new(8, 8);
    assert_eq!(
        t.export_quality(),
        75,
        "must match useToolStore quality: 75"
    );
}

#[test]
fn undo_restores_the_previous_export_quality() {
    let mut t = ImageHorseTool::new(8, 8);
    assert_eq!(t.export_quality(), 75);

    t.push_compress_marker(40);
    assert_eq!(t.export_quality(), 40, "apply takes effect");

    t.undo();
    assert_eq!(t.export_quality(), 75, "undo returns the OUTGOING quality");
}

#[test]
fn redo_restores_the_applied_export_quality() {
    let mut t = ImageHorseTool::new(8, 8);
    t.push_compress_marker(40);
    t.undo();
    assert_eq!(t.export_quality(), 75);

    t.redo();
    assert_eq!(t.export_quality(), 40, "redo puts the applied value back");
}

#[test]
fn a_quality_only_apply_is_exactly_one_history_step() {
    // Not zero (the change would be unundoable) and not two (one Apply is
    // one step the user can reason about).
    let mut t = ImageHorseTool::new(8, 8);
    let before = t.undo_count();
    t.push_compress_marker(40);
    assert_eq!(t.undo_count(), before + 1);
}

#[test]
fn dragging_the_slider_records_no_history() {
    // The live drag goes through set_export_quality; only Apply records.
    // Otherwise one drag would be dozens of undo steps.
    let mut t = ImageHorseTool::new(8, 8);
    let before = t.undo_count();
    for q in [10u8, 20, 30, 40, 50] {
        t.set_export_quality(q);
    }
    assert_eq!(t.export_quality(), 50, "the drag still takes effect");
    assert_eq!(t.undo_count(), before, "but records nothing");
}

#[test]
fn out_of_range_quality_is_clamped_not_panicking() {
    // This crosses the wasm boundary; a panic there is unrecoverable.
    let mut t = ImageHorseTool::new(8, 8);
    t.set_export_quality(0);
    assert_eq!(t.export_quality(), 1);
    t.set_export_quality(255);
    assert_eq!(t.export_quality(), 100);
    t.push_compress_marker(0);
    assert_eq!(t.export_quality(), 1);
}

#[test]
fn a_pixel_edit_also_carries_the_quality_live_at_the_time() {
    // Every snapshot captures it, not just compress ones — so undoing a
    // brush stroke restores the quality that was live when it was made.
    let mut t = ImageHorseTool::new(8, 8);
    t.push_compress_marker(30);
    assert_eq!(t.export_quality(), 30);

    t.adjust_brightness(0.1); // any snapping pixel edit
    t.set_export_quality(90); // a later drag, never applied
    t.undo(); // undoes the brightness step
    assert_eq!(
        t.export_quality(),
        30,
        "the snapshot's quality wins over an unapplied drag"
    );
}

#[test]
fn committing_quality_without_applying_is_one_undoable_step() {
    // The slider's pointer-up path: a quality change is undoable on its
    // own, without applying compression.
    let mut t = ImageHorseTool::new(8, 8);
    let before = t.undo_count();
    t.commit_export_quality(40);
    assert_eq!(t.undo_count(), before + 1, "exactly one step");
    assert_eq!(t.export_quality(), 40);
    t.undo();
    assert_eq!(t.export_quality(), 75, "undo returns the outgoing value");
    t.redo();
    assert_eq!(t.export_quality(), 40);
}

#[test]
fn a_commit_that_changes_nothing_records_nothing() {
    // Pointer-up fires even when the handle never moved. A history full of
    // steps that change nothing is the same defect ADR-031 removed, at the
    // other end.
    let mut t = ImageHorseTool::new(8, 8);
    let before = t.undo_count();
    t.commit_export_quality(75); // already 75
    assert_eq!(t.undo_count(), before, "no-op records no step");
    t.commit_export_quality(40);
    t.commit_export_quality(40); // same again
    assert_eq!(t.undo_count(), before + 1, "still just the one real change");
}

#[test]
fn each_slider_release_is_its_own_step() {
    // Three drags, three steps, walking back one at a time.
    let mut t = ImageHorseTool::new(8, 8);
    t.commit_export_quality(60);
    t.commit_export_quality(45);
    t.commit_export_quality(30);
    assert_eq!(t.export_quality(), 30);
    t.undo();
    assert_eq!(t.export_quality(), 45);
    t.undo();
    assert_eq!(t.export_quality(), 60);
    t.undo();
    assert_eq!(t.export_quality(), 75);
}
