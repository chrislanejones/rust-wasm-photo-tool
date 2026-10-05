// Batch › Main | Exceptions — the one switch every Batch tool shares. Same
// control as the top bar's Tools | Gallery | Review. Logo, Text, Rename and AI
// Rename run on the group that is showing; Crop keeps a crop for each group and
// runs both at once.
import { Images, SquareDashed } from "lucide-react";
import { ToggleButtonGroup } from "@/components/ui/toggle-button-group";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";
import { useBatchGroups } from "./useBatchGroups";

export function BatchGroupToggle({
  photos,
  activePhotoId,
}: {
  photos: PhotoEntry[];
  activePhotoId: string | null;
}) {
  const { groups, hasExceptions, group, stored, setGroup } = useBatchGroups(photos, activePhotoId);
  return (
    <div className="space-y-2">
      <ToggleButtonGroup
        mode="select"
        aria-label="Which photos"
        // Label-only and sized to the words: an even split wraps "Exceptions · 2".
        noIcons
        items={[
          {
            key: "main",
            icon: Images,
            label: `Main · ${groups.main.length}`,
            active: group === "main",
            onToggle: () => setGroup("main"),
          },
          {
            key: "exceptions",
            icon: SquareDashed,
            label: `Exceptions · ${groups.exceptions.length}`,
            active: group === "exceptions",
            onToggle: () => setGroup("exceptions"),
          },
        ]}
      />
      {!hasExceptions && stored === "exceptions" && (
        <p className="text-2xs text-theme-muted-foreground">
          Tick photos in the gallery to make them exceptions.
        </p>
      )}
    </div>
  );
}
