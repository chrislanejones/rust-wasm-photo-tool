import { Package } from "lucide-react";
import { LargeButton } from "@/components/ui/large-button";

/**
 * Settings → Export pane. Placeholder for project export. The only action so far
 * is exporting to OpenRaster (.ora) — a layered, open ZIP container that round-
 * trips the layer stack. Disabled until the exporter lands; here just to stake
 * out the UI.
 */
export function ExportPane() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">Export</h3>
        <p className="mt-1 text-xs leading-relaxed text-text-muted">
          Export the full project — every layer and annotation — to OpenRaster
          (.ora), an open, layered format that opens in Krita, GIMP, and other
          editors. Coming soon.
        </p>
      </div>
      <LargeButton disabled className="w-full">
        <Package />
        Export as .ora
      </LargeButton>
    </div>
  );
}
