class x {
  __destroy_into_raw() {
    const t = this.__wbg_ptr;
    return this.__wbg_ptr = 0, A.unregister(this), t;
  }
  free() {
    const t = this.__destroy_into_raw();
    e.__wbg_clonestamptool_free(t, 0);
  }
  adjust_brightness(t) {
    e.clonestamptool_adjust_brightness(this.__wbg_ptr, t);
  }
  adjust_contrast(t) {
    e.clonestamptool_adjust_contrast(this.__wbg_ptr, t);
  }
  adjust_zoom(t) {
    e.clonestamptool_adjust_zoom(this.__wbg_ptr, t);
  }
  apply_crop_from_preview(t, _, n, r) {
    e.clonestamptool_apply_crop_from_preview(this.__wbg_ptr, t, _, n, r);
  }
  begin_blur_stroke() {
    e.clonestamptool_begin_blur_stroke(this.__wbg_ptr);
  }
  begin_draw_stroke(t) {
    const _ = g(t, e.__wbindgen_malloc, e.__wbindgen_realloc), n = c;
    e.clonestamptool_begin_draw_stroke(this.__wbg_ptr, _, n);
  }
  begin_stroke(t, _) {
    e.clonestamptool_begin_stroke(this.__wbg_ptr, t, _);
  }
  blur_region(t, _, n, r) {
    e.clonestamptool_blur_region(this.__wbg_ptr, t, _, n, r);
  }
  cancel_crop_preview() {
    return e.clonestamptool_cancel_crop_preview(this.__wbg_ptr) !== 0;
  }
  clear_history() {
    e.clonestamptool_clear_history(this.__wbg_ptr);
  }
  commit_red_stamp(t, _, n, r, i, s, a) {
    const l = g(t, e.__wbindgen_malloc, e.__wbindgen_realloc), p = c;
    e.clonestamptool_commit_red_stamp(this.__wbg_ptr, l, p, _, n, r, i, s, a);
  }
  commit_text(t, _, n, r, i, s, a, l) {
    const p = g(t, e.__wbindgen_malloc, e.__wbindgen_realloc), z = c;
    e.clonestamptool_commit_text(this.__wbg_ptr, p, z, _, n, r, i, s, a, l);
  }
  continue_stroke(t, _) {
    e.clonestamptool_continue_stroke(this.__wbg_ptr, t, _);
  }
  copy_region(t, _, n, r) {
    const i = e.clonestamptool_copy_region(this.__wbg_ptr, t, _, n, r);
    var s = b(i[0], i[1]).slice();
    return e.__wbindgen_free(i[0], i[1] * 1, 1), s;
  }
  crop(t, _, n, r) {
    e.clonestamptool_crop(this.__wbg_ptr, t, _, n, r);
  }
  data_len() {
    return e.clonestamptool_data_len(this.__wbg_ptr) >>> 0;
  }
  data_ptr() {
    return e.clonestamptool_data_ptr(this.__wbg_ptr) >>> 0;
  }
  delete_history_entry(t) {
    return e.clonestamptool_delete_history_entry(this.__wbg_ptr, t) !== 0;
  }
  draw_arrow(t, _, n, r, i, s, a) {
    const l = g(i, e.__wbindgen_malloc, e.__wbindgen_realloc), p = c;
    e.clonestamptool_draw_arrow(this.__wbg_ptr, t, _, n, r, l, p, s, a);
  }
  draw_shape(t, _, n, r, i, s, a) {
    const l = g(s, e.__wbindgen_malloc, e.__wbindgen_realloc), p = c;
    e.clonestamptool_draw_shape(this.__wbg_ptr, t, _, n, r, i, l, p, a);
  }
  end_stroke() {
    e.clonestamptool_end_stroke(this.__wbg_ptr);
  }
  export_png() {
    const t = e.clonestamptool_export_png(this.__wbg_ptr);
    var _ = b(t[0], t[1]).slice();
    return e.__wbindgen_free(t[0], t[1] * 1, 1), _;
  }
  extract_region_png(t, _, n, r) {
    const i = e.clonestamptool_extract_region_png(this.__wbg_ptr, t, _, n, r);
    var s = b(i[0], i[1]).slice();
    return e.__wbindgen_free(i[0], i[1] * 1, 1), s;
  }
  flip_horizontal() {
    e.clonestamptool_flip_horizontal(this.__wbg_ptr);
  }
  flip_vertical() {
    e.clonestamptool_flip_vertical(this.__wbg_ptr);
  }
  get_brush_size() {
    return e.clonestamptool_get_brush_size(this.__wbg_ptr) >>> 0;
  }
  get_image_data() {
    const t = e.clonestamptool_get_image_data(this.__wbg_ptr);
    var _ = b(t[0], t[1]).slice();
    return e.__wbindgen_free(t[0], t[1] * 1, 1), _;
  }
  get_redo_snapshot_label(t) {
    let _, n;
    try {
      const r = e.clonestamptool_get_redo_snapshot_label(this.__wbg_ptr, t);
      return _ = r[0], n = r[1], f(r[0], r[1]);
    } finally {
      e.__wbindgen_free(_, n, 1);
    }
  }
  get_redo_snapshot_png(t) {
    const _ = e.clonestamptool_get_redo_snapshot_png(this.__wbg_ptr, t);
    var n = b(_[0], _[1]).slice();
    return e.__wbindgen_free(_[0], _[1] * 1, 1), n;
  }
  get_undo_snapshot_label(t) {
    let _, n;
    try {
      const r = e.clonestamptool_get_undo_snapshot_label(this.__wbg_ptr, t);
      return _ = r[0], n = r[1], f(r[0], r[1]);
    } finally {
      e.__wbindgen_free(_, n, 1);
    }
  }
  get_undo_snapshot_png(t) {
    const _ = e.clonestamptool_get_undo_snapshot_png(this.__wbg_ptr, t);
    var n = b(_[0], _[1]).slice();
    return e.__wbindgen_free(_[0], _[1] * 1, 1), n;
  }
  get_zoom() {
    return e.clonestamptool_get_zoom(this.__wbg_ptr);
  }
  has_source() {
    return e.clonestamptool_has_source(this.__wbg_ptr) !== 0;
  }
  has_transparency() {
    return e.clonestamptool_has_transparency(this.__wbg_ptr) !== 0;
  }
  height() {
    return e.clonestamptool_height(this.__wbg_ptr) >>> 0;
  }
  history_labels() {
    let t, _;
    try {
      const n = e.clonestamptool_history_labels(this.__wbg_ptr);
      return t = n[0], _ = n[1], f(n[0], n[1]);
    } finally {
      e.__wbindgen_free(t, _, 1);
    }
  }
  inject_redo_snapshot(t, _, n, r) {
    const i = w(t, e.__wbindgen_malloc), s = c, a = g(r, e.__wbindgen_malloc, e.__wbindgen_realloc), l = c;
    e.clonestamptool_inject_redo_snapshot(this.__wbg_ptr, i, s, _, n, a, l);
  }
  inject_undo_snapshot(t, _, n, r) {
    const i = w(t, e.__wbindgen_malloc), s = c, a = g(r, e.__wbindgen_malloc, e.__wbindgen_realloc), l = c;
    e.clonestamptool_inject_undo_snapshot(this.__wbg_ptr, i, s, _, n, a, l);
  }
  jump_to_history(t) {
    return e.clonestamptool_jump_to_history(this.__wbg_ptr, t) !== 0;
  }
  load_image(t) {
    const _ = w(t, e.__wbindgen_malloc), n = c;
    e.clonestamptool_load_image(this.__wbg_ptr, _, n);
  }
  measure_text(t, _, n) {
    const r = g(t, e.__wbindgen_malloc, e.__wbindgen_realloc), i = c, s = e.clonestamptool_measure_text(this.__wbg_ptr, r, i, _, n);
    var a = k(s[0], s[1]).slice();
    return e.__wbindgen_free(s[0], s[1] * 4, 4), a;
  }
  constructor(t, _) {
    const n = e.clonestamptool_new(t, _);
    return this.__wbg_ptr = n >>> 0, A.register(this, this.__wbg_ptr, this), this;
  }
  paint_begin() {
    e.clonestamptool_paint_begin(this.__wbg_ptr);
  }
  paint_dab(t, _, n, r, i, s, a) {
    e.clonestamptool_paint_dab(this.__wbg_ptr, t, _, n, r, i, s, a);
  }
  paint_stroke_to(t, _, n, r, i, s, a, l, p) {
    e.clonestamptool_paint_stroke_to(this.__wbg_ptr, t, _, n, r, i, s, a, l, p);
  }
  paste_region(t, _, n, r, i) {
    const s = w(t, e.__wbindgen_malloc), a = c;
    e.clonestamptool_paste_region(this.__wbg_ptr, s, a, _, n, r, i);
  }
  preview_crop(t, _, n, r) {
    e.clonestamptool_preview_crop(this.__wbg_ptr, t, _, n, r);
  }
  redo() {
    return e.clonestamptool_redo(this.__wbg_ptr) !== 0;
  }
  redo_count() {
    return e.clonestamptool_redo_count(this.__wbg_ptr) >>> 0;
  }
  redo_snapshot_count() {
    return e.clonestamptool_redo_count(this.__wbg_ptr) >>> 0;
  }
  resize(t, _) {
    e.clonestamptool_resize(this.__wbg_ptr, t, _);
  }
  rotate_90_ccw() {
    e.clonestamptool_rotate_90_ccw(this.__wbg_ptr);
  }
  rotate_90_cw() {
    e.clonestamptool_rotate_90_cw(this.__wbg_ptr);
  }
  set_brush_size(t) {
    e.clonestamptool_set_brush_size(this.__wbg_ptr, t);
  }
  set_hardness(t) {
    e.clonestamptool_set_hardness(this.__wbg_ptr, t);
  }
  set_opacity(t) {
    e.clonestamptool_set_opacity(this.__wbg_ptr, t);
  }
  set_source(t, _) {
    e.clonestamptool_set_source(this.__wbg_ptr, t, _);
  }
  set_spacing(t) {
    e.clonestamptool_set_spacing(this.__wbg_ptr, t);
  }
  set_zoom(t) {
    e.clonestamptool_set_zoom(this.__wbg_ptr, t);
  }
  stamp_pixels(t, _, n, r, i) {
    const s = w(t, e.__wbindgen_malloc), a = c;
    e.clonestamptool_stamp_pixels(this.__wbg_ptr, s, a, _, n, r, i);
  }
  stamp_red(t, _, n, r, i, s) {
    const a = w(t, e.__wbindgen_malloc), l = c;
    e.clonestamptool_stamp_red(this.__wbg_ptr, a, l, _, n, r, i, s);
  }
  thumbnail_data(t) {
    const _ = e.clonestamptool_thumbnail_data(this.__wbg_ptr, t);
    var n = b(_[0], _[1]).slice();
    return e.__wbindgen_free(_[0], _[1] * 1, 1), n;
  }
  thumbnail_height(t) {
    return e.clonestamptool_thumbnail_height(this.__wbg_ptr, t) >>> 0;
  }
  thumbnail_width(t) {
    return e.clonestamptool_thumbnail_width(this.__wbg_ptr, t) >>> 0;
  }
  undo() {
    return e.clonestamptool_undo(this.__wbg_ptr) !== 0;
  }
  undo_count() {
    return e.clonestamptool_undo_count(this.__wbg_ptr) >>> 0;
  }
  undo_snapshot_count() {
    return e.clonestamptool_undo_count(this.__wbg_ptr) >>> 0;
  }
  width() {
    return e.clonestamptool_width(this.__wbg_ptr) >>> 0;
  }
}
Symbol.dispose && (x.prototype[Symbol.dispose] = x.prototype.free);
function j() {
  return { __proto__: null, "./stamp_tool_bg.js": { __proto__: null, __wbg___wbindgen_throw_be289d5034ed271b: function(t, _) {
    throw new Error(f(t, _));
  }, __wbindgen_init_externref_table: function() {
    const t = e.__wbindgen_externrefs, _ = t.grow(4);
    t.set(0, void 0), t.set(_ + 0, void 0), t.set(_ + 1, null), t.set(_ + 2, true), t.set(_ + 3, false);
  } } };
}
const A = typeof FinalizationRegistry > "u" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((o) => e.__wbg_clonestamptool_free(o >>> 0, 1));
function k(o, t) {
  return o = o >>> 0, R().subarray(o / 4, o / 4 + t);
}
function b(o, t) {
  return o = o >>> 0, d().subarray(o / 1, o / 1 + t);
}
function f(o, t) {
  return o = o >>> 0, W(o, t);
}
let u = null;
function R() {
  return (u === null || u.byteLength === 0) && (u = new Uint32Array(e.memory.buffer)), u;
}
let h = null;
function d() {
  return (h === null || h.byteLength === 0) && (h = new Uint8Array(e.memory.buffer)), h;
}
function w(o, t) {
  const _ = t(o.length * 1, 1) >>> 0;
  return d().set(o, _ / 1), c = o.length, _;
}
function g(o, t, _) {
  if (_ === void 0) {
    const a = m.encode(o), l = t(a.length, 1) >>> 0;
    return d().subarray(l, l + a.length).set(a), c = a.length, l;
  }
  let n = o.length, r = t(n, 1) >>> 0;
  const i = d();
  let s = 0;
  for (; s < n; s++) {
    const a = o.charCodeAt(s);
    if (a > 127) break;
    i[r + s] = a;
  }
  if (s !== n) {
    s !== 0 && (o = o.slice(s)), r = _(r, n, n = s + o.length * 3, 1) >>> 0;
    const a = d().subarray(r + s, r + n), l = m.encodeInto(o, a);
    s += l.written, r = _(r, n, s, 1) >>> 0;
  }
  return c = s, r;
}
let y = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
y.decode();
const T = 2146435072;
let v = 0;
function W(o, t) {
  return v += t, v >= T && (y = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true }), y.decode(), v = t), y.decode(d().subarray(o, o + t));
}
const m = new TextEncoder();
"encodeInto" in m || (m.encodeInto = function(o, t) {
  const _ = m.encode(o);
  return t.set(_), { read: o.length, written: _.length };
});
let c = 0, e;
function S(o, t) {
  return e = o.exports, u = null, h = null, e.__wbindgen_start(), e;
}
async function U(o, t) {
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
async function M(o) {
  if (e !== void 0) return e;
  o !== void 0 && (Object.getPrototypeOf(o) === Object.prototype ? { module_or_path: o } = o : console.warn("using deprecated parameters for the initialization function; pass a single object instead")), o === void 0 && (o = new URL("/assets/stamp_tool_bg-DAb6_u3O.wasm", import.meta.url));
  const t = j();
  (typeof o == "string" || typeof Request == "function" && o instanceof Request || typeof URL == "function" && o instanceof URL) && (o = fetch(o));
  const { instance: _, module: n } = await U(await o, t);
  return S(_);
}
export {
  x as CloneStampTool,
  M as default
};
