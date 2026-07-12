// ===== FILE: app/src/components/ui/tool-mode-toggle.tsx =====
// Shared "multi-mode tool panel" template — extracted verbatim from the Paint
// panel (the reference implementation of the pattern): a stacked icon-row of
// sub-mode tiles on top, the active mode's title (SectionHeader + lightbulb
// info) below, then the mode's settings body, animated per-mode with the
// shared `settingsPanelMotion`. Every multi-mode tool (Stamps, Shapes, …)
// adopts this in its own migration session — do not fork the layout.
//
// Styling is composed 100% from existing primitives: `ToolButtonGroup` /
// `ToolButton` carry the HOVER_RING SSOT (lib/styles.ts) and the
// focus-visible keyboard ring — nothing is re-invented here.
import { AnimatePresence, motion } from "framer-motion";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import type { ToolButtonOption } from "@/components/ui/tool-button-group";
import { SectionHeader } from "@/components/ui/section-header";
import { settingsPanelMotion } from "@/lib/animations";
import { cn } from "@/lib/utils";

/** One sub-mode of a multi-mode tool (e.g. Paint's paint / blur / pen /
 *  erase). Extends the ToolButtonGroup option (id, label, icon) with the
 *  panel-body header bits. */
export interface ToolMode<T extends string = string>
  extends ToolButtonOption<T> {
  /** SectionHeader title shown below the icon row while this mode is active.
   *  Defaults to `label` (e.g. Paint's four modes all title === label). */
  title?: string;
  /** SectionHeader lightbulb tooltip — the mode's explanation + shortcuts.
   *  Omit to render the body without a header row. */
  info?: React.ReactNode;
}

export interface ToolModeToggleProps<T extends string> {
  /** The tool's sub-modes, rendered as stacked icon-on-top tiles. */
  modes: readonly ToolMode<T>[];
  activeMode: T;
  onModeChange: (mode: T) => void;
  /** Icon-row grid columns (ToolButtonGroup). Default 2 — Paint's 2×2. */
  columns?: 2 | 3 | 4 | 5;
  /** Body slot — renders the active mode's settings. Mounted inside the
   *  per-mode `motion.div` (space-y-4), below the SectionHeader, so returning
   *  a fragment of siblings reproduces the pre-extraction DOM exactly. */
  children: (mode: T) => React.ReactNode;
  className?: string;
}

/**
 * Icon-row + title-below + body-slot template for multi-mode tool panels.
 * Behavior notes (all inherited, none new):
 * - keyboard: each tile is a real `<button>` (ToolButton) with the shared
 *   `focus-visible` ring — the toggle stays keyboard-reachable.
 * - motion: `AnimatePresence mode="wait"` + `key={activeMode}` gives the same
 *   exit-then-enter swap the Paint panel had with four conditional divs.
 */
export function ToolModeToggle<T extends string>({
  modes,
  activeMode,
  onModeChange,
  columns = 2,
  children,
  className,
}: ToolModeToggleProps<T>) {
  const active = modes.find((m) => m.id === activeMode);
  return (
    <div className={cn("space-y-2.5 -mt-2", className)}>
      <ToolButtonGroup
        stacked
        columns={columns}
        options={modes}
        value={activeMode}
        onChange={onModeChange}
      />

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
