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
 * Settings → Appearance pane. A real, persisted preference (saved via the footer
 * Apply, synced to Convex) that drives the live theme: `usePreferences` →
 * `useTheme` toggles the `.dark` class on <html> (light/dark, or "system" which
 * tracks the OS color-scheme live). index.html sets the class pre-paint (no FOUC).
 */
export function AppearancePane({ value, onChange }: AppearancePaneProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">Theme</h3>
        <p className="mt-1 text-xs leading-relaxed text-text-muted">
          Match your system, or force dark / light. Applied on Apply &amp; Save;
          “System” follows your OS setting and updates live.
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
