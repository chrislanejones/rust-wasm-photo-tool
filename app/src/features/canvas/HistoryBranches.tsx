import { GitBranch } from "lucide-react";
import { ReselectBar } from "@/components/ui/reselect-bar";
import { TinyNumberBox } from "@/components/ui/tiny-number-box";
import { useHistoryBranchStore } from "@/stores/useHistoryBranchStore";

/**
 * Beta "history forks" (ADR-086): the timelines you undid and then edited
 * away from, listed under History in the Review panel.
 *
 * Renders NOTHING when there are no branches, which is always with the Beta
 * off and most of the time with it on. Not a fifth panel section, because it
 * is not a fifth kind of thing: it is history, on a path you walked away from.
 *
 * Keyboard: every row is a ReselectBar — Tab to reach it, Enter/Space to go
 * there, Delete/Backspace to forget it; its ✕ is revealed on focus as well as
 * hover. The list is a labeled group so a screen reader hears what it is.
 */
export function HistoryBranches() {
  const branches = useHistoryBranchStore((s) => s.branches);
  const actions = useHistoryBranchStore((s) => s.actions);
  if (branches.length === 0 || !actions) return null;

  return (
    <div className="history-branches flex min-h-0 flex-col border-t border-border" data-testid="history-branches">
      <div className="review-section-head text-theme-muted-foreground">
        <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="review-section-name" id="history-branches-heading">
          Time Machine
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <TinyNumberBox>{branches.length}</TinyNumberBox>
        </div>
      </div>
      {/* Height-capped in styles.css (`.history-branches .history-list`) so
          the linear list above is never pushed off screen. */}
      <div className="history-list" role="group" aria-label="Alternative history timelines">
        {branches.map((b) => {
          const steps = `${b.steps} step${b.steps === 1 ? "" : "s"}`;
          return (
            <ReselectBar
              key={b.id}
              type="redo"
              index={b.steps}
              label={b.label}
              onSelect={() => void actions.restore(b.id)}
              onDelete={() => void actions.forget(b.id)}
              deleteLabel="Forget this timeline"
              title={`Go to: ${b.label}, ${steps}${
                b.nested ? ", branched off another timeline" : ""
              }. Where you are now is kept as a timeline too.`}
            />
          );
        })}
      </div>
    </div>
  );
}
