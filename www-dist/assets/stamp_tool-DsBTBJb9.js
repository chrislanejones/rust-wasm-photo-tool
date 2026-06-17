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
    const _ = h(t, e.__wbindgen_malloc, e.__wbindgen_realloc), r = c;
    return e.imagehorsetool_add_layer(this.__wbg_ptr, _, r) >>> 0;
  }
  add_pin_annotation(t, _, r, o, i, s) {
    const a = h(s, e.__wbindgen_malloc, e.__wbindgen_realloc), l = c;
    return e.imagehorsetool_add_pin_annotation(this.__wbg_ptr, t, _, r, o, i, a, l) >>> 0;
  }
  add_polyline_annotation(t, _, r) {
    const o = D(t, e.__wbindgen_malloc), i = c, s = h(_, e.__wbindgen_malloc, e.__wbindgen_realloc), a = c;
    return e.imagehorsetool_add_polyline_annotation(this.__wbg_ptr, o, i, s, a, r) >>> 0;
  }
  add_shape_annotation(t, _, r, o, i, s, a, l) {
    const g = h(s, e.__wbindgen_malloc, e.__wbindgen_realloc), p = c;
    return e.imagehorsetool_add_shape_annotation(this.__wbg_ptr, t, _, r, o, i, g, p, a, l) >>> 0;
  }
  add_text_annotation(t, _, r, o, i, s, a, l, g, p, b, u, d, f, v, x, A) {
    const z = h(t, e.__wbindgen_malloc, e.__wbindgen_realloc), j = c;
    return e.imagehorsetool_add_text_annotation(this.__wbg_ptr, z, j, _, r, o, i, s, a, l, g, p, b, u, d, f, v, x, A) >>> 0;
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
  apply_crop_from_preview(t, _, r, o) {
    e.imagehorsetool_apply_crop_from_preview(this.__wbg_ptr, t, _, r, o);
  }
  begin_blur_stroke() {
    e.imagehorsetool_begin_blur_stroke(this.__wbg_ptr);
  }
  begin_draw_stroke(t) {
    const _ = h(t, e.__wbindgen_malloc, e.__wbindgen_realloc), r = c;
    e.imagehorsetool_begin_draw_stroke(this.__wbg_ptr, _, r);
  }
  begin_stroke(t, _) {
    e.imagehorsetool_begin_stroke(this.__wbg_ptr, t, _);
  }
  blur_region(t, _, r, o) {
    e.imagehorsetool_blur_region(this.__wbg_ptr, t, _, r, o);
  }
  cancel_crop_preview() {
    return e.imagehorsetool_cancel_crop_preview(this.__wbg_ptr) !== 0;
  }
  clear_history() {
    e.imagehorsetool_clear_history(this.__wbg_ptr);
  }
  commit_red_stamp(t, _, r, o, i, s, a) {
    const l = h(t, e.__wbindgen_malloc, e.__wbindgen_realloc), g = c;
    e.imagehorsetool_commit_red_stamp(this.__wbg_ptr, l, g, _, r, o, i, s, a);
  }
  commit_text(t, _, r, o, i, s, a, l, g) {
    const p = h(t, e.__wbindgen_malloc, e.__wbindgen_realloc), b = c;
    e.imagehorsetool_commit_text(this.__wbg_ptr, p, b, _, r, o, i, s, a, l, g);
  }
  continue_stroke(t, _) {
    e.imagehorsetool_continue_stroke(this.__wbg_ptr, t, _);
  }
  copy_region(t, _, r, o) {
    const i = e.imagehorsetool_copy_region(this.__wbg_ptr, t, _, r, o);
    var s = w(i[0], i[1]).slice();
    return e.__wbindgen_free(i[0], i[1] * 1, 1), s;
  }
  crop(t, _, r, o) {
    e.imagehorsetool_crop(this.__wbg_ptr, t, _, r, o);
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
  draw_arrow(t, _, r, o, i, s, a) {
    const l = h(i, e.__wbindgen_malloc, e.__wbindgen_realloc), g = c;
    e.imagehorsetool_draw_arrow(this.__wbg_ptr, t, _, r, o, l, g, s, a);
  }
  draw_shape(t, _, r, o, i, s, a) {
    const l = h(s, e.__wbindgen_malloc, e.__wbindgen_realloc), g = c;
    e.imagehorsetool_draw_shape(this.__wbg_ptr, t, _, r, o, i, l, g, a);
  }
  duplicate_layer(t) {
    return e.imagehorsetool_duplicate_layer(this.__wbg_ptr, t) >>> 0;
  }
  end_stroke() {
    e.imagehorsetool_end_stroke(this.__wbg_ptr);
  }
  export_png() {
    const t = e.imagehorsetool_export_png(this.__wbg_ptr);
    var _ = w(t[0], t[1]).slice();
    return e.__wbindgen_free(t[0], t[1] * 1, 1), _;
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
    var _ = w(t[0], t[1]).slice();
    return e.__wbindgen_free(t[0], t[1] * 1, 1), _;
  }
  get_layers() {
    let t, _;
    try {
      const r = e.imagehorsetool_get_layers(this.__wbg_ptr);
      return t = r[0], _ = r[1], y(r[0], r[1]);
    } finally {
      e.__wbindgen_free(t, _, 1);
    }
  }
  get_pixel(t, _) {
    const r = e.imagehorsetool_get_pixel(this.__wbg_ptr, t, _);
    var o = w(r[0], r[1]).slice();
    return e.__wbindgen_free(r[0], r[1] * 1, 1), o;
  }
  get_pixel_region(t, _, r) {
    const o = e.imagehorsetool_get_pixel_region(this.__wbg_ptr, t, _, r);
    var i = w(o[0], o[1]).slice();
    return e.__wbindgen_free(o[0], o[1] * 1, 1), i;
  }
  get_redo_snapshot_annotations(t) {
    let _, r;
    try {
      const o = e.imagehorsetool_get_redo_snapshot_annotations(this.__wbg_ptr, t);
      return _ = o[0], r = o[1], y(o[0], o[1]);
    } finally {
      e.__wbindgen_free(_, r, 1);
    }
  }
  get_redo_snapshot_label(t) {
    let _, r;
    try {
      const o = e.imagehorsetool_get_redo_snapshot_label(this.__wbg_ptr, t);
      return _ = o[0], r = o[1], y(o[0], o[1]);
    } finally {
      e.__wbindgen_free(_, r, 1);
    }
  }
  get_redo_snapshot_png(t) {
    const _ = e.imagehorsetool_get_redo_snapshot_png(this.__wbg_ptr, t);
    var r = w(_[0], _[1]).slice();
    return e.__wbindgen_free(_[0], _[1] * 1, 1), r;
  }
  get_shape_annotations() {
    let t, _;
    try {
      const r = e.imagehorsetool_get_shape_annotations(this.__wbg_ptr);
      return t = r[0], _ = r[1], y(r[0], r[1]);
    } finally {
      e.__wbindgen_free(t, _, 1);
    }
  }
  get_text_annotations() {
    let t, _;
    try {
      const r = e.imagehorsetool_get_text_annotations(this.__wbg_ptr);
      return t = r[0], _ = r[1], y(r[0], r[1]);
    } finally {
      e.__wbindgen_free(t, _, 1);
    }
  }
  get_undo_snapshot_annotations(t) {
    let _, r;
    try {
      const o = e.imagehorsetool_get_undo_snapshot_annotations(this.__wbg_ptr, t);
      return _ = o[0], r = o[1], y(o[0], o[1]);
    } finally {
      e.__wbindgen_free(_, r, 1);
    }
  }
  get_undo_snapshot_label(t) {
    let _, r;
    try {
      const o = e.imagehorsetool_get_undo_snapshot_label(this.__wbg_ptr, t);
      return _ = o[0], r = o[1], y(o[0], o[1]);
    } finally {
      e.__wbindgen_free(_, r, 1);
    }
  }
  get_undo_snapshot_png(t) {
    const _ = e.imagehorsetool_get_undo_snapshot_png(this.__wbg_ptr, t);
    var r = w(_[0], _[1]).slice();
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
      return t = r[0], _ = r[1], y(r[0], r[1]);
    } finally {
      e.__wbindgen_free(t, _, 1);
    }
  }
  inject_redo_snapshot(t, _, r, o) {
    const i = m(t, e.__wbindgen_malloc), s = c, a = h(o, e.__wbindgen_malloc, e.__wbindgen_realloc), l = c;
    e.imagehorsetool_inject_redo_snapshot(this.__wbg_ptr, i, s, _, r, a, l);
  }
  inject_undo_snapshot(t, _, r, o) {
    const i = m(t, e.__wbindgen_malloc), s = c, a = h(o, e.__wbindgen_malloc, e.__wbindgen_realloc), l = c;
    e.imagehorsetool_inject_undo_snapshot(this.__wbg_ptr, i, s, _, r, a, l);
  }
  jump_to_history(t) {
    return e.imagehorsetool_jump_to_history(this.__wbg_ptr, t) !== 0;
  }
  layer_count() {
    return e.imagehorsetool_layer_count(this.__wbg_ptr) >>> 0;
  }
  load_image(t) {
    const _ = m(t, e.__wbindgen_malloc), r = c;
    e.imagehorsetool_load_image(this.__wbg_ptr, _, r);
  }
  measure_text(t, _, r) {
    const o = h(t, e.__wbindgen_malloc, e.__wbindgen_realloc), i = c, s = e.imagehorsetool_measure_text(this.__wbg_ptr, o, i, _, r);
    var a = U(s[0], s[1]).slice();
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
  paint_dab(t, _, r, o, i, s, a) {
    e.imagehorsetool_paint_dab(this.__wbg_ptr, t, _, r, o, i, s, a);
  }
  paint_stroke_to(t, _, r, o, i, s, a, l, g) {
    e.imagehorsetool_paint_stroke_to(this.__wbg_ptr, t, _, r, o, i, s, a, l, g);
  }
  paste_region(t, _, r, o, i) {
    const s = m(t, e.__wbindgen_malloc), a = c;
    e.imagehorsetool_paste_region(this.__wbg_ptr, s, a, _, r, o, i);
  }
  preview_crop(t, _, r, o) {
    e.imagehorsetool_preview_crop(this.__wbg_ptr, t, _, r, o);
  }
  push_annotation_to_redo_snapshot(t, _, r, o, i, s, a, l, g, p, b, u, d, f, v, x, A, z) {
    const j = h(_, e.__wbindgen_malloc, e.__wbindgen_realloc), W = c;
    return e.imagehorsetool_push_annotation_to_redo_snapshot(this.__wbg_ptr, t, j, W, r, o, i, s, a, l, g, p, b, u, d, f, v, x, A, z) !== 0;
  }
  push_annotation_to_undo_snapshot(t, _, r, o, i, s, a, l, g, p, b, u, d, f, v, x, A, z) {
    const j = h(_, e.__wbindgen_malloc, e.__wbindgen_realloc), W = c;
    return e.imagehorsetool_push_annotation_to_undo_snapshot(this.__wbg_ptr, t, j, W, r, o, i, s, a, l, g, p, b, u, d, f, v, x, A, z) !== 0;
  }
  push_compress_marker() {
    e.imagehorsetool_push_compress_marker(this.__wbg_ptr);
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
    const r = h(_, e.__wbindgen_malloc, e.__wbindgen_realloc), o = c;
    return e.imagehorsetool_rename_layer(this.__wbg_ptr, t, r, o) !== 0;
  }
  render_with_annotations() {
    const t = e.imagehorsetool_render_with_annotations(this.__wbg_ptr);
    var _ = w(t[0], t[1]).slice();
    return e.__wbindgen_free(t[0], t[1] * 1, 1), _;
  }
  resize(t, _) {
    e.imagehorsetool_resize(this.__wbg_ptr, t, _);
  }
  resize_with_filter(t, _, r) {
    e.imagehorsetool_resize_with_filter(this.__wbg_ptr, t, _, r);
  }
  restore_pin_annotation(t, _, r, o, i, s, a, l) {
    return e.imagehorsetool_restore_pin_annotation(this.__wbg_ptr, t, _, r, o, i, s, a, l) >>> 0;
  }
  restore_polyline_annotation(t, _, r, o, i) {
    const s = D(t, e.__wbindgen_malloc), a = c;
    return e.imagehorsetool_restore_polyline_annotation(this.__wbg_ptr, s, a, _, r, o, i) >>> 0;
  }
  restore_shape_annotation(t, _, r, o, i, s, a, l, g, p) {
    return e.imagehorsetool_restore_shape_annotation(this.__wbg_ptr, t, _, r, o, i, s, a, l, g, p) >>> 0;
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
  stamp_pixels(t, _, r, o, i) {
    const s = m(t, e.__wbindgen_malloc), a = c;
    e.imagehorsetool_stamp_pixels(this.__wbg_ptr, s, a, _, r, o, i);
  }
  stamp_red(t, _, r, o, i, s) {
    const a = m(t, e.__wbindgen_malloc), l = c;
    e.imagehorsetool_stamp_red(this.__wbg_ptr, a, l, _, r, o, i, s);
  }
  text_annotation_at(t, _) {
    return e.imagehorsetool_text_annotation_at(this.__wbg_ptr, t, _);
  }
  text_annotation_count() {
    return e.imagehorsetool_text_annotation_count(this.__wbg_ptr) >>> 0;
  }
  thumbnail_data(t) {
    const _ = e.imagehorsetool_thumbnail_data(this.__wbg_ptr, t);
    var r = w(_[0], _[1]).slice();
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
  update_shape_annotation(t, _, r, o, i, s, a, l, g) {
    const p = h(a, e.__wbindgen_malloc, e.__wbindgen_realloc), b = c;
    return e.imagehorsetool_update_shape_annotation(this.__wbg_ptr, t, _, r, o, i, s, p, b, l, g) !== 0;
  }
  update_text_annotation(t, _, r, o, i, s, a, l, g, p, b, u, d, f, v, x, A, z) {
    const j = h(_, e.__wbindgen_malloc, e.__wbindgen_realloc), W = c;
    return e.imagehorsetool_update_text_annotation(this.__wbg_ptr, t, j, W, r, o, i, s, a, l, g, p, b, u, d, f, v, x, A, z) !== 0;
  }
  width() {
    return e.imagehorsetool_width(this.__wbg_ptr) >>> 0;
  }
}
Symbol.dispose && (I.prototype[Symbol.dispose] = I.prototype.free);
function Y(n, t, _, r, o, i, s, a, l) {
  const g = m(n, e.__wbindgen_malloc), p = c, b = m(r, e.__wbindgen_malloc), u = c, d = e.composite_pixels(g, p, t, _, b, u, o, i, s, a, l);
  var f = w(d[0], d[1]).slice();
  return e.__wbindgen_free(d[0], d[1] * 1, 1), f;
}
function Z(n, t, _, r) {
  const o = e.compute_aspect_crop(n, t, _, r);
  var i = U(o[0], o[1]).slice();
  return e.__wbindgen_free(o[0], o[1] * 4, 4), i;
}
function G(n, t, _, r, o, i, s, a) {
  const l = e.constrain_crop_to_ratio(n, t, _, r, o, i, s, a);
  var g = U(l[0], l[1]).slice();
  return e.__wbindgen_free(l[0], l[1] * 4, 4), g;
}
function J(n, t, _) {
  const r = m(n, e.__wbindgen_malloc), o = c, i = e.encode_png_pixels(r, o, t, _);
  var s = w(i[0], i[1]).slice();
  return e.__wbindgen_free(i[0], i[1] * 1, 1), s;
}
function K(n) {
  const t = h(n, e.__wbindgen_malloc, e.__wbindgen_realloc), _ = c, r = e.parse_color(t, _);
  var o = w(r[0], r[1]).slice();
  return e.__wbindgen_free(r[0], r[1] * 1, 1), o;
}
function Q(n) {
  const t = h(n, e.__wbindgen_malloc, e.__wbindgen_realloc), _ = c;
  return e.photo_limit(t, _) >>> 0;
}
function $(n, t, _, r, o) {
  const i = m(n, e.__wbindgen_malloc), s = c, a = e.resize_pixels(i, s, t, _, r, o);
  var l = w(a[0], a[1]).slice();
  return e.__wbindgen_free(a[0], a[1] * 1, 1), l;
}
function tt(n, t, _, r, o, i, s, a, l) {
  const g = e.web_perf_metrics(n, t, _, r, o, i, s, a, l);
  var p = H(g[0], g[1]).slice();
  return e.__wbindgen_free(g[0], g[1] * 8, 8), p;
}
function B() {
  return { __proto__: null, "./stamp_tool_bg.js": { __proto__: null, __wbg___wbindgen_throw_be289d5034ed271b: function(t, _) {
    throw new Error(y(t, _));
  }, __wbindgen_init_externref_table: function() {
    const t = e.__wbindgen_externrefs, _ = t.grow(4);
    t.set(0, void 0), t.set(_ + 0, void 0), t.set(_ + 1, null), t.set(_ + 2, true), t.set(_ + 3, false);
  } } };
}
const L = typeof FinalizationRegistry > "u" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((n) => e.__wbg_imagehorsetool_free(n >>> 0, 1));
function H(n, t) {
  return n = n >>> 0, C().subarray(n / 8, n / 8 + t);
}
function U(n, t) {
  return n = n >>> 0, P().subarray(n / 4, n / 4 + t);
}
function w(n, t) {
  return n = n >>> 0, k().subarray(n / 1, n / 1 + t);
}
let T = null;
function C() {
  return (T === null || T.byteLength === 0) && (T = new Float64Array(e.memory.buffer)), T;
}
function y(n, t) {
  return n = n >>> 0, V(n, t);
}
let F = null;
function P() {
  return (F === null || F.byteLength === 0) && (F = new Uint32Array(e.memory.buffer)), F;
}
let M = null;
function k() {
  return (M === null || M.byteLength === 0) && (M = new Uint8Array(e.memory.buffer)), M;
}
function m(n, t) {
  const _ = t(n.length * 1, 1) >>> 0;
  return k().set(n, _ / 1), c = n.length, _;
}
function D(n, t) {
  const _ = t(n.length * 8, 8) >>> 0;
  return C().set(n, _ / 8), c = n.length, _;
}
function h(n, t, _) {
  if (_ === void 0) {
    const a = R.encode(n), l = t(a.length, 1) >>> 0;
    return k().subarray(l, l + a.length).set(a), c = a.length, l;
  }
  let r = n.length, o = t(r, 1) >>> 0;
  const i = k();
  let s = 0;
  for (; s < r; s++) {
    const a = n.charCodeAt(s);
    if (a > 127) break;
    i[o + s] = a;
  }
  if (s !== r) {
    s !== 0 && (n = n.slice(s)), o = _(o, r, r = s + n.length * 3, 1) >>> 0;
    const a = k().subarray(o + s, o + r), l = R.encodeInto(n, a);
    s += l.written, o = _(o, r, s, 1) >>> 0;
  }
  return c = s, o;
}
let S = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
S.decode();
const N = 2146435072;
let O = 0;
function V(n, t) {
  return O += t, O >= N && (S = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true }), S.decode(), O = t), S.decode(k().subarray(n, n + t));
}
const R = new TextEncoder();
"encodeInto" in R || (R.encodeInto = function(n, t) {
  const _ = R.encode(n);
  return t.set(_), { read: n.length, written: _.length };
});
let c = 0, e;
function q(n, t) {
  return e = n.exports, T = null, F = null, M = null, e.__wbindgen_start(), e;
}
async function X(n, t) {
  if (typeof Response == "function" && n instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming == "function") try {
      return await WebAssembly.instantiateStreaming(n, t);
    } catch (o) {
      if (n.ok && _(n.type) && n.headers.get("Content-Type") !== "application/wasm") console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", o);
      else throw o;
    }
    const r = await n.arrayBuffer();
    return await WebAssembly.instantiate(r, t);
  } else {
    const r = await WebAssembly.instantiate(n, t);
    return r instanceof WebAssembly.Instance ? { instance: r, module: n } : r;
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
function et(n) {
  if (e !== void 0) return e;
  n !== void 0 && (Object.getPrototypeOf(n) === Object.prototype ? { module: n } = n : console.warn("using deprecated parameters for `initSync()`; pass a single object instead"));
  const t = B();
  n instanceof WebAssembly.Module || (n = new WebAssembly.Module(n));
  const _ = new WebAssembly.Instance(n, t);
  return q(_);
}
async function _t(n) {
  if (e !== void 0) return e;
  n !== void 0 && (Object.getPrototypeOf(n) === Object.prototype ? { module_or_path: n } = n : console.warn("using deprecated parameters for the initialization function; pass a single object instead")), n === void 0 && (n = new URL("/assets/stamp_tool_bg-Tn7ZhA0f.wasm", import.meta.url));
  const t = B();
  (typeof n == "string" || typeof Request == "function" && n instanceof Request || typeof URL == "function" && n instanceof URL) && (n = fetch(n));
  const { instance: _, module: r } = await X(await n, t);
  return q(_);
}
export {
  I as ImageHorseTool,
  Y as composite_pixels,
  Z as compute_aspect_crop,
  G as constrain_crop_to_ratio,
  _t as default,
  J as encode_png_pixels,
  et as initSync,
  K as parse_color,
  Q as photo_limit,
  $ as resize_pixels,
  tt as web_perf_metrics
};
