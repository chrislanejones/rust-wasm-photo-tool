import { Clock, History, Frame, Image as ImageIcon } from "lucide-react";
import { SizeSlider } from "@/components/SizeSlider";
import { ToggleButtonGroup } from "@/components/ui/toggle-button-group";
import {
  MAX_HISTORY_MIN,
  MAX_HISTORY_MAX,
  type Preferences,
} from "@/lib/preferences";

/**
 * Settings → General pane. App-wide preferences, persisted via
 * `lib/preferences.ts` (`usePreferences`, localStorage key `image-horse-prefs`):
 * - Undo history depth (50–1000), applied to the WASM engine via Apply & Save.
 * - Idle screen timeout (drives the "Continue with Image Horse" overlay).
 *
 * ── Roadmap (each = add a field on `Preferences` + a control below) ───────────
 * The prefs store + this pane are the foundation; future settings just plug in.
 *
 * • Export defaults ⭐ (highest value — Image Horse is a compression tool first):
 *     default format / quality / EXIF keep-strip. Seed `defaultToolSettings`
 *     + the EXIF policy from prefs on load; the Compress panel owns the live
 *     controls.
 * • Appearance:
 *     - Accent color — the warm #fcdfc2 (`--theme-primary` / `--accent` /
 *       `--ring` in styles.css). Reuse `ColorSwatchGrid` + `useUserColors`; set
 *       the CSS var on `:root`. (First themed var — no theme infra yet.)
 *     - Reduce motion — swap `panelSpacingTransition` / modal+zoom springs for
 *       `{ duration: 0 }`; also honor `matchMedia('prefers-reduced-motion')`.
 *       a11y + slow-machine win; nothing handles it today.
 * • Behavior:
 *     - Confirm before "Delete All" (gate the existing Delete-All dialog).
 *     - Restore last session on launch (edits persist to `image-horse-edits`;
 *       today a reload drops logged-out users back to the upload screen).
 * • Data & privacy (bottom danger-zone, destructive `LargeButton`):
 *     - Clear local data — wipe LS keys `image-horse-user-colors` /
 *       `-recent-texts` and IndexedDB `image-horse-originals` / `-edits`
 *       (`indexedDB.deleteDatabase`).
 *
 * Other tabs (not General): Super User ✓, Plan & Billing ✓; maybe a Shortcuts
 * tab later (mirror `ShortcutModal`). All client-side prefs — not a security
 * boundary. Keep the visual language consistent with `SuperUserPane` (section
 * heading + `space-y-4`, `ToggleButtonGroup` for choices, `LargeButton` actions).
 */
/** AppShell → Settings modal contract: the live prefs + a commit callback. */
export interface GeneralControls {
  /** Currently-applied (and persisted) preferences. */
  current: Preferences;
  /** Commit a full preferences object → WASM engine + localStorage + Convex. */
  onApply: (next: Preferences) => void;
}

interface GeneralPaneProps {
  /** The draft being edited (owned by the Settings modal). */
  value: Preferences;
  /** Patch the draft; the Settings footer's Apply commits it. */
  onChange: (patch: Partial<Preferences>) => void;
}

const IDLE_OPTIONS: { min: number; label: string }[] = [
  { min: 15, label: "15 min" },
  { min: 30, label: "30 min" },
  { min: 60, label: "60 min" },
  { min: 0, label: "Never" },
];

export function GeneralPane({ value, onChange }: GeneralPaneProps) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Undo history</h3>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            How many undo steps the editor keeps. Higher = more undo, but more
            memory. Applied to the WASM engine on Apply (trims immediately if
            lowered).
          </p>
        </div>
        <SizeSlider
          label="History depth"
          value={value.maxHistory}
          onChange={(n) => onChange({ maxHistory: n })}
          min={MAX_HISTORY_MIN}
          max={MAX_HISTORY_MAX}
          step={50}
          unit=" steps"
        />
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Idle screen</h3>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            After this long with no activity, Image Horse dims to a “Continue”
            screen and pauses background work to save CPU. Your edits are kept.
          </p>
        </div>
        <ToggleButtonGroup
          fill
          noIcons
          items={IDLE_OPTIONS.map(({ min, label }) => ({
            key: String(min),
            icon: Clock,
            label,
            active: value.idleTimeoutMin === min,
            onToggle: () => onChange({ idleTimeoutMin: min }),
          }))}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">When you return</h3>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            After you close the tab and come back, reopen your last gallery right
            where you left off — or start with a clean upload. Either way your
            edits stay saved.
          </p>
        </div>
        <ToggleButtonGroup
          fill
          noIcons
          items={[
            {
              key: "reopen",
              icon: History,
              label: "Reopen last session",
              active: value.reopenLastSession,
              onToggle: () => onChange({ reopenLastSession: true }),
            },
            {
              key: "fresh",
              icon: History,
              label: "Start fresh",
              active: !value.reopenLastSession,
              onToggle: () => onChange({ reopenLastSession: false }),
            },
          ]}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Canvas on import
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            How a freshly-opened photo lands. “Canvas + photo” places the image
            on a slightly larger backing canvas as two layers (a Background and
            the Photo on top), Photoshop-style. “Photo only” keeps the classic
            single full-bleed layer at the exact photo size. Applies to new
            imports.
          </p>
        </div>
        <ToggleButtonGroup
          fill
          items={[
            {
              key: "artboard",
              icon: Frame,
              label: "Canvas + photo",
              active: value.canvasArtboard,
              onToggle: () => onChange({ canvasArtboard: true }),
            },
            {
              key: "photo",
              icon: ImageIcon,
              label: "Photo only",
              active: !value.canvasArtboard,
              onToggle: () => onChange({ canvasArtboard: false }),
            },
          ]}
        />
        {value.canvasArtboard && (
          <SizeSlider
            label="Canvas border"
            value={value.canvasPadding}
            onChange={(n) => onChange({ canvasPadding: n })}
            min={0}
            max={200}
            step={5}
            unit=" px"
          />
        )}
      </section>
    </div>
  );
}
