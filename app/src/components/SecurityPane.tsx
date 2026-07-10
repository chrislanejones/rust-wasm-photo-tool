import { Tag, MapPinOff, Eraser } from "lucide-react";
import { ToggleButtonGroup } from "@/components/ui/toggle-button-group";
import type { MetadataStripMode } from "@/lib/exif";

interface SecurityPaneProps {
  /** Keep EXIF metadata on export (true) or strip it (false). */
  value: boolean;
  onChange: (keep: boolean) => void;
  /** When `value` is false (stripping), how aggressively: 'all' (default —
   *  the original full scrub) or 'location' (GPS only, camera/lens kept). */
  stripMode: MetadataStripMode;
  onStripModeChange: (mode: MetadataStripMode) => void;
}

/**
 * Settings → Security. Controls whether camera metadata (EXIF — GPS, capture
 * time, lens) is kept or stripped on export. A real, persisted preference (saved
 * via the footer Apply, synced to Convex); applies to Export, Export All, and
 * Export Selected. Matches the toggle style of the other Settings tabs.
 */
export function SecurityPane({
  value,
  onChange,
  stripMode,
  onStripModeChange,
}: SecurityPaneProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">
          Export metadata (EXIF)
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-text-muted">
          Keep your camera metadata — GPS, capture time, lens — embedded in
          exported JPEG / WebP files, or strip it for privacy before an image ever
          leaves the tab. Applies to Export, Export All, and Export Selected.
        </p>
      </div>
      <ToggleButtonGroup
        fill
        items={[
          {
            key: "keep",
            icon: Tag,
            label: "Keep EXIF",
            active: value,
            onToggle: () => onChange(true),
          },
          {
            key: "strip",
            icon: Eraser,
            label: "Strip EXIF",
            active: !value,
            onToggle: () => onChange(false),
          },
        ]}
      />
      {!value && (
        <div className="pl-1">
          <h4 className="text-xs font-semibold text-text-secondary">
            Strip scope
          </h4>
          <p className="mt-0.5 text-2xs leading-relaxed text-text-muted">
            "All" removes EXIF, GPS, maker notes, and XMP/IPTC. "Location only"
            removes just GPS — camera, lens, and timestamp survive.
          </p>
          <div className="mt-2">
            <ToggleButtonGroup
              fill
              items={[
                {
                  key: "location",
                  icon: MapPinOff,
                  label: "Location only",
                  active: stripMode === "location",
                  onToggle: () => onStripModeChange("location"),
                },
                {
                  key: "all",
                  icon: Eraser,
                  label: "All metadata",
                  active: stripMode === "all",
                  onToggle: () => onStripModeChange("all"),
                },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
