// The photo transfer, on both devices and in both directions (ADR-105,
// "Sending"): the receiver's "<device> wants to send 4 photos (18 MB)" with
// Accept / Decline, then progress per photo and overall with Cancel, then how
// it ended. The sender sees the same dialog from its side. Mounted by
// PairHost, so it works in every layout, the phone's included.
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { acceptIncoming, cancelTransfer, declineIncoming } from "./sendController";
import { usePairStore } from "./pairStore";
import { usePairSendStore } from "./sendStore";
import { transferLines, type Bar } from "./transferView";

function ProgressBar({ bar, testId }: { bar: Bar; testId: string }) {
  return (
    <div className="space-y-1">
      <p className="truncate text-xs text-text-secondary">{bar.label}</p>
      <div
        role="progressbar"
        aria-label={bar.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={bar.percent}
        data-testid={testId}
        className="h-1.5 overflow-hidden rounded-full bg-bg-tertiary"
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${bar.percent}%` }} />
      </div>
    </div>
  );
}

export function PairTransferDialog() {
  const view = usePairSendStore((s) => s.view);
  const clear = usePairSendStore((s) => s.clear);
  const role = usePairStore((s) => s.role);
  if (!view || !role) return null;
  const lines = transferLines(view, role);
  const asking = lines.accept !== undefined;

  const onOpenChange = (open: boolean) => {
    if (open) return;
    // Escape on the question is a No; once moving, only Cancel stops it.
    if (asking) declineIncoming();
    else if (lines.ended) clear();
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        size="default"
        data-testid="pair-transfer"
        data-dir={view.dir}
        data-phase={view.phase}
        data-outcome={view.end?.outcome}
        onInteractOutside={(e) => {
          // A stray tap outside must not answer or close it.
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle data-testid="pair-transfer-title">{lines.title}</DialogTitle>
          <DialogDescription className={lines.body.length ? undefined : "sr-only"}>
            {lines.body.length ? lines.body[0] : view.dir === "in" ? "Photos from your paired device." : "Photos to your paired device."}
          </DialogDescription>
        </DialogHeader>
        {(lines.body.length > 1 || lines.file || lines.total) && (
          <DialogBody className="space-y-3" aria-live="polite">
            {lines.body.length > 1 && (
              <ul className="space-y-1 text-xs text-text-secondary" data-testid="pair-transfer-notes">
                {lines.body.slice(1).map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            )}
            {lines.file && <ProgressBar bar={lines.file} testId="pair-progress-file" />}
            {lines.total && <ProgressBar bar={lines.total} testId="pair-progress-total" />}
          </DialogBody>
        )}
        <DialogFooter>
          {asking && (
            <>
              <Button size="default" variant="secondary" onClick={() => declineIncoming()}>
                Decline
              </Button>
              <Button size="default" onClick={() => acceptIncoming()}>
                {lines.accept}
              </Button>
            </>
          )}
          {lines.cancel && (
            <Button size="default" variant="secondary" onClick={() => cancelTransfer()}>
              Cancel
            </Button>
          )}
          {lines.ended && (
            <Button size="default" onClick={() => clear()}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
