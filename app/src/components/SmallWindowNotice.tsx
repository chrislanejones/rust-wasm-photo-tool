import { Maximize2 } from "lucide-react";

interface Props {
  onDismiss: () => void;
}

/**
 * Shown only below BP_MIN (~600px). Image Horse is a single canvas-centric
 * workspace and genuinely needs room, so rather than forking a second layout we
 * surface a dismissible nudge (not a hard block): widen the window for the full
 * workspace, or continue anyway. Reappears if the window shrinks below BP_MIN
 * again after being dismissed.
 */
export function SmallWindowNotice({ onDismiss }: Props) {
  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <div className="max-w-xs rounded-2xl border border-border bg-card p-6 text-center shadow-panel">
        <Maximize2 className="mx-auto h-8 w-8 text-text-muted" />
        <h2 className="mt-3 text-base font-semibold text-text-primary">
          A little more room, please
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
          Image Horse needs a wider window to edit comfortably. Widen the window
          — or unsnap it — for the full workspace.
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-4 w-full rounded-lg border border-border bg-bg-elevated px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-elevated/70"
        >
          Continue anyway
        </button>
      </div>
    </div>
  );
}
