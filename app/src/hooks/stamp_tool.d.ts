declare module "stamp_tool" {
  export default function init(): Promise<void>;

  export class CloneStampTool {
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
    ): void;
    /** Extract a region as PNG bytes without modifying the buffer. */
    extract_region_png(x: number, y: number, w: number, h: number): Uint8Array;
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

    // Item 9: Crop preview in WASM
    // Uncomment after adding the Rust implementations
    // preview_crop(x: number, y: number, w: number, h: number): void;
    // cancel_crop_preview(): boolean;
    // apply_crop_from_preview(x: number, y: number, w: number, h: number): void;
  }
}
