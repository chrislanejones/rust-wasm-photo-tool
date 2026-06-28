import { Package, Upload } from "lucide-react";
import { LargeButton } from "@/components/ui/large-button";

/**
 * Settings → Import / Export pane. Round-trips the full project (every layer +
 * annotation) through OpenRaster (.ora) — an open, layered ZIP container that
 * also opens in Krita, GIMP, and other editors. Both actions are disabled until
 * the .ora serializer/parser land (planned in Rust, alongside the layer stack);
 * this stakes out the UI.
 */
export function ExportPane() {
  return (
    <div className="space-y-6">
      {/* Import */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Import</h3>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            Open an OpenRaster (.ora) project and restore its full layer stack.
            Coming soon.
          </p>
        </div>
        <LargeButton disabled className="w-full">
          <Upload />
          Import .ora
        </LargeButton>
      </div>

      {/* Export */}
      <div className="space-y-3 pt-4 border-t border-theme-sidebar-border">
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
    </div>
  );
}
