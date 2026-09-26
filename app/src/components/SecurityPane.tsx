import { useId } from "react";
import { Tag, MapPinOff, Eraser, Laptop, Cloud } from "lucide-react";
import { ToggleButtonGroup } from "@/components/ui/toggle-button-group";
import type { MetadataStripMode } from "@/lib/exif";
import { LIVE_SUB_TOOLS } from "@/features/tools/toolGroups";

/** Every sub-tool that sends the image off the machine. */
const NETWORK_SUB_TOOLS = LIVE_SUB_TOOLS.filter((r) => r.subTool.requiresNetwork);

interface SecurityPaneProps {
  /** Keep EXIF metadata on export (true) or strip it (false). */
  value: boolean;
  onChange: (keep: boolean) => void;
  /** When `value` is false (stripping), how aggressively: 'all' (default —
   *  the original full scrub) or 'location' (GPS only, camera/lens kept). */
  stripMode: MetadataStripMode;
  onStripModeChange: (mode: MetadataStripMode) => void;
  /** `useUIStore.onlineFeaturesEnabled` — the SAME switch the New dialog
   *  shows, not a copy of its value. */
  onlineFeatures: boolean;
  onOnlineFeaturesChange: (on: boolean) => void;
  /** `useUIStore.aiComposerOpen` — the New dialog is inside the Create AI
   *  Image step, so this control is locked exactly as that dialog's is. */
  onlineFeaturesLocked: boolean;
}

/**
 * Settings → Security. Two independent controls:
 *
 * 1. **Everything in your browser** — the New dialog's online-features switch,
 *    shown again with room to explain itself.
 * 2. **Export metadata (EXIF)** — whether camera metadata (GPS, capture time,
 *    lens) survives an export.
 *
 * ⚠️ THE TWO CONTROLS COMMIT DIFFERENTLY, and that asymmetry is deliberate.
 * EXIF is a `Preferences` field: it edits the Settings draft and lands on the
 * footer's Apply, like every other pane. Online features is
 * `useUIStore.onlineFeaturesEnabled` and writes IMMEDIATELY, because the
 * requirement is that this control and the New dialog's switch mirror each
 * other. Routing it through the draft would break that twice over — the two
 * would disagree until Apply, and an Apply would clobber a change the New
 * dialog made in the meantime. One switch, one piece of state, read and
 * written in two places.
 */
export function SecurityPane({
  value,
  onChange,
  stripMode,
  onStripModeChange,
  onlineFeatures,
  onOnlineFeaturesChange,
  onlineFeaturesLocked,
}: SecurityPaneProps) {
  const onlineId = useId();
  const exifId = useId();
  const scopeId = useId();
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 id={onlineId} className="text-sm font-semibold text-text-primary">
            Everything in your browser
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            Off — the default — your photos never leave this tab. Opening,
            editing, compressing and exporting all run on your own machine in
            WebAssembly, and your images, edits and gallery are stored in this
            browser. On adds the features whose job is to send something out.
            The same switch sits in the New dialog; changing it in either place
            changes it in both.
          </p>
        </div>
        <ToggleButtonGroup
          fill
          mode="select"
          aria-labelledby={onlineId}
          items={[
            {
              key: "local",
              icon: Laptop,
              label: "In your browser",
              active: !onlineFeatures,
              disabled: onlineFeaturesLocked,
              onToggle: () => onOnlineFeaturesChange(false),
            },
            {
              key: "online",
              icon: Cloud,
              label: "Online features",
              active: onlineFeatures,
              disabled: onlineFeaturesLocked,
              onToggle: () => onOnlineFeaturesChange(true),
            },
          ]}
        />
        {onlineFeaturesLocked && (
          <p className="pl-1 text-2xs leading-relaxed text-text-muted">
            Locked while the New dialog is writing an AI prompt — switching now
            would close that step and lose the prompt. Hit Back there first.
          </p>
        )}
        <div className="pl-1">
          <h4 className="text-xs font-semibold text-text-secondary">
            What "on" turns on
          </h4>
          {/* Built from `requiresNetwork` (toolGroups.ts), the one list of
              what leaves the tab — so this page cannot promise less than the
              app does. Create AI Image isn't a sub-tool, so it's named here. */}
          <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-2xs leading-relaxed text-text-muted">
            <li>
              <strong>Create AI Image</strong> in the New dialog — your prompt
              and any images you attach go to a generation server.
            </li>
            <li>
              <strong>Your edits, backed up to your account</strong> — signed
              in, a flattened copy of each edited photo is kept on the server so
              another device can pick it up. Off, the copy stays in this browser
              and nothing is uploaded.
            </li>
            {NETWORK_SUB_TOOLS.map(({ group, subTool, key }) => (
              <li key={key}>
                <strong>
                  {group.label} › {subTool.label}
                </strong>{" "}
                — {subTool.description.toLowerCase()}; the image goes to a server.
              </li>
            ))}
          </ul>
          <p className="mt-1 text-2xs leading-relaxed text-text-muted">
            Off, those are grayed out and nothing is uploaded. Tools that run on
            your machine, like Magic Eraser, stay available either way. Deleting
            a copy you already uploaded still works with the switch off — it
            sends nothing and it is how you take something back.
          </p>
          <h4 className="mt-2 text-xs font-semibold text-text-secondary">
            What it does not cover
          </h4>
          <p className="mt-0.5 text-2xs leading-relaxed text-text-muted">
            Anonymous usage analytics — page views and feature counts — load on
            every visit either way, and set cookies. Your images, edits and
            filenames are never part of that.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 id={exifId} className="text-sm font-semibold text-text-primary">
            Export metadata (EXIF)
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            Keep your camera metadata — GPS, capture time, lens — embedded in
            exported JPEG / WebP files, or strip it for privacy before an image
            ever leaves the tab. Applies to Export, Export All, and Export
            Selected.
          </p>
        </div>
        <ToggleButtonGroup
          fill
          mode="select"
          aria-labelledby={exifId}
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
            <h4 id={scopeId} className="text-xs font-semibold text-text-secondary">
              Strip scope
            </h4>
            <p className="mt-0.5 text-2xs leading-relaxed text-text-muted">
              "All" removes EXIF, GPS, maker notes, and XMP/IPTC. "Location only"
              removes just GPS — camera, lens, and timestamp survive.
            </p>
            <div className="mt-2">
              <ToggleButtonGroup
                fill
                mode="select"
                aria-labelledby={scopeId}
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
      </section>
    </div>
  );
}
