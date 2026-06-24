import { Monitor, Moon, Sun } from "lucide-react";
import { ToggleButtonGroup } from "@/components/ui/toggle-button-group";
import type { ThemeChoice } from "@/lib/preferences";

const THEMES: { value: ThemeChoice; label: string; icon: typeof Monitor }[] = [
  { value: "system", label: "System setting", icon: Monitor },
  { value: "dark", label: "Dark mode", icon: Moon },
  { value: "light", label: "Light mode", icon: Sun },
];

interface AppearancePaneProps {
  /** Theme draft (owned by the Settings modal); committed by the footer Apply. */
  value: ThemeChoice;
  onChange: (theme: ThemeChoice) => void;
}

/**
 * Settings → Appearance pane. The choice is a real, persisted preference (saved
 * via the footer Apply, synced to Convex), but it does NOT yet change the app's
 * look — the app is dark-only until theming (CSS vars + `data-theme`) ships.
 */
export function AppearancePane({ value, onChange }: AppearancePaneProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">Theme</h3>
        <p className="mt-1 text-xs leading-relaxed text-text-muted">
          Match your system, or force dark / light. Saved with your settings —
          but preview only for now: the app stays dark until theming ships.
        </p>
      </div>
      <ToggleButtonGroup
        fill
        items={THEMES.map(({ value: v, label, icon }) => ({
          key: v,
          icon,
          label,
          active: value === v,
          onToggle: () => onChange(v),
        }))}
      />
    </div>
  );
}
