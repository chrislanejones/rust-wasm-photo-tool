class I {
  __destroy_into_raw() {
    const t = this.__wbg_ptr;
    return this.__wbg_ptr = 0, L.unregister(this), t;
  }
  free() {
    const t = this.__destroy_into_raw();
    e.__wbg_imagehorsetool_free(t, 0);
  }
  active_layer_id() {
    return e.imagehorsetool_active_layer_id(this.__wbg_ptr) >>> 0;
  }
  add_layer(t) {
    const _ = h(t, e.__wbindgen_malloc, e.__wbindgen_realloc), r = g;
    return e.imagehorsetool_add_layer(this.__wbg_ptr, _, r) >>> 0;
  }
  add_pin_annotation(t, _, r, n, i, s) {
    const a = h(s, e.__wbindgen_malloc, e.__wbindgen_realloc), l = g;
    return e.imagehorsetool_add_pin_annotation(this.__wbg_ptr, t, _, r, n, i, a, l) >>> 0;
  }
  add_polyline_annotation(t, _, r) {
    const n = B(t, e.__wbindgen_malloc), i = g, s = h(_, e.__wbindgen_malloc, e.__wbindgen_realloc), a = g;
    return e.imagehorsetool_add_polyline_annotation(this.__wbg_ptr, n, i, s, a, r) >>> 0;
  }
  add_shape_annotation(t, _, r, n, i, s, a, l, c, p, b, d) {
    const w = h(s, e.__wbindgen_malloc, e.__wbindgen_realloc), m = g, u = h(p, e.__wbindgen_malloc, e.__wbindgen_realloc), f = g, y = h(b, e.__wbindgen_malloc, e.__wbindgen_realloc), v = g;
    return e.imagehorsetool_add_shape_annotation(this.__wbg_ptr, t, _, r, n, i, w, m, a, l, c, u, f, y, v, d) >>> 0;
  }
  add_text_annotation(t, _, r, n, i, s, a, l, c, p, b, d, w, m, u, f, y) {
    const v = h(t, e.__wbindgen_malloc, e.__wbindgen_realloc), A = g;
    return e.imagehorsetool_add_text_annotation(this.__wbg_ptr, v, A, _, r, n, i, s, a, l, c, p, b, d, w, m, u, f, y) >>> 0;
  }
  adjust_brightness(t) {
    e.imagehorsetool_adjust_brightness(this.__wbg_ptr, t);
  }
  adjust_contrast(t) {
    e.imagehorsetool_adjust_contrast(this.__wbg_ptr, t);
  }
  adjust_zoom(t) {
    e.imagehorsetool_adjust_zoom(this.__wbg_ptr, t);
  }
  apply_crop_from_preview(t, _, r, n) {
    e.imagehorsetool_apply_crop_from_preview(this.__wbg_ptr, t, _, r, n);
  }
  begin_blur_stroke() {
    e.imagehorsetool_begin_blur_stroke(this.__wbg_ptr);
  }
  begin_draw_stroke(t) {
    const _ = h(t, e.__wbindgen_malloc, e.__wbindgen_realloc), r = g;
    e.imagehorsetool_begin_draw_stroke(this.__wbg_ptr, _, r);
  }
  begin_layer_restore() {
    e.imagehorsetool_begin_layer_restore(this.__wbg_ptr);
  }
  begin_stroke(t, _) {
    e.imagehorsetool_begin_stroke(this.__wbg_ptr, t, _);
  }
  blur_region(t, _, r, n) {
    e.imagehorsetool_blur_region(this.__wbg_ptr, t, _, r, n);
  }
  cancel_crop_preview() {
    return e.imagehorsetool_cancel_crop_preview(this.__wbg_ptr) !== 0;
  }
  clear_history() {
    e.imagehorsetool_clear_history(this.__wbg_ptr);
  }
  commit_red_stamp(t, _, r, n, i, s, a, l) {
    const c = h(t, e.__wbindgen_malloc, e.__wbindgen_realloc), p = g;
    e.imagehorsetool_commit_red_stamp(this.__wbg_ptr, c, p, _, r, n, i, s, a, l);
  }
  commit_text(t, _, r, n, i, s, a, l, c) {
    const p = h(t, e.__wbindgen_malloc, e.__wbindgen_realloc), b = g;
    e.imagehorsetool_commit_text(this.__wbg_ptr, p, b, _, r, n, i, s, a, l, c);
  }
  continue_stroke(t, _) {
    e.imagehorsetool_continue_stroke(this.__wbg_ptr, t, _);
  }
  copy_region(t, _, r, n) {
    const i = e.imagehorsetool_copy_region(this.__wbg_ptr, t, _, r, n);
    var s = x(i[0], i[1]).slice();
    return e.__wbindgen_free(i[0], i[1] * 1, 1), s;
  }
  crop(t, _, r, n) {
    e.imagehorsetool_crop(this.__wbg_ptr, t, _, r, n);
  }
  data_len() {
    return e.imagehorsetool_data_len(this.__wbg_ptr) >>> 0;
  }
  data_ptr() {
    return e.imagehorsetool_data_ptr(this.__wbg_ptr) >>> 0;
  }
  delete_history_entry(t) {
    return e.imagehorsetool_delete_history_entry(this.__wbg_ptr, t) !== 0;
  }
  draw_arrow(t, _, r, n, i, s, a) {
    const l = h(i, e.__wbindgen_malloc, e.__wbindgen_realloc), c = g;
    e.imagehorsetool_draw_arrow(this.__wbg_ptr, t, _, r, n, l, c, s, a);
  }
  draw_shape(t, _, r, n, i, s, a) {
    const l = h(s, e.__wbindgen_malloc, e.__wbindgen_realloc), c = g;
    e.imagehorsetool_draw_shape(this.__wbg_ptr, t, _, r, n, i, l, c, a);
  }
  duplicate_layer(t) {
    return e.imagehorsetool_duplicate_layer(this.__wbg_ptr, t) >>> 0;
  }
  end_stroke() {
    e.imagehorsetool_end_stroke(this.__wbg_ptr);
  }
  export_png() {
    const t = e.imagehorsetool_export_png(this.__wbg_ptr);
    var _ = x(t[0], t[1]).slice();
    return e.__wbindgen_free(t[0], t[1] * 1, 1), _;
  }
  finish_layer_restore(t) {
    e.imagehorsetool_finish_layer_restore(this.__wbg_ptr, t);
  }
  flatten_all() {
    e.imagehorsetool_flatten_all(this.__wbg_ptr);
  }
  flatten_text_annotations() {
    e.imagehorsetool_flatten_text_annotations(this.__wbg_ptr);
  }
  flip_horizontal() {
    e.imagehorsetool_flip_horizontal(this.__wbg_ptr);
  }
  flip_vertical() {
    e.imagehorsetool_flip_vertical(this.__wbg_ptr);
  }
  get_brush_size() {
    return e.imagehorsetool_get_brush_size(this.__wbg_ptr) >>> 0;
  }
  get_image_data() {
    const t = e.imagehorsetool_get_image_data(this.__wbg_ptr);
    var _ = x(t[0], t[1]).slice();
    return e.__wbindgen_free(t[0], t[1] * 1, 1), _;
  }
  get_layer_png(t) {
    const _ = e.imagehorsetool_get_layer_png(this.__wbg_ptr, t);
    var r = x(_[0], _[1]).slice();
    return e.__wbindgen_free(_[0], _[1] * 1, 1), r;
  }
  get_layer_shape_annotations(t) {
    let _, r;
    try {
      const n = e.imagehorsetool_get_layer_shape_annotations(this.__wbg_ptr, t);
      return _ = n[0], r = n[1], z(n[0], n[1]);
    } finally {
      e.__wbindgen_free(_, r, 1);
    }
  }
  get_layer_text_annotations(t) {
    let _, r;
    try {
      const n = e.imagehorsetool_get_layer_text_annotations(this.__wbg_ptr, t);
      return _ = n[0], r = n[1], z(n[0], n[1]);
    } finally {
      e.__wbindgen_free(_, r, 1);
    }
  }
  get_layers() {
    let t, _;
    try {
      const r = e.imagehorsetool_get_layers(this.__wbg_ptr);
      return t = r[0], _ = r[1], z(r[0], r[1]);
    } finally {
      e.__wbindgen_free(t, _, 1);
    }
  }
  get_pixel(t, _) {
    const r = e.imagehorsetool_get_pixel(this.__wbg_ptr, t, _);
    var n = x(r[0], r[1]).slice();
    return e.__wbindgen_free(r[0], r[1] * 1, 1), n;
  }
  get_pixel_region(t, _, r) {
    const n = e.imagehorsetool_get_pixel_region(this.__wbg_ptr, t, _, r);
    var i = x(n[0], n[1]).slice();
    return e.__wbindgen_free(n[0], n[1] * 1, 1), i;
  }
  get_redo_snapshot_annotations(t) {
    let _, r;
    try {
      const n = e.imagehorsetool_get_redo_snapshot_annotations(this.__wbg_ptr, t);
      return _ = n[0], r = n[1], z(n[0], n[1]);
    } finally {
      e.__wbindgen_free(_, r, 1);
    }
  }
  get_redo_snapshot_label(t) {
    let _, r;
    try {
      const n = e.imagehorsetool_get_redo_snapshot_label(this.__wbg_ptr, t);
      return _ = n[0], r = n[1], z(n[0], n[1]);
    } finally {
      e.__wbindgen_free(_, r, 1);
    }
  }
  get_redo_snapshot_png(t) {
    const _ = e.imagehorsetool_get_redo_snapshot_png(this.__wbg_ptr, t);
    var r = x(_[0], _[1]).slice();
    return e.__wbindgen_free(_[0], _[1] * 1, 1), r;
  }
  get_shape_annotations() {
    let t, _;
    try {
      const r = e.imagehorsetool_get_shape_annotations(this.__wbg_ptr);
      return t = r[0], _ = r[1], z(r[0], r[1]);
    } finally {
      e.__wbindgen_free(t, _, 1);
    }
  }
  get_text_annotations() {
    let t, _;
    try {
      const r = e.imagehorsetool_get_text_annotations(this.__wbg_ptr);
      return t = r[0], _ = r[1], z(r[0], r[1]);
    } finally {
      e.__wbindgen_free(t, _, 1);
    }
  }
  get_undo_snapshot_annotations(t) {
    let _, r;
    try {
      const n = e.imagehorsetool_get_undo_snapshot_annotations(this.__wbg_ptr, t);
      return _ = n[0], r = n[1], z(n[0], n[1]);
    } finally {
      e.__wbindgen_free(_, r, 1);
    }
  }
  get_undo_snapshot_label(t) {
    let _, r;
    try {
      const n = e.imagehorsetool_get_undo_snapshot_label(this.__wbg_ptr, t);
      return _ = n[0], r = n[1], z(n[0], n[1]);
    } finally {
      e.__wbindgen_free(_, r, 1);
    }
  }
  get_undo_snapshot_png(t) {
    const _ = e.imagehorsetool_get_undo_snapshot_png(this.__wbg_ptr, t);
    var r = x(_[0], _[1]).slice();
    return e.__wbindgen_free(_[0], _[1] * 1, 1), r;
  }
  get_zoom() {
    return e.imagehorsetool_get_zoom(this.__wbg_ptr);
  }
  has_source() {
    return e.imagehorsetool_has_source(this.__wbg_ptr) !== 0;
  }
  has_transparency() {
    return e.imagehorsetool_has_transparency(this.__wbg_ptr) !== 0;
  }
  height() {
    return e.imagehorsetool_height(this.__wbg_ptr) >>> 0;
  }
  history_labels() {
    let t, _;
    try {
      const r = e.imagehorsetool_history_labels(this.__wbg_ptr);
      return t = r[0], _ = r[1], z(r[0], r[1]);
    } finally {
      e.__wbindgen_free(t, _, 1);
    }
  }
  inject_redo_snapshot(t, _, r, n) {
    const i = W(t, e.__wbindgen_malloc), s = g, a = h(n, e.__wbindgen_malloc, e.__wbindgen_realloc), l = g;
    e.imagehorsetool_inject_redo_snapshot(this.__wbg_ptr, i, s, _, r, a, l);
  }
  inject_undo_snapshot(t, _, r, n) {
    const i = W(t, e.__wbindgen_malloc), s = g, a = h(n, e.__wbindgen_malloc, e.__wbindgen_realloc), l = g;
    e.imagehorsetool_inject_undo_snapshot(this.__wbg_ptr, i, s, _, r, a, l);
  }
  jump_to_history(t) {
    return e.imagehorsetool_jump_to_history(this.__wbg_ptr, t) !== 0;
  }
  layer_count() {
    return e.imagehorsetool_layer_count(this.__wbg_ptr) >>> 0;
  }
  load_image(t) {
    const _ = W(t, e.__wbindgen_malloc), r = g;
    e.imagehorsetool_load_image(this.__wbg_ptr, _, r);
  }
  measure_text(t, _, r) {
    const n = h(t, e.__wbindgen_malloc, e.__wbindgen_realloc), i = g, s = e.imagehorsetool_measure_text(this.__wbg_ptr, n, i, _, r);
    var a = E(s[0], s[1]).slice();
    return e.__wbindgen_free(s[0], s[1] * 4, 4), a;
  }
  merge_down(t) {
    return e.imagehorsetool_merge_down(this.__wbg_ptr, t) !== 0;
  }
  move_layer(t, _) {
    return e.imagehorsetool_move_layer(this.__wbg_ptr, t, _) !== 0;
  }
  constructor(t, _) {
    const r = e.imagehorsetool_new(t, _);
    return this.__wbg_ptr = r >>> 0, L.register(this, this.__wbg_ptr, this), this;
  }
  paint_begin() {
    e.imagehorsetool_paint_begin(this.__wbg_ptr);
  }
  paint_dab(t, _, r, n, i, s, a) {
    e.imagehorsetool_paint_dab(this.__wbg_ptr, t, _, r, n, i, s, a);
  }
  paint_stroke_to(t, _, r, n, i, s, a, l, c) {
    e.imagehorsetool_paint_stroke_to(this.__wbg_ptr, t, _, r, n, i, s, a, l, c);
  }
  paste_region(t, _, r, n, i) {
    const s = W(t, e.__wbindgen_malloc), a = g;
    e.imagehorsetool_paste_region(this.__wbg_ptr, s, a, _, r, n, i);
  }
  preview_crop(t, _, r, n) {
    e.imagehorsetool_preview_crop(this.__wbg_ptr, t, _, r, n);
  }
  push_annotation_to_redo_snapshot(t, _, r, n, i, s, a, l, c, p, b, d, w, m, u, f, y, v) {
    const A = h(_, e.__wbindgen_malloc, e.__wbindgen_realloc), j = g;
    return e.imagehorsetool_push_annotation_to_redo_snapshot(this.__wbg_ptr, t, A, j, r, n, i, s, a, l, c, p, b, d, w, m, u, f, y, v) !== 0;
  }
  push_annotation_to_undo_snapshot(t, _, r, n, i, s, a, l, c, p, b, d, w, m, u, f, y, v) {
    const A = h(_, e.__wbindgen_malloc, e.__wbindgen_realloc), j = g;
    return e.imagehorsetool_push_annotation_to_undo_snapshot(this.__wbg_ptr, t, A, j, r, n, i, s, a, l, c, p, b, d, w, m, u, f, y, v) !== 0;
  }
  push_compress_marker() {
    e.imagehorsetool_push_compress_marker(this.__wbg_ptr);
  }
  push_restored_layer(t, _, r, n, i, s) {
    const a = W(t, e.__wbindgen_malloc), l = g, c = h(n, e.__wbindgen_malloc, e.__wbindgen_realloc), p = g;
    return e.imagehorsetool_push_restored_layer(this.__wbg_ptr, a, l, _, r, c, p, i, s) >>> 0;
  }
  recomposite() {
    e.imagehorsetool_recomposite(this.__wbg_ptr);
  }
  redo() {
    return e.imagehorsetool_redo(this.__wbg_ptr) !== 0;
  }
  redo_count() {
    return e.imagehorsetool_redo_count(this.__wbg_ptr) >>> 0;
  }
  redo_snapshot_count() {
    return e.imagehorsetool_redo_count(this.__wbg_ptr) >>> 0;
  }
  remove_layer(t) {
    return e.imagehorsetool_remove_layer(this.__wbg_ptr, t) !== 0;
  }
  remove_shape_annotation(t) {
    return e.imagehorsetool_remove_shape_annotation(this.__wbg_ptr, t) !== 0;
  }
  remove_text_annotation(t) {
    return e.imagehorsetool_remove_text_annotation(this.__wbg_ptr, t) !== 0;
  }
  rename_layer(t, _) {
    const r = h(_, e.__wbindgen_malloc, e.__wbindgen_realloc), n = g;
    return e.imagehorsetool_rename_layer(this.__wbg_ptr, t, r, n) !== 0;
  }
  render_with_annotations() {
    const t = e.imagehorsetool_render_with_annotations(this.__wbg_ptr);
    var _ = x(t[0], t[1]).slice();
    return e.__wbindgen_free(t[0], t[1] * 1, 1), _;
  }
  resize(t, _) {
    e.imagehorsetool_resize(this.__wbg_ptr, t, _);
  }
  resize_with_filter(t, _, r) {
    e.imagehorsetool_resize_with_filter(this.__wbg_ptr, t, _, r);
  }
  restore_pin_annotation(t, _, r, n, i, s, a, l) {
    return e.imagehorsetool_restore_pin_annotation(this.__wbg_ptr, t, _, r, n, i, s, a, l) >>> 0;
  }
  restore_polyline_annotation(t, _, r, n, i) {
    const s = B(t, e.__wbindgen_malloc), a = g;
    return e.imagehorsetool_restore_polyline_annotation(this.__wbg_ptr, s, a, _, r, n, i) >>> 0;
  }
  restore_shape_annotation(t, _, r, n, i, s, a, l, c, p, b, d, w, m, u, f, y, v, A, j) {
    return e.imagehorsetool_restore_shape_annotation(this.__wbg_ptr, t, _, r, n, i, s, a, l, c, p, b, d, w, m, u, f, y, v, A, j) >>> 0;
  }
  restore_text_annotation(t, _, r, n, i, s, a, l, c, p, b, d, w, m, u, f, y) {
    const v = h(t, e.__wbindgen_malloc, e.__wbindgen_realloc), A = g;
    return e.imagehorsetool_restore_text_annotation(this.__wbg_ptr, v, A, _, r, n, i, s, a, l, c, p, b, d, w, m, u, f, y) >>> 0;
  }
  rotate_90_ccw() {
    e.imagehorsetool_rotate_90_ccw(this.__wbg_ptr);
  }
  rotate_90_cw() {
    e.imagehorsetool_rotate_90_cw(this.__wbg_ptr);
  }
  set_active_layer(t) {
    return e.imagehorsetool_set_active_layer(this.__wbg_ptr, t) !== 0;
  }
  set_brush_size(t) {
    e.imagehorsetool_set_brush_size(this.__wbg_ptr, t);
  }
  set_editing_shape(t) {
    e.imagehorsetool_set_editing_shape(this.__wbg_ptr, t);
  }
  set_editing_text(t) {
    e.imagehorsetool_set_editing_text(this.__wbg_ptr, t);
  }
  set_hardness(t) {
    e.imagehorsetool_set_hardness(this.__wbg_ptr, t);
  }
  set_layer_opacity(t, _) {
    return e.imagehorsetool_set_layer_opacity(this.__wbg_ptr, t, _) !== 0;
  }
  set_layer_visible(t, _) {
    return e.imagehorsetool_set_layer_visible(this.__wbg_ptr, t, _) !== 0;
  }
  set_opacity(t) {
    e.imagehorsetool_set_opacity(this.__wbg_ptr, t);
  }
  set_source(t, _) {
    e.imagehorsetool_set_source(this.__wbg_ptr, t, _);
  }
  set_spacing(t) {
    e.imagehorsetool_set_spacing(this.__wbg_ptr, t);
  }
  set_zoom(t) {
    e.imagehorsetool_set_zoom(this.__wbg_ptr, t);
  }
  shape_annotation_at(t, _) {
    return e.imagehorsetool_shape_annotation_at(this.__wbg_ptr, t, _);
  }
  shape_annotation_count() {
    return e.imagehorsetool_shape_annotation_count(this.__wbg_ptr) >>> 0;
  }
  stamp_pixels(t, _, r, n, i) {
    const s = W(t, e.__wbindgen_malloc), a = g;
    e.imagehorsetool_stamp_pixels(this.__wbg_ptr, s, a, _, r, n, i);
  }
  stamp_red(t, _, r, n, i, s) {
    const a = W(t, e.__wbindgen_malloc), l = g;
    e.imagehorsetool_stamp_red(this.__wbg_ptr, a, l, _, r, n, i, s);
  }
  text_annotation_at(t, _) {
    return e.imagehorsetool_text_annotation_at(this.__wbg_ptr, t, _);
  }
  text_annotation_count() {
    return e.imagehorsetool_text_annotation_count(this.__wbg_ptr) >>> 0;
  }
  thumbnail_data(t) {
    const _ = e.imagehorsetool_thumbnail_data(this.__wbg_ptr, t);
    var r = x(_[0], _[1]).slice();
    return e.__wbindgen_free(_[0], _[1] * 1, 1), r;
  }
  thumbnail_height(t) {
    return e.imagehorsetool_thumbnail_height(this.__wbg_ptr, t) >>> 0;
  }
  thumbnail_width(t) {
    return e.imagehorsetool_thumbnail_width(this.__wbg_ptr, t) >>> 0;
  }
  undo() {
    return e.imagehorsetool_cancel_crop_preview(this.__wbg_ptr) !== 0;
  }
  undo_count() {
    return e.imagehorsetool_undo_count(this.__wbg_ptr) >>> 0;
  }
  undo_snapshot_count() {
    return e.imagehorsetool_undo_count(this.__wbg_ptr) >>> 0;
  }
  update_shape_annotation(t, _, r, n, i, s, a, l, c, p, b, d, w) {
    const m = h(a, e.__wbindgen_malloc, e.__wbindgen_realloc), u = g, f = h(b, e.__wbindgen_malloc, e.__wbindgen_realloc), y = g, v = h(d, e.__wbindgen_malloc, e.__wbindgen_realloc), A = g;
    return e.imagehorsetool_update_shape_annotation(this.__wbg_ptr, t, _, r, n, i, s, m, u, l, c, p, f, y, v, A, w) !== 0;
  }
  update_text_annotation(t, _, r, n, i, s, a, l, c, p, b, d, w, m, u, f, y, v) {
    const A = h(_, e.__wbindgen_malloc, e.__wbindgen_realloc), j = g;
    return e.imagehorsetool_update_text_annotation(this.__wbg_ptr, t, A, j, r, n, i, s, a, l, c, p, b, d, w, m, u, f, y, v) !== 0;
  }
  width() {
    return e.imagehorsetool_width(this.__wbg_ptr) >>> 0;
  }
}
Symbol.dispose && (I.prototype[Symbol.dispose] = I.prototype.free);
function X(o, t, _, r, n, i) {
  const s = e.blank_png(o, t, _, r, n, i);
  var a = x(s[0], s[1]).slice();
  return e.__wbindgen_free(s[0], s[1] * 1, 1), a;
}
function Y(o, t, _, r, n, i, s, a, l) {
  const c = W(o, e.__wbindgen_malloc), p = g, b = W(r, e.__wbindgen_malloc), d = g, w = e.composite_pixels(c, p, t, _, b, d, n, i, s, a, l);
  var m = x(w[0], w[1]).slice();
  return e.__wbindgen_free(w[0], w[1] * 1, 1), m;
}
function G(o, t, _, r) {
  const n = e.compute_aspect_crop(o, t, _, r);
  let i;
  return n[0] !== 0 && (i = E(n[0], n[1]).slice(), e.__wbindgen_free(n[0], n[1] * 4, 4)), i;
}
function K(o, t, _, r, n, i, s, a) {
  const l = e.constrain_crop_to_ratio(o, t, _, r, n, i, s, a);
  let c;
  return l[0] !== 0 && (c = E(l[0], l[1]).slice(), e.__wbindgen_free(l[0], l[1] * 4, 4)), c;
}
function Q(o, t, _) {
  const r = W(o, e.__wbindgen_malloc), n = g, i = e.encode_png_pixels(r, n, t, _);
  var s = x(i[0], i[1]).slice();
  return e.__wbindgen_free(i[0], i[1] * 1, 1), s;
}
function Z(o) {
  const t = h(o, e.__wbindgen_malloc, e.__wbindgen_realloc), _ = g, r = e.parse_color(t, _);
  var n = x(r[0], r[1]).slice();
  return e.__wbindgen_free(r[0], r[1] * 1, 1), n;
}
function $(o) {
  const t = h(o, e.__wbindgen_malloc, e.__wbindgen_realloc), _ = g;
  return e.photo_limit(t, _) >>> 0;
}
function tt(o, t, _, r, n) {
  const i = W(o, e.__wbindgen_malloc), s = g, a = e.resize_pixels(i, s, t, _, r, n);
  var l = x(a[0], a[1]).slice();
  return e.__wbindgen_free(a[0], a[1] * 1, 1), l;
}
function et(o, t, _, r, n, i, s, a, l) {
  const c = e.web_perf_metrics(o, t, _, r, n, i, s, a, l);
  var p = H(c[0], c[1]).slice();
  return e.__wbindgen_free(c[0], c[1] * 8, 8), p;
}
function D() {
  return { __proto__: null, "./stamp_tool_bg.js": { __proto__: null, __wbg___wbindgen_throw_be289d5034ed271b: function(t, _) {
    throw new Error(z(t, _));
  }, __wbindgen_init_externref_table: function() {
    const t = e.__wbindgen_externrefs, _ = t.grow(4);
    t.set(0, void 0), t.set(_ + 0, void 0), t.set(_ + 1, null), t.set(_ + 2, true), t.set(_ + 3, false);
  } } };
}
const L = typeof FinalizationRegistry > "u" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((o) => e.__wbg_imagehorsetool_free(o >>> 0, 1));
function H(o, t) {
  return o = o >>> 0, C().subarray(o / 8, o / 8 + t);
}
function E(o, t) {
  return o = o >>> 0, P().subarray(o / 4, o / 4 + t);
}
function x(o, t) {
  return o = o >>> 0, k().subarray(o / 1, o / 1 + t);
}
let F = null;
function C() {
  return (F === null || F.byteLength === 0) && (F = new Float64Array(e.memory.buffer)), F;
}
function z(o, t) {
  return o = o >>> 0, N(o, t);
}
let T = null;
function P() {
  return (T === null || T.byteLength === 0) && (T = new Uint32Array(e.memory.buffer)), T;
}
let M = null;
function k() {
  return (M === null || M.byteLength === 0) && (M = new Uint8Array(e.memory.buffer)), M;
}
function W(o, t) {
  const _ = t(o.length * 1, 1) >>> 0;
  return k().set(o, _ / 1), g = o.length, _;
}
function B(o, t) {
  const _ = t(o.length * 8, 8) >>> 0;
  return C().set(o, _ / 8), g = o.length, _;
}
function h(o, t, _) {
  if (_ === void 0) {
    const a = R.encode(o), l = t(a.length, 1) >>> 0;
    return k().subarray(l, l + a.length).set(a), g = a.length, l;
  }
  let r = o.length, n = t(r, 1) >>> 0;
  const i = k();
  let s = 0;
  for (; s < r; s++) {
    const a = o.charCodeAt(s);
    if (a > 127) break;
    i[n + s] = a;
  }
  if (s !== r) {
    s !== 0 && (o = o.slice(s)), n = _(n, r, r = s + o.length * 3, 1) >>> 0;
    const a = k().subarray(n + s, n + r), l = R.encodeInto(o, a);
    s += l.written, n = _(n, r, s, 1) >>> 0;
  }
  return g = s, n;
}
let S = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
S.decode();
const J = 2146435072;
let U = 0;
function N(o, t) {
  return U += t, U >= J && (S = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true }), S.decode(), U = t), S.decode(k().subarray(o, o + t));
}
const R = new TextEncoder();
"encodeInto" in R || (R.encodeInto = function(o, t) {
  const _ = R.encode(o);
  return t.set(_), { read: o.length, written: _.length };
});
let g = 0, e;
function q(o, t) {
  return e = o.exports, F = null, T = null, M = null, e.__wbindgen_start(), e;
}
async function V(o, t) {
  if (typeof Response == "function" && o instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming == "function") try {
      return await WebAssembly.instantiateStreaming(o, t);
    } catch (n) {
      if (o.ok && _(o.type) && o.headers.get("Content-Type") !== "application/wasm") console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", n);
      else throw n;
    }
    const r = await o.arrayBuffer();
    return await WebAssembly.instantiate(r, t);
  } else {
    const r = await WebAssembly.instantiate(o, t);
    return r instanceof WebAssembly.Instance ? { instance: r, module: o } : r;
  }
  function _(r) {
    switch (r) {
      case "basic":
      case "cors":
      case "default":
        return true;
    }
    return false;
  }
}
function _t(o) {
  if (e !== void 0) return e;
  o !== void 0 && (Object.getPrototypeOf(o) === Object.prototype ? { module: o } = o : console.warn("using deprecated parameters for `initSync()`; pass a single object instead"));
  const t = D();
  o instanceof WebAssembly.Module || (o = new WebAssembly.Module(o));
  const _ = new WebAssembly.Instance(o, t);
  return q(_);
}
async function rt(o) {
  if (e !== void 0) return e;
  o !== void 0 && (Object.getPrototypeOf(o) === Object.prototype ? { module_or_path: o } = o : console.warn("using deprecated parameters for the initialization function; pass a single object instead")), o === void 0 && (o = new URL("/assets/stamp_tool_bg-BgJ06yWA.wasm", import.meta.url));
  const t = D();
  (typeof o == "string" || typeof Request == "function" && o instanceof Request || typeof URL == "function" && o instanceof URL) && (o = fetch(o));
  const { instance: _, module: r } = await V(await o, t);
  return q(_);
}
export {
  I as ImageHorseTool,
  X as blank_png,
  Y as composite_pixels,
  G as compute_aspect_crop,
  K as constrain_crop_to_ratio,
  rt as default,
  Q as encode_png_pixels,
  _t as initSync,
  Z as parse_color,
  $ as photo_limit,
  tt as resize_pixels,
  et as web_perf_metrics
};
