import { useId } from "react";
import { Tag, MapPinOff, Eraser, Laptop, Cloud } from "lucide-react";
import { ToggleButtonGroup } from "@/components/ui/toggle-button-group";
import type { MetadataStripMode } from "@/lib/exif";
import { LIVE_SUB_TOOLS } from "@/features/tools/toolGroups";
import { SWITCHED_PATHS, UNSWITCHED_PATHS, type NetworkPath } from "@/lib/networkPaths";

/** The sub-tools behind the registry's `ai_processing` entry — each carries
 *  `requiresNetwork` in toolGroups.ts. Not a second list: it is how that one
 *  registry entry is spelled out by name, and networkPaths.test.ts pins that
 *  every `requiresNetwork` tool is covered by it. */
const NETWORK_SUB_TOOLS = LIVE_SUB_TOOLS.filter((r) => r.subTool.requiresNetwork);

/** "(when signed in)" and friends: why an unswitched path runs at all. */
function unswitchedWhy(p: NetworkPath): string {
  if (p.gate === "own-toggle") return ` It has its own switch, in ${p.toggle}.`;
  if (p.gate === "signed-in") return " Only when you are signed in.";
  return "";
}

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
            Off — the default — your photos stay in this tab unless you make
            a share link (see below). Opening,
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
          {/* Rendered from shared/networkPaths.ts — the one list of what
              reaches a server, which the switch itself asks. There is no
              hand-written bullet here any more: the #223 bug was a switch that
              gated a list this page did not show. The AI tools entry is spelled
              out as the sub-tools it covers, by name. */}
          <ul
            data-testid="security-switched"
            className="mt-0.5 list-disc space-y-0.5 pl-4 text-2xs leading-relaxed text-text-muted"
          >
            {SWITCHED_PATHS.flatMap((p) =>
              p.id === "ai_processing"
                ? NETWORK_SUB_TOOLS.map(({ group, subTool, key }) => (
                    <li key={key} data-path={p.id}>
                      <strong>
                        {group.label} › {subTool.label}
                      </strong>{" "}
                      — {subTool.description.toLowerCase()}; {p.sends}.
                    </li>
                  ))
                : [
                    <li key={p.id} data-path={p.id}>
                      <strong>{p.label}</strong> — {p.sends}.
                    </li>,
                  ],
            )}
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
          {/* Everything in the registry that runs whatever this switch says.
              Listed rather than summarized, so "off" can never be read as
              "nothing reaches a server" — it is exactly what the registry
              says, including the ones that are not flattering. */}
          <ul
            data-testid="security-unswitched"
            className="mt-0.5 list-disc space-y-0.5 pl-4 text-2xs leading-relaxed text-text-muted"
          >
            {UNSWITCHED_PATHS.map((p) => (
              <li key={p.id} data-path={p.id}>
                <strong>{p.label}</strong> — {p.sends}.{unswitchedWhy(p)}
              </li>
            ))}
          </ul>
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
