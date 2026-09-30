// What a plugin IS, to this app. The loader (load.ts), the store (store.ts)
// and the switches (state.ts) all speak these shapes; this file is only the
// shapes.
//
// A plugin is ONE JavaScript module, an ES module whose default export is a
// `PluginModule`: a manifest (id, name, version, what it adds) with the code
// beside it. It lives in its own repository, is built to a single file there,
// and a person ADDS it from Settings → Plugins — from a file they downloaded,
// or from a URL. The app keeps the module's source in IndexedDB on that device
// and loads it from there on every visit (ADR-076). Nothing is fetched on the
// app's own initiative, ever: a plugin arrives because a person handed it in.
//
// A plugin runs in the page, with the same access as the app. That is said
// plainly in the pane, and it is why adding one is a deliberate act with a
// file picker, not a store with an Install button.
//
// Today a plugin can add one kind of thing — a FILE FORMAT, import and export
// of a layered document. The manifest leaves room for more (a tool, a filter,
// a panel) without pretending those exist: a plugin declares `formats`, and
// nothing else, until something else is real. `apiVersion` is how a future
// shape says so.
import type { LayeredDocument } from "./document";

/** The plugin API this build speaks. A module declaring another number is
 *  refused with a message rather than half-loaded. */
export const PLUGIN_API_VERSION = 1;

/** The pure half of a format: bytes ⇄ LayeredDocument. Never sees the engine,
 *  the DOM or React — bridge.ts is the only code that does (document.ts). */
export interface FormatCodec {
  /** Throw an Error whose message is fit for a toast when the bytes are not
   *  this format, or are a variant the codec does not read. */
  read(bytes: Uint8Array): LayeredDocument;
  write(doc: LayeredDocument): Uint8Array;
}

/** A format as the manifest describes it: everything but the code. This is
 *  what the store keeps and what the pickers render. */
export interface PluginFormatManifest {
  /** Short id, also the value the Download dialog's picker carries. Must not
   *  collide with a built-in (`png` / `jpeg` / `webp` / `avif` / `ora` /
   *  `svg`) or with another installed plugin's format. */
  id: string;
  /** The picker's label: "PSD". */
  label: string;
  /** The picker's one-line hint under the label: "Layered · Photoshop". */
  hint: string;
  /** With the dot: ".psd". */
  extension: string;
  /** For `<input type="file" accept>`. */
  accept: string;
  /** MIME type for the downloaded Blob. */
  mime: string;
  /** One sentence for Settings → Import / Export, saying what the format is
   *  and where else it opens. */
  describe: string;
}

/** The manifest half of a plugin module. */
export interface PluginManifest {
  apiVersion: number;
  /** URL-safe, stable: `[a-z0-9][a-z0-9-]*`, at most 32 characters. It keys the
   *  device's switch and the stored source; a new version keeps the id. */
  id: string;
  name: string;
  version: string;
  /** What it adds and what it does not do — the honest sentence for the pane. */
  blurb: string;
  /** Where it comes from, for the pane's link. https only. */
  homepage?: string;
  formats: PluginFormatManifest[];
}

/** What a plugin file's `export default` must be: the manifest, with each
 *  format carrying its own `read` and `write`. */
export interface PluginModule extends Omit<PluginManifest, "formats"> {
  formats: (PluginFormatManifest & FormatCodec)[];
}

/** A plugin as this device keeps it: the manifest, plus the module's source
 *  so it can be loaded again next visit without anyone re-adding it. */
export interface InstalledPlugin extends PluginManifest {
  /** The ES module's text, exactly as added. */
  source: string;
  /** The URL it was added from, or null for a file. Shown in the pane; never
   *  re-fetched on the app's own initiative. */
  sourceUrl: string | null;
  /** `Date.now()` when added. */
  addedAt: number;
}

/** A format the rest of the app can use: the manifest plus a way to get the
 *  code, which `state.ts` builds from the installed plugin's source. */
export interface FormatSpec extends PluginFormatManifest {
  load: () => Promise<FormatCodec>;
}

/** A format together with the plugin that provides it. */
export interface ActiveFormat {
  plugin: InstalledPlugin;
  format: FormatSpec;
}

/** Thrown for a file that is not a plugin, or a plugin this build cannot
 *  take. The message is user-facing — it goes straight into the toast. */
export class PluginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PluginError";
  }
}
