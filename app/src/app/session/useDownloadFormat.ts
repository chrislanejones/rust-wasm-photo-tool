import { useEffect, useMemo, useState } from "react";
import { canEncode } from "@/lib/encodeSupport";
import { EXPORT_FORMATS, type ExportFormat } from "@/lib/exportImage";
import { useToolStore } from "@/stores/useToolStore";
import { useUIStore } from "@/stores/useUIStore";

/** The Download dialog offers two more choices than the Compress panel, and
 *  neither is a raster encode, so neither touches the persisted `exportFormat`
 *  preference: ORA (the full layered project) and SVG (an uploaded SVG written
 *  back out as a vector, with its crop — lib/svgPassthrough.ts). SVG is not in
 *  `DOWNLOAD_FORMATS`: the dialog draws its tile itself, because whether it is
 *  enabled depends on the images, not on the browser. */
export type DownloadFormat = ExportFormat | "ora" | "svg" | PluginFormatId;

/** A format a plugin added (Settings → Plugins, lib/plugins): its manifest
 *  id, e.g. "psd". Any string that is not one of the built-ins above — the
 *  dialog resolves it against the ACTIVE plugin formats on every render, so a
 *  plugin switched off while the dialog is open drops back to a raster pick. */
export type PluginFormatId = string & { readonly __plugin?: never };

export function isExportFormat(v: string): v is ExportFormat {
  return (EXPORT_FORMATS as readonly string[]).includes(v);
}

/** ORA, SVG or a plugin format: a whole-project or vector file, never a
 *  raster encode, so never written to the persisted `exportFormat`. */
export function isBuiltInDownloadFormat(v: string): v is ExportFormat | "ora" | "svg" {
  return isExportFormat(v) || v === "ora" || v === "svg";
}

export interface DownloadFormatOption {
  value: DownloadFormat;
  label: string;
  hint: string;
}

const DOWNLOAD_FORMATS: DownloadFormatOption[] = [
  { value: "jpeg", label: "JPEG", hint: "Small · no transparency" },
  { value: "png", label: "PNG", hint: "Lossless · transparency" },
  { value: "webp", label: "WebP", hint: "Small · transparency" },
  { value: "avif", label: "AVIF", hint: "Smallest · modern" },
  { value: "ora", label: "ORA", hint: "Layered · full project" },
];

/** What the browser will ACTUALLY write, given what it can encode.
 *
 *  Pure, and exported for its test: it is the rule that keeps the dialog
 *  honest, and the honesty is the whole point — the button used to offer
 *  "Download AVIF" and then hand over a PNG. */
export function effectiveFormat(
  preferred: ExportFormat,
  avifEncodable: boolean | undefined,
): ExportFormat {
  return preferred === "avif" && avifEncodable === false ? "png" : preferred;
}

/** The same fact, said in the picker's own list. `undefined` means the probe
 *  has not answered yet, and an unanswered probe must NOT re-label anything —
 *  a hint that flickers from "Smallest · modern" to "Not supported here" and
 *  back is worse than one that arrives a frame late. */
export function labelFormats(
  avifEncodable: boolean | undefined,
): DownloadFormatOption[] {
  return DOWNLOAD_FORMATS.map((o) =>
    o.value === "avif" && avifEncodable === false
      ? { ...o, hint: "Not supported here · saves as PNG" }
      : o,
  );
}

/**
 * Everything the Download dialog needs to name the file it is about to write.
 *
 * Extracted from AppShell. Three facts travel together and nothing else reads
 * them, which is what makes this a unit: whether this browser can encode AVIF,
 * what that means for the format actually written, and the dialog's own
 * separate pick (which may be ORA, and so must never reach the store).
 *
 * The AVIF probe is why this exists at all. The Download dialog is a SECOND
 * format picker, and it was still selling AVIF as "Smallest · modern" while
 * the browser silently wrote PNG. The Compress panel's note does not reach
 * here, so the dialog has to say it itself — otherwise the more prominent of
 * the two surfaces is the dishonest one.
 */
export function useDownloadFormat() {
  const exportFormat = useToolStore((s) => s.exportFormat);
  const exportDialogOpen = useUIStore((s) => s.exportDialogOpen);

  const [avifEncodable, setAvifEncodable] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void canEncode("image/avif").then((ok) => {
      if (live) setAvifEncodable(ok);
    });
    return () => {
      live = false;
    };
  }, []);

  const downloadFormats = useMemo(() => labelFormats(avifEncodable), [avifEncodable]);

  // The dialog's own format pick, reseeded from the persisted preference each
  // time it opens — kept separate so an "ora" or "svg" pick never lands in
  // that store.
  const [downloadFormat, setDownloadFormat] = useState<DownloadFormat>(exportFormat);
  useEffect(() => {
    if (exportDialogOpen) setDownloadFormat(exportFormat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportDialogOpen]);

  return {
    downloadFormats,
    /** What will actually be written — drives the dialog's button label so it
     *  cannot offer "Download AVIF" and then hand over a PNG. */
    effectiveExportFormat: effectiveFormat(exportFormat, avifEncodable),
    downloadFormat,
    setDownloadFormat,
    isOraDownload: downloadFormat === "ora",
    isSvgDownload: downloadFormat === "svg",
  };
}
