declare module "stamp_tool" {
  export default function init(): Promise<void>;

  /** Gallery photo cap for an account tier ("demo" | "loggedIn" | "paid"). */
  export function photo_limit(tier: string): number;

  /**
   * Web-performance indicators for the Resize & Compress panel.
   * Returns `[lighthouseScore, webPerformanceGain]`, both 0..100.
   * The Lighthouse score is byte-aware (log-normal on the projected
   * delivered size), so a big, uncompressed image scores low.
   */
  export function web_perf_metrics(
    curW: number,
    curH: number,
    curBytes: number,
    origBytes: number,
    newW: number,
    newH: number,
    quality: number,
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
   * Parse a CSS-ish color string into RGBA bytes.
   * Accepts: #rgb, #rgba, #rrggbb, #rrggbbaa, rgb(...), rgba(...).
   * Returns a 4-byte Uint8Array [r, g, b, a] on success, or an empty
   * Uint8Array on parse failure.
   */
  export function parse_color(input: string): Uint8Array;

  /**
   * Compute the largest centred rectangle with the given aspect ratio
   * that fits inside an `image_w` × `image_h` image. Returns `[x, y, w, h]`
   * as a Uint32Array, or an empty array if any input is 0.
   */
  export function compute_aspect_crop(
    image_w: number,
    image_h: number,
    ratio_w: number,
    ratio_h: number,
  ): Uint32Array;

  /**
   * Snap a free drag to a locked aspect ratio. Anchored at (start_x, start_y),
   * extends toward (end_x, end_y), scaled so width/height match ratio_w/ratio_h,
   * clipped to image bounds. Returns `[x, y, w, h]` as a Uint32Array, or empty
   * on invalid input.
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
  ): Uint32Array;

  export class ImageHorseTool {
    constructor(width: number, height: number);
    free(): void;
    load_image(pixels: Uint8Array): void;
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
    undo(): boolean;
    redo(): boolean;
    undo_count(): number;
    redo_count(): number;
    history_labels(): string;
    jump_to_history(index: number): boolean;
    delete_history_entry(index: number): boolean;
    clear_history(): void;
    get_image_data(): Uint8Array;
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
    adjust_brightness(delta: number): void;
    adjust_contrast(factor: number): void;
    blur_region(
      cx: number,
      cy: number,
      brush_radius: number,
      intensity: number,
    ): void;
    begin_blur_stroke(): void;
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
    ): void;
    paint_begin(): void;
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
    remove_text_annotation(id: number): boolean;
    get_text_annotations(): string;
    /** Returns the matching annotation id, or -1 if no hit. */
    text_annotation_at(x: number, y: number): number;
    render_with_annotations(): Uint8Array;
    flatten_text_annotations(): void;
  }
}
