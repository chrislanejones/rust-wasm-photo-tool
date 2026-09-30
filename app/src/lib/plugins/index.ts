// Plugins — the public surface. See docs/Plugins.md and ADR-076.
export {
  hydrateInstalledPlugins,
  installedPlugins,
  installedPlugin,
  addPlugin,
  addPluginFromUrl,
  removePlugin,
  arePluginsAllowed,
  setPluginsAllowed,
  isPluginOn,
  setPluginOn,
  isPluginActive,
  subscribePlugins,
  activeFormats,
  activeFormatById,
} from "./state";
export { PLUGIN_API_VERSION, PluginError } from "./types";
export type {
  ActiveFormat,
  FormatCodec,
  FormatSpec,
  InstalledPlugin,
  PluginModule,
} from "./types";
export type { LayeredDocument, LayeredLayer } from "./document";
export { downloadPluginFormatWithToast } from "./download";
export { importPluginFormatAsNewPhoto } from "./importAsNewPhoto";
