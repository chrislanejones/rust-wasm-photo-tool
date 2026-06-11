class I {
  __destroy_into_raw() {
    const t = this.__wbg_ptr;
    return this.__wbg_ptr = 0, L.unregister(this), t;
  }
  free() {
    const t = this.__destroy_into_raw();
    e.__wbg_imagehorsetool_free(t, 0);
  }
  add_text_annotation(t, _, n, r, i, s, a, l, g, w, d, m, b, f, y, v, x) {
    const A = h(t, e.__wbindgen_malloc, e.__wbindgen_realloc), z = c;
    return e.imagehorsetool_add_text_annotation(this.__wbg_ptr, A, z, _, n, r, i, s, a, l, g, w, d, m, b, f, y, v, x) >>> 0;
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
  apply_crop_from_preview(t, _, n, r) {
    e.imagehorsetool_apply_crop_from_preview(this.__wbg_ptr, t, _, n, r);
  }
  begin_blur_stroke() {
    e.imagehorsetool_begin_blur_stroke(this.__wbg_ptr);
  }
  begin_draw_stroke(t) {
    const _ = h(t, e.__wbindgen_malloc, e.__wbindgen_realloc), n = c;
    e.imagehorsetool_begin_draw_stroke(this.__wbg_ptr, _, n);
  }
  begin_stroke(t, _) {
    e.imagehorsetool_begin_stroke(this.__wbg_ptr, t, _);
  }
  blur_region(t, _, n, r) {
    e.imagehorsetool_blur_region(this.__wbg_ptr, t, _, n, r);
  }
  cancel_crop_preview() {
    return e.imagehorsetool_cancel_crop_preview(this.__wbg_ptr) !== 0;
  }
  clear_history() {
    e.imagehorsetool_clear_history(this.__wbg_ptr);
  }
  commit_red_stamp(t, _, n, r, i, s, a) {
    const l = h(t, e.__wbindgen_malloc, e.__wbindgen_realloc), g = c;
    e.imagehorsetool_commit_red_stamp(this.__wbg_ptr, l, g, _, n, r, i, s, a);
  }
  commit_text(t, _, n, r, i, s, a, l, g) {
    const w = h(t, e.__wbindgen_malloc, e.__wbindgen_realloc), d = c;
    e.imagehorsetool_commit_text(this.__wbg_ptr, w, d, _, n, r, i, s, a, l, g);
  }
  continue_stroke(t, _) {
    e.imagehorsetool_continue_stroke(this.__wbg_ptr, t, _);
  }
  copy_region(t, _, n, r) {
    const i = e.imagehorsetool_copy_region(this.__wbg_ptr, t, _, n, r);
    var s = p(i[0], i[1]).slice();
    return e.__wbindgen_free(i[0], i[1] * 1, 1), s;
  }
  crop(t, _, n, r) {
    e.imagehorsetool_crop(this.__wbg_ptr, t, _, n, r);
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
  draw_arrow(t, _, n, r, i, s, a) {
    const l = h(i, e.__wbindgen_malloc, e.__wbindgen_realloc), g = c;
    e.imagehorsetool_draw_arrow(this.__wbg_ptr, t, _, n, r, l, g, s, a);
  }
  draw_shape(t, _, n, r, i, s, a) {
    const l = h(s, e.__wbindgen_malloc, e.__wbindgen_realloc), g = c;
    e.imagehorsetool_draw_shape(this.__wbg_ptr, t, _, n, r, i, l, g, a);
  }
  end_stroke() {
    e.imagehorsetool_end_stroke(this.__wbg_ptr);
  }
  export_png() {
    const t = e.imagehorsetool_export_png(this.__wbg_ptr);
    var _ = p(t[0], t[1]).slice();
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
    var _ = p(t[0], t[1]).slice();
    return e.__wbindgen_free(t[0], t[1] * 1, 1), _;
  }
  get_pixel(t, _) {
    const n = e.imagehorsetool_get_pixel(this.__wbg_ptr, t, _);
    var r = p(n[0], n[1]).slice();
    return e.__wbindgen_free(n[0], n[1] * 1, 1), r;
  }
  get_pixel_region(t, _, n) {
    const r = e.imagehorsetool_get_pixel_region(this.__wbg_ptr, t, _, n);
    var i = p(r[0], r[1]).slice();
    return e.__wbindgen_free(r[0], r[1] * 1, 1), i;
  }
  get_redo_snapshot_annotations(t) {
    let _, n;
    try {
      const r = e.imagehorsetool_get_redo_snapshot_annotations(this.__wbg_ptr, t);
      return _ = r[0], n = r[1], j(r[0], r[1]);
    } finally {
      e.__wbindgen_free(_, n, 1);
    }
  }
  get_redo_snapshot_label(t) {
    let _, n;
    try {
      const r = e.imagehorsetool_get_redo_snapshot_label(this.__wbg_ptr, t);
      return _ = r[0], n = r[1], j(r[0], r[1]);
    } finally {
      e.__wbindgen_free(_, n, 1);
    }
  }
  get_redo_snapshot_png(t) {
    const _ = e.imagehorsetool_get_redo_snapshot_png(this.__wbg_ptr, t);
    var n = p(_[0], _[1]).slice();
    return e.__wbindgen_free(_[0], _[1] * 1, 1), n;
  }
  get_text_annotations() {
    let t, _;
    try {
      const n = e.imagehorsetool_get_text_annotations(this.__wbg_ptr);
      return t = n[0], _ = n[1], j(n[0], n[1]);
    } finally {
      e.__wbindgen_free(t, _, 1);
    }
  }
  get_undo_snapshot_annotations(t) {
    let _, n;
    try {
      const r = e.imagehorsetool_get_undo_snapshot_annotations(this.__wbg_ptr, t);
      return _ = r[0], n = r[1], j(r[0], r[1]);
    } finally {
      e.__wbindgen_free(_, n, 1);
    }
  }
  get_undo_snapshot_label(t) {
    let _, n;
    try {
      const r = e.imagehorsetool_get_undo_snapshot_label(this.__wbg_ptr, t);
      return _ = r[0], n = r[1], j(r[0], r[1]);
    } finally {
      e.__wbindgen_free(_, n, 1);
    }
  }
  get_undo_snapshot_png(t) {
    const _ = e.imagehorsetool_get_undo_snapshot_png(this.__wbg_ptr, t);
    var n = p(_[0], _[1]).slice();
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
      return t = n[0], _ = n[1], j(n[0], n[1]);
    } finally {
      e.__wbindgen_free(t, _, 1);
    }
  }
  inject_redo_snapshot(t, _, n, r) {
    const i = u(t, e.__wbindgen_malloc), s = c, a = h(r, e.__wbindgen_malloc, e.__wbindgen_realloc), l = c;
    e.imagehorsetool_inject_redo_snapshot(this.__wbg_ptr, i, s, _, n, a, l);
  }
  inject_undo_snapshot(t, _, n, r) {
    const i = u(t, e.__wbindgen_malloc), s = c, a = h(r, e.__wbindgen_malloc, e.__wbindgen_realloc), l = c;
    e.imagehorsetool_inject_undo_snapshot(this.__wbg_ptr, i, s, _, n, a, l);
  }
  jump_to_history(t) {
    return e.imagehorsetool_jump_to_history(this.__wbg_ptr, t) !== 0;
  }
  load_image(t) {
    const _ = u(t, e.__wbindgen_malloc), n = c;
    e.imagehorsetool_load_image(this.__wbg_ptr, _, n);
  }
  measure_text(t, _, n) {
    const r = h(t, e.__wbindgen_malloc, e.__wbindgen_realloc), i = c, s = e.imagehorsetool_measure_text(this.__wbg_ptr, r, i, _, n);
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
  paint_dab(t, _, n, r, i, s, a) {
    e.imagehorsetool_paint_dab(this.__wbg_ptr, t, _, n, r, i, s, a);
  }
  paint_stroke_to(t, _, n, r, i, s, a, l, g) {
    e.imagehorsetool_paint_stroke_to(this.__wbg_ptr, t, _, n, r, i, s, a, l, g);
  }
  paste_region(t, _, n, r, i) {
    const s = u(t, e.__wbindgen_malloc), a = c;
    e.imagehorsetool_paste_region(this.__wbg_ptr, s, a, _, n, r, i);
  }
  preview_crop(t, _, n, r) {
    e.imagehorsetool_preview_crop(this.__wbg_ptr, t, _, n, r);
  }
  push_annotation_to_redo_snapshot(t, _, n, r, i, s, a, l, g, w, d, m, b, f, y, v, x, A) {
    const z = h(_, e.__wbindgen_malloc, e.__wbindgen_realloc), W = c;
    return e.imagehorsetool_push_annotation_to_redo_snapshot(this.__wbg_ptr, t, z, W, n, r, i, s, a, l, g, w, d, m, b, f, y, v, x, A) !== 0;
  }
  push_annotation_to_undo_snapshot(t, _, n, r, i, s, a, l, g, w, d, m, b, f, y, v, x, A) {
    const z = h(_, e.__wbindgen_malloc, e.__wbindgen_realloc), W = c;
    return e.imagehorsetool_push_annotation_to_undo_snapshot(this.__wbg_ptr, t, z, W, n, r, i, s, a, l, g, w, d, m, b, f, y, v, x, A) !== 0;
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
  remove_text_annotation(t) {
    return e.imagehorsetool_remove_text_annotation(this.__wbg_ptr, t) !== 0;
  }
  render_with_annotations() {
    const t = e.imagehorsetool_render_with_annotations(this.__wbg_ptr);
    var _ = p(t[0], t[1]).slice();
    return e.__wbindgen_free(t[0], t[1] * 1, 1), _;
  }
  resize(t, _) {
    e.imagehorsetool_resize(this.__wbg_ptr, t, _);
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
  stamp_pixels(t, _, n, r, i) {
    const s = u(t, e.__wbindgen_malloc), a = c;
    e.imagehorsetool_stamp_pixels(this.__wbg_ptr, s, a, _, n, r, i);
  }
  stamp_red(t, _, n, r, i, s) {
    const a = u(t, e.__wbindgen_malloc), l = c;
    e.imagehorsetool_stamp_red(this.__wbg_ptr, a, l, _, n, r, i, s);
  }
  text_annotation_at(t, _) {
    return e.imagehorsetool_text_annotation_at(this.__wbg_ptr, t, _);
  }
  text_annotation_count() {
    return e.imagehorsetool_text_annotation_count(this.__wbg_ptr) >>> 0;
  }
  thumbnail_data(t) {
    const _ = e.imagehorsetool_thumbnail_data(this.__wbg_ptr, t);
    var n = p(_[0], _[1]).slice();
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
  update_text_annotation(t, _, n, r, i, s, a, l, g, w, d, m, b, f, y, v, x, A) {
    const z = h(_, e.__wbindgen_malloc, e.__wbindgen_realloc), W = c;
    return e.imagehorsetool_update_text_annotation(this.__wbg_ptr, t, z, W, n, r, i, s, a, l, g, w, d, m, b, f, y, v, x, A) !== 0;
  }
  width() {
    return e.imagehorsetool_width(this.__wbg_ptr) >>> 0;
  }
}
Symbol.dispose && (I.prototype[Symbol.dispose] = I.prototype.free);
function X(o, t, _, n, r, i, s, a, l) {
  const g = u(o, e.__wbindgen_malloc), w = c, d = u(n, e.__wbindgen_malloc), m = c, b = e.composite_pixels(g, w, t, _, d, m, r, i, s, a, l);
  var f = p(b[0], b[1]).slice();
  return e.__wbindgen_free(b[0], b[1] * 1, 1), f;
}
function Y(o, t, _, n) {
  const r = e.compute_aspect_crop(o, t, _, n);
  var i = U(r[0], r[1]).slice();
  return e.__wbindgen_free(r[0], r[1] * 4, 4), i;
}
function G(o, t, _, n, r, i, s, a) {
  const l = e.constrain_crop_to_ratio(o, t, _, n, r, i, s, a);
  var g = U(l[0], l[1]).slice();
  return e.__wbindgen_free(l[0], l[1] * 4, 4), g;
}
function J(o, t, _) {
  const n = u(o, e.__wbindgen_malloc), r = c, i = e.encode_png_pixels(n, r, t, _);
  var s = p(i[0], i[1]).slice();
  return e.__wbindgen_free(i[0], i[1] * 1, 1), s;
}
function K(o) {
  const t = h(o, e.__wbindgen_malloc, e.__wbindgen_realloc), _ = c, n = e.parse_color(t, _);
  var r = p(n[0], n[1]).slice();
  return e.__wbindgen_free(n[0], n[1] * 1, 1), r;
}
function Q(o) {
  const t = h(o, e.__wbindgen_malloc, e.__wbindgen_realloc), _ = c;
  return e.photo_limit(t, _) >>> 0;
}
function Z(o, t, _, n, r) {
  const i = u(o, e.__wbindgen_malloc), s = c, a = e.resize_pixels(i, s, t, _, n, r);
  var l = p(a[0], a[1]).slice();
  return e.__wbindgen_free(a[0], a[1] * 1, 1), l;
}
function $(o, t, _, n, r, i) {
  const s = e.web_perf_metrics(o, t, _, n, r, i);
  var a = C(s[0], s[1]).slice();
  return e.__wbindgen_free(s[0], s[1] * 8, 8), a;
}
function B() {
  return { __proto__: null, "./stamp_tool_bg.js": { __proto__: null, __wbg___wbindgen_throw_be289d5034ed271b: function(t, _) {
    throw new Error(j(t, _));
  }, __wbindgen_init_externref_table: function() {
    const t = e.__wbindgen_externrefs, _ = t.grow(4);
    t.set(0, void 0), t.set(_ + 0, void 0), t.set(_ + 1, null), t.set(_ + 2, true), t.set(_ + 3, false);
  } } };
}
const L = typeof FinalizationRegistry > "u" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((o) => e.__wbg_imagehorsetool_free(o >>> 0, 1));
function C(o, t) {
  return o = o >>> 0, H().subarray(o / 8, o / 8 + t);
}
function U(o, t) {
  return o = o >>> 0, q().subarray(o / 4, o / 4 + t);
}
function p(o, t) {
  return o = o >>> 0, k().subarray(o / 1, o / 1 + t);
}
let F = null;
function H() {
  return (F === null || F.byteLength === 0) && (F = new Float64Array(e.memory.buffer)), F;
}
function j(o, t) {
  return o = o >>> 0, P(o, t);
}
let M = null;
function q() {
  return (M === null || M.byteLength === 0) && (M = new Uint32Array(e.memory.buffer)), M;
}
let R = null;
function k() {
  return (R === null || R.byteLength === 0) && (R = new Uint8Array(e.memory.buffer)), R;
}
function u(o, t) {
  const _ = t(o.length * 1, 1) >>> 0;
  return k().set(o, _ / 1), c = o.length, _;
}
function h(o, t, _) {
  if (_ === void 0) {
    const a = T.encode(o), l = t(a.length, 1) >>> 0;
    return k().subarray(l, l + a.length).set(a), c = a.length, l;
  }
  let n = o.length, r = t(n, 1) >>> 0;
  const i = k();
  let s = 0;
  for (; s < n; s++) {
    const a = o.charCodeAt(s);
    if (a > 127) break;
    i[r + s] = a;
  }
  if (s !== n) {
    s !== 0 && (o = o.slice(s)), r = _(r, n, n = s + o.length * 3, 1) >>> 0;
    const a = k().subarray(r + s, r + n), l = T.encodeInto(o, a);
    s += l.written, r = _(r, n, s, 1) >>> 0;
  }
  return c = s, r;
}
let S = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
S.decode();
const N = 2146435072;
let O = 0;
function P(o, t) {
  return O += t, O >= N && (S = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true }), S.decode(), O = t), S.decode(k().subarray(o, o + t));
}
const T = new TextEncoder();
"encodeInto" in T || (T.encodeInto = function(o, t) {
  const _ = T.encode(o);
  return t.set(_), { read: o.length, written: _.length };
});
let c = 0, e;
function D(o, t) {
  return e = o.exports, F = null, M = null, R = null, e.__wbindgen_start(), e;
}
async function V(o, t) {
  if (typeof Response == "function" && o instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming == "function") try {
      return await WebAssembly.instantiateStreaming(o, t);
    } catch (r) {
      if (o.ok && _(o.type) && o.headers.get("Content-Type") !== "application/wasm") console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", r);
      else throw r;
    }
    const n = await o.arrayBuffer();
    return await WebAssembly.instantiate(n, t);
  } else {
    const n = await WebAssembly.instantiate(o, t);
    return n instanceof WebAssembly.Instance ? { instance: n, module: o } : n;
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
function tt(o) {
  if (e !== void 0) return e;
  o !== void 0 && (Object.getPrototypeOf(o) === Object.prototype ? { module: o } = o : console.warn("using deprecated parameters for `initSync()`; pass a single object instead"));
  const t = B();
  o instanceof WebAssembly.Module || (o = new WebAssembly.Module(o));
  const _ = new WebAssembly.Instance(o, t);
  return D(_);
}
async function et(o) {
  if (e !== void 0) return e;
  o !== void 0 && (Object.getPrototypeOf(o) === Object.prototype ? { module_or_path: o } = o : console.warn("using deprecated parameters for the initialization function; pass a single object instead")), o === void 0 && (o = new URL("/assets/stamp_tool_bg-BwilHiNi.wasm", import.meta.url));
  const t = B();
  (typeof o == "string" || typeof Request == "function" && o instanceof Request || typeof URL == "function" && o instanceof URL) && (o = fetch(o));
  const { instance: _, module: n } = await V(await o, t);
  return D(_);
}
export {
  I as ImageHorseTool,
  X as composite_pixels,
  Y as compute_aspect_crop,
  G as constrain_crop_to_ratio,
  et as default,
  J as encode_png_pixels,
  tt as initSync,
  K as parse_color,
  Q as photo_limit,
  Z as resize_pixels,
  $ as web_perf_metrics
};
