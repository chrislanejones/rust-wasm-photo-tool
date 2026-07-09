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
    /** Returns true if any pixel in the loaded image has alpha < 255. */
    has_transparency(): boolean;
    export_png(): Uint8Array;
    width(): number;
    height(): number;
    data_ptr(): number;
    data_len(): number;
    thumbnail_width(max_px: number): number;
    thumbnail_height(max_px: number): number;
    thumbnail_data(max_px: number): Uint8Array;
    copy_region(x: number, y: number, w: number, h: number): Uint8Array;
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
    push_compress_marker(): void;
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
    /** Render text with the embedded Liberation Sans font and composite onto the buffer. */
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
    get_text_annotations(): string;
    flatten_text_annotations(): void;

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
    flatten_text_annotations(): void;

    // ── Layers (Photoshop-style stack) ──
    /** Recompute the cached composite of all visible layers (call before reading data_ptr). */
    recomposite(): void;
    layer_count(): number;
    /** JSON array bottom→top: [{id,name,visible,opacity,active,hasMask}]. */
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
     *  own current pixels (full canvas size initially) instead of externally
     *  pasted bytes. Reuses the exact same set_paste_preview_rect/
     *  cancel_paste_preview/commit_paste_preview flow as paste placement; while
     *  live, the active layer is hidden from the composite (its own content is
     *  the drag preview) so nothing doubles up. No-op if there's no active layer. */
    begin_layer_resize_preview(): void;

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
    /** Select the whole canvas; returns the overlay RGBA. */
    select_all(): Uint8Array;
    /** Current selection as an RGBA overlay (empty if nothing selected). */
    selection_overlay(): Uint8Array;
    has_selection(): boolean;
    /** Deselect (no history). */
    clear_selection(): void;
    /** Delete selected pixels (transparent) on the active layer; deselects. */
    delete_selection(): boolean;
    /** Suppress one shape from render while its JS overlay preview is shown. Pass -1 to clear. */
    set_editing_shape(id: number): void;
    /** Suppress an in-edit text annotation's baked tile from the composite
     *  (so the JS textarea overlay isn't doubled). Pass -1 to clear. */
    set_editing_text(id: number): void;
    /** JSON array of all live shapes (id, kind, x0,y0,x1,y1, r,g,b, stroke_width, arrow_style, number, points). */
    get_shape_annotations(): string;
    /** Returns the matching shape id, or -1 if no hit. */
    shape_annotation_at(x: number, y: number): number;
  }
}
