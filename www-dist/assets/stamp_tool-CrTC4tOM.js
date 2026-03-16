class u {
  __destroy_into_raw() {
    const t = this.__wbg_ptr;
    return this.__wbg_ptr = 0, w.unregister(this), t;
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
  begin_stroke(t, o) {
    e.clonestamptool_begin_stroke(this.__wbg_ptr, t, o);
  }
  clear_history() {
    e.clonestamptool_clear_history(this.__wbg_ptr);
  }
  continue_stroke(t, o) {
    e.clonestamptool_continue_stroke(this.__wbg_ptr, t, o);
  }
  copy_region(t, o, _, r) {
    const s = e.clonestamptool_copy_region(this.__wbg_ptr, t, o, _, r);
    var l = a(s[0], s[1]).slice();
    return e.__wbindgen_free(s[0], s[1] * 1, 1), l;
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
  end_stroke() {
    e.clonestamptool_end_stroke(this.__wbg_ptr);
  }
  export_png() {
    const t = e.clonestamptool_export_png(this.__wbg_ptr);
    var o = a(t[0], t[1]).slice();
    return e.__wbindgen_free(t[0], t[1] * 1, 1), o;
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
    var o = a(t[0], t[1]).slice();
    return e.__wbindgen_free(t[0], t[1] * 1, 1), o;
  }
  get_zoom() {
    return e.clonestamptool_get_zoom(this.__wbg_ptr);
  }
  has_source() {
    return e.clonestamptool_has_source(this.__wbg_ptr) !== 0;
  }
  height() {
    return e.clonestamptool_height(this.__wbg_ptr) >>> 0;
  }
  history_labels() {
    let t, o;
    try {
      const _ = e.clonestamptool_history_labels(this.__wbg_ptr);
      return t = _[0], o = _[1], f(_[0], _[1]);
    } finally {
      e.__wbindgen_free(t, o, 1);
    }
  }
  jump_to_history(t) {
    return e.clonestamptool_jump_to_history(this.__wbg_ptr, t) !== 0;
  }
  load_image(t) {
    const o = h(t, e.__wbindgen_malloc), _ = g;
    e.clonestamptool_load_image(this.__wbg_ptr, o, _);
  }
  constructor(t, o) {
    const _ = e.clonestamptool_new(t, o);
    return this.__wbg_ptr = _ >>> 0, w.register(this, this.__wbg_ptr, this), this;
  }
  paste_region(t, o, _, r, s) {
    const l = h(t, e.__wbindgen_malloc), m = g;
    e.clonestamptool_paste_region(this.__wbg_ptr, l, m, o, _, r, s);
  }
  redo() {
    return e.clonestamptool_redo(this.__wbg_ptr) !== 0;
  }
  redo_count() {
    return e.clonestamptool_redo_count(this.__wbg_ptr) >>> 0;
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
  set_source(t, o) {
    e.clonestamptool_set_source(this.__wbg_ptr, t, o);
  }
  set_spacing(t) {
    e.clonestamptool_set_spacing(this.__wbg_ptr, t);
  }
  set_zoom(t) {
    e.clonestamptool_set_zoom(this.__wbg_ptr, t);
  }
  thumbnail_data(t) {
    const o = e.clonestamptool_thumbnail_data(this.__wbg_ptr, t);
    var _ = a(o[0], o[1]).slice();
    return e.__wbindgen_free(o[0], o[1] * 1, 1), _;
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
  width() {
    return e.clonestamptool_width(this.__wbg_ptr) >>> 0;
  }
}
Symbol.dispose && (u.prototype[Symbol.dispose] = u.prototype.free);
function d() {
  return { __proto__: null, "./stamp_tool_bg.js": { __proto__: null, __wbg___wbindgen_throw_be289d5034ed271b: function(t, o) {
    throw new Error(f(t, o));
  }, __wbindgen_init_externref_table: function() {
    const t = e.__wbindgen_externrefs, o = t.grow(4);
    t.set(0, void 0), t.set(o + 0, void 0), t.set(o + 1, null), t.set(o + 2, true), t.set(o + 3, false);
  } } };
}
const w = typeof FinalizationRegistry > "u" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((n) => e.__wbg_clonestamptool_free(n >>> 0, 1));
function a(n, t) {
  return n = n >>> 0, b().subarray(n / 1, n / 1 + t);
}
function f(n, t) {
  return n = n >>> 0, z(n, t);
}
let i = null;
function b() {
  return (i === null || i.byteLength === 0) && (i = new Uint8Array(e.memory.buffer)), i;
}
function h(n, t) {
  const o = t(n.length * 1, 1) >>> 0;
  return b().set(n, o / 1), g = n.length, o;
}
let c = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
c.decode();
const y = 2146435072;
let p = 0;
function z(n, t) {
  return p += t, p >= y && (c = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true }), c.decode(), p = t), c.decode(b().subarray(n, n + t));
}
let g = 0, e;
function A(n, t) {
  return e = n.exports, i = null, e.__wbindgen_start(), e;
}
async function R(n, t) {
  if (typeof Response == "function" && n instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming == "function") try {
      return await WebAssembly.instantiateStreaming(n, t);
    } catch (r) {
      if (n.ok && o(n.type) && n.headers.get("Content-Type") !== "application/wasm") console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", r);
      else throw r;
    }
    const _ = await n.arrayBuffer();
    return await WebAssembly.instantiate(_, t);
  } else {
    const _ = await WebAssembly.instantiate(n, t);
    return _ instanceof WebAssembly.Instance ? { instance: _, module: n } : _;
  }
  function o(_) {
    switch (_) {
      case "basic":
      case "cors":
      case "default":
        return true;
    }
    return false;
  }
}
async function v(n) {
  if (e !== void 0) return e;
  n !== void 0 && (Object.getPrototypeOf(n) === Object.prototype ? { module_or_path: n } = n : console.warn("using deprecated parameters for the initialization function; pass a single object instead")), n === void 0 && (n = new URL("/assets/stamp_tool_bg-C1YCOARK.wasm", import.meta.url));
  const t = d();
  (typeof n == "string" || typeof Request == "function" && n instanceof Request || typeof URL == "function" && n instanceof URL) && (n = fetch(n));
  const { instance: o, module: _ } = await R(await n, t);
  return A(o);
}
export {
  u as CloneStampTool,
  v as default
};
