import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { SizeSlider } from "@/components/SizeSlider";
import { LargeButton } from "@/components/ui/large-button";
import { ToggleButtonGroup } from "@/components/ui/toggle-button-group";
import { MAX_HISTORY_MIN, MAX_HISTORY_MAX } from "@/lib/preferences";

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
export interface GeneralControls {
  /** Currently-applied (and persisted) undo depth. */
  maxHistory: number;
  /** Apply a new undo depth → WASM engine + persist. */
  onApplyMaxHistory: (n: number) => void;
  /** Idle timeout in minutes (0 = never). */
  idleTimeoutMin: number;
  /** Change the idle timeout → persist + re-arm. */
  onSetIdleTimeout: (min: number) => void;
}

const IDLE_OPTIONS: { min: number; label: string }[] = [
  { min: 15, label: "15 min" },
  { min: 30, label: "30 min" },
  { min: 60, label: "60 min" },
  { min: 0, label: "Never" },
];

export function GeneralPane({
  maxHistory,
  onApplyMaxHistory,
  idleTimeoutMin,
  onSetIdleTimeout,
}: GeneralControls) {
  // Draft slider value; only committed to the engine on Apply & Save.
  const [draft, setDraft] = useState(maxHistory);
  useEffect(() => setDraft(maxHistory), [maxHistory]);
  const dirty = draft !== maxHistory;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Undo history</h3>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            How many undo steps the editor keeps. Higher = more undo, but more
            memory. Applies to the WASM engine and trims immediately if lowered.
          </p>
        </div>
        <SizeSlider
          label="History depth"
          value={draft}
          onChange={setDraft}
          min={MAX_HISTORY_MIN}
          max={MAX_HISTORY_MAX}
          step={50}
          unit=" steps"
        />
        <LargeButton onClick={() => onApplyMaxHistory(draft)} disabled={!dirty}>
          {dirty ? `Apply & Save (${draft})` : "Saved"}
        </LargeButton>
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
            active: idleTimeoutMin === min,
            onToggle: () => onSetIdleTimeout(min),
          }))}
        />
      </section>
    </div>
  );
}
