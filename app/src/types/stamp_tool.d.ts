declare module "stamp_tool" {
  export default function init(): Promise<void>;

  export class CloneStampTool {
    static new(width: number, height: number): CloneStampTool;
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
    begin_stroke(): void;
    stamp_line(
      dest_x: number,
      dest_y: number,
      src_x: number,
      src_y: number,
    ): void;
    end_stroke(): void;
    stamp(dest_x: number, dest_y: number): void;
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
  }
}