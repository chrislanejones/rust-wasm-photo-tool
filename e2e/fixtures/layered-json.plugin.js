// A TEST plugin — the smallest real format plugin there is, so the plugin
// machinery (Settings → Plugins → Add, the Download dialog tile, Import /
// Export, the engine bridge) can be proved without shipping any real codec in
// this repo. Real plugins live in their own repositories; see docs/Plugins.md.
//
// The format is "IHL": the layer stack as JSON, pixels base64. Not for real
// work — a 12 MP layer is 64 MB of text — but every byte round-trips.
//
// This file is also what the unit tests load (lib/plugins/*.test.ts), so it
// stays plain ES2020 with no imports: it runs as a blob: module in the browser
// and as a data: module under node.

const toBase64 = (bytes) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
};

const fromBase64 = (text) => {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
};

export default {
  apiVersion: 1,
  id: "layered-json",
  name: "Layered JSON (test plugin)",
  version: "0.1.0",
  blurb:
    "A tiny test format: the layer stack as JSON with base64 pixels. It exists to prove the plugin machinery and is not for real work.",
  homepage: "https://github.com/chrislanejones/rust-wasm-photo-tool",
  formats: [
    {
      id: "ihl",
      label: "IHL",
      hint: "Layered · JSON (test)",
      extension: ".ihl",
      accept: ".ihl,application/json",
      mime: "application/json",
      describe: "Image Horse's own test format: every layer, as JSON.",
      read(bytes) {
        let parsed;
        try {
          parsed = JSON.parse(new TextDecoder().decode(bytes));
        } catch {
          throw new Error("Not an .ihl file — it isn't JSON.");
        }
        if (parsed?.format !== "ihl" || !Array.isArray(parsed.layers)) {
          throw new Error("Not an .ihl file — missing the layer list.");
        }
        const { width, height } = parsed;
        const layers = parsed.layers.map((l) => ({
          name: String(l.name ?? "Layer"),
          visible: l.visible !== false,
          opacity: typeof l.opacity === "number" ? l.opacity : 1,
          rgba: fromBase64(l.rgba),
        }));
        for (const l of layers) {
          if (l.rgba.length !== width * height * 4) {
            throw new Error(`Layer "${l.name}" is not ${width}×${height}.`);
          }
        }
        return { width, height, layers, activeIndex: null, composite: null, notes: [] };
      },
      write(doc) {
        const json = JSON.stringify({
          format: "ihl",
          width: doc.width,
          height: doc.height,
          layers: doc.layers.map((l) => ({
            name: l.name,
            visible: l.visible,
            opacity: l.opacity,
            rgba: toBase64(l.rgba),
          })),
        });
        return new TextEncoder().encode(json);
      },
    },
  ],
};
