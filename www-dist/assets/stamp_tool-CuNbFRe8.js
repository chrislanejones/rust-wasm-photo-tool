class E {
  __destroy_into_raw() {
    const t = this.__wbg_ptr;
    return this.__wbg_ptr = 0, y.unregister(this), t;
  }
  free() {
    const t = this.__destroy_into_raw();
    r.__wbg_clonestamptool_free(t, 0);
  }
  adjust_brightness(t) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), r.clonestamptool_adjust_brightness(this.__wbg_ptr, t);
  }
  adjust_contrast(t) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), r.clonestamptool_adjust_contrast(this.__wbg_ptr, t);
  }
  adjust_zoom(t) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), r.clonestamptool_adjust_zoom(this.__wbg_ptr, t);
  }
  apply_crop_from_preview(t, _, o, n) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), e(t), e(_), e(o), e(n), r.clonestamptool_apply_crop_from_preview(this.__wbg_ptr, t, _, o, n);
  }
  begin_blur_stroke() {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), r.clonestamptool_begin_blur_stroke(this.__wbg_ptr);
  }
  begin_draw_stroke(t) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr);
    const _ = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), o = l;
    r.clonestamptool_begin_draw_stroke(this.__wbg_ptr, _, o);
  }
  begin_stroke(t, _) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), r.clonestamptool_begin_stroke(this.__wbg_ptr, t, _);
  }
  blur_region(t, _, o, n) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), e(n), r.clonestamptool_blur_region(this.__wbg_ptr, t, _, o, n);
  }
  cancel_crop_preview() {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    return e(this.__wbg_ptr), r.clonestamptool_cancel_crop_preview(this.__wbg_ptr) !== 0;
  }
  clear_history() {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), r.clonestamptool_clear_history(this.__wbg_ptr);
  }
  commit_red_stamp(t, _, o, n, a, i, p) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr);
    const w = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), h = l;
    e(_), e(o), e(n), e(a), e(i), e(p), r.clonestamptool_commit_red_stamp(this.__wbg_ptr, w, h, _, o, n, a, i, p);
  }
  commit_text(t, _, o, n, a, i, p, w) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr);
    const h = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), R = l;
    e(o), e(n), e(a), z(i), e(p), e(w), r.clonestamptool_commit_text(this.__wbg_ptr, h, R, _, o, n, a, i, p, w);
  }
  continue_stroke(t, _) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), r.clonestamptool_continue_stroke(this.__wbg_ptr, t, _);
  }
  copy_region(t, _, o, n) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), e(t), e(_), e(o), e(n);
    const a = r.clonestamptool_copy_region(this.__wbg_ptr, t, _, o, n);
    var i = c(a[0], a[1]).slice();
    return r.__wbindgen_free(a[0], a[1] * 1, 1), i;
  }
  crop(t, _, o, n) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), e(t), e(_), e(o), e(n), r.clonestamptool_crop(this.__wbg_ptr, t, _, o, n);
  }
  data_len() {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    return e(this.__wbg_ptr), r.clonestamptool_data_len(this.__wbg_ptr) >>> 0;
  }
  data_ptr() {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    return e(this.__wbg_ptr), r.clonestamptool_data_ptr(this.__wbg_ptr) >>> 0;
  }
  delete_history_entry(t) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    return e(this.__wbg_ptr), e(t), r.clonestamptool_delete_history_entry(this.__wbg_ptr, t) !== 0;
  }
  draw_arrow(t, _, o, n, a, i, p) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr);
    const w = b(a, r.__wbindgen_malloc, r.__wbindgen_realloc), h = l;
    e(p), r.clonestamptool_draw_arrow(this.__wbg_ptr, t, _, o, n, w, h, i, p);
  }
  draw_shape(t, _, o, n, a, i, p) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), e(a);
    const w = b(i, r.__wbindgen_malloc, r.__wbindgen_realloc), h = l;
    r.clonestamptool_draw_shape(this.__wbg_ptr, t, _, o, n, a, w, h, p);
  }
  end_stroke() {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), r.clonestamptool_end_stroke(this.__wbg_ptr);
  }
  export_png() {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr);
    const t = r.clonestamptool_export_png(this.__wbg_ptr);
    var _ = c(t[0], t[1]).slice();
    return r.__wbindgen_free(t[0], t[1] * 1, 1), _;
  }
  extract_region_png(t, _, o, n) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), e(t), e(_), e(o), e(n);
    const a = r.clonestamptool_extract_region_png(this.__wbg_ptr, t, _, o, n);
    var i = c(a[0], a[1]).slice();
    return r.__wbindgen_free(a[0], a[1] * 1, 1), i;
  }
  flip_horizontal() {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), r.clonestamptool_flip_horizontal(this.__wbg_ptr);
  }
  flip_vertical() {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), r.clonestamptool_flip_vertical(this.__wbg_ptr);
  }
  get_brush_size() {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    return e(this.__wbg_ptr), r.clonestamptool_get_brush_size(this.__wbg_ptr) >>> 0;
  }
  get_image_data() {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr);
    const t = r.clonestamptool_get_image_data(this.__wbg_ptr);
    var _ = c(t[0], t[1]).slice();
    return r.__wbindgen_free(t[0], t[1] * 1, 1), _;
  }
  get_zoom() {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    return e(this.__wbg_ptr), r.clonestamptool_get_zoom(this.__wbg_ptr);
  }
  has_source() {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    return e(this.__wbg_ptr), r.clonestamptool_has_source(this.__wbg_ptr) !== 0;
  }
  has_transparency() {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    return e(this.__wbg_ptr), r.clonestamptool_has_transparency(this.__wbg_ptr) !== 0;
  }
  height() {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    return e(this.__wbg_ptr), r.clonestamptool_height(this.__wbg_ptr) >>> 0;
  }
  history_labels() {
    let t, _;
    try {
      if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
      e(this.__wbg_ptr);
      const o = r.clonestamptool_history_labels(this.__wbg_ptr);
      return t = o[0], _ = o[1], k(o[0], o[1]);
    } finally {
      r.__wbindgen_free(t, _, 1);
    }
  }
  jump_to_history(t) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    return e(this.__wbg_ptr), e(t), r.clonestamptool_jump_to_history(this.__wbg_ptr, t) !== 0;
  }
  load_image(t) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr);
    const _ = d(t, r.__wbindgen_malloc), o = l;
    r.clonestamptool_load_image(this.__wbg_ptr, _, o);
  }
  measure_text(t, _, o) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr);
    const n = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), a = l;
    z(o);
    const i = r.clonestamptool_measure_text(this.__wbg_ptr, n, a, _, o);
    var p = W(i[0], i[1]).slice();
    return r.__wbindgen_free(i[0], i[1] * 4, 4), p;
  }
  constructor(t, _) {
    e(t), e(_);
    const o = r.clonestamptool_new(t, _);
    return this.__wbg_ptr = o >>> 0, y.register(this, this.__wbg_ptr, this), this;
  }
  paint_begin() {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), r.clonestamptool_paint_begin(this.__wbg_ptr);
  }
  paint_dab(t, _, o, n, a, i, p) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), e(n), e(a), e(i), r.clonestamptool_paint_dab(this.__wbg_ptr, t, _, o, n, a, i, p);
  }
  paint_stroke_to(t, _, o, n, a, i, p, w, h) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), e(i), e(p), e(w), r.clonestamptool_paint_stroke_to(this.__wbg_ptr, t, _, o, n, a, i, p, w, h);
  }
  paste_region(t, _, o, n, a) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr);
    const i = d(t, r.__wbindgen_malloc), p = l;
    e(_), e(o), e(n), e(a), r.clonestamptool_paste_region(this.__wbg_ptr, i, p, _, o, n, a);
  }
  preview_crop(t, _, o, n) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), e(t), e(_), e(o), e(n), r.clonestamptool_preview_crop(this.__wbg_ptr, t, _, o, n);
  }
  redo() {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    return e(this.__wbg_ptr), r.clonestamptool_redo(this.__wbg_ptr) !== 0;
  }
  redo_count() {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    return e(this.__wbg_ptr), r.clonestamptool_redo_count(this.__wbg_ptr) >>> 0;
  }
  resize(t, _) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), e(t), e(_), r.clonestamptool_resize(this.__wbg_ptr, t, _);
  }
  rotate_90_ccw() {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), r.clonestamptool_rotate_90_ccw(this.__wbg_ptr);
  }
  rotate_90_cw() {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), r.clonestamptool_rotate_90_cw(this.__wbg_ptr);
  }
  set_brush_size(t) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), e(t), r.clonestamptool_set_brush_size(this.__wbg_ptr, t);
  }
  set_hardness(t) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), r.clonestamptool_set_hardness(this.__wbg_ptr, t);
  }
  set_opacity(t) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), r.clonestamptool_set_opacity(this.__wbg_ptr, t);
  }
  set_source(t, _) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), e(t), e(_), r.clonestamptool_set_source(this.__wbg_ptr, t, _);
  }
  set_spacing(t) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), r.clonestamptool_set_spacing(this.__wbg_ptr, t);
  }
  set_zoom(t) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), r.clonestamptool_set_zoom(this.__wbg_ptr, t);
  }
  stamp_pixels(t, _, o, n, a) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr);
    const i = d(t, r.__wbindgen_malloc), p = l;
    e(_), e(o), e(n), e(a), r.clonestamptool_stamp_pixels(this.__wbg_ptr, i, p, _, o, n, a);
  }
  stamp_red(t, _, o, n, a, i) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr);
    const p = d(t, r.__wbindgen_malloc), w = l;
    e(_), e(o), e(n), e(a), e(i), r.clonestamptool_stamp_red(this.__wbg_ptr, p, w, _, o, n, a, i);
  }
  thumbnail_data(t) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    e(this.__wbg_ptr), e(t);
    const _ = r.clonestamptool_thumbnail_data(this.__wbg_ptr, t);
    var o = c(_[0], _[1]).slice();
    return r.__wbindgen_free(_[0], _[1] * 1, 1), o;
  }
  thumbnail_height(t) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    return e(this.__wbg_ptr), e(t), r.clonestamptool_thumbnail_height(this.__wbg_ptr, t) >>> 0;
  }
  thumbnail_width(t) {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    return e(this.__wbg_ptr), e(t), r.clonestamptool_thumbnail_width(this.__wbg_ptr, t) >>> 0;
  }
  undo() {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    return e(this.__wbg_ptr), r.clonestamptool_undo(this.__wbg_ptr) !== 0;
  }
  undo_count() {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    return e(this.__wbg_ptr), r.clonestamptool_undo_count(this.__wbg_ptr) >>> 0;
  }
  width() {
    if (this.__wbg_ptr == 0) throw new Error("Attempt to use a moved value");
    return e(this.__wbg_ptr), r.clonestamptool_width(this.__wbg_ptr) >>> 0;
  }
}
Symbol.dispose && (E.prototype[Symbol.dispose] = E.prototype.free);
function T() {
  return { __proto__: null, "./stamp_tool_bg.js": { __proto__: null, __wbg___wbindgen_throw_be289d5034ed271b: function(t, _) {
    throw new Error(k(t, _));
  }, __wbindgen_init_externref_table: function() {
    const t = r.__wbindgen_externrefs, _ = t.grow(4);
    t.set(0, void 0), t.set(_ + 0, void 0), t.set(_ + 1, null), t.set(_ + 2, true), t.set(_ + 3, false);
  } } };
}
const y = typeof FinalizationRegistry > "u" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((s) => r.__wbg_clonestamptool_free(s >>> 0, 1));
function z(s) {
  if (typeof s != "boolean") throw new Error(`expected a boolean argument, found ${typeof s}`);
}
function e(s) {
  if (typeof s != "number") throw new Error(`expected a number argument, found ${typeof s}`);
}
function W(s, t) {
  return s = s >>> 0, j().subarray(s / 4, s / 4 + t);
}
function c(s, t) {
  return s = s >>> 0, g().subarray(s / 1, s / 1 + t);
}
function k(s, t) {
  return s = s >>> 0, U(s, t);
}
let u = null;
function j() {
  return (u === null || u.byteLength === 0) && (u = new Uint32Array(r.memory.buffer)), u;
}
let m = null;
function g() {
  return (m === null || m.byteLength === 0) && (m = new Uint8Array(r.memory.buffer)), m;
}
function d(s, t) {
  const _ = t(s.length * 1, 1) >>> 0;
  return g().set(s, _ / 1), l = s.length, _;
}
function b(s, t, _) {
  if (typeof s != "string") throw new Error(`expected a string argument, found ${typeof s}`);
  if (_ === void 0) {
    const p = f.encode(s), w = t(p.length, 1) >>> 0;
    return g().subarray(w, w + p.length).set(p), l = p.length, w;
  }
  let o = s.length, n = t(o, 1) >>> 0;
  const a = g();
  let i = 0;
  for (; i < o; i++) {
    const p = s.charCodeAt(i);
    if (p > 127) break;
    a[n + i] = p;
  }
  if (i !== o) {
    i !== 0 && (s = s.slice(i)), n = _(n, o, o = i + s.length * 3, 1) >>> 0;
    const p = g().subarray(n + i, n + o), w = f.encodeInto(s, p);
    if (w.read !== s.length) throw new Error("failed to pass whole string");
    i += w.written, n = _(n, o, i, 1) >>> 0;
  }
  return l = i, n;
}
let v = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
v.decode();
const S = 2146435072;
let A = 0;
function U(s, t) {
  return A += t, A >= S && (v = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true }), v.decode(), A = t), v.decode(g().subarray(s, s + t));
}
const f = new TextEncoder();
"encodeInto" in f || (f.encodeInto = function(s, t) {
  const _ = f.encode(s);
  return t.set(_), { read: s.length, written: _.length };
});
let l = 0, r;
function M(s, t) {
  return r = s.exports, u = null, m = null, r.__wbindgen_start(), r;
}
async function F(s, t) {
  if (typeof Response == "function" && s instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming == "function") try {
      return await WebAssembly.instantiateStreaming(s, t);
    } catch (n) {
      if (s.ok && _(s.type) && s.headers.get("Content-Type") !== "application/wasm") console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", n);
      else throw n;
    }
    const o = await s.arrayBuffer();
    return await WebAssembly.instantiate(o, t);
  } else {
    const o = await WebAssembly.instantiate(s, t);
    return o instanceof WebAssembly.Instance ? { instance: o, module: s } : o;
  }
  function _(o) {
    switch (o) {
      case "basic":
      case "cors":
      case "default":
        return true;
    }
    return false;
  }
}
async function O(s) {
  if (r !== void 0) return r;
  s !== void 0 && (Object.getPrototypeOf(s) === Object.prototype ? { module_or_path: s } = s : console.warn("using deprecated parameters for the initialization function; pass a single object instead")), s === void 0 && (s = new URL("/assets/stamp_tool_bg-vQuiphiG.wasm", import.meta.url));
  const t = T();
  (typeof s == "string" || typeof Request == "function" && s instanceof Request || typeof URL == "function" && s instanceof URL) && (s = fetch(s));
  const { instance: _, module: o } = await F(await s, t);
  return M(_);
}
export {
  E as CloneStampTool,
  r as __wasm,
  O as default
};
