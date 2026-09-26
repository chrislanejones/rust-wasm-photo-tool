// The plugin catalogue: every plugin this build ships, on or off.
//
// A plugin joins by adding a row here. That is the whole install step, and it
// is deliberate — see types.ts for why nothing is fetched at runtime. The row
// is a manifest; the code behind it lives under its own folder and is reached
// only through `load()`, a dynamic import, so a switched-off plugin adds
// nothing to the main bundle.
//
// Ids are forever: `state.ts` keys a device's choice on `plugin.id`, and a
// format's `id` is what a Download-dialog pick carries. Rename the label, not
// the id.
import type { ImageHorsePlugin } from "./types";

const PSD_PLUGIN: ImageHorsePlugin = {
  id: "psd",
  name: "Photoshop PSD",
  version: "1.0.0",
  blurb:
    "Export the project as a layered .psd and open a .psd as a new photo with its layers. " +
    "Layer names, order, visibility and opacity survive. Blend modes, groups, masks and " +
    "adjustment layers do not — the import says which ones it dropped.",
  formats: [
    {
      id: "psd",
      label: "PSD",
      hint: "Layered · Photoshop",
      extension: ".psd",
      accept: ".psd,image/vnd.adobe.photoshop",
      mime: "image/vnd.adobe.photoshop",
      describe:
        "Photoshop's own layered format. Opens in Photoshop, Affinity Photo, Krita, GIMP and Photopea.",
      load: async () => (await import("./psd")).codec,
    },
  ],
};

export const PLUGINS: readonly ImageHorsePlugin[] = [PSD_PLUGIN];

export function pluginById(id: string): ImageHorsePlugin | undefined {
  return PLUGINS.find((p) => p.id === id);
}
