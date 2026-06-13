class I {
  __destroy_into_raw() {
    const t = this.__wbg_ptr;
    return this.__wbg_ptr = 0, L.unregister(this), t;
  }
  free() {
    const t = this.__destroy_into_raw();
    e.__wbg_imagehorsetool_free(t, 0);
  }
  add_shape_annotation(t, _, n, o, i, s, a, l) {
    const c = p(s, e.__wbindgen_malloc, e.__wbindgen_realloc), h = g;
    return e.imagehorsetool_add_shape_annotation(this.__wbg_ptr, t, _, n, o, i, c, h, a, l) >>> 0;
  }
  add_text_annotation(t, _, n, o, i, s, a, l, c, h, b, u, d, f, v, x, A) {
    const z = p(t, e.__wbindgen_malloc, e.__wbindgen_realloc), j = g;
    return e.imagehorsetool_add_text_annotation(this.__wbg_ptr, z, j, _, n, o, i, s, a, l, c, h, b, u, d, f, v, x, A) >>> 0;
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
  apply_crop_from_preview(t, _, n, o) {
    e.imagehorsetool_apply_crop_from_preview(this.__wbg_ptr, t, _, n, o);
  }
  begin_blur_stroke() {
    e.imagehorsetool_begin_blur_stroke(this.__wbg_ptr);
  }
  begin_draw_stroke(t) {
    const _ = p(t, e.__wbindgen_malloc, e.__wbindgen_realloc), n = g;
    e.imagehorsetool_begin_draw_stroke(this.__wbg_ptr, _, n);
  }
  begin_stroke(t, _) {
    e.imagehorsetool_begin_stroke(this.__wbg_ptr, t, _);
  }
  blur_region(t, _, n, o) {
    e.imagehorsetool_blur_region(this.__wbg_ptr, t, _, n, o);
  }
  cancel_crop_preview() {
    return e.imagehorsetool_cancel_crop_preview(this.__wbg_ptr) !== 0;
  }
  clear_history() {
    e.imagehorsetool_clear_history(this.__wbg_ptr);
  }
  commit_red_stamp(t, _, n, o, i, s, a) {
    const l = p(t, e.__wbindgen_malloc, e.__wbindgen_realloc), c = g;
    e.imagehorsetool_commit_red_stamp(this.__wbg_ptr, l, c, _, n, o, i, s, a);
  }
  commit_text(t, _, n, o, i, s, a, l, c) {
    const h = p(t, e.__wbindgen_malloc, e.__wbindgen_realloc), b = g;
    e.imagehorsetool_commit_text(this.__wbg_ptr, h, b, _, n, o, i, s, a, l, c);
  }
  continue_stroke(t, _) {
    e.imagehorsetool_continue_stroke(this.__wbg_ptr, t, _);
  }
  copy_region(t, _, n, o) {
    const i = e.imagehorsetool_copy_region(this.__wbg_ptr, t, _, n, o);
    var s = w(i[0], i[1]).slice();
    return e.__wbindgen_free(i[0], i[1] * 1, 1), s;
  }
  crop(t, _, n, o) {
    e.imagehorsetool_crop(this.__wbg_ptr, t, _, n, o);
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
  draw_arrow(t, _, n, o, i, s, a) {
    const l = p(i, e.__wbindgen_malloc, e.__wbindgen_realloc), c = g;
    e.imagehorsetool_draw_arrow(this.__wbg_ptr, t, _, n, o, l, c, s, a);
  }
  draw_shape(t, _, n, o, i, s, a) {
    const l = p(s, e.__wbindgen_malloc, e.__wbindgen_realloc), c = g;
    e.imagehorsetool_draw_shape(this.__wbg_ptr, t, _, n, o, i, l, c, a);
  }
  end_stroke() {
    e.imagehorsetool_end_stroke(this.__wbg_ptr);
  }
  export_png() {
    const t = e.imagehorsetool_export_png(this.__wbg_ptr);
    var _ = w(t[0], t[1]).slice();
    return e.__wbindgen_free(t[0], t[1] * 1, 1), _;
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
  get_pixel(t, _) {
    const n = e.imagehorsetool_get_pixel(this.__wbg_ptr, t, _);
    var o = w(n[0], n[1]).slice();
    return e.__wbindgen_free(n[0], n[1] * 1, 1), o;
  }
  get_pixel_region(t, _, n) {
    const o = e.imagehorsetool_get_pixel_region(this.__wbg_ptr, t, _, n);
    var i = w(o[0], o[1]).slice();
    return e.__wbindgen_free(o[0], o[1] * 1, 1), i;
  }
  get_redo_snapshot_annotations(t) {
    let _, n;
    try {
      const o = e.imagehorsetool_get_redo_snapshot_annotations(this.__wbg_ptr, t);
      return _ = o[0], n = o[1], y(o[0], o[1]);
    } finally {
      e.__wbindgen_free(_, n, 1);
    }
  }
  get_redo_snapshot_label(t) {
    let _, n;
    try {
      const o = e.imagehorsetool_get_redo_snapshot_label(this.__wbg_ptr, t);
      return _ = o[0], n = o[1], y(o[0], o[1]);
    } finally {
      e.__wbindgen_free(_, n, 1);
    }
  }
  get_redo_snapshot_png(t) {
    const _ = e.imagehorsetool_get_redo_snapshot_png(this.__wbg_ptr, t);
    var n = w(_[0], _[1]).slice();
    return e.__wbindgen_free(_[0], _[1] * 1, 1), n;
  }
  get_shape_annotations() {
    let t, _;
    try {
      const n = e.imagehorsetool_get_shape_annotations(this.__wbg_ptr);
      return t = n[0], _ = n[1], y(n[0], n[1]);
    } finally {
      e.__wbindgen_free(t, _, 1);
    }
  }
  get_text_annotations() {
    let t, _;
    try {
      const n = e.imagehorsetool_get_text_annotations(this.__wbg_ptr);
      return t = n[0], _ = n[1], y(n[0], n[1]);
    } finally {
      e.__wbindgen_free(t, _, 1);
    }
  }
  get_undo_snapshot_annotations(t) {
    let _, n;
    try {
      const o = e.imagehorsetool_get_undo_snapshot_annotations(this.__wbg_ptr, t);
      return _ = o[0], n = o[1], y(o[0], o[1]);
    } finally {
      e.__wbindgen_free(_, n, 1);
    }
  }
  get_undo_snapshot_label(t) {
    let _, n;
    try {
      const o = e.imagehorsetool_get_undo_snapshot_label(this.__wbg_ptr, t);
      return _ = o[0], n = o[1], y(o[0], o[1]);
    } finally {
      e.__wbindgen_free(_, n, 1);
    }
  }
  get_undo_snapshot_png(t) {
    const _ = e.imagehorsetool_get_undo_snapshot_png(this.__wbg_ptr, t);
    var n = w(_[0], _[1]).slice();
    return e.__wbindgen_free(_[0], _[1] * 1, 1), n;
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
      const n = e.imagehorsetool_history_labels(this.__wbg_ptr);
      return t = n[0], _ = n[1], y(n[0], n[1]);
    } finally {
      e.__wbindgen_free(t, _, 1);
    }
  }
  inject_redo_snapshot(t, _, n, o) {
    const i = m(t, e.__wbindgen_malloc), s = g, a = p(o, e.__wbindgen_malloc, e.__wbindgen_realloc), l = g;
    e.imagehorsetool_inject_redo_snapshot(this.__wbg_ptr, i, s, _, n, a, l);
  }
  inject_undo_snapshot(t, _, n, o) {
    const i = m(t, e.__wbindgen_malloc), s = g, a = p(o, e.__wbindgen_malloc, e.__wbindgen_realloc), l = g;
    e.imagehorsetool_inject_undo_snapshot(this.__wbg_ptr, i, s, _, n, a, l);
  }
  jump_to_history(t) {
    return e.imagehorsetool_jump_to_history(this.__wbg_ptr, t) !== 0;
  }
  load_image(t) {
    const _ = m(t, e.__wbindgen_malloc), n = g;
    e.imagehorsetool_load_image(this.__wbg_ptr, _, n);
  }
  measure_text(t, _, n) {
    const o = p(t, e.__wbindgen_malloc, e.__wbindgen_realloc), i = g, s = e.imagehorsetool_measure_text(this.__wbg_ptr, o, i, _, n);
    var a = U(s[0], s[1]).slice();
    return e.__wbindgen_free(s[0], s[1] * 4, 4), a;
  }
  constructor(t, _) {
    const n = e.imagehorsetool_new(t, _);
    return this.__wbg_ptr = n >>> 0, L.register(this, this.__wbg_ptr, this), this;
  }
  paint_begin() {
    e.imagehorsetool_paint_begin(this.__wbg_ptr);
  }
  paint_dab(t, _, n, o, i, s, a) {
    e.imagehorsetool_paint_dab(this.__wbg_ptr, t, _, n, o, i, s, a);
  }
  paint_stroke_to(t, _, n, o, i, s, a, l, c) {
    e.imagehorsetool_paint_stroke_to(this.__wbg_ptr, t, _, n, o, i, s, a, l, c);
  }
  paste_region(t, _, n, o, i) {
    const s = m(t, e.__wbindgen_malloc), a = g;
    e.imagehorsetool_paste_region(this.__wbg_ptr, s, a, _, n, o, i);
  }
  preview_crop(t, _, n, o) {
    e.imagehorsetool_preview_crop(this.__wbg_ptr, t, _, n, o);
  }
  push_annotation_to_redo_snapshot(t, _, n, o, i, s, a, l, c, h, b, u, d, f, v, x, A, z) {
    const j = p(_, e.__wbindgen_malloc, e.__wbindgen_realloc), W = g;
    return e.imagehorsetool_push_annotation_to_redo_snapshot(this.__wbg_ptr, t, j, W, n, o, i, s, a, l, c, h, b, u, d, f, v, x, A, z) !== 0;
  }
  push_annotation_to_undo_snapshot(t, _, n, o, i, s, a, l, c, h, b, u, d, f, v, x, A, z) {
    const j = p(_, e.__wbindgen_malloc, e.__wbindgen_realloc), W = g;
    return e.imagehorsetool_push_annotation_to_undo_snapshot(this.__wbg_ptr, t, j, W, n, o, i, s, a, l, c, h, b, u, d, f, v, x, A, z) !== 0;
  }
  push_compress_marker() {
    e.imagehorsetool_push_compress_marker(this.__wbg_ptr);
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
  remove_shape_annotation(t) {
    return e.imagehorsetool_remove_shape_annotation(this.__wbg_ptr, t) !== 0;
  }
  remove_text_annotation(t) {
    return e.imagehorsetool_remove_text_annotation(this.__wbg_ptr, t) !== 0;
  }
  render_with_annotations() {
    const t = e.imagehorsetool_render_with_annotations(this.__wbg_ptr);
    var _ = w(t[0], t[1]).slice();
    return e.__wbindgen_free(t[0], t[1] * 1, 1), _;
  }
  resize(t, _) {
    e.imagehorsetool_resize(this.__wbg_ptr, t, _);
  }
  resize_with_filter(t, _, n) {
    e.imagehorsetool_resize_with_filter(this.__wbg_ptr, t, _, n);
  }
  restore_shape_annotation(t, _, n, o, i, s, a, l, c, h) {
    return e.imagehorsetool_restore_shape_annotation(this.__wbg_ptr, t, _, n, o, i, s, a, l, c, h) >>> 0;
  }
  rotate_90_ccw() {
    e.imagehorsetool_rotate_90_ccw(this.__wbg_ptr);
  }
  rotate_90_cw() {
    e.imagehorsetool_rotate_90_cw(this.__wbg_ptr);
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
  stamp_pixels(t, _, n, o, i) {
    const s = m(t, e.__wbindgen_malloc), a = g;
    e.imagehorsetool_stamp_pixels(this.__wbg_ptr, s, a, _, n, o, i);
  }
  stamp_red(t, _, n, o, i, s) {
    const a = m(t, e.__wbindgen_malloc), l = g;
    e.imagehorsetool_stamp_red(this.__wbg_ptr, a, l, _, n, o, i, s);
  }
  text_annotation_at(t, _) {
    return e.imagehorsetool_text_annotation_at(this.__wbg_ptr, t, _);
  }
  text_annotation_count() {
    return e.imagehorsetool_text_annotation_count(this.__wbg_ptr) >>> 0;
  }
  thumbnail_data(t) {
    const _ = e.imagehorsetool_thumbnail_data(this.__wbg_ptr, t);
    var n = w(_[0], _[1]).slice();
    return e.__wbindgen_free(_[0], _[1] * 1, 1), n;
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
  update_shape_annotation(t, _, n, o, i, s, a, l, c) {
    const h = p(a, e.__wbindgen_malloc, e.__wbindgen_realloc), b = g;
    return e.imagehorsetool_update_shape_annotation(this.__wbg_ptr, t, _, n, o, i, s, h, b, l, c) !== 0;
  }
  update_text_annotation(t, _, n, o, i, s, a, l, c, h, b, u, d, f, v, x, A, z) {
    const j = p(_, e.__wbindgen_malloc, e.__wbindgen_realloc), W = g;
    return e.imagehorsetool_update_text_annotation(this.__wbg_ptr, t, j, W, n, o, i, s, a, l, c, h, b, u, d, f, v, x, A, z) !== 0;
  }
  width() {
    return e.imagehorsetool_width(this.__wbg_ptr) >>> 0;
  }
}
Symbol.dispose && (I.prototype[Symbol.dispose] = I.prototype.free);
function V(r, t, _, n, o, i, s, a, l) {
  const c = m(r, e.__wbindgen_malloc), h = g, b = m(n, e.__wbindgen_malloc), u = g, d = e.composite_pixels(c, h, t, _, b, u, o, i, s, a, l);
  var f = w(d[0], d[1]).slice();
  return e.__wbindgen_free(d[0], d[1] * 1, 1), f;
}
function X(r, t, _, n) {
  const o = e.compute_aspect_crop(r, t, _, n);
  var i = U(o[0], o[1]).slice();
  return e.__wbindgen_free(o[0], o[1] * 4, 4), i;
}
function Y(r, t, _, n, o, i, s, a) {
  const l = e.constrain_crop_to_ratio(r, t, _, n, o, i, s, a);
  var c = U(l[0], l[1]).slice();
  return e.__wbindgen_free(l[0], l[1] * 4, 4), c;
}
function G(r, t, _) {
  const n = m(r, e.__wbindgen_malloc), o = g, i = e.encode_png_pixels(n, o, t, _);
  var s = w(i[0], i[1]).slice();
  return e.__wbindgen_free(i[0], i[1] * 1, 1), s;
}
function J(r) {
  const t = p(r, e.__wbindgen_malloc, e.__wbindgen_realloc), _ = g, n = e.parse_color(t, _);
  var o = w(n[0], n[1]).slice();
  return e.__wbindgen_free(n[0], n[1] * 1, 1), o;
}
function Q(r) {
  const t = p(r, e.__wbindgen_malloc, e.__wbindgen_realloc), _ = g;
  return e.photo_limit(t, _) >>> 0;
}
function Z(r, t, _, n, o) {
  const i = m(r, e.__wbindgen_malloc), s = g, a = e.resize_pixels(i, s, t, _, n, o);
  var l = w(a[0], a[1]).slice();
  return e.__wbindgen_free(a[0], a[1] * 1, 1), l;
}
function $(r, t, _, n, o, i, s, a, l) {
  const c = e.web_perf_metrics(r, t, _, n, o, i, s, a, l);
  var h = C(c[0], c[1]).slice();
  return e.__wbindgen_free(c[0], c[1] * 8, 8), h;
}
function D() {
  return { __proto__: null, "./stamp_tool_bg.js": { __proto__: null, __wbg___wbindgen_throw_be289d5034ed271b: function(t, _) {
    throw new Error(y(t, _));
  }, __wbindgen_init_externref_table: function() {
    const t = e.__wbindgen_externrefs, _ = t.grow(4);
    t.set(0, void 0), t.set(_ + 0, void 0), t.set(_ + 1, null), t.set(_ + 2, true), t.set(_ + 3, false);
  } } };
}
const L = typeof FinalizationRegistry > "u" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((r) => e.__wbg_imagehorsetool_free(r >>> 0, 1));
function C(r, t) {
  return r = r >>> 0, q().subarray(r / 8, r / 8 + t);
}
function U(r, t) {
  return r = r >>> 0, H().subarray(r / 4, r / 4 + t);
}
function w(r, t) {
  return r = r >>> 0, k().subarray(r / 1, r / 1 + t);
}
let F = null;
function q() {
  return (F === null || F.byteLength === 0) && (F = new Float64Array(e.memory.buffer)), F;
}
function y(r, t) {
  return r = r >>> 0, K(r, t);
}
let M = null;
function H() {
  return (M === null || M.byteLength === 0) && (M = new Uint32Array(e.memory.buffer)), M;
}
let R = null;
function k() {
  return (R === null || R.byteLength === 0) && (R = new Uint8Array(e.memory.buffer)), R;
}
function m(r, t) {
  const _ = t(r.length * 1, 1) >>> 0;
  return k().set(r, _ / 1), g = r.length, _;
}
function p(r, t, _) {
  if (_ === void 0) {
    const a = T.encode(r), l = t(a.length, 1) >>> 0;
    return k().subarray(l, l + a.length).set(a), g = a.length, l;
  }
  let n = r.length, o = t(n, 1) >>> 0;
  const i = k();
  let s = 0;
  for (; s < n; s++) {
    const a = r.charCodeAt(s);
    if (a > 127) break;
    i[o + s] = a;
  }
  if (s !== n) {
    s !== 0 && (r = r.slice(s)), o = _(o, n, n = s + r.length * 3, 1) >>> 0;
    const a = k().subarray(o + s, o + n), l = T.encodeInto(r, a);
    s += l.written, o = _(o, n, s, 1) >>> 0;
  }
  return g = s, o;
}
let S = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
S.decode();
const P = 2146435072;
let O = 0;
function K(r, t) {
  return O += t, O >= P && (S = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true }), S.decode(), O = t), S.decode(k().subarray(r, r + t));
}
const T = new TextEncoder();
"encodeInto" in T || (T.encodeInto = function(r, t) {
  const _ = T.encode(r);
  return t.set(_), { read: r.length, written: _.length };
});
let g = 0, e;
function B(r, t) {
  return e = r.exports, F = null, M = null, R = null, e.__wbindgen_start(), e;
}
async function N(r, t) {
  if (typeof Response == "function" && r instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming == "function") try {
      return await WebAssembly.instantiateStreaming(r, t);
    } catch (o) {
      if (r.ok && _(r.type) && r.headers.get("Content-Type") !== "application/wasm") console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", o);
      else throw o;
    }
    const n = await r.arrayBuffer();
    return await WebAssembly.instantiate(n, t);
  } else {
    const n = await WebAssembly.instantiate(r, t);
    return n instanceof WebAssembly.Instance ? { instance: n, module: r } : n;
  }
  function _(n) {
    switch (n) {
      case "basic":
      case "cors":
      case "default":
        return true;
    }
    return false;
  }
}
function tt(r) {
  if (e !== void 0) return e;
  r !== void 0 && (Object.getPrototypeOf(r) === Object.prototype ? { module: r } = r : console.warn("using deprecated parameters for `initSync()`; pass a single object instead"));
  const t = D();
  r instanceof WebAssembly.Module || (r = new WebAssembly.Module(r));
  const _ = new WebAssembly.Instance(r, t);
  return B(_);
}
async function et(r) {
  if (e !== void 0) return e;
  r !== void 0 && (Object.getPrototypeOf(r) === Object.prototype ? { module_or_path: r } = r : console.warn("using deprecated parameters for the initialization function; pass a single object instead")), r === void 0 && (r = new URL("/assets/stamp_tool_bg-CqK8wc75.wasm", import.meta.url));
  const t = D();
  (typeof r == "string" || typeof Request == "function" && r instanceof Request || typeof URL == "function" && r instanceof URL) && (r = fetch(r));
  const { instance: _, module: n } = await N(await r, t);
  return B(_);
}
export {
  I as ImageHorseTool,
  V as composite_pixels,
  X as compute_aspect_crop,
  Y as constrain_crop_to_ratio,
  et as default,
  G as encode_png_pixels,
  tt as initSync,
  J as parse_color,
  Q as photo_limit,
  Z as resize_pixels,
  $ as web_perf_metrics
};
