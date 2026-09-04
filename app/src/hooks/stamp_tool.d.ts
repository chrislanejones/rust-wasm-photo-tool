declare module "stamp_tool" {
  export default function init(): Promise<void>;

  /** Gallery photo cap for an account tier ("demo" | "loggedIn" | "paid"). */
  export function photo_limit(tier: string): number;

  /** Solid-color RGBA image, PNG-encoded (blank canvas). r/g/b/a are 0..=255
   *  (a = 0 → fully transparent surface). */
  export function blank_png(
    width: number,
    height: number,
    r: number,
    g: number,
    b: number,
    a: number,
  ): Uint8Array;

  /**
   * Web-performance indicators for the Resize & Compress panel.
   * Returns `[pageSpeedScore, webPerformanceGain]`, both 0..100.
   * Byte-aware (log-normal on the projected delivered size) and
   * PSI-audit-aware: format codes (0=png 1=jpeg 2=webp 3=avif, other=neutral)
   * model the "next-gen formats" audit, and output wider than 1920px accrues
   * a "properly size images" score penalty.
   */
  export function web_perf_metrics(
    curW: number,
    curH: number,
    curBytes: number,
    origBytes: number,
    newW: number,
    newH: number,
    quality: number,
    curFormat: number,
    newFormat: number,
  ): Float64Array;

  /**
   * Stateless: composite `src` (RGBA, sw*sh*4 bytes) onto a copy of `target`
   * (RGBA, tw*th*4 bytes) at (dx, dy) with opacity in [0, 1]. Returns the new
   * buffer. Does not touch any ImageHorseTool state.
   */
  export function composite_pixels(
    target: Uint8Array,
    tw: number,
    th: number,
    src: Uint8Array,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    opacity: number,
  ): Uint8Array;

  /**
   * Stateless: describe what an RGBA image looks like, as a JSON object —
   * the engine behind Batch → AI Rename. Parse with `parseDescription`
   * (app/src/lib/describeImage.ts), which owns the matching TS shape.
   *
   * Offline and account-free: it measures the pixels (hue histogram, luma
   * mean/variance, gradient energy, palette diversity, skin/foliage/sky
   * ratios). It describes an image; it does not recognise objects in it.
   */
  export function describe_image(
    pixels: Uint8Array,
    w: number,
    h: number,
  ): string;

  /**
   * Stateless bilinear resize of an RGBA buffer.
   * Used by the batch-logo feature to scale logos in Rust.
   */
  export function resize_pixels(
    pixels: Uint8Array,
    old_w: number,
    old_h: number,
    new_w: number,
    new_h: number,
  ): Uint8Array;

  /**
   * Stateless: encode an RGBA pixel buffer as PNG bytes.
   * Used by the batch-logo feature to skip the OffscreenCanvas round-trip.
   */
  export function encode_png_pixels(
    pixels: Uint8Array,
    width: number,
    height: number,
  ): Uint8Array;

  /**
   * Return value of `decode_png_to_rgba`: decoded pixels + dimensions out of
   * one wasm-bindgen call. Call `.free()` once you've read the fields you
   * need — it holds a boxed allocation on the wasm heap.
   */
  export class DecodedPng {
    private constructor();
    free(): void;
    width: number;
    height: number;
    rgba: Uint8Array;
  }

  /**
   * Pixels + the dimensions that describe them, out of one wasm-bindgen call.
   * Returned by `capture_composite()` and `capture_thumbnail()`.
   *
   * Read each field ONCE and then `.free()`. Every access to `.rgba` clones
   * the whole buffer out of wasm memory (~10 MB for a 3072×864 composite),
   * and the object holds a boxed allocation on the wasm heap until freed.
   * `openraster/import.ts` shows the shape: destructure, free, return.
   */
  export class RgbaCapture {
    private constructor();
    free(): void;
    width: number;
    height: number;
    rgba: Uint8Array;
  }

  /**
   * The ten values `useEngineCore`'s `syncState` publishes to React, out of
   * one wasm-bindgen call. Returned by `capture_ui_state()`.
   *
   * Was eleven until v7.96, when `has_transparency` was removed — it was the
   * entire cost of this call (a full document composite) and nothing consumed
   * it. `has_transparency()` is still available as a method for a caller that
   * genuinely wants it.
   *
   * No pixels — that is the difference from `capture_state()`, which carries
   * every undo/redo snapshot PNG. One is what gets DRAWN, the other is what
   * gets SAVED. `history_labels` and `layers_json` arrive RAW because the JS
   * owns both formats; parse them the same way `syncState` always has.
   *
   * Read each field once and `.free()` when done.
   */
  /**
   * The size an export will produce, with no pixels attached. Returned by
   * `export_dims_excluding_background()`.
   *
   * Both fields are plain numbers, so unlike `RgbaCapture` reading them copies
   * nothing out of wasm memory. Still `.free()` it — it is a boxed allocation
   * on the wasm heap like every other wasm-bindgen struct.
   */
  export class ExportDims {
    private constructor();
    free(): void;
    width: number;
    height: number;
  }

  /**
   * The layer stack and the canvas it sits on, with NO pixels touched.
   * Returned by `capture_layer_stack()`.
   *
   * Every field except `layer_count` is also on `UiStateCapture`. The original
   * reason to prefer this one — that `UiStateCapture.has_transparency`
   * composited the whole document — went away in v7.96 when that field was
   * removed for having no consumer. What is left is that `capture_ui_state`
   * builds `history_labels` over the whole undo stack, which an export has no
   * use for, and that the export path should not be shaped by the render
   * capture. See `LayerStackCapture` in src/capture.rs for the full note.
   *
   * `layer_count` always equals `JSON.parse(layers_json).length`.
   * Read each field once and `.free()` when done.
   */
  export class LayerStackCapture {
    private constructor();
    free(): void;
    width: number;
    height: number;
    layer_count: number;
    active_layer_id: number;
    layers_json: string;
  }

  /**
   * The pen path under a canvas point, hit-test and lookup in one call.
   * Returned by `capture_pen_hit()`.
   *
   * `id` is -1 for "no pen path here" — the same sentinel
   * `shape_annotation_at` uses — and covers BOTH "nothing is there" and "the
   * topmost shape there is not a pen path". `points` is the flat control
   * sequence `[x0,y0,x1,y1,…]`, empty on a miss.
   *
   * Tens of floats, not megabytes, so there is no read-once discipline here
   * beyond the usual `.free()`.
   */
  export class PenHit {
    private constructor();
    free(): void;
    id: number;
    points: Float64Array;
  }

  export class UiStateCapture {
    private constructor();
    free(): void;
    has_source: boolean;
    undo_count: number;
    redo_count: number;
    history_labels: string;
    zoom: number;
    width: number;
    height: number;
    layers_json: string;
    active_layer_id: number;
    export_quality: number;
  }

  /**
   * Stateless: decode PNG bytes back into straight (non-premultiplied)
   * RGBA8 pixels, normalizing any source color type (RGB, RGBA, indexed,
   * grayscale…) to the same convention `encode_png_pixels`/`get_layer_png`
   * write on the way out. The inverse of `encode_png_pixels`. Throws (a
   * JS-catchable exception, not a WASM trap) on corrupt/non-PNG input.
   */
  export function decode_png_to_rgba(png: Uint8Array): DecodedPng;

  /**
   * Parse a CSS-ish color string into RGBA bytes.
   * Accepts: #rgb, #rgba, #rrggbb, #rrggbbaa, rgb(...), rgba(...).
   * Returns a 4-byte Uint8Array [r, g, b, a] on success, or an empty
   * Uint8Array on parse failure.
   */
  export function parse_color(input: string): Uint8Array;

  /**
   * Grid-overlay line geometry. Returns a flat list of segments
   * `[x1, y1, x2, y2, …]` in image-space px. `kind`: 0 = square (param_a =
   * spacing px), 1 = golden ratio, 2 = columns×rows (param_a = cols, param_b =
   * rows). The "Rulers & Grids" single source of grid-layout math.
   */
  export function grid_lines(
    width: number,
    height: number,
    kind: number,
    param_a: number,
    param_b: number,
  ): Float32Array;

  /**
   * Compute the largest centred rectangle with the given aspect ratio
   * that fits inside an `image_w` × `image_h` image. Returns `[x, y, w, h]`
   * as a Uint32Array, or `undefined` if any input is 0.
   */
  export function compute_aspect_crop(
    image_w: number,
    image_h: number,
    ratio_w: number,
    ratio_h: number,
  ): Uint32Array | undefined;

  /**
   * Snap a free drag to a locked aspect ratio. Anchored at (start_x, start_y),
   * extends toward (end_x, end_y), scaled so width/height match ratio_w/ratio_h,
   * clipped to image bounds. Returns `[x, y, w, h]` as a Uint32Array, or
   * `undefined` on invalid input.
   */
  export function constrain_crop_to_ratio(
    start_x: number,
    start_y: number,
    end_x: number,
    end_y: number,
    ratio_w: number,
    ratio_h: number,
    image_w: number,
    image_h: number,
  ): Uint32Array | undefined;

  export class ImageHorseTool {
    constructor(width: number, height: number);
    free(): void;
    load_image(pixels: Uint8Array): void;
    load_image_artboard(
      pixels: Uint8Array,
      img_w: number,
      img_h: number,
      pad: number,
      bg_r: number,
      bg_g: number,
      bg_b: number,
      bg_a: number,
    ): void;
    set_source(x: number, y: number): void;
    has_source(): boolean;
    set_brush_size(size: number): void;
    get_brush_size(): number;
    set_hardness(h: number): void;
    set_opacity(o: number): void;
    set_spacing(s: number): void;
    set_zoom(z: number): void;
    get_zoom(): number;
    adjust_zoom(delta: number): void;
    begin_stroke(dest_x: number, dest_y: number): void;
    continue_stroke(dest_x: number, dest_y: number): void;
    end_stroke(): void;
    set_max_history(n: number): void;
    undo(): boolean;
    redo(): boolean;
    undo_count(): number;
    redo_count(): number;
    history_labels(): string;
    jump_to_history(index: number): boolean;
    delete_history_entry(index: number): boolean;
    clear_history(): void;
    get_image_data(): Uint8Array;
    /** Composite cropped to content with the artboard's backing "Background"
     *  layer left out. Dimensions: export_width/height_excluding_background. */
    get_image_data_excluding_background(): Uint8Array;
    export_width_excluding_background(): number;
    export_height_excluding_background(): number;
    /** Returns true if any pixel in the loaded image has alpha < 255.
     *
     *  ⚠️ EXPENSIVE — it composites the entire document into a fresh RGBA
     *  buffer before scanning, so `.any()`'s early exit saves nothing (~30 ms
     *  on a 1385x2068 document). It was removed from `capture_ui_state()` in
     *  v7.96 precisely because `syncState` paid that on every mutation for a
     *  value nothing read. Call it deliberately, not on a hot or per-sync path;
     *  if a consumer ever needs it cheap, that is the point to design a cached
     *  flag with real invalidation. */
    has_transparency(): boolean;
    export_png(): Uint8Array;
    /** ADR-024 Stage 3.5 — everything the save path reads, in ONE call.
     *
     *  Exists so the save capture cannot be interleaved. The 18 separate reads
     *  it replaces had no `await` between them and `useEditPersistence.ts` says
     *  that is load-bearing: a capture that yields lets a photo switch land
     *  midway, and the second half of the archive would describe the incoming
     *  photo while being stored under the outgoing photo's key.
     *
     *  Returns a TRANSPORT frame (magic "IHCS"), not the persisted archive —
     *  `encodeArchive` still owns the bytes on disk. See src/capture.rs. */
    capture_state(): Uint8Array;
    /** The composite and its dimensions, atomically — the one-call form of
     *  `get_image_data()` + `width()` + `height()`. Prefer it wherever the
     *  pixels are encoded or scaled AT those dimensions: read separately,
     *  behind the worker, a resize can land between them and pair one state's
     *  pixels with another state's size. Free it when done. */
    /** The eleven values React renders from, atomically — the one-call form of
     *  the reads `syncState` used to make. Split behind the worker, React would
     *  render a snapshot that never existed (a width from before a resize
     *  beside an undo count from after). NOT `capture_state()`: that one is
     *  what gets saved, this is what gets drawn. Free it when done. */
    capture_ui_state(): UiStateCapture;
    /** The pen path under a canvas point, atomically — the one-call form of
     *  `shape_annotation_at(x, y)` + `get_shape_annotations()`. HIT-TEST THEN
     *  LOOK UP: an id is only meaningful against the list it was drawn from,
     *  and behind the worker a shape deleted between the two reads makes the
     *  lookup miss and the click do nothing, silently. `id` is -1 for both
     *  "nothing there" and "the topmost shape there is not a pen path" —
     *  TOPMOST-THEN-CHECK, so a rectangle over a path still means no path.
     *  Free it when done. */
    capture_pen_hit(x: number, y: number): PenHit;
    /** The layer stack and its canvas, atomically and WITHOUT compositing —
     *  the one-call form of `layer_count()` + `width()` + `height()` +
     *  `active_layer_id()` + `get_layers()`. Both captures are cheap since
     *  v7.96; prefer this one where the undo-history label string is not
     *  wanted. Free it when done. */
    capture_layer_stack(): LayerStackCapture;
    capture_composite(): RgbaCapture;
    /** The background-excluded composite and its CROPPED dimensions, atomically
     *  — the one-call form of `get_image_data_excluding_background()` +
     *  `export_width_excluding_background()` + `export_height_excluding_background()`.
     *  Prefer it everywhere: those three getters each recompute the whole
     *  composite + tight-bbox + crop internally, so the split form does the
     *  work three times, and the crop is content-dependent so the three reads
     *  can disagree. Free it when done. */
    capture_composite_excluding_background(): RgbaCapture;
    /** The size an export will produce, WITHOUT producing it — the one-call
     *  form of `export_width_excluding_background()` +
     *  `export_height_excluding_background()`, each of which composites the
     *  whole document internally. Use this for anything that only needs the
     *  numbers (a caption, a label); do NOT reach for
     *  `capture_composite_excluding_background()` there, because reading its
     *  `.rgba` copies ~11 MB you would immediately discard. Free it when done. */
    export_dims_excluding_background(): ExportDims;
    width(): number;
    height(): number;
    data_ptr(): number;
    data_len(): number;
    /** The scaled thumbnail and its dimensions, atomically — the one-call form
     *  of `thumbnail_width(n)` + `thumbnail_height(n)` + `thumbnail_data(n)`.
     *  `codec::thumbnail_data` computes all three together anyway; the split
     *  wrappers threw two away at the boundary. Free it when done. */
    capture_thumbnail(max_px: number): RgbaCapture;
    thumbnail_width(max_px: number): number;
    thumbnail_height(max_px: number): number;
    thumbnail_data(max_px: number): Uint8Array;
    copy_region(x: number, y: number, w: number, h: number): Uint8Array;
    /** Copy a region out of the VISIBLE COMPOSITE rather than the active
     *  layer. `include_background` mirrors the `exportCanvasBackground`
     *  preference. Not tight-cropped — the rect is in document coordinates. */
    copy_region_composited(
      x: number,
      y: number,
      w: number,
      h: number,
      include_background: boolean,
    ): Uint8Array;
    paste_region(
      pixels: Uint8Array,
      src_w: number,
      src_h: number,
      dest_x: number,
      dest_y: number,
    ): void;
    flip_horizontal(): void;
    flip_vertical(): void;
    rotate_90_cw(): void;
    rotate_90_ccw(): void;
    crop(x: number, y: number, w: number, h: number): void;
    resize(new_w: number, new_h: number): void;
    /**
     * Resize with a selectable resampling filter.
     * 0 = nearest, 1 = bilinear, 2 = catmull-rom, 3 = lanczos3.
     */
    resize_with_filter(new_w: number, new_h: number, filter: number): void;
    /**
     * Photoshop-style **Canvas Size** — change the document to new_w × new_h
     * WITHOUT resampling any layer (re-blits each layer's native pixels at the
     * anchor; crops where smaller, transparent pad where larger). `anchor` is a
     * 0..=8 nine-grid (4 = centre, the UI default). The bottom Background layer
     * of a multi-layer doc is refilled with bg_* (bg_a = 0 ⇒ transparent ⇒
     * checkerboard). Pushes one "Canvas Size" history step.
     */
    resize_canvas(
      new_w: number,
      new_h: number,
      anchor: number,
      bg_r: number,
      bg_g: number,
      bg_b: number,
      bg_a: number,
    ): void;
    /**
     * Normalize the doc to an artboard: photo at native size, centred, with a
     * uniform `pad`-px border filled with bg_* (bg_a = 0 ⇒ transparent ⇒
     * checkerboard). ABSOLUTE and IDEMPOTENT — always yields exactly
     * photoW + 2*pad × photoH + 2*pad regardless of the current size, so a
     * "jumbo" doc snaps back to photo + border and repeated calls don't
     * accumulate. Grows a Background layer if the doc has none (artboard-on
     * always ends as Background + Photo). Pushes one "Canvas Border" step.
     */
    set_artboard_border(
      pad: number,
      bg_r: number,
      bg_g: number,
      bg_b: number,
      bg_a: number,
    ): void;
    /** History marker for a quality/format-only re-encode (pixels unchanged). */
    /** Record a quality-only Apply, capturing the quality it applied.
     *  ADR-031 — snaps first so the step carries the OUTGOING quality. */
    push_compress_marker(quality: number): void;
    /** Export quality, 1..=100. Engine-owned; React reads this rather than
     *  keeping its own copy (ADR-031). */
    export_quality(): number;
    /** Set export quality WITHOUT a history step — for the live slider drag. */
    set_export_quality(quality: number): void;
    /** Commit a quality change as its OWN undo step, without applying
     *  compression. Fired on slider release, so one drag is one step. Records
     *  nothing when the value did not move (ADR-031). */
    commit_export_quality(quality: number): void;
    adjust_brightness(delta: number): void;
    adjust_contrast(factor: number): void;
    /** 0 = grayscale, 1 = unchanged, >1 = more saturated (grayscale-lerp
     *  against the pixel's own luminance, like CSS `filter: saturate()`). */
    adjust_saturation(factor: number): void;
    /** Lifts (brightens) shadows, luminance-masked to peak in dark tones. */
    adjust_shadows(amount: number): void;
    /** Recovers (darkens) blown highlights, luminance-masked to peak in bright tones. */
    adjust_highlights(amount: number): void;
    /** Unsharp-mask sharpen over the whole active layer. 0 = no sharpening. */
    adjust_sharpen(amount: number): void;
    blur_region(
      cx: number,
      cy: number,
      brush_radius: number,
      intensity: number,
    ): void;
    begin_blur_stroke(): void;
    /** Blur the whole image, snapshot included — geometry computed engine-side
     *  so the caller never measures width/height and hands them back. */
    blur_whole_image(intensity: number): void;
    /** Pixelate (mosaic) a circular brush region into block_size px squares. */
    pixelate_region(
      cx: number,
      cy: number,
      brush_radius: number,
      block_size: number,
    ): void;
    begin_pixelate_stroke(): void;
    /** Paint an opaque solid colour over a circular brush region (redaction). */
    redact_region(
      cx: number,
      cy: number,
      brush_radius: number,
      r: number,
      g: number,
      b: number,
    ): void;
    begin_redact_stroke(): void;
    begin_draw_stroke(label: string): void;
    draw_arrow(
      from_x: number,
      from_y: number,
      to_x: number,
      to_y: number,
      color_hex: string,
      stroke_width: number,
      style: number,
    ): void;
    draw_shape(
      from_x: number,
      from_y: number,
      to_x: number,
      to_y: number,
      shape: number,
      color_hex: string,
      stroke_width: number,
    ): void;
    stamp_pixels(
      pixels: Uint8Array,
      src_w: number,
      src_h: number,
      dest_x: number,
      dest_y: number,
    ): void;
    stamp_red(
      pixels: Uint8Array,
      src_w: number,
      src_h: number,
      dest_x: number,
      dest_y: number,
      target_size: number,
    ): void;
    /** Render text with the embedded Liberation Sans font and composite onto the
     *  buffer. `dest_x/dest_y` is the top-left of the TEXT itself — a background
     *  box (kind 1) grows outward from it by `bg_padding`, text position never
     *  shifts. `background_kind`: 0 = none, 1 = solid rect. No bubble (kind 2) —
     *  batch text is a one-shot bake with no live overlay for a tail control. */
    commit_text(
      text: string,
      font_size: number,
      r: number,
      g: number,
      b: number,
      bold: boolean,
      dest_x: number,
      dest_y: number,
      angle_deg: number,
      background_kind: number,
      bg_r: number,
      bg_g: number,
      bg_b: number,
      bg_a: number,
      bg_padding: number,
      bg_corner_radius: number,
    ): void;
    /** Returns [width, height] in pixels for the given text, without committing. */
    measure_text(text: string, font_size: number, bold: boolean): Uint32Array;
    /** Render a stamp label (bordered, rotated) entirely in Rust and composite centred on dest. */
    commit_red_stamp(
      label: string,
      r: number,
      g: number,
      b: number,
      dest_x: number,
      dest_y: number,
      target_size: number,
      angle_deg: number,
    ): void;
    /** Snapshot the layer (history `label`) + prime the per-stroke coverage
     *  buffer. Called internally by paint_down / erase_down. */
    paint_begin(label: string): void;
    paint_dab(
      cx: number,
      cy: number,
      radius: number,
      r: number,
      g: number,
      b: number,
      opacity: number,
    ): void;
    paint_stroke_to(
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      radius: number,
      r: number,
      g: number,
      b: number,
      opacity: number,
    ): void;
    /** Begin a stabilized ("lazy mouse") stroke, anchoring the tip. */
    paint_stab_begin(x: number, y: number): void;
    /** Advance the stabilized tip toward the cursor; paints + returns true if it cleared the leash. */
    paint_stab_to(
      raw_x: number, raw_y: number, leash: number,
      radius: number, r: number, g: number, b: number, opacity: number,
    ): boolean;
    /** Catch up to the real cursor on stroke end and clear the stabilizer. */
    paint_stab_flush(
      raw_x: number, raw_y: number,
      radius: number, r: number, g: number, b: number, opacity: number,
    ): boolean;
    /** High-level brush driver — JS forwards pointer coords; hex parse, edge
     *  hardness (0..1), stabilizer leash, stroke state, and per-stroke opacity
     *  all live in Rust. */
    paint_down(
      x: number, y: number, size: number,
      color: string, opacity: number, hardness: number, stab: string,
    ): void;
    /** Continue the active stroke; returns true if it painted (→ flush). */
    paint_move(x: number, y: number): boolean;
    /** End the active stroke (stabilizer catch-up) + free buffers; true if painted. */
    paint_up(): boolean;
    /** Eraser driver — mirror of paint_down sharing the dab/coverage/stabilizer
     *  engine, but clears the active layer's alpha instead of laying down colour
     *  (no colour arg; hardness is 0..1). */
    erase_down(
      x: number, y: number, size: number,
      opacity: number, hardness: number, stab: string,
    ): void;
    /** Continue the active eraser stroke; true if it scrubbed pixels (→ flush). */
    erase_move(x: number, y: number): boolean;
    /** End the active eraser stroke + free buffers; true if it scrubbed. */
    erase_up(): boolean;
    /** Effects-brush driver (blur / pixelate / redaction) — mirrors the paint
     *  driver; mode branch, hex parse, and stroke interpolation live in Rust.
     *  `mode` is "blur" | "pixelate" | "solid". */
    effect_down(
      x: number, y: number, size: number,
      mode: string, intensity: number, pixel_size: number, color: string,
    ): void;
    effect_move(x: number, y: number): boolean;
    effect_up(): void;

    // Color picker helpers (Rust pixel sampling)
    get_pixel(x: number, y: number): Uint8Array;
    get_pixel_region(cx: number, cy: number, radius: number): Uint8Array;

    // ── Text annotations (live overlay, re-editable until flattened) ──
    add_text_annotation(
      text: string,
      font_size: number,
      r: number,
      g: number,
      b: number,
      bold: boolean,
      x: number,
      y: number,
      rotation_deg: number,
      background_kind: number,
      bg_r: number,
      bg_g: number,
      bg_b: number,
      bg_a: number,
      bg_padding: number,
      bg_corner_radius: number,
      bg_tail: number,
    ): number;
    update_text_annotation(
      id: number,
      text: string,
      font_size: number,
      r: number,
      g: number,
      b: number,
      bold: boolean,
      x: number,
      y: number,
      rotation_deg: number,
      background_kind: number,
      bg_r: number,
      bg_g: number,
      bg_b: number,
      bg_a: number,
      bg_padding: number,
      bg_corner_radius: number,
      bg_tail: number,
    ): boolean;
    remove_text_annotation(id: number): boolean;
    text_annotation_at(x: number, y: number): number;
    text_annotation_count(): number;
    /** [dx, dy] where the first line's glyph ink begins inside the
     *  annotation tile — the overlay↔engine anchor mapping for bg-kind 0. */
    text_ink_offset(text: string, font_size: number, bold: boolean): Int32Array;
    /** `text_ink_offset` extended to every background kind: [dx, dy] of the
     *  first line's ink inside the FULL tile (bubble tail margin +
     *  bg_padding included; no-shadow geometry). The overlay↔engine anchor
     *  mapping for ALL kinds: commit stores (x,y) = overlay ink − this,
     *  re-edit applies the exact inverse. */
    text_ink_offset_bg(
      text: string,
      font_size: number,
      bold: boolean,
      background_kind: number,
      bg_padding: number,
    ): Int32Array;
    get_text_annotations(): string;
    /** Returns whether anything was flattened (ADR-024 Stage 2 — the
     *  verdict comes from the call that does the work, so no caller has to
     *  read state first). Reports the ACTIVE layer, text AND shapes. */
    flatten_text_annotations(): boolean;

    // History snapshot serialization (for JS-side persistence)
    undo_snapshot_count(): number;
    redo_snapshot_count(): number;
    get_undo_snapshot_png(index: number): Uint8Array;
    get_undo_snapshot_label(index: number): string;
    get_redo_snapshot_png(index: number): Uint8Array;
    get_redo_snapshot_label(index: number): string;
    /** Per-snapshot annotation list as JSON (same shape as get_text_annotations). */
    get_undo_snapshot_annotations(index: number): string;
    get_redo_snapshot_annotations(index: number): string;
    inject_undo_snapshot(data: Uint8Array, w: number, h: number, label: string): void;
    inject_redo_snapshot(data: Uint8Array, w: number, h: number, label: string): void;
    /**
     * Append one annotation onto the snapshot at `snap_idx`. The tile is
     * re-rendered from the config so callers don't need to persist tile bytes.
     * Returns false if the index is out of range.
     */
    push_annotation_to_undo_snapshot(
      snap_idx: number,
      text: string,
      font_size: number,
      r: number, g: number, b: number,
      bold: boolean,
      x: number, y: number,
      rotation_deg: number,
      background_kind: number,
      bg_r: number, bg_g: number, bg_b: number, bg_a: number,
      bg_padding: number,
      bg_corner_radius: number,
      bg_tail: number,
    ): boolean;
    push_annotation_to_redo_snapshot(
      snap_idx: number,
      text: string,
      font_size: number,
      r: number, g: number, b: number,
      bold: boolean,
      x: number, y: number,
      rotation_deg: number,
      background_kind: number,
      bg_r: number, bg_g: number, bg_b: number, bg_a: number,
      bg_padding: number,
      bg_corner_radius: number,
      bg_tail: number,
    ): boolean;

    // Item 9: Crop preview in WASM
    // Uncomment after adding the Rust implementations
    // preview_crop(x: number, y: number, w: number, h: number): void;
    // cancel_crop_preview(): boolean;
    // apply_crop_from_preview(x: number, y: number, w: number, h: number): void;

    // Live text annotations (non-destructive overlay layer)
    text_annotation_count(): number;
    text_ink_offset(text: string, font_size: number, bold: boolean): Int32Array;
    text_ink_offset_bg(
      text: string,
      font_size: number,
      bold: boolean,
      background_kind: number,
      bg_padding: number,
    ): Int32Array;
    add_text_annotation(
      text: string,
      font_size: number,
      r: number,
      g: number,
      b: number,
      bold: boolean,
      x: number,
      y: number,
      rotation_deg: number,
      background_kind: number,
      bg_r: number,
      bg_g: number,
      bg_b: number,
      bg_a: number,
      bg_padding: number,
      bg_corner_radius: number,
      bg_tail: number,
    ): number;
    update_text_annotation(
      id: number,
      text: string,
      font_size: number,
      r: number,
      g: number,
      b: number,
      bold: boolean,
      x: number,
      y: number,
      rotation_deg: number,
      background_kind: number,
      bg_r: number,
      bg_g: number,
      bg_b: number,
      bg_a: number,
      bg_padding: number,
      bg_corner_radius: number,
      bg_tail: number,
    ): boolean;
    /** Set/clear the soft drop shadow on a text annotation; rebuilds its tile.
     *  on_box/on_text choose the silhouette; shared color/alpha/offset/blur. */
    /** Set a text annotation's reflow width in px (0 = don't wrap) and rebuild
     *  its tile. Returns false if `id` isn't on the active layer. v8.40.
     *
     *  ⚠️ Hand-synced shadow of the wasm-bindgen signature — this file
     *  ambiently SHADOWS pkg's generated types, so a drift here type-checks
     *  and dies at runtime. */
    set_text_wrap_width(id: number, wrap_width: number): boolean;
    /** Set a text annotation's BOX HEIGHT in px (0 = size the box to the text)
     *  and rebuild its tile. Returns false if `id` isn't on the active layer.
     *  The vertical twin of `set_text_wrap_width`. v8.41.
     *
     *  ⚠️ Same hand-sync warning as above — this file ambiently SHADOWS pkg's
     *  generated types, so a drift here type-checks and dies at runtime. */
    set_text_box_height(id: number, box_height: number): boolean;
    /** Set a text annotation's projective corner quad and rebuild its tile
     *  through it. `quad` is 8 floats, `[x0,y0,…,x3,y3]`, NORMALISED 0..1
     *  across the tile, in TL/TR/BR/BL order. Returns false for a wrong-length
     *  quad or an id that isn't on the active layer. v8.42.
     *
     *  Normalised, not pixels — that is what keeps the warp attached to the
     *  text through an edit. See `perspective::warp_normalised` in the crate.
     *
     *  ⚠️ Same hand-sync warning as above — this file ambiently SHADOWS pkg's
     *  generated types, so a drift here type-checks and dies at runtime. */
    set_text_perspective(id: number, quad: Float32Array): boolean;
    /** A text annotation's current corner quad, flat (8 floats). EMPTY when the
     *  id isn't on the active layer — an empty result and an identity quad are
     *  different answers, so callers check `length`. v8.42.
     *
     *  ⚠️ Same hand-sync warning as above. */
    text_perspective_of(id: number): Float32Array;
    /** Perspective tool, DESTRUCTIVE half — lift the pixels in `(x,y,w,h)` off
     *  the active layer and resample them into `quad` (8 floats, ABSOLUTE
     *  canvas coords, TL/TR/BR/BL). Pushes one "Perspective" history step and
     *  records one op. Returns false, having changed nothing, for a degenerate
     *  or self-crossing quad. v8.42.
     *
     *  ⚠️ Same hand-sync warning as above. */
    perspective_warp_region(
      x: number,
      y: number,
      w: number,
      h: number,
      quad: Float32Array,
    ): boolean;
    set_text_shadow(
      id: number,
      on_box: boolean,
      on_text: boolean,
      color_hex: string,
      alpha: number,
      dx: number,
      dy: number,
      blur: number,
    ): boolean;
    remove_text_annotation(id: number): boolean;
    get_text_annotations(): string;
    /** Returns the matching annotation id, or -1 if no hit. */
    text_annotation_at(x: number, y: number): number;
    render_with_annotations(): Uint8Array;
    /** Returns whether anything was flattened (ADR-024 Stage 2 — the
     *  verdict comes from the call that does the work, so no caller has to
     *  read state first). Reports the ACTIVE layer, text AND shapes. */
    flatten_text_annotations(): boolean;

    // ── Layers (Photoshop-style stack) ──
    /** Recompute the cached composite of all visible layers (call before reading data_ptr). */
    recomposite(): void;
    /** Every layer in the stack, Canvas included — what the Layers panel shows. */
    layer_count(): number;
    /** Real PIXEL layers: the Canvas fill does NOT count (ADR-016). A default
     *  document (Canvas + Photo) answers 1. This — not `layer_count()` — is what
     *  decides whether the op log can describe the document (`isLogTrustworthy`). */
    content_layer_count(): number;
    /** JSON array bottom→top:
     *  [{id,name,kind,visible,opacity,active,hasMask,overlay}].
     *  `kind` is "canvas" for the artboard fill, "content" otherwise.
     *  `overlay` is null or {color:"#rrggbb",opacity:0..1}. */
    get_layers(): string;
    /** Id of the active layer (receives all tool edits). */
    active_layer_id(): number;
    /** Add a transparent layer above the active one; it becomes active. Returns its id. */
    add_layer(name: string): number;
    /** Duplicate a layer (pixels + annotations) above it. Returns the new id (0 if not found). */
    duplicate_layer(id: number): number;
    /** Remove a layer (refuses the last one). Returns true if removed. */
    remove_layer(id: number): boolean;
    set_active_layer(id: number): boolean;
    set_layer_visible(id: number, visible: boolean): boolean;
    set_layer_opacity(id: number, opacity: number): boolean;
    rename_layer(id: number, name: string): boolean;
    /** Move a layer to a new stack index (0 = bottom). Returns true if moved. */
    move_layer(id: number, new_index: number): boolean;
    /** Merge a layer down onto the one below it. Returns true if merged. */
    merge_down(id: number): boolean;
    /** Flatten the whole stack into a single Background layer. */
    flatten_all(): void;

    // ── Layer masks (non-destructive grayscale alpha; 255 = reveal, 0 = hide) ──
    /** Add a fully-revealed (white) mask to a layer. False if not found / already masked. */
    add_layer_mask(id: number): boolean;
    /** Discard a layer's mask (reveal everything). False if it had none. */
    remove_layer_mask(id: number): boolean;
    /** Bake the mask into the layer's alpha permanently, then drop it. False if no mask. */
    apply_layer_mask(id: number): boolean;
    /** Invert the mask (reveal↔hide). False if it has none. */
    invert_layer_mask(id: number): boolean;
    has_layer_mask(id: number): boolean;
    /** Paint the active layer's mask with the brush engine. `value` 0=hide, 255=reveal;
     *  `opacity`/`hardness` are 0..1. Creates a white mask first if the layer has none. */
    mask_paint_down(
      x: number, y: number, size: number,
      value: number, opacity: number, hardness: number, stab: string,
    ): void;
    /** Continue the active mask stroke; true if it changed the mask (→ flush). */
    mask_paint_move(x: number, y: number): boolean;
    /** End the active mask stroke + free buffers; true if it changed the mask. */
    mask_paint_up(): boolean;

    // ── Layer colour overlay (Photoshop's Color Overlay layer style) ──
    // A solid colour tinting the layer's pixels at composite time, clipped to
    // the layer's alpha and sitting UNDER the mask. Non-destructive until
    // applied. Like masks, it is session-lived — `push_restored_layer` does not
    // carry it back across a reload.
    /** Set/update a layer's colour overlay. `opacity` 0..1 (clamped). False if
     *  the layer isn't found. Snaps history ONLY on the first set, so a slider
     *  drag doesn't flood the undo stack. */
    set_layer_color_overlay(
      id: number, r: number, g: number, b: number, opacity: number,
    ): boolean;
    /** Discard the overlay (true colours back). False if it had none. */
    remove_layer_color_overlay(id: number): boolean;
    /** Bake the overlay into the layer's pixels permanently, then drop it.
     *  False if it had none. */
    apply_layer_color_overlay(id: number): boolean;
    has_layer_color_overlay(id: number): boolean;

    // ── Move tool (reposition the active layer's content) ──
    /** Live, non-destructive drag offset for the active layer; recomposite then
     *  renders it shifted by (dx,dy). (0,0) clears it. No history. */
    set_move_preview(dx: number, dy: number): void;
    /** Discard an in-progress move preview without committing. No history. */
    cancel_move_preview(): void;
    /** Commit a move of the active layer's pixels + annotations by (dx,dy).
     *  Pushes one "Move Layer" snapshot; a zero delta is a no-op. */
    translate_active_layer(dx: number, dy: number): void;

    // ── Paste placement (movable/resizable bounding-box preview) ──
    /** Begin a placement preview for `pixels` (src_w × src_h RGBA), shown at
     *  (dest_x, dest_y, dest_w, dest_h). Transient — not part of undo history
     *  until `commit_paste_preview`. Replaces any prior preview. */
    begin_paste_preview(
      pixels: Uint8Array,
      src_w: number,
      src_h: number,
      dest_x: number,
      dest_y: number,
      dest_w: number,
      dest_h: number,
    ): void;
    /** Update the live placement rect (called every move/resize drag frame). */
    set_paste_preview_rect(
      dest_x: number,
      dest_y: number,
      dest_w: number,
      dest_h: number,
    ): void;
    /** Discard the in-progress preview without committing (Escape). No history. */
    cancel_paste_preview(): void;
    /** True while a placement preview is active. */
    has_paste_preview(): boolean;
    /** Bake the preview into the active layer at its current placement, resampled
     *  with `filter` (0=nearest, 1=bilinear, 2=catmull-rom, 3=lanczos3 — same
     *  convention as `resize_with_filter`). Pushes one "Paste" (or "Resize Layer",
     *  for a `begin_layer_resize_preview` preview) snapshot. */
    commit_paste_preview(filter: number): void;
    /** "Resize Layer" — begin a placement preview seeded from the ACTIVE layer's
     *  own current pixels, box hugging the layer's CONTENT BOUNDS (tightest
     *  non-transparent rect). Returns that rect as an Int32Array `[x, y, w, h]`
     *  so the caller seeds its overlay at the SAME rect — empty on no-op (no
     *  active layer, or fully transparent). v8.37: replaced the full-canvas
     *  seed + JS-side cosmetic inset that gave the engine and the overlay two
     *  different rects (the first drag then snapped the layer to the overlay's).
     *  Reuses the exact same set_paste_preview_rect/cancel_paste_preview/
     *  commit_paste_preview flow as paste placement; while live, the active
     *  layer is hidden from the composite (its own content is the drag preview)
     *  so nothing doubles up. */
    begin_layer_resize_preview(): Int32Array;

    // ── Layer persistence (serialize / restore) ──
    /** PNG of one layer's raw pixels (no compositing, no overlays). */
    get_layer_png(index: number): Uint8Array;
    /** JSON of a specific layer's text annotations. */
    get_layer_text_annotations(index: number): string;
    /** JSON of a specific layer's shape annotations. */
    get_layer_shape_annotations(index: number): string;
    /** Begin rebuilding the stack from persisted data (empties stack + history). */
    begin_layer_restore(): void;
    /** Append a restored layer from raw RGBA; makes it active. Returns its id. */
    push_restored_layer(
      pixels: Uint8Array,
      w: number,
      h: number,
      name: string,
      visible: boolean,
      opacity: number,
    ): number;
    /** Restore a text annotation onto the active layer (no history). */
    restore_text_annotation(
      text: string,
      font_size: number,
      r: number, g: number, b: number,
      bold: boolean,
      x: number, y: number,
      rotation_deg: number,
      background_kind: number,
      bg_r: number, bg_g: number, bg_b: number, bg_a: number,
      bg_padding: number,
      bg_corner_radius: number,
      bg_tail: number,
      shadow_box: boolean,
      shadow_text: boolean,
      shadow_r: number, shadow_g: number, shadow_b: number, shadow_a: number,
      shadow_dx: number, shadow_dy: number, shadow_blur: number,
    ): number;
    /** Finish a layer-restore: set active index + recomposite. */
    finish_layer_restore(active_index: number): void;

    // ── Live shape/arrow annotations (non-destructive, re-selectable) ──
    // kind: 0=rect, 1=circle, 2=line, 3=handCircle, 4=arrow, 5=pin, 6=polyline.
    // arrow_style (arrows only): 0=single, 1=double.
    shape_annotation_count(): number;
    /** Add a numbered callout pin (kind 5): circle bbox + label. Pushes "Add Pin". */
    add_pin_annotation(
      x0: number, y0: number, x1: number, y1: number,
      number: number,
      color_hex: string,
      label_kind: number,
    ): number;
    /** Restore a persisted pin WITHOUT pushing history. Colour is raw r,g,b. */
    restore_pin_annotation(
      x0: number, y0: number, x1: number, y1: number,
      number: number, r: number, g: number, b: number,
      label_kind: number,
    ): number;
    /** Add a freehand/polyline pen (kind 6). `points` is a flat [x0,y0,x1,y1,…] array. Pushes "Add Pen". */
    add_polyline_annotation(
      points: Float64Array,
      color_hex: string,
      stroke_width: number,
    ): number;
    /** Restore a persisted polyline WITHOUT pushing history. Colour is raw r,g,b. */
    restore_polyline_annotation(
      points: Float64Array,
      r: number, g: number, b: number,
      stroke_width: number,
    ): number;
    /** Add a Bézier pen path (kind 7). Flat cubic control sequence + optional
     *  fill (fill_kind 0=none, 1=solid). Pushes "Add Pen Path". */
    add_bezier_annotation(
      points: Float64Array,
      color_hex: string,
      stroke_width: number,
      fill_kind: number,
      fill_color_hex: string,
    ): number;
    /** Restore a persisted Bézier path WITHOUT pushing history. Colour is raw r,g,b. */
    restore_bezier_annotation(
      points: Float64Array,
      r: number, g: number, b: number,
      stroke_width: number,
      fill_kind: number,
      fill_r: number, fill_g: number, fill_b: number, fill_a: number,
    ): number;
    /** Replace just the control points of an annotation (no history) — live drag-edit. */
    set_annotation_points(id: number, points: Float64Array): void;
    /** Commit a Bézier-path reshape + restyle: snapshot "Edit Pen Path", replace
     *  points, and apply stroke colour/width + solid Background fill (fill_kind
     *  0 = none, 1 = solid fill_color_hex) so reselecting a path can fill it. */
    update_bezier_annotation(
      id: number,
      points: Float64Array,
      color_hex: string,
      stroke_width: number,
      fill_kind: number,
      fill_color_hex: string,
    ): void;
    /** Add a live shape/arrow. Pushes an "Add Shape"/"Add Arrow" history step. Returns the new id. */
    add_shape_annotation(
      kind: number,
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      color_hex: string,
      stroke_width: number,
      arrow_style: number,
      fill_kind: number,
      fill_hex: string,
      fill2_hex: string,
      fill_angle: number,
      fill_block: number,
    ): number;
    /** Restore a persisted shape WITHOUT pushing history (load path). Colours are raw bytes. */
    restore_shape_annotation(
      kind: number,
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      r: number,
      g: number,
      b: number,
      stroke_width: number,
      arrow_style: number,
      fill_kind: number,
      fill_r: number,
      fill_g: number,
      fill_b: number,
      fill_a: number,
      fill2_r: number,
      fill2_g: number,
      fill2_b: number,
      fill2_a: number,
      fill_angle: number,
      fill_block: number,
    ): number;
    /** Update a shape in full (geometry + style). Pushes an "Edit Shape" history step. */
    update_shape_annotation(
      id: number,
      kind: number,
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      color_hex: string,
      stroke_width: number,
      arrow_style: number,
      fill_kind: number,
      fill_hex: string,
      fill2_hex: string,
      fill_angle: number,
      fill_block: number,
    ): boolean;
    /** Remove a shape. Pushes a "Delete Shape" history step. */
    remove_shape_annotation(id: number): boolean;
    /** Move a shape to index `to` in the active layer's draw order (0 = back;
     *  `to` saturates at the top, so `0xffffffff` means "to front"). Pushes a
     *  "Reorder Shape" history step; a no-op returns false and pushes nothing.
     *  Deliberately NOT op-logged — ADR-044. */
    move_shape_annotation(id: number, to: number): boolean;
    /** Align a committed text/shape annotation's bbox to a canvas edge/center.
     *  mode ∈ left|centerH|right|top|middleV|bottom. Caller flushes to re-render. */
    align_annotation(
      id: number,
      is_text: boolean,
      mode: string,
      canvas_w: number,
      canvas_h: number,
    ): boolean;
    /** Per-channel histogram of the current composite (computed in Rust from the
     *  authoritative buffer — no canvas sampling). Flat 1024-element array:
     *  [0,256)=R, [256,512)=G, [512,768)=B, [768,1024)=Luma. */
    calculate_histogram(): Uint32Array;
    // ── Selection Marker (magic-wand) ──
    /** Flood-select from (x,y) within per-channel `tolerance`; stores the mask,
     *  returns a canvas-sized RGBA overlay (selected pixels tinted). */
    magic_wand_select(x: number, y: number, tolerance: number): Uint8Array;
    /** Edge-aware wand: the same flood fill, but it won't cross a pixel whose
     *  Sobel edge strength exceeds `edge_threshold` (0..=255) — so a fill stops
     *  at the object outline instead of leaking through a soft gradient. Shares
     *  the edge core (src/edges.rs) with the magnetic lasso / Smart Brush. */
    magic_wand_select_edges(
      x: number,
      y: number,
      tolerance: number,
      edge_threshold: number,
    ): Uint8Array;
    /** Color Range (Photoshop's Select → Color Range): every pixel within
     *  `tolerance` of the clicked colour, anywhere in the image — not just the
     *  connected blob the wand reaches. */
    color_range_select(x: number, y: number, tolerance: number): Uint8Array;
    /** Non-committing hover preview: the tinted FILLED overlay of the region a
     *  click-once kind WOULD grab from (x,y), computed with the same mask core
     *  as the committing producer so the two can't drift. Touches neither the
     *  stored selection nor history. `kind`: 0 wand, 1 edge-aware, 2 color
     *  range. `tint`: 1 add (green), 2 subtract (red), else neutral (blue).
     *  Empty when out of bounds or the region is empty. */
    selection_preview(
      x: number,
      y: number,
      kind: number,
      tolerance: number,
      edge_threshold: number,
      tint: number,
    ): Uint8Array;
    /** Rectangular marquee over the drag rect (any corner order, canvas px).
     *  Normalised, snapped outward (floor/ceil), clamped to the canvas; rides
     *  the same combine pipeline as every producer. A degenerate or fully
     *  off-canvas drag replaces with NO selection (Photoshop's empty-marquee
     *  deselect); under combine 1/2 it no-ops. Returns the overlay RGBA. */
    rect_select(x0: number, y0: number, x1: number, y1: number): Uint8Array;
    /** Elliptical marquee: the ellipse inscribed in the same drag rect. A
     *  pixel is in when its centre satisfies (dx/rx)² + (dy/ry)² <= 1; a drag
     *  past the canvas edge keeps its shape and is cropped, not squashed.
     *  Same normalise/clamp/combine behaviour as `rect_select`. */
    ellipse_select(x0: number, y0: number, x1: number, y1: number): Uint8Array;
    /** Select the whole canvas; returns the overlay RGBA. */
    select_all(): Uint8Array;
    /** Current selection as an RGBA overlay (empty if nothing selected). */
    selection_overlay(): Uint8Array;
    has_selection(): boolean;
    /** Deselect (no history). */
    clear_selection(): void;
    /** Delete selected pixels (transparent) on the active layer; deselects. */
    delete_selection(): boolean;
    /** Place the selected pixels of the ACTIVE layer on a new layer directly
     *  above it (Layer Via Copy / Layer Via Cut — Ctrl+J / Ctrl+Shift+J).
     *  `cut` additionally clears them from the source layer. One history step;
     *  deselects after. Returns the new layer id, or 0 when nothing is
     *  selected (no history, no mutation). */
    selection_to_new_layer(cut: boolean): number;
    /** Boolean selection ops (`ih_selection_bool`). `mask` is `&[u8]`
     *  (non-zero = covered); a length mismatch is a safe no-op. Returns
     *  whether anything is still selected afterwards.
     *  Union: OR `mask` into the current selection (no selection → the mask
     *  becomes it). Subtract: clear covered pixels; an all-false result reads
     *  back as NO selection (None), not a zero-area Some. */
    selection_union(mask: Uint8Array): boolean;
    selection_subtract(mask: Uint8Array): boolean;
    /** Combine mode for the NEXT producer call: 0 = replace, 1 = union,
     *  2 = subtract (clamped). The producers (wand / edge / color-range /
     *  lasso-close) route their mask through this so Shift/Alt-drag adds or
     *  subtracts instead of replacing. Reset to 0 after each use is the
     *  caller's job. */
    set_selection_combine(mode: number): void;

    // ── Magnetic lasso (live-wire) — always available ──
    // Path-finds along the SAME edge core the edge-aware wand uses, turned into
    // a cost map (strong edge = cheap to travel). Ends where every other
    // selection tool ends: one mask, one overlay RGBA.
    /** Start a lasso at the first anchor. Builds the edge cost map once for the
     *  whole session. False if the click is out of bounds / the image is empty. */
    lasso_begin(x: number, y: number): boolean;
    /** The live wire: minimum-cost path from the last anchor to the cursor, as
     *  flat [x0,y0,x1,y1,…] pairs. A preview — does not mutate the session.
     *  Empty when no lasso is running. */
    lasso_path_to(x: number, y: number): Int32Array;
    /** Freeze the live wire into the committed path and drop a new anchor.
     *  Returns the new anchor count (0 = no session). */
    lasso_commit(x: number, y: number): number;
    /** The committed path so far, as flat [x,y,…] pairs — for redrawing after a
     *  re-render without re-walking it. */
    lasso_committed_path(): Int32Array;
    /** Is a lasso session in progress? */
    lasso_active(): boolean;
    /** Close the loop (wire back to the first anchor), fill the enclosed region,
     *  and store it as THE selection. Returns the same canvas-sized overlay RGBA
     *  the wands return. Empty if there's no session or fewer than 3 anchors. */
    lasso_close(): Uint8Array;
    /** Abandon the session (Esc). Leaves any existing selection alone. */
    lasso_cancel(): void;

    /** Smart Brush: wall a stroke in with strong edges (`strength` 0..=255;
     *  higher = only the hardest edges contain it). Takes effect from the next
     *  stroke. OFF by default — with it off the brush is byte-for-byte the one
     *  that shipped. Behind the `ih_smart_edge` switch. */
    set_smart_brush(enabled: boolean, strength: number): void;
    /** Suppress one shape from render while its JS overlay preview is shown. Pass -1 to clear. */
    set_editing_shape(id: number): void;
    /** Suppress an in-edit text annotation's baked tile from the composite
     *  (so the JS textarea overlay isn't doubled). Pass -1 to clear. */
    set_editing_text(id: number): void;
    /** JSON array of all live shapes (id, kind, x0,y0,x1,y1, r,g,b, stroke_width, arrow_style, number, points). */
    get_shape_annotations(): string;
    /** Returns the matching shape id, or -1 if no hit. Newest-first. Lines,
     *  arrows and polylines hit near their stroke; an UNFILLED rect / circle /
     *  hand-circle hits on its outline RING only (the empty middle is a miss,
     *  so a shape can be drawn inside another); filled shapes, pins and bézier
     *  paths hit anywhere in their padded bounding box. */
    shape_annotation_at(x: number, y: number): number;
  }
}
