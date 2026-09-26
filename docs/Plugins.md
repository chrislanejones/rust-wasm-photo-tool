# Plugins

> Part of the [Image Horse](../README.md) docs. See also: [Architecture](Architecture.md) · [File Map](File-Map.md) · [OpenRaster (.ora)](OpenRaster-Export-Import.md) · [ADR-072](adr/072-plugins-ship-in-the-bundle-are-enabled-per-device-and-a-format-plugin-never-touches-the-engine.md).

A plugin is a feature that ships **inside** Image Horse but stays **off** until
a person turns it on in **Settings → Plugins**. The first one is **Photoshop
PSD**: export the project as a layered `.psd`, and open a `.psd` as a new photo
with its layers. More will follow; the catalogue is `app/src/lib/plugins/registry.ts`.

## Turning plugins on

1. Open **Settings → Plugins** (also in the command palette, or `#/settings/plugins`).
2. **Allow plugins → On.** This is the master switch. While it is off, no
   plugin is active whatever its own switch says, and nothing a plugin adds
   shows up anywhere in the app.
3. Turn on the plugins you want. Each row says what it adds and what it does not do.

Changes commit as pressed — there is no Apply, and no reload. The choice is kept
on **this device only**, in `localStorage`, and is never sent anywhere (the same
rule as [Beta](adr/064-a-feature-reaches-a-few-people-before-everyone-through-a-per-device-opt-in-ring.md)).
Turning the master off keeps each plugin's own choice, so turning it back on
restores the same set.

Everything is off on a fresh device, and off is the fallback: blocked storage,
an unknown id, a value that is not exactly `"1"` — all off.

## What a plugin can add

Today: a **file format** — import and export of a layered document. A format
plugin adds

- its file type to the **Download dialog**'s format picker (next to JPEG / PNG /
  WebP / AVIF / ORA), named in the file-name field's extension and the button's label;
- an **Import** and **Export** pair to **Settings → Import / Export**, under the
  built-in `.ora` pair.

Import always lands as a **new photo** — the open photo is never overwritten —
the same funnel `.ora` uses. Export flattens live text and shape annotations into
pixels first, as `.ora` does, and says so in the toast.

The shape leaves room for other kinds (a tool, a filter, a panel) without
pretending they exist: a plugin declares `formats`, and nothing else, until
something else is real.

## Why nothing is downloaded

A plugin is code reviewed into this repository and compiled into the bundle.
"Installing" one is a pull request; "enabling" one is a switch on the device.
This is deliberate:

- The editor's Content-Security-Policy forbids loading scripts from anywhere but
  itself. A plugin fetched by URL would need that wall taken down.
- Your pixels never leave the tab. Third-party code running against the engine's
  buffers is the one thing that promise cannot survive.
- A switched-off plugin still costs nothing: its code is reached only through a
  dynamic `import()` behind `load()`, so the main bundle carries the manifest
  (a name, a version, a sentence) and no more.

## The Photoshop PSD plugin

| | |
| --- | --- |
| Writes | PSD version 1, 8-bit RGB, PackBits ("RLE") throughout. Every layer as a full-canvas record with R, G, B and alpha; a four-channel merged image so viewers without layer support still show the picture; layer names both as the spec's Pascal string and as a `luni` Unicode block. Blend mode is always Normal. Canvas up to 30,000 px a side (the format's own ceiling). |
| Reads | Version 1, 8-bit or 16-bit (16 keeps the high byte), RGB or Grayscale, Raw or PackBits channels. Layer rectangles and offsets are resolved onto the canvas. Names from `luni` when present. A flat file with no layer section opens as one Background layer. |
| Survives a round trip | Layer names, order, visibility, opacity, pixels (exactly, for what this app wrote). |
| Dropped on import, and said so | Blend modes other than Normal (imported as Normal), groups (the layers inside are kept, the folder is not), layer masks, adjustment and fill layers (they come in as the blank layers they are). Each puts a sentence in the import toast. |
| Refused, with the reason | PSB (version 2), 32-bit depth, CMYK / Lab / Indexed / Duotone / Bitmap modes, ZIP-compressed channels, truncated files. |
| Active layer | PSD has no such notion; import lands on the top layer, like a foreign `.ora`. |

Layer masks are not written either: the engine holds them but exposes no read
of the mask plane to JavaScript. That is the first thing to add when masks
should survive.

Opens in Photoshop, Affinity Photo, Krita, GIMP and Photopea. The reader is
tested against hand-built files in the shapes those editors produce (offsets,
raw channels, groups, 16-bit, grayscale) — `app/src/lib/plugins/psd/psd.test.ts` —
and the whole path is exercised on the production build by `e2e/plugins-psd.spec.ts`.

## Writing a plugin

A format plugin is a **pure codec**. It never sees the engine, the DOM or React.

```ts
// app/src/lib/plugins/types.ts
export interface FormatCodec {
  read(bytes: Uint8Array): LayeredDocument;   // throw an Error with a toast-ready message
  write(doc: LayeredDocument): Uint8Array;
}
```

`LayeredDocument` (`document.ts`) is the engine's own conventions, so the
bridge does no reordering: full-canvas RGBA planes, bottom-first, opacity 0..1,
an optional `activeIndex`, an optional `composite`, and `notes` — the sentences
about what did not survive.

1. Create `app/src/lib/plugins/<id>/` with `read.ts`, `write.ts` and an
   `index.ts` exporting `codec: FormatCodec`. Test it in node with a
   `Uint8Array` — no wasm, no jsdom.
2. Add a row to `PLUGINS` in `registry.ts`: id, name, version, a blurb that says
   what it adds **and what it does not do**, and a `formats` entry whose `load`
   is `async () => (await import("./<id>")).codec`. A format `id` must not
   collide with a built-in `ExportFormat` (`png` / `jpeg` / `webp` / `avif`) or `ora`;
   `state.test.ts` pins that.
3. That is all. The pane lists it, the Download dialog and Import / Export pick
   it up through `useActivePluginFormats()`, and `bridge.ts` — the **one** file that
   moves a `LayeredDocument` in and out of the engine — does the rest.

Ids are forever: a device's choice is keyed on `plugin.id`, and a format's `id`
is what a Download-dialog pick carries. Rename the label, not the id.

## Files

```
app/src/lib/plugins/
├── index.ts             the public surface
├── types.ts             ImageHorsePlugin, FormatSpec, FormatCodec — and why nothing is fetched
├── document.ts          LayeredDocument + compositeLayers() (the fallback merged image)
├── registry.ts          PLUGINS — the catalogue; add a row to ship a plugin
├── state.ts             the master switch + per-plugin switches, per device, in localStorage
├── bridge.ts            the ONLY engine access: capture / restore a LayeredDocument
├── download.ts          export through a format + the browser download + the toast
├── importAsNewPhoto.ts  the two-step "new photo, then restore the stack" funnel
└── psd/
    ├── index.ts         codec
    ├── read.ts          .psd → LayeredDocument
    ├── write.ts         LayeredDocument → .psd
    ├── packbits.ts      the RLE
    └── bytes.ts         big-endian cursors + PsdError
app/src/hooks/usePlugins.ts          useSyncExternalStore views of state.ts
app/src/components/PluginsPane.tsx   Settings → Plugins
```
