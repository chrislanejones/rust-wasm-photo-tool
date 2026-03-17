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

    // ── Blur (WASM Gaussian) ──
    blur_region(
      cx: number,
      cy: number,
      brush_radius: number,
      intensity: number,
    ): void;
    begin_blur_stroke(): void;

    // ── Drawing: Arrows & Shapes (WASM) ──
    /** Save undo snapshot before drawing. label appears in history. */
    begin_draw_stroke(label: string): void;
    /** Draw arrow. style: 0=single, 1=double. color_hex: "#rrggbb" */
    draw_arrow(
      from_x: number,
      from_y: number,
      to_x: number,
      to_y: number,
      color_hex: string,
      stroke_width: number,
      style: number,
    ): void;
    /** Draw shape. shape: 0=rect, 1=circle, 2=line. color_hex: "#rrggbb" */
    draw_shape(
      from_x: number,
      from_y: number,
      to_x: number,
      to_y: number,
      shape: number,
      color_hex: string,
      stroke_width: number,
    ): void;
  }
}
