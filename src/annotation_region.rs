//! Experimental explicit-damage compositor, not a general invalidation system.
//!
//! The caller MUST supply the union of the old and new ink bounds of every
//! change since the last composite. Pixel/layer/document changes and unknown
//! damage require a full recomposite. This API is absent from normal builds.
//! A persistent full-canvas scratch buffer preserves the rasterizers' absolute
//! coordinates (cropping/rebasing changes rounding and patterned fills).
//! Only damaged rows are restored/copied; intersecting objects are rerasterized
//! in original stacking order. It trades one RGBA canvas of memory for avoiding
//! full-frame copies. A future clipped raster API could shrink this scratch.

use crate::{annotations::render_shape_into, ImageHorseTool};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct AnnotationRegionPrototype {
    scratch: Vec<u8>,
    width: u32,
    height: u32,
}

#[wasm_bindgen]
impl AnnotationRegionPrototype {
    /// Establish a full, correct cache and allocate scratch once. Recreate this
    /// object after resizing; render() falls back if the dimensions differ.
    #[wasm_bindgen(constructor)]
    pub fn new(tool: &mut ImageHorseTool) -> Self {
        tool.recomposite();
        Self {
            scratch: vec![0; tool.composite_cache.len()],
            width: tool.width,
            height: tool.height,
        }
    }

    /// Recompose [left, right) × [top, bottom), clipping to the canvas.
    /// Returns true for the regional path, false for a full-frame fallback.
    ///
    /// Bounds are an explicit caller contract, NOT inferred from changes.
    /// Include both old and new ink, including stroke/shadow extents. A caller
    /// unable to prove the damage rectangle must call tool.recomposite().
    pub fn render(
        &mut self,
        tool: &mut ImageHorseTool,
        left: i32,
        top: i32,
        right: i32,
        bottom: i32,
    ) -> bool {
        let x0 = left.max(0) as usize;
        let y0 = top.max(0) as usize;
        let x1 = right.max(0).min(tool.width as i32) as usize;
        let y1 = bottom.max(0).min(tool.height as i32) as usize;
        if !self.supports(tool) || x0 >= x1 || y0 >= y1 {
            tool.recomposite();
            return false;
        }
        let layer = &tool.layers[0];
        let stride = tool.width as usize * 4;
        for y in y0..y1 {
            let row = y * stride + x0 * 4..y * stride + x1 * 4;
            self.scratch[row.clone()].copy_from_slice(&layer.buf.data[row]);
        }
        for s in &layer.shape_annotations {
            if tool.editing_shape_id == Some(s.id) {
                continue;
            }
            // Pins have text with a minimum font size: a tiny disc's label can
            // exceed its bbox. Render all pins until we have exact ink bounds.
            let pad = s.stroke_width.max(1.0) * 0.5
                + 2.0
                + if s.kind == 4 {
                    20.0f64.max(s.stroke_width * 3.0)
                } else {
                    0.0
                };
            if s.kind != 5
                && (s.x0.min(s.x1) - pad >= x1 as f64
                    || s.x0.max(s.x1) + pad <= x0 as f64
                    || s.y0.min(s.y1) - pad >= y1 as f64
                    || s.y0.max(s.y1) + pad <= y0 as f64)
            {
                continue;
            }
            render_shape_into(&mut self.scratch, tool.width, tool.height, s);
        }
        for a in &layer.text_annotations {
            let tx = i64::from(a.x) + i64::from(a.tile_offset_x);
            let ty = i64::from(a.y) + i64::from(a.tile_offset_y);
            if tool.editing_text_id == Some(a.id)
                || tx >= x1 as i64
                || ty >= y1 as i64
                || tx + i64::from(a.tile_w) <= x0 as i64
                || ty + i64::from(a.tile_h) <= y0 as i64
            {
                continue;
            }
            crate::transform::paste_region(
                &mut self.scratch,
                tool.width as i32,
                tool.height as i32,
                a.tile_pixels.as_ref(),
                a.tile_w,
                a.tile_h,
                tx as i32,
                ty as i32,
            );
        }
        for y in y0..y1 {
            let row = y * stride + x0 * 4..y * stride + x1 * 4;
            tool.composite_cache[row.clone()].copy_from_slice(&self.scratch[row]);
        }
        // Same recording choke point as recomposite; partial rendering must
        // not silently omit the annotation edit from the operation log.
        #[cfg(feature = "tiles")]
        {
            tool.oplog_rebase_stale_empty();
            tool.oplog_sync_annotations();
            tool.oplog_sync_canvas();
        }
        true
    }
}

impl AnnotationRegionPrototype {
    fn supports(&self, tool: &ImageHorseTool) -> bool {
        if self.width != tool.width
            || self.height != tool.height
            || self.scratch.len() != tool.composite_cache.len()
            || tool.layers.len() != 1
            || tool.move_preview.is_some()
            || tool.paste_preview.is_some()
        {
            return false;
        }
        let layer = &tool.layers[0];
        layer.visible && layer.opacity == 1.0
            && layer.mask.is_none() && layer.overlay.is_none()
            && layer.buf.data.len() == self.scratch.len()
            // Conservative and measurable O(pixels) eligibility cost. Do not
            // cache this property until pixel mutations have invalidation.
            && layer.buf.data.chunks_exact(4).all(|p| p[3] == 255)
            && layer.shape_annotations.iter().all(|s| {
                matches!(s.kind, 0 | 1 | 2 | 4 | 5)
                    && s.fill_kind <= 1 && s.sloppiness == 0
                    && s.rotation_deg == 0.0 && s.points.is_empty()
                    && crate::perspective::is_identity(&s.perspective.0)
                    && [s.x0, s.y0, s.x1, s.y1, s.stroke_width].iter().all(|v| v.is_finite())
            })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> ImageHorseTool {
        let mut tool = ImageHorseTool::new(160, 120);
        let mut pixels = vec![255; 160 * 120 * 4];
        for (i, p) in pixels.chunks_exact_mut(4).enumerate() {
            p[0] = (i % 251) as u8;
            p[1] = (i / 160) as u8;
        }
        tool.load_image(&pixels);
        // Restore accepts explicit alpha; the CSS-style add API reads RGB
        // only. This fixture must genuinely exercise translucent blending.
        tool.restore_shape_annotation(
            0, 10.25, 15.5, 70.25, 65.5, 255, 17, 34, 5.0, 0, 1, 68, 85, 102, 136, 0, 0, 0, 0, 0,
            8, 0,
        );
        tool.add_shape_annotation(
            4, -8.5, 5.25, 100.5, 90.25, "#2277aa", 3.0, 1, 0, "#000000", "#000000", 0, 8, 0,
        );
        tool.add_pin_annotation(40.0, 30.0, 80.0, 70.0, 123, "#ffaa00", 0);
        tool.add_text_annotation(
            "Overlap", 18.0, 20, 30, 40, false, 25, 25, 0.0, 0, 0, 0, 0, 0, 0, 0, 0, "",
        );
        assert_eq!(tool.layers[0].shape_annotations[0].fill_a, 136);
        tool
    }

    fn parity(tool: &mut ImageHorseTool) {
        let actual = tool.composite_cache.clone();
        tool.recomposite();
        assert_eq!(actual, tool.composite_cache);
    }

    #[test]
    fn moving_overlapping_fractional_shapes_preserves_pixels_and_scratch() {
        let mut tool = fixture();
        let mut renderer = AnnotationRegionPrototype::new(&mut tool);
        let ptr = renderer.scratch.as_ptr();
        for dx in [4.0, -13.0, 80.0, -90.0, 25.0] {
            let s = &mut tool.layers[0].shape_annotations[0];
            let old = (s.x0, s.x1);
            s.x0 += dx;
            s.x1 += dx;
            let left = (old.0.min(s.x0) - 6.0).floor() as i32;
            let right = (old.1.max(s.x1) + 6.0).ceil() as i32;
            assert!(renderer.render(&mut tool, left, 9, right, 72));
            parity(&mut tool);
            assert_eq!(ptr, renderer.scratch.as_ptr());
        }
    }

    #[test]
    fn deletion_hiding_text_shadow_and_undo_restore_old_ink() {
        let mut tool = fixture();
        let text_id = tool.layers[0].text_annotations[0].id;
        tool.set_text_shadow(text_id, false, true, "#000000", 180, 8, 6, 4);
        let mut renderer = AnnotationRegionPrototype::new(&mut tool);
        let id = tool.layers[0].shape_annotations[0].id;
        tool.remove_shape_annotation(id);
        assert!(renderer.render(&mut tool, 3, 8, 77, 73));
        parity(&mut tool);
        tool.undo();
        assert!(renderer.render(&mut tool, 3, 8, 77, 73));
        parity(&mut tool);
        tool.set_editing_text(text_id as i32);
        assert!(renderer.render(&mut tool, 0, 0, 160, 120));
        parity(&mut tool);
    }

    #[test]
    fn unsupported_styles_and_layers_fall_back_to_full() {
        let mut tool = fixture();
        let mut renderer = AnnotationRegionPrototype::new(&mut tool);
        for fill in [2, 3] {
            tool.layers[0].shape_annotations[0].fill_kind = fill;
            assert!(!renderer.render(&mut tool, 5, 5, 20, 20));
            parity(&mut tool);
        }
        tool.layers[0].shape_annotations[0].fill_kind = 0;
        tool.layers[0].opacity = 0.5;
        assert!(!renderer.render(&mut tool, 5, 5, 20, 20));
        parity(&mut tool);
        tool.layers[0].opacity = 1.0;
        tool.layers[0].buf.data[3] = 0;
        assert!(!renderer.render(&mut tool, 5, 5, 20, 20));
        parity(&mut tool);
        tool.add_layer("second");
        assert!(!renderer.render(&mut tool, 5, 5, 20, 20));
        parity(&mut tool);
    }

    #[test]
    fn invalid_bounds_and_preview_fall_back() {
        let mut tool = fixture();
        let mut renderer = AnnotationRegionPrototype::new(&mut tool);
        assert!(!renderer.render(&mut tool, 80, 80, 20, 20));
        assert!(!renderer.render(&mut tool, -50, -50, -10, -10));
        tool.set_move_preview(20, 10);
        assert!(!renderer.render(&mut tool, 5, 5, 20, 20));
        parity(&mut tool);
    }

    #[test]
    fn moving_shadowed_text_uses_old_and_new_cached_ink_bounds() {
        let mut tool = fixture();
        let text_id = tool.layers[0].text_annotations[0].id;
        tool.set_text_shadow(text_id, false, true, "#000000", 180, -8, 6, 4);
        let mut renderer = AnnotationRegionPrototype::new(&mut tool);
        for dx in [-40, 25, 60] {
            let a = &mut tool.layers[0].text_annotations[0];
            let old_x = a.x + a.tile_offset_x;
            a.x += dx;
            let new_x = a.x + a.tile_offset_x;
            let y = a.y + a.tile_offset_y;
            let right = old_x.max(new_x) + a.tile_w as i32;
            let bottom = y + a.tile_h as i32;
            assert!(renderer.render(&mut tool, old_x.min(new_x), y, right, bottom));
            parity(&mut tool);
        }
    }

    #[test]
    fn masks_rotation_perspective_and_resize_fall_back() {
        let mut tool = fixture();
        let mut renderer = AnnotationRegionPrototype::new(&mut tool);
        tool.layers[0].mask = Some(vec![128; 160 * 120]);
        assert!(!renderer.render(&mut tool, 0, 0, 20, 20));
        parity(&mut tool);
        tool.layers[0].mask = None;
        tool.layers[0].shape_annotations[0].rotation_deg = 30.0;
        assert!(!renderer.render(&mut tool, 0, 0, 20, 20));
        parity(&mut tool);
        tool.layers[0].shape_annotations[0].rotation_deg = 0.0;
        tool.layers[0].shape_annotations[0].perspective.0[0] = (0.2, 0.1);
        assert!(!renderer.render(&mut tool, 0, 0, 20, 20));
        parity(&mut tool);
        tool.resize(200, 150);
        assert!(!renderer.render(&mut tool, 0, 0, 20, 20));
        parity(&mut tool);
    }

    #[test]
    #[cfg(feature = "tiles")]
    fn regional_edit_records_the_same_op_as_full_recomposition() {
        let mut full = fixture();
        let mut dirty = fixture();
        full.recomposite();
        let mut renderer = AnnotationRegionPrototype::new(&mut dirty);
        let before = dirty.oplog_op_count();
        for tool in [&mut full, &mut dirty] {
            let id = tool.layers[0].shape_annotations[0].id;
            tool.update_shape_annotation(
                id,
                0,
                14.25,
                15.5,
                74.25,
                65.5,
                "#ff1122",
                5.0,
                0,
                1,
                "#44556688",
                "#000000",
                0,
                8,
                0,
            );
        }
        full.recomposite();
        assert!(renderer.render(&mut dirty, 3, 8, 81, 73));
        assert_eq!(dirty.composite_cache, full.composite_cache);
        assert!(dirty.oplog_op_count() > before);
        assert_eq!(dirty.oplog_op_count(), full.oplog_op_count());
        dirty.undo();
        full.undo();
        assert!(renderer.render(&mut dirty, 3, 8, 81, 73));
        full.recomposite();
        assert_eq!(dirty.composite_cache, full.composite_cache);
    }
}
