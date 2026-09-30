// Turn a plugin's source text into a running module, and check its shape.
//
// HOW A MODULE LOADS. The source becomes a Blob, the Blob a `blob:` URL, and
// `import()` of that URL evaluates it as an ES module — the one way to run
// module code that did not ship in the bundle, and the reason `script-src`
// carries `blob:` (vercel.json). No `eval`, no `new Function`, no script tag.
// Under node (vitest) there is no real `createObjectURL`, so the same text goes
// through a `data:` URL instead; the module semantics are identical.
//
// WHAT IS CHECKED, AND WHY BEFORE STORING. `validatePluginModule` walks the
// default export field by field and names the first thing wrong in words a
// person can act on ("formats[0].read is not a function"). It runs when a
// plugin is ADDED, so the store never holds a module that will not load; and
// it runs again on every load, because the checks are cheap and a future
// build with a higher `apiVersion` must refuse an old file the same way.
import {
  PLUGIN_API_VERSION,
  PluginError,
  type FormatCodec,
  type PluginFormatManifest,
  type PluginManifest,
  type PluginModule,
} from "./types";

/** Ids the built-in pickers already use; a plugin format may not claim one. */
const RESERVED_FORMAT_IDS: readonly string[] = ["png", "jpeg", "webp", "avif", "ora", "svg"];

const ID_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;
/** A plugin file bigger than this is almost certainly not a plugin. */
const MAX_PLUGIN_BYTES = 4 * 1024 * 1024;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function str(obj: Record<string, unknown>, key: string, where: string, max = 400): string {
  const v = obj[key];
  if (typeof v !== "string" || v.trim() === "") {
    throw new PluginError(`Not a valid plugin: ${where}.${key} is missing.`);
  }
  if (v.length > max) {
    throw new PluginError(`Not a valid plugin: ${where}.${key} is too long.`);
  }
  return v;
}

function validateFormat(x: unknown, index: number): PluginFormatManifest & FormatCodec {
  const where = `formats[${index}]`;
  if (!isRecord(x)) throw new PluginError(`Not a valid plugin: ${where} is not an object.`);
  const id = str(x, "id", where, 32);
  if (!ID_RE.test(id)) {
    throw new PluginError(
      `Not a valid plugin: ${where}.id "${id}" must be lowercase letters, digits and dashes.`,
    );
  }
  if (RESERVED_FORMAT_IDS.includes(id)) {
    throw new PluginError(`This plugin's format id "${id}" is one the app already uses.`);
  }
  const extension = str(x, "extension", where, 16);
  if (!/^\.[a-z0-9]{1,10}$/i.test(extension)) {
    throw new PluginError(`Not a valid plugin: ${where}.extension "${extension}" should look like ".psd".`);
  }
  if (typeof x.read !== "function") {
    throw new PluginError(`Not a valid plugin: ${where}.read is not a function.`);
  }
  if (typeof x.write !== "function") {
    throw new PluginError(`Not a valid plugin: ${where}.write is not a function.`);
  }
  return {
    id,
    label: str(x, "label", where, 32),
    hint: str(x, "hint", where, 64),
    extension,
    accept: typeof x.accept === "string" && x.accept ? x.accept.slice(0, 200) : extension,
    mime: typeof x.mime === "string" && x.mime ? x.mime.slice(0, 100) : "application/octet-stream",
    describe: typeof x.describe === "string" ? x.describe.slice(0, 400) : "",
    read: x.read as FormatCodec["read"],
    write: x.write as FormatCodec["write"],
  };
}

/** Check a module's default export and return it in the app's shape, or throw
 *  a PluginError that says what is wrong. */
function validatePluginModule(x: unknown): PluginModule {
  if (!isRecord(x)) {
    throw new PluginError(
      "Not a plugin: the file's default export is not an object. A plugin is an ES module whose `export default` is its manifest.",
    );
  }
  if (x.apiVersion !== PLUGIN_API_VERSION) {
    throw new PluginError(
      `This plugin speaks API version ${String(x.apiVersion)}; this build of Image Horse speaks ${PLUGIN_API_VERSION}.`,
    );
  }
  const id = str(x, "id", "plugin", 32);
  if (!ID_RE.test(id)) {
    throw new PluginError(`Not a valid plugin: id "${id}" must be lowercase letters, digits and dashes.`);
  }
  const formatsRaw = x.formats;
  if (!Array.isArray(formatsRaw) || formatsRaw.length === 0) {
    throw new PluginError("Not a valid plugin: it declares no formats, and formats are the only thing a plugin can add today.");
  }
  const formats = formatsRaw.map(validateFormat);
  const ids = new Set(formats.map((f) => f.id));
  if (ids.size !== formats.length) {
    throw new PluginError("Not a valid plugin: two of its formats share an id.");
  }
  const homepage = typeof x.homepage === "string" && /^https:\/\//.test(x.homepage) ? x.homepage.slice(0, 400) : undefined;
  return {
    apiVersion: PLUGIN_API_VERSION,
    id,
    name: str(x, "name", "plugin", 80),
    version: str(x, "version", "plugin", 32),
    blurb: typeof x.blurb === "string" ? x.blurb.slice(0, 600) : "",
    homepage,
    formats,
  };
}

/** The manifest alone — what the store keeps. Functions stripped. */
export function manifestOf(mod: PluginModule): PluginManifest {
  return {
    apiVersion: mod.apiVersion,
    id: mod.id,
    name: mod.name,
    version: mod.version,
    blurb: mod.blurb,
    homepage: mod.homepage,
    formats: mod.formats.map(({ id, label, hint, extension, accept, mime, describe }) => ({
      id,
      label,
      hint,
      extension,
      accept,
      mime,
      describe,
    })),
  };
}

const IS_NODE = typeof process !== "undefined" && !!process.versions?.node;

/** Evaluate `source` as an ES module and return its validated default export. */
export async function loadPluginModule(source: string): Promise<PluginModule> {
  if (source.length > MAX_PLUGIN_BYTES) {
    throw new PluginError("That file is too large to be a plugin (over 4 MB).");
  }
  let url: string;
  let revoke: (() => void) | null = null;
  if (IS_NODE) {
    url = `data:text/javascript;base64,${Buffer.from(source, "utf8").toString("base64")}`;
  } else {
    url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    revoke = () => URL.revokeObjectURL(url);
  }
  let mod: unknown;
  try {
    mod = await import(/* @vite-ignore */ url);
  } catch (err) {
    throw new PluginError(
      `That file didn't load as a plugin: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    revoke?.();
  }
  const def = isRecord(mod) ? mod.default : undefined;
  return validatePluginModule(def);
}

/**
 * Fetch a plugin's source from a URL the person typed. A GitHub "blob" page
 * link is turned into its raw file, because that is the link people copy from
 * the address bar. Nothing here is called on the app's own initiative.
 */
export async function fetchPluginSource(input: string): Promise<{ source: string; url: string }> {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new PluginError("That doesn't look like a web address.");
  }
  if (url.protocol !== "https:") {
    throw new PluginError("A plugin can only be added from an https:// address.");
  }
  const blobPage = /^\/([^/]+)\/([^/]+)\/blob\/(.+)$/.exec(url.pathname);
  if (url.hostname === "github.com" && blobPage) {
    url = new URL(`https://raw.githubusercontent.com/${blobPage[1]}/${blobPage[2]}/${blobPage[3]}`);
  }
  let res: Response;
  try {
    res = await fetch(url.toString(), { mode: "cors", credentials: "omit" });
  } catch {
    throw new PluginError(
      "Couldn't download from that address. Download the plugin file yourself and use \"Add from file\".",
    );
  }
  if (!res.ok) {
    throw new PluginError(`That address answered ${res.status}. Check the link, or download the file and add it from disk.`);
  }
  const source = await res.text();
  if (source.length > MAX_PLUGIN_BYTES) {
    throw new PluginError("That file is too large to be a plugin (over 4 MB).");
  }
  return { source, url: url.toString() };
}
