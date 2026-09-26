// What a plugin IS, to this app. Read registry.ts for the catalogue and
// state.ts for the switches; this file is only the shapes.
//
// A plugin is code that ships INSIDE the bundle and is off until a person
// turns it on in Settings → Plugins (ADR-072). It is not a script fetched from
// somewhere: the app's Content-Security-Policy forbids that, and a plugin that
// arrived by URL would be code nobody reviewed running against a person's
// photos. So "installing" a plugin is a pull request here, and "enabling" one
// is a switch on the device. The catalogue can grow; the trust model does not.
//
// Today a plugin can add one kind of thing — a FILE FORMAT, import and export
// of a layered document. The shape leaves room for more (a tool, a filter, a
// panel) without pretending those exist: a plugin declares `formats`, and
// nothing else, until something else is real.
import type { LayeredDocument } from "./document";

/** The pure half of a format: bytes ⇄ LayeredDocument. Loaded on demand, so a
 *  plugin nobody has switched on costs the bundle nothing but its manifest. */
export interface FormatCodec {
  /** Throw an Error whose message is fit for a toast when the bytes are not
   *  this format, or are a variant the codec does not read. */
  read(bytes: Uint8Array): LayeredDocument;
  write(doc: LayeredDocument): Uint8Array;
}

export interface FormatSpec {
  /** Short id, also the value the Download dialog's picker carries, so it
   *  must not collide with a built-in `ExportFormat` ("png", "jpeg", "webp",
   *  "avif") or with "ora". */
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
  load: () => Promise<FormatCodec>;
}

export interface ImageHorsePlugin {
  /** URL-safe, stable: it is the localStorage key's suffix. */
  id: string;
  name: string;
  version: string;
  /** What it adds and what it does not do — the honest sentence for the pane. */
  blurb: string;
  formats: readonly FormatSpec[];
}

/** A format together with the plugin that provides it. */
export interface ActiveFormat {
  plugin: ImageHorsePlugin;
  format: FormatSpec;
}
