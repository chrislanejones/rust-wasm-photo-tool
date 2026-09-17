// Settings → Dev Tests. A small harness to open dialogs in isolation so they
// can be previewed/tweaked without having to trigger their real conditions
// (an actual idle timeout).
import { useState } from "react";
import { MonitorPause } from "lucide-react";
import { IdleScreenDialog } from "@/components/IdleScreenDialog";

// Declared at module scope, not inside DevTestsPane: a component defined during
// render gets a fresh type identity every render, so React unmounts and remounts
// the whole subtree each time. Row closes over nothing from the parent (icon,
// label and onClick all arrive as props), so hoisting is a pure move.
const Row = ({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof MonitorPause;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full items-center gap-3 rounded-lg border border-border bg-bg-elevated px-4 py-3 text-left text-sm font-medium text-text-primary transition-colors hover:bg-bg-elevated/70"
  >
    <Icon className="h-4 w-4 shrink-0 text-text-secondary" />
    <span className="flex-1">{label}</span>
    <span className="text-2xs text-text-muted">Open</span>
  </button>
);

export function DevTestsPane() {
  const [idleOpen, setIdleOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">Dev Tests</h3>
        <p className="mt-1 text-xs text-text-secondary">
          Open dialogs in isolation to preview and tweak them without triggering
          their real conditions.
        </p>
      </div>

      <div className="space-y-2">
        <Row
          icon={MonitorPause}
          label="Idle Screen"
          onClick={() => setIdleOpen(true)}
        />
      </div>

      <IdleScreenDialog
        open={idleOpen}
        dismissible
        onContinue={() => setIdleOpen(false)}
      />
    </div>
  );
}
