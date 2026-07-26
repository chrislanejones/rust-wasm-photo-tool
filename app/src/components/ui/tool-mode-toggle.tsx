// ===== FILE: app/src/components/ui/tool-mode-toggle.tsx =====
// Shared "multi-mode tool panel" template.
//
// NEW-UI-TOOLBAR ARC — THE ICON ROW MOVED OUT. This component used to own the
// stacked sub-mode tiles at the top of every multi-mode panel. Those tiles are
// now `SubtoolRow` in the ToolsSidebar header (features/tools/SubtoolRow.tsx),
// so what's left here is the per-mode title + lightbulb + animated body swap.
//
// `showModeRow` is a MIGRATION SHIM, not a feature. It defaults to false (the
// hoisted world). Pass `showModeRow` only where a panel renders somewhere the
// header row can't reach it — today that is nowhere, and the prop should be
// deleted outright once that stays true through a release. Do NOT reach for it
// to "keep the old look" in one panel: two panels disagreeing about where their
// sub-modes live is exactly the drift this arc removed.
//
// Everything else is unchanged: styling composes 100% from existing primitives
// (`ToolButtonGroup` / `ToolButton` carry the HOVER_RING SSOT in lib/styles.ts
// and the focus-visible keyboard ring), and the AnimatePresence
// key={activeMode} body swap is the same one Paint shipped with.
import { AnimatePresence, motion } from "framer-motion";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import type { ToolButtonOption } from "@/components/ui/tool-button-group";
import { SectionHeader } from "@/components/ui/section-header";
import { settingsPanelMotion } from "@/lib/animations";
import { cn } from "@/lib/utils";

/** One sub-mode of a multi-mode tool (e.g. Paint's paint / blur / pen /
 *  erase). Extends the ToolButtonGroup option (id, label, icon) with the
 *  panel-body header bits. The `icon` is now ALSO what SubtoolRow draws in the
 *  header, via toolModes.ts `modesFor()` — so a mode without an icon renders a
 *  two-letter fallback tile. Give every mode an icon. */
export interface ToolMode<T extends string = string>
  extends ToolButtonOption<T> {
  /** SectionHeader title shown while this mode is active. Defaults to `label`
   *  (e.g. Paint's four modes all title === label). */
  title?: string;
  /** SectionHeader lightbulb tooltip — the mode's explanation + shortcuts.
   *  Omit to render the body without a header row. */
  info?: React.ReactNode;
}

export interface ToolModeToggleProps<T extends string> {
  /** The tool's sub-modes. Still required even with the row hoisted: this is
   *  what resolves `activeMode` to its title/info for the header below. */
  modes: readonly ToolMode<T>[];
  activeMode: T;
  onModeChange: (mode: T) => void;
  /** Render the legacy in-panel icon row. Default false — see the shim note. */
  showModeRow?: boolean;
  /** Icon-row grid columns. Only read when `showModeRow`. Default 2. */
  columns?: 2 | 3 | 4 | 5;
  /** Disable the mode tiles (forwarded to ToolButtonGroup). Default false. */
  disabled?: boolean;
  /** Body slot — renders the active mode's settings. Mounted inside the
   *  per-mode `motion.div` (space-y-4), below the SectionHeader, so returning
   *  a fragment of siblings reproduces the pre-extraction DOM exactly. */
  children: (mode: T) => React.ReactNode;
  className?: string;
}

/**
 * Title + body-slot template for multi-mode tool panels (plus the legacy
 * icon-row behind `showModeRow`).
 * Behavior notes (all inherited, none new):
 * - keyboard: in the legacy branch each tile is a real `<button>` (ToolButton)
 *   with the shared `focus-visible` ring. Hoisted, that duty is SubtoolRow's.
 * - motion: `AnimatePresence mode="wait"` + `key={activeMode}` gives the same
 *   exit-then-enter swap the Paint panel had with four conditional divs.
 */
export function ToolModeToggle<T extends string>({
  modes,
  activeMode,
  onModeChange,
  showModeRow = false,
  columns = 2,
  disabled = false,
  children,
  className,
}: ToolModeToggleProps<T>) {
  const active = modes.find((m) => m.id === activeMode);
  return (
    // The `-mt-2` existed to tuck the icon row under the panel's top padding.
    // With the row gone the title would ride too high, so it only applies in
    // the legacy branch.
    <div className={cn("space-y-2.5", showModeRow && "-mt-2", className)}>
      {showModeRow && (
        <ToolButtonGroup
          stacked
          columns={columns}
          options={modes}
          value={activeMode}
          onChange={onModeChange}
          disabled={disabled}
        />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={activeMode}
          {...settingsPanelMotion}
          className="space-y-4"
        >
          {active?.info != null && (
            <SectionHeader
              title={active.title ?? active.label}
              info={active.info}
            />
          )}
          {children(activeMode)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
