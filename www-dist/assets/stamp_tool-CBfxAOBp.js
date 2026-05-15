class x {
  __destroy_into_raw() {
    const t = this.__wbg_ptr;
    return this.__wbg_ptr = 0, A.unregister(this), t;
  }
  free() {
    const t = this.__destroy_into_raw();
    e.__wbg_imagehorsetool_free(t, 0);
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
    const _ = p(t, e.__wbindgen_malloc, e.__wbindgen_realloc), r = l;
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
    const g = p(t, e.__wbindgen_malloc, e.__wbindgen_realloc), c = l;
    e.imagehorsetool_commit_red_stamp(this.__wbg_ptr, g, c, _, r, o, i, s, a);
  }
  commit_text(t, _, r, o, i, s, a, g, c) {
    const z = p(t, e.__wbindgen_malloc, e.__wbindgen_realloc), j = l;
    e.imagehorsetool_commit_text(this.__wbg_ptr, z, j, _, r, o, i, s, a, g, c);
  }
  continue_stroke(t, _) {
    e.imagehorsetool_continue_stroke(this.__wbg_ptr, t, _);
  }
  copy_region(t, _, r, o) {
    const i = e.imagehorsetool_copy_region(this.__wbg_ptr, t, _, r, o);
    var s = h(i[0], i[1]).slice();
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
    const g = p(i, e.__wbindgen_malloc, e.__wbindgen_realloc), c = l;
    e.imagehorsetool_draw_arrow(this.__wbg_ptr, t, _, r, o, g, c, s, a);
  }
  draw_shape(t, _, r, o, i, s, a) {
    const g = p(s, e.__wbindgen_malloc, e.__wbindgen_realloc), c = l;
    e.imagehorsetool_draw_shape(this.__wbg_ptr, t, _, r, o, i, g, c, a);
  }
  end_stroke() {
    e.imagehorsetool_end_stroke(this.__wbg_ptr);
  }
  export_png() {
    const t = e.imagehorsetool_export_png(this.__wbg_ptr);
    var _ = h(t[0], t[1]).slice();
    return e.__wbindgen_free(t[0], t[1] * 1, 1), _;
  }
  extract_region_png(t, _, r, o) {
    const i = e.imagehorsetool_extract_region_png(this.__wbg_ptr, t, _, r, o);
    var s = h(i[0], i[1]).slice();
    return e.__wbindgen_free(i[0], i[1] * 1, 1), s;
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
    var _ = h(t[0], t[1]).slice();
    return e.__wbindgen_free(t[0], t[1] * 1, 1), _;
  }
  get_pixel(t, _) {
    const r = e.imagehorsetool_get_pixel(this.__wbg_ptr, t, _);
    var o = h(r[0], r[1]).slice();
    return e.__wbindgen_free(r[0], r[1] * 1, 1), o;
  }
  get_pixel_region(t, _, r) {
    const o = e.imagehorsetool_get_pixel_region(this.__wbg_ptr, t, _, r);
    var i = h(o[0], o[1]).slice();
    return e.__wbindgen_free(o[0], o[1] * 1, 1), i;
  }
  get_redo_snapshot_label(t) {
    let _, r;
    try {
      const o = e.imagehorsetool_get_redo_snapshot_label(this.__wbg_ptr, t);
      return _ = o[0], r = o[1], f(o[0], o[1]);
    } finally {
      e.__wbindgen_free(_, r, 1);
    }
  }
  get_redo_snapshot_png(t) {
    const _ = e.imagehorsetool_get_redo_snapshot_png(this.__wbg_ptr, t);
    var r = h(_[0], _[1]).slice();
    return e.__wbindgen_free(_[0], _[1] * 1, 1), r;
  }
  get_undo_snapshot_label(t) {
    let _, r;
    try {
      const o = e.imagehorsetool_get_undo_snapshot_label(this.__wbg_ptr, t);
      return _ = o[0], r = o[1], f(o[0], o[1]);
    } finally {
      e.__wbindgen_free(_, r, 1);
    }
  }
  get_undo_snapshot_png(t) {
    const _ = e.imagehorsetool_get_undo_snapshot_png(this.__wbg_ptr, t);
    var r = h(_[0], _[1]).slice();
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
      return t = r[0], _ = r[1], f(r[0], r[1]);
    } finally {
      e.__wbindgen_free(t, _, 1);
    }
  }
  inject_redo_snapshot(t, _, r, o) {
    const i = b(t, e.__wbindgen_malloc), s = l, a = p(o, e.__wbindgen_malloc, e.__wbindgen_realloc), g = l;
    e.imagehorsetool_inject_redo_snapshot(this.__wbg_ptr, i, s, _, r, a, g);
  }
  inject_undo_snapshot(t, _, r, o) {
    const i = b(t, e.__wbindgen_malloc), s = l, a = p(o, e.__wbindgen_malloc, e.__wbindgen_realloc), g = l;
    e.imagehorsetool_inject_undo_snapshot(this.__wbg_ptr, i, s, _, r, a, g);
  }
  jump_to_history(t) {
    return e.imagehorsetool_jump_to_history(this.__wbg_ptr, t) !== 0;
  }
  load_image(t) {
    const _ = b(t, e.__wbindgen_malloc), r = l;
    e.imagehorsetool_load_image(this.__wbg_ptr, _, r);
  }
  measure_text(t, _, r) {
    const o = p(t, e.__wbindgen_malloc, e.__wbindgen_realloc), i = l, s = e.imagehorsetool_measure_text(this.__wbg_ptr, o, i, _, r);
    var a = R(s[0], s[1]).slice();
    return e.__wbindgen_free(s[0], s[1] * 4, 4), a;
  }
  constructor(t, _) {
    const r = e.imagehorsetool_new(t, _);
    return this.__wbg_ptr = r >>> 0, A.register(this, this.__wbg_ptr, this), this;
  }
  paint_begin() {
    e.imagehorsetool_paint_begin(this.__wbg_ptr);
  }
  paint_dab(t, _, r, o, i, s, a) {
    e.imagehorsetool_paint_dab(this.__wbg_ptr, t, _, r, o, i, s, a);
  }
  paint_stroke_to(t, _, r, o, i, s, a, g, c) {
    e.imagehorsetool_paint_stroke_to(this.__wbg_ptr, t, _, r, o, i, s, a, g, c);
  }
  paste_region(t, _, r, o, i) {
    const s = b(t, e.__wbindgen_malloc), a = l;
    e.imagehorsetool_paste_region(this.__wbg_ptr, s, a, _, r, o, i);
  }
  preview_crop(t, _, r, o) {
    e.imagehorsetool_preview_crop(this.__wbg_ptr, t, _, r, o);
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
  stamp_pixels(t, _, r, o, i) {
    const s = b(t, e.__wbindgen_malloc), a = l;
    e.imagehorsetool_stamp_pixels(this.__wbg_ptr, s, a, _, r, o, i);
  }
  stamp_red(t, _, r, o, i, s) {
    const a = b(t, e.__wbindgen_malloc), g = l;
    e.imagehorsetool_stamp_red(this.__wbg_ptr, a, g, _, r, o, i, s);
  }
  thumbnail_data(t) {
    const _ = e.imagehorsetool_thumbnail_data(this.__wbg_ptr, t);
    var r = h(_[0], _[1]).slice();
    return e.__wbindgen_free(_[0], _[1] * 1, 1), r;
  }
  thumbnail_height(t) {
    return e.imagehorsetool_thumbnail_height(this.__wbg_ptr, t) >>> 0;
  }
  thumbnail_width(t) {
    return e.imagehorsetool_thumbnail_width(this.__wbg_ptr, t) >>> 0;
  }
  undo() {
    return e.imagehorsetool_undo(this.__wbg_ptr) !== 0;
  }
  undo_count() {
    return e.imagehorsetool_undo_count(this.__wbg_ptr) >>> 0;
  }
  undo_snapshot_count() {
    return e.imagehorsetool_undo_count(this.__wbg_ptr) >>> 0;
  }
  width() {
    return e.imagehorsetool_width(this.__wbg_ptr) >>> 0;
  }
}
Symbol.dispose && (x.prototype[Symbol.dispose] = x.prototype.free);
function k() {
  return { __proto__: null, "./stamp_tool_bg.js": { __proto__: null, __wbg___wbindgen_throw_be289d5034ed271b: function(t, _) {
    throw new Error(f(t, _));
  }, __wbindgen_init_externref_table: function() {
    const t = e.__wbindgen_externrefs, _ = t.grow(4);
    t.set(0, void 0), t.set(_ + 0, void 0), t.set(_ + 1, null), t.set(_ + 2, true), t.set(_ + 3, false);
  } } };
}
const A = typeof FinalizationRegistry > "u" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((n) => e.__wbg_imagehorsetool_free(n >>> 0, 1));
function R(n, t) {
  return n = n >>> 0, T().subarray(n / 4, n / 4 + t);
}
function h(n, t) {
  return n = n >>> 0, w().subarray(n / 1, n / 1 + t);
}
function f(n, t) {
  return n = n >>> 0, U(n, t);
}
let d = null;
function T() {
  return (d === null || d.byteLength === 0) && (d = new Uint32Array(e.memory.buffer)), d;
}
let u = null;
function w() {
  return (u === null || u.byteLength === 0) && (u = new Uint8Array(e.memory.buffer)), u;
}
function b(n, t) {
  const _ = t(n.length * 1, 1) >>> 0;
  return w().set(n, _ / 1), l = n.length, _;
}
function p(n, t, _) {
  if (_ === void 0) {
    const a = m.encode(n), g = t(a.length, 1) >>> 0;
    return w().subarray(g, g + a.length).set(a), l = a.length, g;
  }
  let r = n.length, o = t(r, 1) >>> 0;
  const i = w();
  let s = 0;
  for (; s < r; s++) {
    const a = n.charCodeAt(s);
    if (a > 127) break;
    i[o + s] = a;
  }
  if (s !== r) {
    s !== 0 && (n = n.slice(s)), o = _(o, r, r = s + n.length * 3, 1) >>> 0;
    const a = w().subarray(o + s, o + r), g = m.encodeInto(n, a);
    s += g.written, o = _(o, r, s, 1) >>> 0;
  }
  return l = s, o;
}
let y = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
y.decode();
const W = 2146435072;
let v = 0;
function U(n, t) {
  return v += t, v >= W && (y = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true }), y.decode(), v = t), y.decode(w().subarray(n, n + t));
}
const m = new TextEncoder();
"encodeInto" in m || (m.encodeInto = function(n, t) {
  const _ = m.encode(n);
  return t.set(_), { read: n.length, written: _.length };
});
let l = 0, e;
function M(n, t) {
  return e = n.exports, d = null, u = null, e.__wbindgen_start(), e;
}
async function S(n, t) {
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
async function E(n) {
  if (e !== void 0) return e;
  n !== void 0 && (Object.getPrototypeOf(n) === Object.prototype ? { module_or_path: n } = n : console.warn("using deprecated parameters for the initialization function; pass a single object instead")), n === void 0 && (n = new URL("/assets/stamp_tool_bg-BelegALk.wasm", import.meta.url));
  const t = k();
  (typeof n == "string" || typeof Request == "function" && n instanceof Request || typeof URL == "function" && n instanceof URL) && (n = fetch(n));
  const { instance: _, module: r } = await S(await n, t);
  return M(_);
}
export {
  x as ImageHorseTool,
  E as default
};
