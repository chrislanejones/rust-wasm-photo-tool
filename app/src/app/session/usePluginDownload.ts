// The Download dialog's plugin half (Settings → Plugins, lib/plugins).
//
// Extracted from AppShell like useDownloadFormat: the formats the active
// plugins add, and — when the dialog's pick is one of them — the extension,
// the button label and the download itself. A plugin pick resolves against
// the ACTIVE formats on every render, so a plugin switched off while the
// dialog is open falls back to a raster format rather than downloading
// through code that is no longer on.
import type { MutableRefObject } from "react";
import type { ImageHorseTool } from "stamp_tool";
import { activeFormatById, downloadPluginFormatWithToast, type ActiveFormat } from "@/lib/plugins";
import { useActivePluginFormats } from "@/hooks/usePlugins";
import { isBuiltInDownloadFormat, type DownloadFormat } from "./useDownloadFormat";

interface Engine {
  toolRef: MutableRefObject<ImageHorseTool | null>;
  flushToCanvas: () => void;
  syncState: () => void;
}

export function usePluginDownload(downloadFormat: DownloadFormat, stamp: Engine) {
  const formats = useActivePluginFormats();
  const active: ActiveFormat | undefined = isBuiltInDownloadFormat(downloadFormat)
    ? undefined
    : activeFormatById(downloadFormat);
  return {
    /** Every format the active plugins add — the dialog's extra tiles. */
    formats,
    /** ".psd" while the pick is a plugin format, else null. */
    ext: active ? active.format.extension : null,
    /** "Download PSD" while the pick is a plugin format, else null. */
    label: active ? `Download ${active.format.label}` : null,
    /** Export through the picked plugin format under `fileStem`. */
    download: (fileStem: string) => {
      if (!active) return;
      void downloadPluginFormatWithToast({
        format: active.format,
        stampToolRef: stamp.toolRef,
        flushToCanvas: stamp.flushToCanvas,
        syncState: stamp.syncState,
        fileStem,
      });
    },
  };
}
