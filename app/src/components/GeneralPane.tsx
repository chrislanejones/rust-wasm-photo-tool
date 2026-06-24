import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { SizeSlider } from "@/components/SizeSlider";
import { LargeButton } from "@/components/ui/large-button";
import { ToggleButtonGroup } from "@/components/ui/toggle-button-group";
import { MAX_HISTORY_MIN, MAX_HISTORY_MAX } from "@/lib/preferences";

/**
 * Settings → General pane. App-wide preferences:
 * - Undo history depth (50–1000), applied to the WASM engine via Apply & Save.
 * - Idle screen timeout (drives the "Continue with Image Horse" overlay).
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
