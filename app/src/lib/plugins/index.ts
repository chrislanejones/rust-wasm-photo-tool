// Plugins — the public surface. See docs/Plugins.md and ADR-072.
export { PLUGINS, pluginById } from "./registry";
export {
  arePluginsAllowed,
  setPluginsAllowed,
  isPluginOn,
  setPluginOn,
  isPluginActive,
  subscribePlugins,
  activeFormats,
  activeFormatById,
} from "./state";
export type { ActiveFormat, FormatSpec, ImageHorsePlugin } from "./types";
export { downloadPluginFormatWithToast } from "./download";
export { importPluginFormatAsNewPhoto } from "./importAsNewPhoto";
