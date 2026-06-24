import { Monitor, Moon, Sun, Sparkles, Accessibility } from "lucide-react";
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
  /** Reduce-motion draft (same Apply/Save flow as the theme). */
  reduceMotion: boolean;
  onReduceMotionChange: (reduceMotion: boolean) => void;
}

/**
 * Settings → Appearance pane. Real, persisted preferences (saved via the footer
 * Apply, synced to Convex). Theme drives the live `.dark` class on <html>
 * (`usePreferences` → `useTheme`); Reduce motion toggles a `.reduce-motion`
 * class + a framer-motion MotionConfig so animations are minimized.
 */
export function AppearancePane({
  value,
  onChange,
  reduceMotion,
  onReduceMotionChange,
}: AppearancePaneProps) {
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

      {/* ── Reduce motion — below Theme, same toggle style ─────────────────── */}
      <div className="pt-2">
        <h3 className="text-sm font-semibold text-text-primary">Motion</h3>
        <p className="mt-1 text-xs leading-relaxed text-text-muted">
          Minimize animations — panel slides, fades and transitions — for a
          calmer, faster interface. Helpful if motion bothers you.
        </p>
      </div>
      <ToggleButtonGroup
        fill
        items={[
          {
            key: "full",
            icon: Sparkles,
            label: "Animations",
            active: !reduceMotion,
            onToggle: () => onReduceMotionChange(false),
          },
          {
            key: "reduced",
            icon: Accessibility,
            label: "Reduce motion",
            active: reduceMotion,
            onToggle: () => onReduceMotionChange(true),
          },
        ]}
      />
    </div>
  );
}
