//! ADR-024 Stage 3.5 — the one-round-trip state capture.
//!
//! WHY THIS EXISTS. The save path reads ~18 separate values out of the engine to
//! build one archive: the canvas PNG, its dimensions, every undo and redo
//! snapshot with labels and per-step annotations, the live text and shape
//! overlays, and the whole layer stack. Today that is 18 synchronous calls with
//! no yield point between them, and `useEditPersistence.ts` says in as many
//! words that the absence of an `await` there is **load-bearing, not
//! incidental**:
//!
//! > "If anyone ever adds an `await` above this line, detaching stops being safe
//! > and this comment is the reason why."
//!
//! The reason is `detachCloudUpload`: a photo switch returns as soon as the
//! local write lands rather than blocking ~13s on the network, and that is only
//! safe because the bytes were already captured. A capture that yields midway
//! could have the switch complete underneath it, so the second half of the
//! archive would describe the INCOMING photo — uploaded under the OUTGOING
//! photo's key. Silent cross-photo corruption, in the cloud copy where the
//! local guard cannot see it.
//!
//! Stage 3.5's instruction is "make every value-consuming engine call async".
//! Applied naively here it produces exactly that bug: today `await` on a
//! synchronous value only yields to the microtask queue, so events cannot
//! interleave and it survives by luck — but once the engine is behind the
//! worker, every await is a real round trip and a photo switch, a stroke or an
//! undo CAN land mid-capture. Nothing throws; the archive is just wrong.
//!
//! So the fix is not to guard the sequence, it is to remove it. One call, one
//! round trip, atomic by construction because `&self` cannot be mutated while
//! it runs. That deletes ~32 conversions across `editPersistence.ts` and
//! `useEditPersistence.ts` instead of making each one a hazard.
//!
//! WHAT THIS DELIBERATELY DOES NOT DO. It does not produce the persisted
//! archive. ADR-024 says persisted formats are untouched by every stage, and
//! this repo's hard rule sends any IndexedDB format change through the
//! `dexie-migration` skill — "no exceptions, even just adding a field". So this
//! is a TRANSPORT frame: the engine hands over the pieces, and the existing JS
//! `encodeArchive` still owns the bytes that land on disk. Its format, its
//! version, its loader, its tests, all unchanged. The cost is one extra copy in
//! memory; the alternative is the engine quietly becoming the author of user
//! data with no migration story.
//!
//! It also adds no new dependency and sits behind no feature flag. `postcard`
//! would have been the natural encoder — the op log uses it — but it is behind
//! `tiles`, and a persistence-critical method that vanishes from a default
//! build is precisely the shape of the bug that shipped a featureless wasm for
//! ten releases. Hand-rolled little-endian framing has no such failure mode.
use crate::ImageHorseTool;
use wasm_bindgen::prelude::*;

/// "IHCS" — Image Horse Capture State. Distinct from the archive's "IHST" so a
/// transport blob can never be mistaken for something persistable.
const CAPTURE_MAGIC: u32 = 0x49_48_43_53;
const CAPTURE_VERSION: u32 = 1;

/// Little-endian writer. Mirrors the conventions the JS archive already uses
/// (u32 lengths, length-prefixed blobs) so the decoder on the other side reads
/// like the one that is already there.
struct Frame(Vec<u8>);

impl Frame {
    fn new() -> Self {
        Frame(Vec::new())
    }
    fn u32(&mut self, v: u32) {
        self.0.extend_from_slice(&v.to_le_bytes());
    }
    fn bytes(&mut self, b: &[u8]) {
        self.u32(b.len() as u32);
        self.0.extend_from_slice(b);
    }
    fn str(&mut self, s: &str) {
        self.bytes(s.as_bytes());
    }
}

#[wasm_bindgen]
impl ImageHorseTool {
    /// Everything the SAVE path needs, in one call.
    ///
    /// ⚠️ **Not to be confused with `capture_ui_state()`.** Two methods that
    /// each describe "the document" is the shape that let two copies of a save
    /// routine drift until the cloud one quietly stopped storing drop shadows.
    /// The rule for choosing, in one line:
    ///
    /// > **This one is what gets WRITTEN TO DISK. `capture_ui_state()` is what
    /// > gets DRAWN ON SCREEN.**
    ///
    /// They overlap on four fields — width, height, the layer metadata JSON and
    /// the active layer id — and cannot drift on them, because BOTH are pure
    /// aggregations of the same public getters. There is exactly one definition
    /// of `width` (`self.width()`) and one of the layer metadata
    /// (`self.get_layers()`); each capture reads them, neither redefines them.
    /// Keeping both as aggregations is what makes the overlap safe, so do not
    /// "optimise" either into computing a field for itself.
    ///
    /// Neither can be built from the other, which is why there are two. This
    /// one carries every undo/redo snapshot PNG — megabytes — so deriving a
    /// zoom level from it would mean decoding an archive to read a float. The
    /// other carries no pixels at all, so the save path cannot use it.
    ///
    /// Layout (all lengths little-endian u32, every blob length-prefixed):
    ///
    /// ```text
    ///   magic(4) version(4) canvas_w(4) canvas_h(4)
    ///   canvas_png
    ///   undo_count(4)  { label, png, annotations_json } × N
    ///   redo_count(4)  { label, png, annotations_json } × N
    ///   text_annotations_json
    ///   shape_annotations_json
    ///   layers_json                       -- the get_layers() metadata array
    ///   layer_count(4) { png, text_json, shape_json } × N
    ///   active_layer_id(4)
    /// ```
    ///
    /// Every field is read through the same getter the JS used to call, so this
    /// is an aggregation and not a reimplementation — there is no second
    /// definition of "what the canvas PNG is" to drift from the first.
    pub fn capture_state(&self) -> Vec<u8> {
        let mut f = Frame::new();
        f.u32(CAPTURE_MAGIC);
        f.u32(CAPTURE_VERSION);
        f.u32(self.width());
        f.u32(self.height());
        f.bytes(&self.export_png());

        let undo = self.undo_snapshot_count();
        f.u32(undo as u32);
        for i in 0..undo {
            f.str(&self.get_undo_snapshot_label(i));
            f.bytes(&self.get_undo_snapshot_png(i));
            f.str(&self.get_undo_snapshot_annotations(i));
        }

        let redo = self.redo_snapshot_count();
        f.u32(redo as u32);
        for i in 0..redo {
            f.str(&self.get_redo_snapshot_label(i));
            f.bytes(&self.get_redo_snapshot_png(i));
            f.str(&self.get_redo_snapshot_annotations(i));
        }

        f.str(&self.get_text_annotations());
        f.str(&self.get_shape_annotations());

        let layers_json = self.get_layers();
        f.str(&layers_json);
        let layer_count = self.layer_count();
        f.u32(layer_count as u32);
        for i in 0..layer_count {
            f.bytes(&self.get_layer_png(i));
            f.str(&self.get_layer_text_annotations(i));
            f.str(&self.get_layer_shape_annotations(i));
        }

        f.u32(self.active_layer_id());
        f.0
    }
}

/// Pixels plus the dimensions that describe them, out of one call.
///
/// A struct rather than `capture_state`'s hand-rolled frame because the payload
/// is three fixed fields, not a variable-length list of lists — there is
/// nothing to length-prefix and no count to walk. `DecodedPng` already
/// established this shape for the same reason.
///
/// **Read each field once.** `getter_with_clone` is required (`Vec<u8>` is not
/// `Copy`) and it means every access to `.rgba` copies the whole buffer out of
/// wasm memory — 10 MB for a 3072×864 composite. Destructure, then `.free()`,
/// the way `openraster/import.ts` consumes `DecodedPng`.
#[wasm_bindgen(getter_with_clone)]
pub struct RgbaCapture {
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
}

/// The size an export will actually produce, with no pixels attached.
/// Returned by `export_dims_excluding_background()`.
///
/// No `getter_with_clone`: both fields are `u32`, which is `Copy`, so
/// wasm-bindgen generates plain getters and reading them copies nothing. That
/// is the entire reason this type exists rather than reusing `RgbaCapture` —
/// see the method's header.
#[wasm_bindgen]
pub struct ExportDims {
    pub width: u32,
    pub height: u32,
}

/// The eleven values `useEngineCore.ts`'s `syncState` publishes to React, out
/// of one call. Returned by `capture_ui_state()`.
///
/// Scalars plus two strings — no pixels anywhere, which is the whole difference
/// from `capture_state()`. `getter_with_clone` is needed only for the two
/// `String` fields; they are a history-label list and the layer metadata JSON,
/// both small, so the per-access clone that matters for `RgbaCapture` is not a
/// concern here. Still read each field once and `.free()` when done.
///
/// `history_labels` and `layers_json` stay RAW. The JS already owns both
/// formats — it splits the label string on `|` and `JSON.parse`s the layer
/// array — and parsing them engine-side would create a second definition of a
/// format that is currently defined in exactly one place.
#[wasm_bindgen(getter_with_clone)]
pub struct UiStateCapture {
    pub has_source: bool,
    pub undo_count: u32,
    pub redo_count: u32,
    pub history_labels: String,
    pub zoom: f64,
    pub width: u32,
    pub height: u32,
    pub has_transparency: bool,
    pub layers_json: String,
    pub active_layer_id: u32,
    pub export_quality: u8,
}

#[wasm_bindgen]
impl ImageHorseTool {
    /// The composite and its dimensions, atomically.
    ///
    /// Replaces `get_image_data()` + `width()` + `height()` at the call sites
    /// that encode one for the other. Three separate reads describe one
    /// document state, so behind the worker a resize landing between them hands
    /// the encoder one state's pixels at another state's dimensions — the
    /// buffer is then the wrong length for the width×height it is paired with,
    /// and the result is a throw or a sheared image depending on which way the
    /// size moved.
    ///
    /// Aggregation, not reimplementation: every field comes from the getter the
    /// JS used to call, so there is no second definition of "the composite" to
    /// drift from the first.
    pub fn capture_composite(&self) -> RgbaCapture {
        RgbaCapture {
            width: self.width(),
            height: self.height(),
            rgba: self.get_image_data(),
        }
    }

    /// The scaled thumbnail and its dimensions, atomically.
    ///
    /// Replaces `thumbnail_width(n)` + `thumbnail_height(n)` + `thumbnail_data(n)`.
    /// Note that `codec::thumbnail_data` computes and returns all three
    /// together already — the split into three `#[wasm_bindgen]` wrappers threw
    /// two of them away at the boundary and made the callers recompute them, so
    /// this restores what the codec always had rather than adding anything.
    ///
    /// `thumb_dims` is a handful of arithmetic ops on `self.width`/`self.height`,
    /// so calling it twice more here costs nothing measurable and keeps this an
    /// aggregation of the existing getters. The composite still happens exactly
    /// once, inside `thumbnail_data`.
    pub fn capture_thumbnail(&self, max_px: u32) -> RgbaCapture {
        RgbaCapture {
            width: self.thumbnail_width(max_px),
            height: self.thumbnail_height(max_px),
            rgba: self.thumbnail_data(max_px),
        }
    }

    /// The background-excluded composite and its cropped dimensions, atomically.
    ///
    /// Replaces `get_image_data_excluding_background()` +
    /// `export_width_excluding_background()` +
    /// `export_height_excluding_background()`, which four call sites use as a
    /// unit to feed `encodeRgba(pixels, w, h, …)`.
    ///
    /// UNLIKE the two above, this one is not written as an aggregation of the
    /// three public getters, and the difference is the point. Each of those
    /// getters calls `composite_excluding_background()` and discards two of its
    /// three return values, so the three-call form does **three full composites,
    /// three `tight_bbox` scans and three crops** to answer one question. This
    /// calls the private helper once and keeps all three values — the same
    /// single definition the getters are built on, so there is still nothing to
    /// drift, but a third of the work.
    ///
    /// The correctness half is the same as `capture_composite`: the crop is
    /// content-dependent, so a stroke landing between the reads changes the
    /// tight bounding box and pairs one state's pixels with another state's
    /// dimensions.
    pub fn capture_composite_excluding_background(&self) -> RgbaCapture {
        let (rgba, width, height) = self.composite_excluding_background();
        RgbaCapture {
            width,
            height,
            rgba,
        }
    }

    /// The size an export will produce, without producing the export.
    ///
    /// Replaces `export_width_excluding_background()` +
    /// `export_height_excluding_background()`, which `useExportDimensions.ts`
    /// calls on the share path. Each of those getters runs a whole
    /// `composite_excluding_background()` internally and discards everything but
    /// one integer, so the pair did two full-document composites, two tight
    /// bounding-box scans and two crops to produce two numbers.
    ///
    /// Those numbers are not a caption, which is what the JS header used to say.
    /// They go to `createShare` and land in the Convex `shares` table, so a torn
    /// width/height pair is persisted against a public link where nothing
    /// downstream can tell it is wrong.
    ///
    /// Measured on a 1385×2068 document, production build: the two getters cost
    /// 39.9 ms, this costs **17.4 ms** (2.29×).
    ///
    /// **Deliberately not `capture_composite_excluding_background()`.** That
    /// method already returns these two numbers, so pointing this call site at
    /// it looks like the obvious reuse and is a mistake: `RgbaCapture.rgba` is
    /// `getter_with_clone`, so merely reading the struct would copy ~11 MB out
    /// of wasm memory and drop it on the floor. Halving the composites while
    /// adding an 11 MB copy is not a win. Hence a pixel-free return type.
    ///
    /// One definition, not two: the box comes from the same
    /// `excluding_background_parts()` the pixel path uses. This one just stops
    /// before the crop, which the pixel path needs and a caption does not.
    ///
    /// It is also an atomic capture, in miniature. The crop is
    /// CONTENT-dependent, so read separately behind the worker the width could
    /// describe one document state and the height another — and the label would
    /// state a size that no export ever had.
    pub fn export_dims_excluding_background(&self) -> ExportDims {
        let (_pixels, w, h, bbox) = self.excluding_background_parts();
        let (width, height) = match bbox {
            Some((_, _, cw, ch)) => (cw, ch),
            None => (w, h),
        };
        ExportDims { width, height }
    }

    /// Everything React renders from, in one call.
    ///
    /// ⚠️ **Not to be confused with `capture_state()`.** See that method's
    /// header for the full contrast; the one-line rule is:
    ///
    /// > **`capture_state()` is what gets WRITTEN TO DISK. This is what gets
    /// > DRAWN ON SCREEN.**
    ///
    /// Replaces the eleven separate reads in `useEngineCore.ts`'s `syncState`,
    /// which build a single object and hand it to one `setState`. That is an
    /// ATOMIC CAPTURE (ADR-024): the eleven describe one document state and are
    /// consumed together. Converted individually behind the worker, React would
    /// render a snapshot that never existed — a width from before a resize
    /// beside an undo count from after, a layer list from one moment beside the
    /// active layer id from another. Nothing throws; the UI is just wrong, and
    /// it self-corrects on the next sync, which is what would make it a
    /// months-long intermittent rather than a bug report.
    ///
    /// Aggregation, not reimplementation — every field is the getter the JS
    /// called. `history_labels` and `layers_json` are handed over as the raw
    /// strings the JS already parses, deliberately: parsing them here would put
    /// a second definition of those formats in the engine.
    pub fn capture_ui_state(&self) -> UiStateCapture {
        UiStateCapture {
            has_source: self.has_source(),
            undo_count: self.undo_count() as u32,
            redo_count: self.redo_count() as u32,
            history_labels: self.history_labels(),
            zoom: self.get_zoom(),
            width: self.width(),
            height: self.height(),
            has_transparency: self.has_transparency(),
            layers_json: self.get_layers(),
            active_layer_id: self.active_layer_id(),
            export_quality: self.export_quality(),
        }
    }
}

#[cfg(test)]
mod capture_tests {
    use crate::ImageHorseTool;

    fn solid(w: u32, h: u32, px: [u8; 4]) -> Vec<u8> {
        let mut v = vec![0u8; (w * h * 4) as usize];
        for c in v.chunks_exact_mut(4) {
            c.copy_from_slice(&px);
        }
        v
    }

    /// Minimal reader mirroring the JS decoder, so the test reads the frame the
    /// same way the consumer will rather than trusting the writer's own maths.
    struct Read<'a> {
        b: &'a [u8],
        p: usize,
    }
    impl<'a> Read<'a> {
        fn u32(&mut self) -> u32 {
            let v = u32::from_le_bytes(self.b[self.p..self.p + 4].try_into().unwrap());
            self.p += 4;
            v
        }
        fn blob(&mut self) -> &'a [u8] {
            let n = self.u32() as usize;
            let s = &self.b[self.p..self.p + n];
            self.p += n;
            s
        }
        fn text(&mut self) -> String {
            String::from_utf8(self.blob().to_vec()).unwrap()
        }
    }

    #[test]
    fn capture_state_round_trips_every_field() {
        let mut t = ImageHorseTool::new(24, 16);
        t.load_image(&solid(24, 16, [10, 20, 30, 255]));
        t.add_shape_annotation(
            0, 2.0, 2.0, 10.0, 10.0, "#ff0000", 2.0, 0, 1, "#ff0000", "#ff0000", 0, 0,
        );

        let blob = t.capture_state();
        let mut r = Read { b: &blob, p: 0 };

        assert_eq!(r.u32(), 0x49_48_43_53, "magic");
        assert_eq!(r.u32(), 1, "version");
        assert_eq!(r.u32(), t.width(), "canvas width");
        assert_eq!(r.u32(), t.height(), "canvas height");

        let png = r.blob();
        assert_eq!(png, &t.export_png()[..], "canvas PNG must match the getter");
        assert_eq!(&png[..4], &[0x89, b'P', b'N', b'G'], "and be a real PNG");

        let undo = r.u32() as usize;
        assert_eq!(undo, t.undo_snapshot_count(), "undo count");
        for i in 0..undo {
            assert_eq!(r.text(), t.get_undo_snapshot_label(i));
            assert_eq!(r.blob(), &t.get_undo_snapshot_png(i)[..]);
            assert_eq!(r.text(), t.get_undo_snapshot_annotations(i));
        }

        let redo = r.u32() as usize;
        assert_eq!(redo, t.redo_snapshot_count(), "redo count");
        for i in 0..redo {
            assert_eq!(r.text(), t.get_redo_snapshot_label(i));
            assert_eq!(r.blob(), &t.get_redo_snapshot_png(i)[..]);
            assert_eq!(r.text(), t.get_redo_snapshot_annotations(i));
        }

        assert_eq!(r.text(), t.get_text_annotations(), "live text overlays");
        let shapes = r.text();
        assert_eq!(shapes, t.get_shape_annotations(), "live shape overlays");
        // The colour is stored as numeric r/g/b, not the "#ff0000" that was
        // passed in — assert on what the serialiser actually emits rather than
        // on the input, or this passes for the wrong reason.
        assert_eq!(t.shape_annotation_count(), 1, "the shape was added");
        assert!(
            shapes.contains("\"r\":255") && shapes.contains("\"g\":0"),
            "the added shape must be in the captured JSON, got: {shapes}"
        );

        assert_eq!(r.text(), t.get_layers(), "layer metadata JSON");
        let layers = r.u32() as usize;
        assert_eq!(layers, t.layer_count(), "layer count");
        for i in 0..layers {
            assert_eq!(r.blob(), &t.get_layer_png(i)[..]);
            assert_eq!(r.text(), t.get_layer_text_annotations(i));
            assert_eq!(r.text(), t.get_layer_shape_annotations(i));
        }

        assert_eq!(r.u32(), t.active_layer_id(), "active layer id");
        assert_eq!(
            r.p,
            blob.len(),
            "frame must be fully consumed — no trailing bytes"
        );
    }

    /// The point of the whole exercise: one call, and the engine cannot change
    /// under it. Guards against someone later "optimising" this into helpers
    /// that take `&mut self`, which would reopen the interleaving hole.
    #[test]
    fn capture_state_does_not_mutate_the_document() {
        let mut t = ImageHorseTool::new(20, 20);
        t.load_image(&solid(20, 20, [7, 7, 7, 255]));
        let before = t.get_image_data();
        let undo_before = t.undo_snapshot_count();
        let hist_before = t.history_labels();

        let a = t.capture_state();
        let b = t.capture_state();

        assert_eq!(
            t.get_image_data(),
            before,
            "pixels changed during a capture"
        );
        assert_eq!(
            t.undo_snapshot_count(),
            undo_before,
            "history grew during a capture"
        );
        assert_eq!(t.history_labels(), hist_before, "history labels changed");
        assert_eq!(
            a, b,
            "two captures of an unchanged document must be identical"
        );
    }

    #[test]
    fn capture_composite_matches_the_three_getters_it_replaces() {
        let mut t = ImageHorseTool::new(24, 16);
        t.load_image(&solid(24, 16, [10, 20, 30, 255]));

        let cap = t.capture_composite();
        assert_eq!(cap.width, t.width(), "width must match the getter");
        assert_eq!(cap.height, t.height(), "height must match the getter");
        assert_eq!(cap.rgba, t.get_image_data(), "pixels must match the getter");
    }

    #[test]
    fn capture_thumbnail_matches_the_three_getters_it_replaces() {
        let mut t = ImageHorseTool::new(64, 32);
        t.load_image(&solid(64, 32, [1, 2, 3, 255]));

        let cap = t.capture_thumbnail(16);
        assert_eq!(cap.width, t.thumbnail_width(16), "thumb width");
        assert_eq!(cap.height, t.thumbnail_height(16), "thumb height");
        assert_eq!(cap.rgba, t.thumbnail_data(16), "thumb pixels");
        // The scale actually happened — otherwise this passes on a no-op.
        assert!(cap.width < 64, "64px wide capped at 16 should shrink");
    }

    /// The invariant the split reads cannot offer: the buffer is always the
    /// right length for the dimensions it arrives with. This is the assertion
    /// that fails if anyone reassembles these from separate calls behind the
    /// worker and a resize lands between them.
    #[test]
    fn a_capture_is_always_self_consistent_across_a_resize() {
        let mut t = ImageHorseTool::new(40, 20);
        t.load_image(&solid(40, 20, [9, 9, 9, 255]));

        let before = t.capture_composite();
        let before_thumb = t.capture_thumbnail(16);
        t.resize(80, 60);
        let after = t.capture_composite();
        let after_thumb = t.capture_thumbnail(16);

        for (label, c) in [
            ("composite before", &before),
            ("composite after", &after),
            ("thumbnail before", &before_thumb),
            ("thumbnail after", &after_thumb),
        ] {
            assert_eq!(
                c.rgba.len() as u32,
                c.width * c.height * 4,
                "{label}: buffer length must describe its own dimensions"
            );
        }

        // And the resize is genuinely visible to the capture, so the test above
        // is not passing because nothing moved.
        assert_eq!((before.width, before.height), (40, 20));
        assert_eq!((after.width, after.height), (80, 60));
    }

    #[test]
    fn capture_excluding_background_matches_the_three_getters_it_replaces() {
        let mut t = ImageHorseTool::new(24, 16);
        t.load_image(&solid(24, 16, [10, 20, 30, 255]));

        let cap = t.capture_composite_excluding_background();
        assert_eq!(cap.width, t.export_width_excluding_background(), "width");
        assert_eq!(cap.height, t.export_height_excluding_background(), "height");
        assert_eq!(
            cap.rgba,
            t.get_image_data_excluding_background(),
            "pixels must match the getter"
        );
        assert_eq!(
            cap.rgba.len() as u32,
            cap.width * cap.height * 4,
            "buffer must describe its own dimensions"
        );
    }

    #[test]
    fn export_dims_matches_the_two_getters_it_replaces() {
        let mut t = ImageHorseTool::new(40, 40);
        t.load_image(&solid(40, 40, [0, 0, 0, 0]));
        t.add_layer("Art");
        t.add_shape_annotation(
            0, 5.0, 6.0, 20.0, 14.0, "#ff0000", 2.0, 0, 1, "#ff0000", "#ff0000", 0, 0,
        );
        t.flatten_text_annotations();

        let dims = t.export_dims_excluding_background();

        assert_eq!(dims.width, t.export_width_excluding_background(), "width");
        assert_eq!(
            dims.height,
            t.export_height_excluding_background(),
            "height"
        );
        // And the crop is real, not a pass-through of the document size — or
        // this passes for the wrong reason on an untrimmable document.
        assert!(
            dims.width < 40 || dims.height < 40,
            "setup: the content must be croppable, got {}x{}",
            dims.width,
            dims.height
        );
    }

    /// THE DRIFT GUARD. `export_dims_excluding_background` and
    /// `capture_composite_excluding_background` now take different routes
    /// through `excluding_background_parts` — one stops before the crop, the
    /// other performs it. If they ever disagree, a caption would state a size
    /// no exported file has.
    #[test]
    fn export_dims_agrees_with_the_pixels_path() {
        let mut t = ImageHorseTool::new(64, 48);
        t.load_image(&solid(64, 48, [0, 0, 0, 0]));
        t.add_layer("Art");
        t.add_shape_annotation(
            0, 8.0, 4.0, 30.0, 22.0, "#00ff00", 2.0, 0, 1, "#00ff00", "#00ff00", 0, 0,
        );
        t.flatten_text_annotations();

        let dims = t.export_dims_excluding_background();
        let cap = t.capture_composite_excluding_background();

        assert_eq!(
            (dims.width, dims.height),
            (cap.width, cap.height),
            "the dimensions-only path and the pixels path disagree"
        );
        assert_eq!(
            cap.rgba.len() as u32,
            dims.width * dims.height * 4,
            "the label's dimensions must describe the exported buffer"
        );
    }

    /// The untrimmable case: nothing to crop to, so both fall back to the full
    /// document size. Guards the `None` arm, which the cropping tests never hit.
    #[test]
    fn export_dims_falls_back_to_the_document_when_nothing_crops() {
        let mut t = ImageHorseTool::new(24, 18);
        t.load_image(&solid(24, 18, [7, 7, 7, 255])); // opaque, edge to edge

        let dims = t.export_dims_excluding_background();

        assert_eq!((dims.width, dims.height), (t.width(), t.height()));
        assert_eq!(dims.width, t.export_width_excluding_background());
        assert_eq!(dims.height, t.export_height_excluding_background());
    }

    /// The crop is CONTENT-dependent, not just size-dependent — that is what
    /// makes splitting these three reads a correctness bug and not merely a
    /// waste. Erasing part of the image moves the tight bounding box, so a
    /// stroke landing mid-read pairs one state's pixels with another's box.
    #[test]
    fn the_excluded_background_crop_moves_when_content_moves() {
        let mut t = ImageHorseTool::new(40, 40);
        t.load_image(&solid(40, 40, [0, 0, 0, 0])); // fully transparent
        t.add_layer("Art"); // >1 layer, so the exclude-Background path is live
                            // Paint a small opaque square, then a larger one, and watch the crop.
        t.add_shape_annotation(
            0, 4.0, 4.0, 10.0, 10.0, "#ff0000", 2.0, 0, 1, "#ff0000", "#ff0000", 0, 0,
        );
        t.flatten_text_annotations();
        let small = t.capture_composite_excluding_background();

        t.add_shape_annotation(
            0, 4.0, 4.0, 30.0, 30.0, "#00ff00", 2.0, 0, 1, "#00ff00", "#00ff00", 0, 0,
        );
        t.flatten_text_annotations();
        let big = t.capture_composite_excluding_background();

        assert!(
            big.width > small.width || big.height > small.height,
            "a bigger shape must widen the tight crop: {}x{} -> {}x{}",
            small.width,
            small.height,
            big.width,
            big.height
        );
        for (label, c) in [("small", &small), ("big", &big)] {
            assert_eq!(
                c.rgba.len() as u32,
                c.width * c.height * 4,
                "{label}: buffer must describe its own dimensions"
            );
        }
    }

    #[test]
    fn capture_ui_state_matches_the_eleven_getters_it_replaces() {
        // EVERY FIELD IS DRIVEN OFF ITS DEFAULT FIRST, and that is the point.
        // The first version of this test used a solid opaque image at default
        // zoom and quality, so `has_transparency: false` — a field pinned to a
        // constant — passed against a getter that also returned false. Mutation
        // testing caught it. A field is only really asserted if the document
        // makes its value distinctive.
        let mut t = ImageHorseTool::new(32, 24);
        t.load_image(&solid(32, 24, [10, 20, 30, 128])); // alpha < 255
        t.add_layer("Art");
        t.set_source(4, 5); // has_source: false -> true
        t.set_zoom(2.5); // zoom: 1.0 -> 2.5
        t.set_export_quality(37); // quality: default -> 37
        t.add_shape_annotation(
            0, 2.0, 2.0, 8.0, 8.0, "#00ff00", 2.0, 0, 1, "#00ff00", "#00ff00", 0, 0,
        );

        // Prove the setup actually moved things, or the assertions below are
        // once again comparing defaults to defaults.
        assert!(t.has_transparency(), "setup: document must have alpha");
        assert!(t.has_source(), "setup: source must be set");
        assert_eq!(t.get_zoom(), 2.5, "setup: zoom must be non-default");
        assert_eq!(t.export_quality(), 37, "setup: quality must be non-default");
        assert!(t.undo_count() > 0, "setup: history must be non-empty");

        let ui = t.capture_ui_state();

        // One assertion per field, against the getter `syncState` used to call.
        // Field-by-field on purpose: a struct-level compare would pass if two
        // fields were transposed, and width/height are the same type.
        assert_eq!(ui.has_source, t.has_source(), "has_source");
        assert_eq!(ui.undo_count, t.undo_count() as u32, "undo_count");
        assert_eq!(ui.redo_count, t.redo_count() as u32, "redo_count");
        assert_eq!(ui.history_labels, t.history_labels(), "history_labels");
        assert_eq!(ui.zoom, t.get_zoom(), "zoom");
        assert_eq!(ui.width, t.width(), "width");
        assert_eq!(ui.height, t.height(), "height");
        assert_eq!(
            ui.has_transparency,
            t.has_transparency(),
            "has_transparency"
        );
        assert_eq!(ui.layers_json, t.get_layers(), "layers_json");
        assert_eq!(ui.active_layer_id, t.active_layer_id(), "active_layer_id");
        assert_eq!(ui.export_quality, t.export_quality(), "export_quality");
    }

    /// width and height are both `u32` and adjacent in the struct, so a
    /// transposition compiles and the equal-dimensions case above would not
    /// notice. Assert on a document whose sides differ.
    #[test]
    fn capture_ui_state_does_not_transpose_width_and_height() {
        let mut t = ImageHorseTool::new(64, 16);
        t.load_image(&solid(64, 16, [1, 2, 3, 255]));

        let ui = t.capture_ui_state();

        assert_eq!((ui.width, ui.height), (64, 16), "width/height transposed");
    }

    /// The reason this capture exists: the eleven must describe ONE state.
    /// Mutate between two captures and every field that should move, moves —
    /// together. A field wired to a stale cache would sit still here.
    #[test]
    fn capture_ui_state_moves_as_one_document_state() {
        let mut t = ImageHorseTool::new(40, 20);
        t.load_image(&solid(40, 20, [9, 9, 9, 255]));
        let before = t.capture_ui_state();

        t.resize(80, 60);

        let after = t.capture_ui_state();
        assert_eq!((before.width, before.height), (40, 20), "before");
        assert_eq!((after.width, after.height), (80, 60), "after");
        assert!(
            after.undo_count > before.undo_count,
            "a resize must be undoable, so the count must have moved: {} -> {}",
            before.undo_count,
            after.undo_count
        );
        // And the whole struct still agrees with the live getters afterwards,
        // which is what fails if any field is served from a stale mirror.
        assert_eq!(after.width, t.width());
        assert_eq!(after.undo_count, t.undo_count() as u32);
        assert_eq!(after.history_labels, t.history_labels());
    }

    /// Same guard `capture_state` carries: these must stay `&self`. A helper
    /// that took `&mut self` would reopen the interleaving hole they exist to
    /// close, and would still compile.
    #[test]
    fn captures_do_not_mutate_the_document() {
        let mut t = ImageHorseTool::new(20, 20);
        t.load_image(&solid(20, 20, [7, 7, 7, 255]));
        let before = t.get_image_data();
        let hist_before = t.history_labels();

        let a = t.capture_composite();
        let b = t.capture_composite();
        let ta = t.capture_thumbnail(8);
        let tb = t.capture_thumbnail(8);

        assert_eq!(
            t.get_image_data(),
            before,
            "pixels changed during a capture"
        );
        assert_eq!(t.history_labels(), hist_before, "history changed");
        assert_eq!(
            (a.width, a.height, a.rgba),
            (b.width, b.height, b.rgba),
            "two composite captures of an unchanged document must be identical"
        );
        assert_eq!(
            (ta.width, ta.height, ta.rgba),
            (tb.width, tb.height, tb.rgba),
            "two thumbnail captures of an unchanged document must be identical"
        );
    }

    #[test]
    fn capture_state_survives_an_empty_document() {
        // No image loaded: every list is empty and the frame must still parse.
        let t = ImageHorseTool::new(4, 4);
        let blob = t.capture_state();
        let mut r = Read { b: &blob, p: 0 };
        assert_eq!(r.u32(), 0x49_48_43_53);
        assert_eq!(r.u32(), 1);
        r.u32();
        r.u32();
        r.blob();
        let u = r.u32();
        for _ in 0..u {
            r.text();
            r.blob();
            r.text();
        }
        let d = r.u32();
        for _ in 0..d {
            r.text();
            r.blob();
            r.text();
        }
        r.text();
        r.text();
        r.text();
        let l = r.u32();
        for _ in 0..l {
            r.blob();
            r.text();
            r.text();
        }
        r.u32();
        assert_eq!(r.p, blob.len(), "empty-document frame must parse cleanly");
    }
}
