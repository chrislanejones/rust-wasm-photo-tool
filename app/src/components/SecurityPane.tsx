import { Tag, Eraser } from "lucide-react";
import { ToggleButtonGroup } from "@/components/ui/toggle-button-group";

interface SecurityPaneProps {
  /** Keep EXIF metadata on export (true) or strip it (false). */
  value: boolean;
  onChange: (keep: boolean) => void;
}

/**
 * Settings → Security. Controls whether camera metadata (EXIF — GPS, capture
 * time, lens) is kept or stripped on export. A real, persisted preference (saved
 * via the footer Apply, synced to Convex); applies to Export, Export All, and
 * Export Selected. Matches the toggle style of the other Settings tabs.
 */
export function SecurityPane({ value, onChange }: SecurityPaneProps) {
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
    </div>
  );
}
