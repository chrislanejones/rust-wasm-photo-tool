# Plugins

> Part of the [Image Horse](../README.md) docs. See also: [Architecture](Architecture.md) · [File Map](File-Map.md) · [OpenRaster (.ora)](OpenRaster-Export-Import.md) · [ADR-075](adr/075-a-plugin-is-a-file-a-person-adds-from-settings-kept-on-the-device-and-a-format-plugin-never-touches-the-engine.md).

A plugin is a feature that comes from **outside** Image Horse and stays **off**
until a person adds it and turns it on in **Settings → Plugins**. The first one
is **Photoshop PSD** — export the project as a layered `.psd`, and open a `.psd`
as a new photo with its layers — and it lives in its own repository:
`image-horse-psd-plugin`. This repository holds the plugin *machinery* and no
plugin.

## Adding a plugin

1. Get the plugin's file from its project — one JavaScript file, e.g.
   `image-horse-psd.plugin.js` from the PSD plugin's `dist/`.
2. Open **Settings → Plugins** (also in the command palette, or `#/settings/plugins`).
3. **Add from file** and pick it, or paste its link under **Or add from a link**
   (a GitHub file page link is turned into the raw file for you).
4. **Allow plugins → On.** This is the master switch. While it is off, no plugin
   is active whatever its own switch says, and nothing a plugin adds shows up
   anywhere in the app.

Each added plugin gets a row with its own On / Off switch and a Remove button.
Adding a newer file with the same plugin id replaces the old one. Changes commit
as pressed — there is no Apply, and no reload.

The plugin is kept in **this browser, on this device**: its file goes into
IndexedDB (`image-horse-plugins`) and the switches into `localStorage`
(`imagehorse:plugins`, `imagehorse:plugin:<id>`). Nothing is sent anywhere, and
nothing is ever fetched on the app's own initiative — a plugin arrives because a
person handed it in. Everything is off on a fresh device, and off is the
fallback: blocked storage, an unknown id, a value that is not exactly `"1"`.

**A plugin runs in the page with the same access as the app.** The pane says
so. Add only plugins you trust, the way you would install any software.

## What a plugin can add

Today: a **file format** — import and export of a layered document. A format
plugin adds

- its file type to the **Download dialog**'s format picker, as a tile after the
  built-ins (the disabled "Activate with plugin" PSD tile is the placeholder you
  see until a plugin provides PSD);
- an **Import** and **Export** pair to **Settings → Import / Export**, under the
  built-in `.ora` pair.

Import always lands as a **new photo** — the open photo is never overwritten —
the same funnel `.ora` uses. Export flattens live text and shape annotations into
pixels first, as `.ora` does, and says so in the toast. A format the file could
not keep (a blend mode, a group, a mask) is a sentence in the import toast, not
a silent drop.

The manifest leaves room for other kinds (a tool, a filter, a panel) without
pretending they exist: a plugin declares `formats`, and nothing else, until
something else is real. `apiVersion` is how a future shape says so.

## Writing a plugin

A plugin is **one ES module** whose `export default` is its manifest with the
code beside it. It is built in its own repository to a single file with no
imports — the PSD plugin uses esbuild — and that file is what people add.

```js
export default {
  apiVersion: 1,
  id: "psd",                       // [a-z0-9][a-z0-9-]*, ≤ 32 chars; forever
  name: "Photoshop PSD",
  version: "1.0.0",
  blurb: "What it adds, and what it does not do.",
  homepage: "https://github.com/…", // https only; optional
  formats: [
    {
      id: "psd",                   // not png/jpeg/webp/avif/ora/svg
      label: "PSD",                // the picker tile
      hint: "Layered · Photoshop", // under the label
      extension: ".psd",
      accept: ".psd,image/vnd.adobe.photoshop",
      mime: "image/vnd.adobe.photoshop",
      describe: "One sentence for Settings → Import / Export.",
      read(bytes) { /* Uint8Array → LayeredDocument, or throw an Error with a toast-ready message */ },
      write(doc)  { /* LayeredDocument → Uint8Array */ },
    },
  ],
};
```

`LayeredDocument` is the engine's own conventions, so the bridge does no
reordering: full-canvas RGBA planes (`width * height * 4`, straight alpha),
**bottom-first**, opacity 0..1, an optional `activeIndex`, an optional
`composite` (the file's own merged image; null means "compose it yourself"),
and `notes` — the sentences about what did not survive. The TypeScript for the
contract is `app/src/lib/plugins/types.ts` + `document.ts` here, mirrored as
`src/api.ts` in the PSD plugin's repository.

A format plugin is a **pure codec**. It never sees the engine, the DOM or
React. `app/src/lib/plugins/bridge.ts` is the one file that moves a
`LayeredDocument` in and out of the wasm engine, so a second format adds a
codec and zero engine call sites.

When the file is added, Image Horse loads it (as a `blob:` module — the reason
`script-src` carries `blob:` in `vercel.json`), checks the default export field
by field, and refuses with a reason — a wrong `apiVersion`, a reserved format
id, a `read` that is not a function, a format another installed plugin already
provides. What passes is stored; what fails is not.

To try the machinery without a real codec, add
`e2e/fixtures/layered-json.plugin.js` — the smallest real format plugin there
is (the layer stack as JSON). The unit tests and the e2e both use it.

## Files

```
app/src/lib/plugins/
├── index.ts             the public surface
├── types.ts             PluginModule, InstalledPlugin, FormatSpec, FormatCodec, PluginError
├── document.ts          LayeredDocument + compositeLayers() (the fallback merged image)
├── load.ts              source → running module (blob: import) + the field-by-field check;
│                        fetchPluginSource() for "Add from a link"
├── store.ts             IndexedDB: the manifest beside the module's source, one record per id
├── state.ts             the installed list (hydrated once), the two switches, activeFormats()
├── bridge.ts            the ONLY engine access: capture / restore a LayeredDocument
├── download.ts          export through a format + the browser download + the toast
└── importAsNewPhoto.ts  the two-step "new photo, then restore the stack" funnel
app/src/hooks/usePlugins.ts              useSyncExternalStore views of state.ts
app/src/app/session/usePluginDownload.ts the Download dialog's plugin half
app/src/components/PluginsPane.tsx       Settings → Plugins
e2e/fixtures/layered-json.plugin.js      the test plugin
```
