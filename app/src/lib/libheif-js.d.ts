// ===== FILE: app/src/lib/libheif-js.d.ts =====
//
// Hand-written types for the ONE libheif-js entry point this app uses.
//
// The package ships a .d.ts, but it describes the raw Emscripten surface
// (`_heif_context_read_from_memory` and ~900 friends taking heap pointers),
// not the small hand-written JS wrapper that sits on top of it — and it
// declares no types at all for the bundle entry points. This declares just the
// wrapper, which is all lib/heicCodec.ts touches.
//
// WHY THIS ENTRY POINT. `libheif-js` has three builds:
//   - the default pure-JS one (~3 MB, no WASM, slow),
//   - `libheif-js/wasm` (CommonJS, loads the .wasm from disk via `fs`),
//   - `libheif-wasm/libheif-bundle.mjs` — a real ES module with the .wasm
//     inlined, which is the only one that both bundles cleanly under Vite and
//     needs no second network request at decode time.
declare module "libheif-js/libheif-wasm/libheif-bundle.mjs" {
  /** An RGBA destination, shaped like a canvas `ImageData`. The buffer is
   *  always one we allocated, hence the explicit `ArrayBuffer` argument — it
   *  is what lets the decoded pixels reach `new ImageData(...)` uncast. */
  export interface HeifImageData {
    data: Uint8ClampedArray<ArrayBuffer>;
    width: number;
    height: number;
  }

  export interface HeifImage {
    get_width(): number;
    get_height(): number;
    /** True for the container's primary item (a HEIC may hold several). */
    is_primary(): boolean;
    has_alpha_channel(): boolean;
    is_premultiplied_alpha(): boolean;
    /**
     * Decode into `target` and hand the filled buffer to `done`, or `null` when
     * libheif failed. Callback-style, not a promise, and the decode does NOT
     * start until this is called (construction only reads the container).
     */
    display(target: HeifImageData, done: (filled: HeifImageData | null) => void): void;
    /** Release the underlying WASM heap allocation. */
    free(): void;
  }

  export interface HeifDecoder {
    /** Parse a container and return its top-level images (never partially). */
    decode(data: Uint8Array): HeifImage[];
  }

  export interface LibHeif {
    HeifDecoder: new () => HeifDecoder;
  }

  /** The module's default export is a FACTORY — call it to get the module. */
  const createLibHeif: () => LibHeif;
  export default createLibHeif;
}
