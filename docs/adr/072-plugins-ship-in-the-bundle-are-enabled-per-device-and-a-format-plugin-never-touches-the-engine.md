# ADR-072 — Plugins ship in the bundle, are enabled per device, and a format plugin never touches the engine

- **Status:** Draft
- **Date:** 2026-09-26
- **Deciders:** Chris Lane Jones
- **Supersedes:** —

## Context

Chris, 09-26-2026: "In the setting - make the ability to allow plugins - then
make a plugin that allows exporting and importing as .PSD - site will allow
more plugins."

Three things are true about the app that shape what "plugin" can mean here:

- **Nothing leaves the tab.** The editor's whole pitch, restated in every
  privacy decision since ADR-010 (metadata scrub), ADR-061 (sync carries
  preferences, never pixels) and ADR-064 (a beta choice is a localStorage key
  and no more). The engine's buffers are the thing that promise protects.
- **The CSP forbids foreign scripts.** `netlify.toml` / `vercel.json` serve a
  Content-Security-Policy under which the only script origin is the app's
  own. A plugin fetched by URL — a store, a marketplace, a "paste a link" box —
  would need that wall taken down, for code nobody here reviewed.
- **One layered format already exists and is wired by hand.** OpenRaster
  (`lib/openraster/`) reaches three surfaces — Settings → Import / Export,
  the Download dialog's picker, and the shared `download.ts` that #243 had to
  extract because the first two had drifted. A second format done the same way
  is a second copy of each of those, plus a second copy of the layer-restore
  dance `openraster/import.ts` documents at length (canvas size from the first
  pushed layer, bottom-first order, the active-layer fallback, the race guard).

PSD is the format people ask for by name. It is also a format with a great
deal this app cannot represent — blend modes, groups, masks, adjustment
layers, 16- and 32-bit depth, CMYK — so an importer that silently drops
things is worse than none.

## Decision

**A plugin is code that ships inside the bundle and is off until a person
turns it on in Settings → Plugins.** "Installing" a plugin is a pull request
that adds a row to `PLUGINS` in `app/src/lib/plugins/registry.ts`;
"enabling" one is a switch on the device. Nothing is fetched at runtime.

**Two switches, both off by default, per device, in `localStorage`.** "Allow
plugins" is the master: while it is off, no plugin is active whatever its own
switch says, and nothing a plugin adds appears anywhere. Under it, one switch
per plugin. The master going off does not clear the per-plugin choices. Keys
are their own namespace (`imagehorse:plugins`, `imagehorse:plugin:<id>`) —
NOT `ih_*` flags in `featureFlags.ts` (those are subsystem kill switches with
no Settings surface on purpose) and NOT a synced Preference (a plugin is code
in a BUILD; a synced "psd: on" arriving on a device whose build lacks it would
be a choice about nothing). Off is the fallback for blocked storage, an
unknown id, or any value that is not exactly `"1"` — the ADR-064 rule.

**A format plugin is a pure codec: `bytes ⇄ LayeredDocument`, and it never
sees the engine.** `LayeredDocument` (`document.ts`) is full-canvas RGBA,
bottom-first, opacity 0..1 — the engine's own conventions, chosen so the
bridge does no reordering. `bridge.ts` is the ONE file that moves a
`LayeredDocument` in and out of the wasm engine: `captureLayeredDocument`
(flatten annotations as `.ora` does, `capture_layer_stack`, `get_layer_png`
per layer decoded through the engine's own PNG decoder, `export_png` for the
merged image) and `restoreLayeredDocument` (`begin` / `push_restored_layer` /
`finish_layer_restore`). A second format adds a codec and zero engine call
sites; the engine-call audit (ADR-024) pins that at 158 → 161 awaited sites,
all three in the bridge.

**A codec's `load()` is a dynamic `import()`.** A switched-off plugin costs
the main bundle its manifest — a name, a version, a sentence — and no more.

**The PSD plugin writes the subset it can read back and reads the superset
other editors write, and every loss is a sentence in the toast.** Written:
version 1, 8-bit RGB, PackBits, every layer full-canvas with R G B A, a
four-channel merged image (layer count negative, so the alpha is real
transparency), names as Pascal + `luni`, blend always Normal. Read: 8- and
16-bit (high byte), RGB and Grayscale, Raw and PackBits, layer rectangles
resolved onto the canvas, `luni` names, flat files as one Background layer.
Dropped and reported in `notes`: non-Normal blend modes (imported as Normal,
named), groups (`lsct` dividers skipped, the layers inside kept), layer masks,
adjustment/fill layers (blank). Refused with the reason: PSB, 32-bit, CMYK /
Lab / Indexed / Duotone / Bitmap, ZIP channels, truncated files, and a canvas
above 16,384² pixels (a hostile 30,000² header is 3.6 GB per layer).

**Surfaces subscribe, they are not told.** `useActivePluginFormats()` is a
`useSyncExternalStore` over `state.ts`; the Download dialog's picker and
Settings → Import / Export render whatever it returns. No reload (unlike
Beta), no prop threaded from AppShell for the plugin list. A plugin pick in
the Download dialog resolves against the ACTIVE formats on every render, so a
plugin switched off while the dialog is open falls back to a raster format
rather than downloading through code that is no longer on.

## Alternatives considered

- **Load plugins from a URL / a store.** Rejected: needs the CSP relaxed
  and puts unreviewed code against the pixel buffers. The trust model here is
  "the code in this repo", and a plugin is that code with a switch.
- **A synced Preference with Apply/Restore like General.** Rejected: a
  preference travels between devices (ADR-061) and a plugin is a fact about a
  build. Also, Beta and Sync already set the precedent that a switch which
  changes what the app *contains* commits as pressed.
- **A `beta` block in `featureFlags.ts`.** Rejected: that registry's header
  says its flags are subsystems that exist regardless, and Beta's point
  (ADR-064) is a temporary ring before a feature is on for everyone. A plugin
  is a permanent choice with a pane; conflating the two would put PSD in the
  invite-link flow and make "reload after changing" apply to it.
- **Give the codec the engine handle.** Rejected: a second restore path per
  format is the drift #243 had to un-drift for `.ora`, and it puts engine call
  sites — each a line in the ADR-024 audit — in every plugin.
- **`ag-psd` or another dependency.** Rejected for now: ~100 KB for a codec
  whose needed subset is ~600 lines, and the reader has to say what it
  dropped in this app's words; a library's "unsupported" is a thrown string.
  Revisit if masks or blend modes become engine features worth round-tripping.
- **Make `.ora` a plugin too.** Not done: it is shipped, on, and documented as
  built in. Moving it would be a migration of a working feature for symmetry.

## Pre-mortem (mandatory)

Six months on, the incident: **a PSD from Photoshop imported "fine" and a
person lost work** — the file had a group with Multiply blend and a mask, the
toast's sentences scrolled off, and the flat result looked plausible enough
that they saved over the original. Mitigations in the Decision: import
ALWAYS lands as a new photo, never over the open one; the toast holds for ten
seconds when there are notes; the `.psd` on disk is untouched. Weakness: the
notes are prose in a toast. If this happens, the fix is a persistent
"imported with changes" badge on the photo, not fewer notes.

The second likely incident: **a plugin's `load()` starts importing from
`@/hooks` or the engine "just for one thing"** and the bridge stops being the
one engine caller. Early warning sign: an `import` of `stamp_tool` or
`@/hooks/*` anywhere under `lib/plugins/<id>/`, or the engine-call audit
reporting a file under `lib/plugins/` other than `bridge.ts`.

## Consequences

- Settings gains a **Plugins** tab (`SettingsTab` union, route
  `#/settings/plugins`, palette entry). Fourteen tabs.
- **New:** `lib/plugins/` (9 files), `lib/plugins/psd/` (5), `hooks/usePlugins.ts`,
  `components/PluginsPane.tsx`; `openraster/export.ts` exports
  `flattenAllLayersInPlace` for the bridge. Settings → Import / Export shows
  a plugin section; the Download dialog's picker takes plugin formats after
  ORA and keeps them local (never `setExportFormat`).
- **Tests:** 32 codec + state, 5 pane (jsdom), 1 e2e on the production build
  (off by default → on → download → the app's own reader opens it → import
  back as a new photo). Suite 1,218 → 1,255.
- **Costs:** two OpenRaster/PSD readers of the same idea (the engine bridge is
  shared, the codecs are not); masks are not written because the engine
  exposes no mask-plane read; `compositeLayers()` in JS is a Normal-only
  fallback used only when a file carries no merged image; the ADR-024 open
  window between per-layer `get_layer_png` awaits is inherited, not widened.
- **Follow-ups:** a mask-plane read in the engine and a `mask` on
  `LayeredLayer`; blend modes if the engine grows them; the `.ora` codec
  behind the same `FormatCodec` interface once a second reason appears.
