# ADR-075 — A plugin is a file a person adds from Settings, kept on the device, and a format plugin never touches the engine

- **Status:** Draft
- **Date:** 2026-09-30
- **Deciders:** Chris Lane Jones
- **Supersedes:** —

## Context

Chris, 09-26-2026: "make the ability to allow plugins - then make a plugin
that allows exporting and importing as .PSD - site will allow more plugins."
Then, 09-30-2026, on the first cut (which compiled the PSD codec into the
bundle behind a switch): "The PSD plugin itself will be in another repo …
the settings panel will have add a plugin. So then a person will be able to
… get the PSD plugin from that other repo, come to settings and then add it.
Don't add it as a PR."

So the shape is decided by the person who owns the product: a plugin is
**not** in this repository. It is a file from somewhere else, and Settings is
where it comes in. Three facts about the app constrain how:

- **Nothing leaves the tab.** The editor's whole pitch, restated in every
  privacy decision since ADR-010, ADR-061 and ADR-064. Whatever a plugin is,
  adding one must not create a request the person did not ask for.
- **The CSP names its script sources.** `vercel.json` serves
  `script-src 'self' …` (report-only today). Code that did not ship in the
  bundle can only run through a source that directive allows.
- **One layered format already exists and is wired by hand** (`.ora`), and
  #269 already put a disabled "Activate with plugin" PSD tile in the Download
  dialog, waiting for exactly this.

## Decision

**A plugin is one ES module file, and a person adds it in Settings → Plugins
— from a file on disk, or from a URL they typed.** Its default export is a
manifest (id, name, version, blurb, homepage, `apiVersion: 1`) with the code
beside it: today, `formats`, each with `read` and `write`. The file is kept in
**IndexedDB on that device** (`image-horse-plugins`, manifest beside source)
and loaded from there on every visit. Nothing is fetched on the app's own
initiative, ever; "Add from a link" is one `fetch` of one URL the person
typed, and a GitHub file page is turned into its raw file because that is the
link people copy.

**The file loads as a `blob:` module.** Source → Blob → `blob:` URL →
`import()`. No `eval`, no `new Function`, no script tag, no CSP relaxation
beyond `blob:` in `script-src`. Under node (vitest) the same text goes through
a `data:` URL, so the loader is tested against a real module evaluation.

**It is checked field by field before it is stored.** `validatePluginModule`
names the first thing wrong in words a person can act on: a wrong
`apiVersion`, an id that is not `[a-z0-9-]`, a format id the app already uses
(`png` … `svg`), a `read` that is not a function, a format another installed
plugin already provides. What passes is stored; what fails is not.

**Two switches, both off by default, per device, in `localStorage`.** "Allow
plugins" is the master: while it is off, no plugin is active whatever its own
switch says, and nothing a plugin adds appears anywhere. Under it, one switch
per added plugin, turned on by the add (the person just handed the file in).
The master going off does not clear the per-plugin choices. Keys are their own
namespace — NOT `ih_*` flags in `featureFlags.ts` (subsystem switches with no
Settings surface on purpose) and NOT a synced Preference (a plugin is a file
this device was handed; a synced "psd: on" on a device never handed the file
would be a choice about nothing). Off is the fallback (ADR-064's rule).

**A format plugin is a pure codec: `bytes ⇄ LayeredDocument`, and it never
sees the engine.** `LayeredDocument` (`document.ts`) is full-canvas RGBA,
bottom-first, opacity 0..1 — the engine's own conventions. `bridge.ts` is the
ONE file that moves a `LayeredDocument` in and out of the wasm engine
(`capture_layer_stack`, `get_layer_png` per layer through the engine's own PNG
decoder, `export_png`; `begin` / `push_restored_layer` / `finish_layer_restore`).
A second format adds a codec and zero engine call sites; the ADR-024 audit
pins that at 173 → 176 awaited sites, all three in the bridge.

**Surfaces subscribe, they are not told.** `useActivePluginFormats()` is a
`useSyncExternalStore` over `state.ts`; the Download dialog's picker
(`usePluginDownload`, the dialog's plugin half, extracted so AppShell stays
under its max-lines cap) and Settings → Import / Export render whatever it
returns. No reload. A plugin pick in the Download dialog resolves against the
ACTIVE formats on every render, so a plugin switched off while the dialog is
open falls back to a raster pick. The disabled PSD tile from #269 stays as the
placeholder and gives way when a plugin provides `psd`.

**The PSD plugin lives in `image-horse-psd-plugin`, its own repository**, as
`src/api.ts` (the contract, mirrored from `types.ts` + `document.ts` here),
`src/plugin.ts` (the default export) and `src/psd/` (the codec), built by
esbuild to one dependency-free file, `dist/image-horse-psd.plugin.js`. This
repository ships **no plugin**: its fixture, `e2e/fixtures/layered-json.plugin.js`,
is the smallest real format plugin there is, and the unit tests, the pane test
and the e2e all add that.

## Alternatives considered

- **Compile plugins into the bundle behind a switch** (the first cut,
  ADR-072-as-drafted on this branch, never merged). Rejected by the product
  owner: a plugin that is a PR here is not a plugin, it is a feature flag.
- **A plugin store / marketplace / registry the app queries.** Rejected: a
  request the person did not make, on every visit, is the one thing
  "nothing leaves the tab" cannot survive; and a listing is a promise about
  code nobody here reviewed. A file the person chose is an honest unit of
  trust.
- **Run plugins in a sandboxed iframe or Worker with `postMessage`.**
  Deferred, not rejected. It would let an untrusted plugin see only the
  `LayeredDocument` it is handed. Cost: every layer crosses a boundary (a 12
  MP layer is 48 MB, per layer, per direction), and the API gets a transport.
  The trust statement in the pane ("same access as the app; add only plugins
  you trust") is the honest version until a plugin needs less trust than that.
- **`localStorage` for the plugin's source.** Rejected: a few MB for the
  whole origin, already holding the synced preferences; a plugin can be
  hundreds of KB. Own IndexedDB database, raw, in the shape of originalsStore.
- **`data:` URLs in the browser.** Rejected: `script-src data:` is what CSP
  evaluators flag; `blob:` is the conventional source for same-origin
  generated modules and is already in `worker-src`.
- **A dependency (`ag-psd`) in the plugin.** Rejected there, for now: the
  needed subset is ~600 lines and the reader has to say what it dropped in
  this app's words.

## Pre-mortem (mandatory)

Six months on: **a person added a plugin from a link someone posted, and it
was not what it said.** It ran with the app's access. Mitigations in the
Decision: the add is deliberate (a file picker or a typed URL, never a click
on a listing), the pane says in plain words that a plugin runs with the same
access as the app, nothing is fetched on the app's own initiative, `https`
only, and the person's pixels still never leave the tab unless the plugin
sends them — which is the trust they extended. The follow-up if this bites is
the deferred sandbox, not a store.

Second: **a plugin file that loaded on the day it was added stops loading**
(a browser drops a syntax it used). `moduleFor` fails the load, the codec's
`load()` rejects, the toast names the plugin, and Remove is one button. Early
warning sign: a `PluginError` toast on a plugin that worked yesterday.

Third: **a plugin's `read` throws something that is not an Error, or hangs.**
The funnels catch and toast `String(err)`; a hang is a hang — the same as any
codec — and the Busy state disables the other buttons. Early warning sign: an
Import button stuck on "Importing…".

## Consequences

- Settings gains a **Plugins** tab (`SettingsTab` union, route
  `#/settings/plugins`, palette entry). Fourteen tabs.
- **New:** `lib/plugins/` (9 files), `hooks/usePlugins.ts`,
  `app/session/usePluginDownload.ts`, `components/PluginsPane.tsx`,
  `e2e/fixtures/layered-json.plugin.js`; `openraster/export.ts` exports
  `flattenAllLayersInPlace` for the bridge; `useDownloadFormat.ts` widens
  `DownloadFormat` with `PluginFormatId` and gains `isExportFormat` /
  `isBuiltInDownloadFormat`; `FileTypeIcons.tsx` exports `makeFileTypeIcon`
  for a plugin tile's glyph; `main.tsx` hydrates the installed list at boot;
  `vercel.json` `script-src` gains `blob:`.
- **Tests:** 28 runtime (load, validate, store across a simulated reload,
  the switches, URL add), 3 pane (jsdom), 1 e2e on the production build that
  adds the fixture plugin through the real pane and round-trips its format;
  the same e2e takes `IH_E2E_PLUGIN=<file>` and was run with the built PSD
  plugin. Suite 1,453 → 1,484.
- **Costs:** a plugin is trusted code (see pre-mortem 1); the `.ora` codec
  and a plugin codec are two implementations of one idea (the bridge is
  shared, the codecs are not); masks are not in `LayeredDocument` because the
  engine exposes no mask-plane read; the PSD plugin's `src/api.ts` is a
  hand-mirror of `types.ts` + `document.ts` and can drift — `apiVersion` is
  the seam, and a mismatch is refused, not guessed.
- **Follow-ups:** the sandbox when a plugin needs less trust; a mask plane on
  `LayeredLayer` once the engine reads one out; a published `@imagehorse/plugin-api`
  types package when a second plugin repository exists.
