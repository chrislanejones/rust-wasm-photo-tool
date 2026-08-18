// The Perspective TOOL's panel (v8.42).
//
// THREE MODES, ONE QUAD. This is the distinction the panel exists to make
// legible: Distort, Perspective and Skew are not three tools with three
// geometries — they are one four-corner quad and three different rules about
// what happens to the OTHER corners when you drag one. The rules themselves
// live in `lib/perspective.ts` (`dragCorner` / `dragEdge`) and are unit-tested
// there; this file is the picker and the two commit actions.
//
//   Distort     — the corner you grabbed moves and nothing else does. Full
//                 projective freedom, and the only mode that can produce a
//                 quad the other two cannot.
//   Perspective — the dragged corner's edge partner mirrors it, so the edge
//                 narrows or widens about its own centre and the shape stays a
//                 symmetric trapezoid. This is the keystone gesture; doing it
//                 by eye in Distort is fiddly, which is why it has its own
//                 mode rather than being a modifier key.
//   Skew        — the whole edge slides along its own axis. Opposite edges
//                 stay parallel, so it is a shear, not a perspective.
//
// TWO TARGETS, ONE GESTURE. With a text or shape annotation selected the quad
// warps THAT, non-destructively: the engine stores the corners on the
// annotation (normalised, so they survive an edit) and re-renders through them.
// With nothing selected the quad warps the PIXELS under it, which is
// destructive and lands as one "Perspective" step in Review → History. The
// panel says which is about to happen rather than making the user infer it
// from what they last clicked.
//
// Layout follows the house template exactly — the sub-mode tiles are drawn by
// SubtoolRow in the ToolsSidebar header (via toolModes.ts `modesFor()`), and
// what remains here is ToolModeToggle's title + lightbulb + body. Do not fork
// it, and do not add a permanent explanatory paragraph: descriptions go in the
// lightbulb.
import { Check, Move3d, RotateCcw, Scan, SquareDashedBottom } from "lucide-react";
import { ToolButton } from "@/components/ui/tool-button";
import { ToolModeToggle } from "@/components/ui/tool-mode-toggle";
import type { ToolMode } from "@/components/ui/tool-mode-toggle";
import { SectionHeader } from "@/components/ui/section-header";
import { useToolStore } from "@/stores/useToolStore";
import { usePerspectiveStore } from "@/stores/usePerspectiveStore";
import type { PerspectiveMode } from "@/stores/useToolStore";

/** The three drag rules, as the registry / palette / SubtoolRow consume them.
 *
 *  `info` is kept a plain STRING here for the same reason SELECT_MODES does:
 *  `toolModes.ts` `modesFor()` uses a string info as palette search terms, and
 *  a ReactNode would silently stop being searchable. */
export const PERSPECTIVE_MODES: readonly (ToolMode<PerspectiveMode> & {
  info: string;
})[] = [
  {
    id: "perspective",
    label: "Perspective",
    icon: Scan,
    info: "Drag a corner and its neighbour mirrors it, so the edge narrows about its centre. This is the keystone — the gesture that makes a flat thing sit on a receding surface.",
  },
  {
    id: "distort",
    label: "Distort",
    icon: Move3d,
    info: "Drag any corner anywhere. The other three stay put — full freedom, and the only mode that reaches shapes the other two can't.",
  },
  {
    id: "skew",
    label: "Skew",
    icon: SquareDashedBottom,
    info: "Slide a whole edge along its own axis. Opposite edges stay parallel, so this shears rather than adding depth.",
  },
];

/**
 * Reads its state straight from `usePerspectiveStore` rather than taking a
 * controls prop, which is why wiring this tool needed no AppShell change at
 * all. The overlay, this panel and the engine hook are in three different
 * subtrees; the store note explains the trade-off in full.
 */
export function PerspectiveSettings({ disabled }: { disabled: boolean }) {
  const mode = useToolStore((s) => s.perspectiveMode);
  const setMode = useToolStore((s) => s.setPerspectiveMode);
  const dirty = usePerspectiveStore((s) => s.dirty);
  const valid = usePerspectiveStore((s) => s.valid);
  const targetLabel = usePerspectiveStore((s) => s.targetLabel);
  const api = usePerspectiveStore((s) => s.api);

  const vector = targetLabel !== null;
  // `api` is null whenever the canvas hook is not mounted. Disabling on it is
  // not defensive padding — it is the honest state, and the alternative is a
  // button that silently does nothing.
  const ready = api !== null;
  return (
    <div className="space-y-4">
      {/* showModeRow: Perspective is the ONE panel that draws its own mode
          row. Chris asked for Edit → Perspective → perspective | distort |
          skew (2026-08-17), i.e. one sidebar tile and the three rules chosen
          here. That is a deliberate divergence from Paint/Select/Stamp, whose
          modes are sibling tiles in SubtoolRow — the prop's own note warns
          against exactly this drift, so it is recorded in ADR-034 rather than
          left as a surprise. Do not copy it to another panel without the
          same explicit ask. */}
      <ToolModeToggle
        modes={PERSPECTIVE_MODES}
        showModeRow
        columns={3}
        activeMode={mode}
        onModeChange={setMode}
        disabled={disabled}
      >
        {() => (
          <>
            {/* WHAT IS ABOUT TO BE TRANSFORMED. One line, not a paragraph —
                but it earns its place: the same drag is non-destructive on an
                annotation and destructive on pixels, and nothing else on
                screen distinguishes the two. */}
            <div className="flex items-center gap-2 text-xs text-theme-sidebar-muted">
              <span
                aria-hidden
                className={
                  vector
                    ? "inline-block h-2 w-2 rounded-full bg-emerald-500"
                    : "inline-block h-2 w-2 rounded-full bg-rose-500"
                }
              />
              {vector ? (
                <span>
                  Warping <strong>{targetLabel}</strong> — stays editable
                </span>
              ) : (
                <span>Warping pixels — this one is destructive</span>
              )}
            </div>
          </>
        )}
      </ToolModeToggle>

      {/* Actions sit OUTSIDE the ToolModeToggle body so they don't re-animate
          on every mode switch — same placement rule as SelectSettings. */}
      <div className="space-y-2 border-t border-theme-sidebar-border pt-3">
        <SectionHeader
          title="Transform"
          info={
            <>
              Drag the corner handles to shape the quad, or an edge handle to
              move a whole side. <kbd>Esc</kbd> resets it. Apply commits the
              warp and adds one <em>Perspective</em> step to Review → History,
              where you can re-select it to pick the quad back up.
            </>
          }
        />
        <div className="grid grid-cols-2 gap-2">
          <ToolButton
            stacked
            disabled={disabled || !ready || !dirty || !valid}
            onClick={() => void api?.apply()}
            title={
              !valid
                ? "The corners cross — untangle the quad first"
                : "Apply the perspective transform"
            }
          >
            <Check /> Apply
          </ToolButton>
          <ToolButton
            stacked
            disabled={disabled || !ready || !dirty}
            onClick={() => api?.reset()}
            title="Reset the quad to a rectangle (Esc)"
          >
            <RotateCcw /> Reset
          </ToolButton>
        </div>
      </div>
    </div>
  );
}
