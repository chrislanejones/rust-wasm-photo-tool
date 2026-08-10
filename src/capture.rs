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
///
/// ## `has_transparency` was REMOVED from this struct in v7.96
///
/// It used to be the eleventh field, and it was **the entire cost of this
/// call**: `has_transparency()` is `get_image_data().chunks_exact(4).any(...)`,
/// and `get_image_data()` composites every layer into a full-document RGBA
/// buffer first, so `.any()`'s early exit saves nothing. Measured on a
/// 1385×2068 document: **29.8 ms for that one field against 0.0 ms for the
/// other ten combined**, on a call `syncState` makes after essentially every
/// mutation.
///
/// It was removed rather than made cheap because **nothing consumed it**. The
/// canvas checkerboard was its only reader and stopped gating on it in
/// `5e46921` (2026-06-27), when the checkerboard became unconditional CSS; the
/// reader was deleted and this producer was left computing a discarded boolean
/// for six weeks. Proven by removing the React field outright — `tsc`, 461
/// tests, eslint and the production build all passed untouched.
///
/// **`has_transparency()` itself is deliberately still on `ImageHorseTool`.**
/// The capability is fine; paying for it on every sync was not. A future
/// consumer calls it directly and knowingly pays — and if it ever needs to be
/// cheap, THAT is the moment to design a cached-and-invalidated flag, with a
/// real consumer to define what "correct" means.
#[wasm_bindgen(getter_with_clone)]
pub struct UiStateCapture {
    pub has_source: bool,
    pub undo_count: u32,
    pub redo_count: u32,
    pub history_labels: String,
    pub zoom: f64,
    pub width: u32,
    pub height: u32,
    pub layers_json: String,
    pub active_layer_id: u32,
    pub export_quality: u8,
}

/// The layer stack and the canvas it sits on. Returned by
/// `capture_layer_stack()`.
///
/// ⚠️ **A third "document" capture, and the reason it is not the second one —
/// REVISED in v7.96, because the original reason no longer exists.**
///
/// When this was added (v7.95) the argument was cost: `UiStateCapture` carried
/// `has_transparency`, which composited the whole document, so an `.ora` export
/// that wanted five scalars would have paid ~30 ms for a boolean it discarded.
/// **v7.96 removed that field entirely** (nothing consumed it), so
/// `capture_ui_state()` is now cheap too and that argument is gone. Recorded
/// rather than quietly deleted: a justification that has stopped being true is
/// worse than none, because the next reader trusts it.
///
/// What remains is weaker but still real:
///
/// - `capture_ui_state()` builds `history_labels`, a string over the whole undo
///   stack, which an export has no use for. Small, but not nothing, and it
///   grows with history depth.
/// - `layer_count` is not on `UiStateCapture` at all.
/// - Scope: the export path should not be shaped by the render capture. They
///   change for different reasons, and coupling them is how one caller's field
///   ends up added "just for" the other.
///
/// If a later session judges that too thin and folds this back into
/// `capture_ui_state()`, that is a defensible call — make it deliberately,
/// knowing this note is the whole argument, rather than by accident.
///
/// The overlap is safe for the same reason `capture_state` and
/// `capture_ui_state`'s is: all three are pure aggregations of the same public
/// getters, so there is exactly one definition of `width` and one of the layer
/// metadata. Do not "optimise" any of them into computing a field for itself.
#[wasm_bindgen(getter_with_clone)]
pub struct LayerStackCapture {
    pub width: u32,
    pub height: u32,
    /// Always equal to the length of `layers_json`'s array — `layer_count()` is
    /// `self.layers.len()` and `get_layers()` emits one object per layer. Kept
    /// as its own field anyway so callers that want a count do not have to know
    /// that, and so the equality can be pinned by a test rather than assumed at
    /// each call site.
    pub layer_count: u32,
    pub active_layer_id: u32,
    pub layers_json: String,
}

/// The pen path under a point, hit-test and lookup in one call. Returned by
/// `capture_pen_hit()`.
///
/// `getter_with_clone` is required for `points` (`Vec<f64>` is not `Copy`), so
/// reading it copies the control sequence out of wasm memory. A pen path is
/// tens of points, not megabytes, so unlike `RgbaCapture` there is no
/// read-once discipline to observe here beyond the usual `.free()`.
#[wasm_bindgen(getter_with_clone)]
pub struct PenHit {
    /// The bezier annotation's id, or **-1** for "no pen path here" — the same
    /// sentinel `shape_annotation_at` already uses, rather than a second
    /// convention for absence. (`Option<u32>` was the alternative; the
    /// annotations module notes wasm-bindgen's `Option` support is uneven, and
    /// the -1 it settled on is what every caller in this area already reads.)
    pub id: i32,
    /// The flat control sequence `[x0,y0,x1,y1,…]`. Flat because that is the
    /// form the caller built by hand — `path.points.flat()` — from the nested
    /// pairs in `get_shape_annotations`' JSON. Empty when `id` is -1.
    pub points: Vec<f64>,
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
            layers_json: self.get_layers(),
            active_layer_id: self.active_layer_id(),
            export_quality: self.export_quality(),
        }
    }

    /// The layer stack and its canvas, atomically — with no pixels touched.
    ///
    /// Replaces two sequences in `lib/openraster/export.ts`:
    ///
    /// ```text
    ///   exportOra                 layer_count + width + height + get_layers
    ///   flattenAllLayersInPlace   active_layer_id + layer_count + get_layers
    /// ```
    ///
    /// The first builds one `stack.xml` describing one document; the second
    /// picks the layers to visit and the layer to restore afterwards. Both are
    /// atomic captures (ADR-024): read separately behind the worker, the
    /// `stack.xml` written into the `.ora` archive could state a canvas size
    /// from before a resize beside a layer list from after it — a corrupt file
    /// the user keeps on disk, with nothing thrown at the time.
    ///
    /// ⚠️ **This does NOT make `exportOra` atomic, and must not be read as
    /// having done so.** The file separates these reads from
    /// `get_layer_png(i)` and `export_png()` with a real `await
    /// import("jszip")`, and mutates the live document mid-export
    /// (`set_active_layer` + `flatten_text_annotations`). Both are pre-existing,
    /// both are triaged in ADR-024, and both remain open. Closing them needs a
    /// single capture that carries the layer PNGs too — a design decision about
    /// what the engine owns, not a conversion.
    ///
    /// See `LayerStackCapture` for why this is not `capture_ui_state()`.
    pub fn capture_layer_stack(&self) -> LayerStackCapture {
        LayerStackCapture {
            width: self.width(),
            height: self.height(),
            layer_count: self.layer_count() as u32,
            active_layer_id: self.active_layer_id(),
            layers_json: self.get_layers(),
        }
    }

    /// The pen path under a canvas-space point, atomically.
    ///
    /// Replaces `shape_annotation_at(x, y)` + `get_shape_annotations()` in
    /// `AppShell`'s `handlePenHitTest`, which is the HIT-TEST THEN LOOK UP
    /// shape (`docs/engine-worker-capture-sweep.md`): read 1 answers *which
    /// one*, read 2 returns *all of them*, and the id from the first indexes
    /// into the second. An id is only meaningful against the list it was drawn
    /// from. Behind the worker, a shape deleted between the two reads makes
    /// `find` return `undefined`, `handlePenHitTest` return `null`, and the
    /// click do nothing at all — no throw, no console error, the pen simply
    /// does not enter re-edit.
    ///
    /// **TOPMOST-THEN-CHECK, not find-a-bezier.** This deliberately calls
    /// `shape_annotation_at`, which returns the newest shape of ANY kind at the
    /// point, and only then asks whether that shape is a pen path. Filtering to
    /// kind 7 inside the hit-test loop would be a different function: it would
    /// reach THROUGH a rectangle lying over a pen path and re-edit the path
    /// underneath, where today the rectangle means "no pen path here". That is
    /// why this is not named `bezier_annotation_at` — the hit-test is not
    /// bezier-aware and must not become so as a side effect of this change.
    ///
    /// Aggregation, not reimplementation: the hit logic is `shape_annotation_at`
    /// itself, so there is no second copy of the padding and
    /// distance-to-segment rules to drift from the first. Only the by-id lookup
    /// is here, and it is the lookup the JS was doing.
    pub fn capture_pen_hit(&self, x: f64, y: f64) -> PenHit {
        /// `ShapeAnnotation::kind` for a cubic pen path. The crate carries no
        /// named constant for the kind codes — they are documented on the field
        /// and written as literals — so this is local rather than a new shared
        /// definition that would have exactly one user.
        const KIND_BEZIER: u8 = 7;
        const MISS: PenHit = PenHit {
            id: -1,
            points: Vec::new(),
        };

        let id = self.shape_annotation_at(x, y);
        // A fast path, not the guard. `shape_annotation_at` returns -1 or a real
        // id, so a -1 reaching the lookup below simply matches nothing and lands
        // on `_ => MISS` — which is why mutating this condition is an EQUIVALENT
        // mutant and no test can kill it. The `_` arm is the actual backstop.
        if id < 0 {
            return MISS;
        }
        match self.layers[self.active]
            .shape_annotations
            .iter()
            .find(|s| s.id as i32 == id)
        {
            Some(s) if s.kind == KIND_BEZIER => PenHit {
                id,
                points: s.points.iter().flat_map(|&(px, py)| [px, py]).collect(),
            },
            _ => MISS,
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
    fn capture_ui_state_matches_the_ten_getters_it_replaces() {
        // EVERY FIELD IS DRIVEN OFF ITS DEFAULT FIRST, and that is the point.
        // An earlier version used a solid opaque image at default zoom and
        // quality, so a field pinned to a constant passed against a getter that
        // also returned false. Mutation testing caught it. A field is only
        // really asserted if the document makes its value distinctive.
        //
        // The field that taught that lesson was `has_transparency`, which left
        // this struct in v7.96 — see `UiStateCapture`'s header. The alpha in the
        // fixture below is kept anyway: it costs nothing and it keeps the
        // document non-trivial.
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

    // ── capture_pen_hit ────────────────────────────────────────────────────
    //
    // Every field is driven OFF its default before it is asserted: the id is
    // never 0 or -1 (both defaults for `i32` and for "miss"), and the points
    // are distinct non-zero values in a deliberate order. A test whose expected
    // value equals the type's default passes for the wrong reason — that exact
    // mistake survived a mutant in a5.

    /// A pen path whose control sequence is asymmetric in x, y AND order, so a
    /// mutant that flattens the pairs the wrong way round, drops a coordinate,
    /// or reverses the sequence cannot produce this list by accident.
    const PEN_PTS: [f64; 8] = [12.0, 34.0, 56.0, 78.0, 90.0, 21.0, 43.0, 65.0];

    /// The probe point, and it is asymmetric ON PURPOSE. `PEN_PTS` has a padded
    /// bounding box of x∈[6,96], y∈[15,84], so a point like (43,65) is inside it
    /// BOTH ways round and cannot tell `shape_annotation_at(x, y)` from
    /// `shape_annotation_at(y, x)`. That mutant survived the first version of
    /// these tests. (85,25) is inside; its swap (25,85) is above the box.
    const HIT: (f64, f64) = (85.0, 25.0);

    /// The two getters `capture_pen_hit` replaces, run the old way — hit-test,
    /// parse the whole list, index into it by id. The capture must agree with
    /// this on every input, because this is literally the code it replaced.
    fn pen_hit_the_old_way(t: &ImageHorseTool, x: f64, y: f64) -> Option<(i32, Vec<f64>)> {
        let id = t.shape_annotation_at(x, y);
        if id < 0 {
            return None;
        }
        let json = t.get_shape_annotations();
        // Walk the JSON the way the JS did: find the object with this id, and
        // require kind 7. Parsed by hand — pulling in serde for one test would
        // add a dependency the crate deliberately does not carry.
        let needle = format!("\"id\":{},\"kind\":7,", id);
        let at = json.find(&needle)?;
        let pts_at = json[at..].find("\"points\":[")? + at + "\"points\":[".len();
        // Scan to the bracket that MATCHES the one `"points":[` consumed. The
        // first draft of this helper stopped at the first `]`, which is the end
        // of the first coordinate PAIR, not of the list — it read 2 values out
        // of 8 and failed the capture for being right. Depth-count instead.
        let mut depth = 1usize;
        let mut end = pts_at;
        for (i, c) in json[pts_at..].char_indices() {
            match c {
                '[' => depth += 1,
                ']' => {
                    depth -= 1;
                    if depth == 0 {
                        end = pts_at + i;
                        break;
                    }
                }
                _ => {}
            }
        }
        let mut flat = Vec::new();
        for pair in json[pts_at..end].split("],[") {
            for n in pair.trim_matches(|c| c == '[' || c == ']').split(',') {
                if !n.is_empty() {
                    flat.push(n.parse::<f64>().unwrap());
                }
            }
        }
        Some((id, flat))
    }

    #[test]
    fn capture_pen_hit_agrees_with_the_two_getters_it_replaces() {
        let mut t = ImageHorseTool::new(128, 128);
        t.load_image(&solid(128, 128, [10, 20, 30, 255]));
        // Burn two ids so the one under test is neither 0 nor 1 — a capture
        // that returned a hardcoded or off-by-one id would still pass against
        // the first annotation ever added.
        t.add_shape_annotation(
            0, 100.0, 100.0, 110.0, 110.0, "#ff0000", 2.0, 0, 0, "#000000", "#000000", 0, 0,
        );
        t.add_shape_annotation(
            0, 112.0, 112.0, 120.0, 120.0, "#ff0000", 2.0, 0, 0, "#000000", "#000000", 0, 0,
        );
        let pen_id = t.add_bezier_annotation(&PEN_PTS, "#00ff00", 3.0, 0, "#000000");

        assert!(pen_id > 1, "id must be off its default: got {pen_id}");

        // A point on the path's bounding box — the same point both paths see.
        let (hx, hy) = HIT;
        let old = pen_hit_the_old_way(&t, hx, hy).expect("the old way must find it");
        assert_eq!(old.0, pen_id as i32);

        let hit = t.capture_pen_hit(hx, hy);
        assert_eq!(hit.id, old.0, "id must agree with shape_annotation_at");
        assert_eq!(
            hit.points, old.1,
            "points must agree with get_shape_annotations"
        );
        // And independently of the old way, against the input itself.
        assert_eq!(
            hit.points,
            PEN_PTS.to_vec(),
            "points must be the flat input"
        );
        assert_eq!(hit.points.len(), 8, "four control points, flattened");
        assert_ne!(hit.id, 0, "id is off the i32 default");
        assert_ne!(hit.id, -1, "id is off the miss sentinel");
    }

    #[test]
    fn capture_pen_hit_misses_report_minus_one_and_no_points() {
        let mut t = ImageHorseTool::new(128, 128);
        t.load_image(&solid(128, 128, [10, 20, 30, 255]));
        t.add_bezier_annotation(&PEN_PTS, "#00ff00", 3.0, 0, "#000000");

        // Far outside the path's padded bbox.
        let hit = t.capture_pen_hit(126.0, 126.0);
        assert_eq!(hit.id, -1, "empty space is a miss");
        assert!(hit.points.is_empty(), "a miss carries no points");
        assert!(
            pen_hit_the_old_way(&t, 126.0, 126.0).is_none(),
            "and the old way agrees it is a miss"
        );
    }

    #[test]
    fn capture_pen_hit_is_topmost_then_check_not_find_a_bezier() {
        // THE BEHAVIOUR-PRESERVING CASE, and the one a "smarter" implementation
        // breaks. `shape_annotation_at` returns the newest shape of ANY kind;
        // the caller then required kind 7. So a rectangle drawn OVER a pen path
        // means "no pen path here". An implementation that filtered to kind 7
        // inside the hit-test loop would reach through the rectangle and return
        // the path — a different feature, silently introduced.
        let mut t = ImageHorseTool::new(128, 128);
        t.load_image(&solid(128, 128, [10, 20, 30, 255]));
        t.add_bezier_annotation(&PEN_PTS, "#00ff00", 3.0, 0, "#000000");
        // A rect covering the whole path, added AFTER it so it is newest.
        t.add_shape_annotation(
            0, 5.0, 5.0, 95.0, 95.0, "#ff0000", 2.0, 0, 0, "#000000", "#000000", 0, 0,
        );

        let hit = t.capture_pen_hit(HIT.0, HIT.1);
        assert_eq!(
            hit.id, -1,
            "a shape on top of the path must read as a miss, not reach through it"
        );
        assert!(hit.points.is_empty());
        // The old way must agree — this is the whole point of the assertion.
        let old = pen_hit_the_old_way(&t, HIT.0, HIT.1);
        assert!(
            old.is_none(),
            "the code being replaced also returned nothing here"
        );
    }

    #[test]
    fn capture_pen_hit_takes_self_by_reference() {
        // `&self` is what makes the capture atomic behind the worker: the
        // document cannot be mutated while it runs. A future edit promoting it
        // to `&mut self` would silently remove that guarantee, so it is pinned
        // by compiling a call through a shared reference — which does not
        // compile against `&mut self`.
        let mut t = ImageHorseTool::new(64, 64);
        t.load_image(&solid(64, 64, [1, 2, 3, 255]));
        let id = t.add_bezier_annotation(&PEN_PTS, "#00ff00", 3.0, 0, "#000000");

        fn through_shared_ref(t: &ImageHorseTool, x: f64, y: f64) -> i32 {
            t.capture_pen_hit(x, y).id
        }
        // Two live shared borrows across the call: impossible if it took &mut.
        let borrow_a = &t;
        let borrow_b = &t;
        assert_eq!(through_shared_ref(borrow_a, HIT.0, HIT.1), id as i32);
        assert_eq!(borrow_b.capture_pen_hit(HIT.0, HIT.1).id, id as i32);
    }

    #[test]
    fn capture_pen_hit_ignores_non_bezier_shapes_under_the_point() {
        // A rect alone under the point: hit-test finds it, kind check rejects
        // it. Distinguishes "found nothing" from "found something that is not a
        // pen path" — both are -1, and they must be.
        let mut t = ImageHorseTool::new(128, 128);
        t.load_image(&solid(128, 128, [10, 20, 30, 255]));
        t.add_shape_annotation(
            0, 20.0, 20.0, 60.0, 60.0, "#ff0000", 2.0, 0, 0, "#000000", "#000000", 0, 0,
        );

        assert!(
            t.shape_annotation_at(40.0, 40.0) >= 0,
            "control: the rect IS under the point"
        );
        let hit = t.capture_pen_hit(40.0, 40.0);
        assert_eq!(hit.id, -1, "a rect is not a pen path");
        assert!(hit.points.is_empty());
    }

    // ── capture_layer_stack ────────────────────────────────────────────────
    //
    // Driven off defaults throughout: a NON-square canvas (so width and height
    // cannot be swapped undetectably), more than one layer, and an active layer
    // that is neither the first nor the default id.

    #[test]
    fn capture_layer_stack_agrees_with_the_five_getters_it_replaces() {
        let mut t = ImageHorseTool::new(37, 21); // non-square, non-round
        t.load_image(&solid(37, 21, [10, 20, 30, 255]));
        t.add_layer("second");
        let third = t.add_layer("third");
        t.add_layer("fourth");
        // Make a layer active that is NOT the last added and NOT index 0.
        assert!(t.set_active_layer(third), "control: the layer exists");

        let cap = t.capture_layer_stack();

        assert_eq!(cap.width, t.width(), "width must agree with the getter");
        assert_eq!(cap.height, t.height(), "height must agree with the getter");
        assert_eq!(
            cap.layer_count,
            t.layer_count() as u32,
            "layer_count must agree with the getter"
        );
        assert_eq!(
            cap.active_layer_id,
            t.active_layer_id(),
            "active_layer_id must agree with the getter"
        );
        assert_eq!(
            cap.layers_json,
            t.get_layers(),
            "layers_json must be the getter's string verbatim"
        );

        // Off their defaults, so none of the above can pass by accident.
        assert_ne!(cap.width, cap.height, "a square canvas would hide a swap");
        assert_eq!(cap.width, 37);
        assert_eq!(cap.height, 21);
        assert!(cap.layer_count > 2, "got {}", cap.layer_count);
        assert_eq!(cap.active_layer_id, third);
        assert_ne!(cap.active_layer_id, 0, "0 is the not-found fallback");
        assert!(cap.layers_json.contains("\"name\":\"third\""));
    }

    #[test]
    fn capture_layer_stack_count_matches_the_json_array_length() {
        // The invariant `openraster/export.ts` leans on: it iterates by count
        // and indexes into the parsed array. If these ever disagreed the export
        // would silently skip or overrun a layer, so it is pinned here rather
        // than assumed at the call site.
        let mut t = ImageHorseTool::new(16, 9);
        t.load_image(&solid(16, 9, [1, 2, 3, 255]));
        t.add_layer("b");
        t.add_layer("c");

        let cap = t.capture_layer_stack();
        let objects = cap.layers_json.matches("\"id\":").count() as u32;
        assert_eq!(
            cap.layer_count, objects,
            "layer_count must equal the number of layer objects in layers_json"
        );
        assert!(cap.layer_count >= 3, "got {}", cap.layer_count);
    }

    #[test]
    fn capture_layer_stack_counts_every_layer_including_the_canvas() {
        // `layer_count()` counts ALL layers; `content_layer_count()` excludes the
        // artboard Canvas (ADR-016). A document with no artboard makes the two
        // equal, which is why the first version of these tests could not tell
        // them apart and a `content_layer_count` mutant survived.
        //
        // It is not a cosmetic distinction: `exportOra` iterates
        // `for (i = n - 1; i >= 0; i--)` writing `data/layer${i}.png` from
        // `get_layer_png(i)`. The content count would silently drop a layer from
        // the archive — a lossy `.ora` with nothing thrown.
        let mut t = ImageHorseTool::new(40, 30);
        t.load_image_artboard(
            &solid(20, 15, [200, 100, 50, 255]),
            20,
            15,
            5,
            8,
            9,
            10,
            255,
        );
        t.add_layer("content-b");

        let cap = t.capture_layer_stack();
        assert!(
            t.content_layer_count() < t.layer_count(),
            "control: this fixture must actually HAVE a canvas layer \
             (layer_count {}, content {})",
            t.layer_count(),
            t.content_layer_count()
        );
        assert_eq!(
            cap.layer_count,
            t.layer_count() as u32,
            "layer_count must count EVERY layer, canvas included"
        );
        assert_ne!(
            cap.layer_count,
            t.content_layer_count() as u32,
            "and must not be the content-only count"
        );
        assert!(cap.layers_json.contains("\"kind\":\"canvas\""));
    }

    #[test]
    fn capture_layer_stack_touches_no_pixels() {
        // This capture must never grow a field that touches pixels. When it was
        // added, the contrast was `capture_ui_state`'s `has_transparency`, which
        // composited the whole document; v7.96 removed that field, so BOTH
        // captures are cheap now and the contrast no longer exists.
        //
        // The invariant this still pins is the one that matters going forward:
        // capturing must not disturb the document, and every field must still
        // equal its getter after an arbitrary number of captures. Proven
        // structurally rather than by timing — a timing assertion on a build
        // machine is a flake.
        let mut t = ImageHorseTool::new(64, 48);
        t.load_image(&solid(64, 48, [9, 8, 7, 255]));
        t.add_layer("b");

        let before = t.get_layers();
        for _ in 0..25 {
            let c = t.capture_layer_stack();
            assert_eq!(c.width, 64);
            assert_eq!(c.layer_count, t.layer_count() as u32);
        }
        assert_eq!(t.get_layers(), before, "capturing must not mutate anything");

        // The two captures overlap on width/height/layers/active-id and must
        // never disagree — both are aggregations of the same getters.
        let ui = t.capture_ui_state();
        let ls = t.capture_layer_stack();
        assert_eq!(ui.width, ls.width, "shared field: width");
        assert_eq!(ui.height, ls.height, "shared field: height");
        assert_eq!(ui.layers_json, ls.layers_json, "shared field: layers_json");
        assert_eq!(
            ui.active_layer_id, ls.active_layer_id,
            "shared field: active_layer_id"
        );
    }

    #[test]
    fn capture_layer_stack_takes_self_by_reference() {
        // `&self` is what makes the capture atomic behind the worker. Pinned by
        // holding two shared borrows across the call, which does not compile
        // against `&mut self`.
        let mut t = ImageHorseTool::new(20, 12);
        t.load_image(&solid(20, 12, [4, 5, 6, 255]));
        t.add_layer("b");

        fn through_shared_ref(t: &ImageHorseTool) -> u32 {
            t.capture_layer_stack().layer_count
        }
        let borrow_a = &t;
        let borrow_b = &t;
        assert_eq!(through_shared_ref(borrow_a), t.layer_count() as u32);
        assert_eq!(borrow_b.capture_layer_stack().width, 20);
    }
}
