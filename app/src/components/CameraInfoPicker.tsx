// "Camera info: Keep all · Remove location · Remove all" — the export choice
// (Night 11-21, 231, ADR-108), shown in the Export dialog's Selected and All
// panes. It reads and writes the two preferences Settings › Security already
// had (`exifKeep`, `exifStripMode`), so the choice is remembered, syncs, and
// the two places can never disagree.
//
// A recipe that saved its own choice shows it here, locked, because that is
// what its files will carry.
import { Eraser, MapPinOff, Tag } from "lucide-react";
import { ControlRow } from "@/components/ui/control-row";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import {
  CAMERA_INFO_LABEL,
  cameraInfoOf,
  prefsForCameraInfo,
  type CameraInfo,
} from "@/lib/exif/cameraInfo";
import { usePreferences } from "@/lib/preferences";

const OPTIONS = [
  { id: "keep", label: CAMERA_INFO_LABEL.keep, icon: Tag, title: "Keep the date, camera and location the photo was taken with" },
  { id: "location", label: CAMERA_INFO_LABEL.location, icon: MapPinOff, title: "Remove where the photo was taken; keep the date and camera" },
  { id: "all", label: CAMERA_INFO_LABEL.all, icon: Eraser, title: "Remove the date, camera and location" },
] as const;

const SAYS: Record<CameraInfo, string> = {
  keep: "JPEG and WebP files keep the date, camera and location.",
  location: "No location. The date and camera stay.",
  all: "No date, camera or location.",
};

export function CameraInfoPicker({
  recipeChoice,
  variant = "row",
}: {
  recipeChoice?: CameraInfo;
  /** `section` in the Export dialog, where it is one of the pane's sections. */
  variant?: "row" | "section";
}) {
  const [prefs, applyPrefs] = usePreferences();
  const value = recipeChoice ?? cameraInfoOf(prefs);
  return (
    <ControlRow label="Camera Info" variant={variant}>
      {({ labelId }) => (
        <div className="space-y-1">
          <ToolButtonGroup<CameraInfo>
            aria-labelledby={labelId}
            columns={3}
            value={value}
            disabled={recipeChoice !== undefined}
            onChange={(c) => applyPrefs({ ...prefs, ...prefsForCameraInfo(c, prefs.exifStripMode) })}
            options={OPTIONS}
          />
          <p data-testid="camera-info-says" className="text-2xs text-theme-muted-foreground">
            {recipeChoice !== undefined ? `Saved with the recipe. ${SAYS[value]}` : SAYS[value]}
          </p>
        </div>
      )}
    </ControlRow>
  );
}
