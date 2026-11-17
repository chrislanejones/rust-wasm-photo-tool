// The computer's "Pair a phone" dialog (ADR-105): a QR code good for 5
// minutes and one phone, a countdown, Copy link, then "Connected". Closing it
// before a phone connects ends the attempt; closing it once connected keeps
// the connection, which the next PR sends photos over.
import { Suspense, lazy, useEffect, useState } from "react";
import { CheckCircle2, Copy, RefreshCw, Smartphone } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { useCloudAuth } from "@/lib/cloud";
import { useTransferBeta } from "@/features/transfer/useTransfer";
import { useTransferStore } from "@/features/transfer/transferStore";
import { NO_SERVER_LINE, ONLINE_OFF_LINE, computerLine, countdown, isEnded } from "./messages";
import { startHosting, stopPairing } from "./pairController";
import { usePairStore } from "./pairStore";
import type { PairSignaling } from "./signaling";
import { usePairAvailability } from "./usePair";

const QrCode = lazy(() => import("./QrCode"));

/** A clock that ticks once a second while `on`. */
function useNow(on: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [on]);
  return now;
}

export function PairDialog({ signaling }: { signaling: PairSignaling | null }) {
  const open = usePairStore((s) => s.dialogOpen);
  const setOpen = usePairStore((s) => s.setDialogOpen);
  const role = usePairStore((s) => s.role);
  const status = usePairStore((s) => (s.role === "phone" ? "idle" : s.status));
  const link = usePairStore((s) => s.link);
  const expiresAt = usePairStore((s) => s.expiresAt);
  const availability = usePairAvailability(signaling);
  const now = useNow(open && status === "waiting");

  // Opening the dialog makes a code, unless a phone is already connected (or
  // this tab is the phone side of a pairing).
  useEffect(() => {
    if (!open || availability !== "ready" || !signaling) return;
    if (role === "phone") return;
    if (usePairStore.getState().status === "idle") startHosting(signaling);
  }, [open, availability, signaling, role]);

  const onOpenChange = (next: boolean) => {
    // A code nobody has used yet is not left open behind a closed dialog.
    if (!next && role === "computer" && status !== "connected") stopPairing();
    setOpen(next);
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied. Open it on your phone.");
    } catch {
      toast.error("Couldn't copy the link. Scan the code instead.");
    }
  };

  const line = computerLine(status);
  const msLeft = expiresAt ? expiresAt - now : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default" data-testid="pair-dialog">
        <DialogHeader>
          <DialogTitle>Pair a phone</DialogTitle>
          <DialogDescription>
            Connect your phone straight to this browser. No account needed, and photos don&rsquo;t go through a server.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col items-center gap-3 text-center">
          {availability === "online-off" ? (
            <p className="text-sm text-text-secondary" role="status" data-testid="pair-off">
              {ONLINE_OFF_LINE} Turn on online features in Settings &rsaquo; Security to pair.
            </p>
          ) : availability === "no-server" ? (
            <p className="text-sm text-text-secondary" role="status">
              {NO_SERVER_LINE}
            </p>
          ) : (
            <>
              {status === "waiting" && link ? (
                <Suspense fallback={<div className="h-56 w-56 rounded-md bg-bg-tertiary" aria-hidden="true" />}>
                  <QrCode text={link} />
                </Suspense>
              ) : status === "connected" ? (
                <CheckCircle2 className="h-12 w-12 text-success" aria-hidden="true" />
              ) : status === "starting" || status === "connecting" || status === "idle" ? (
                <Spinner size={28} aria-hidden="true" />
              ) : (
                <Smartphone className="h-12 w-12 text-text-muted" aria-hidden="true" />
              )}
              <div className="space-y-1" role="status" aria-live="polite" data-testid="pair-status" data-status={status}>
                <p className="text-sm font-semibold text-text-primary">{line.title}</p>
                {line.body && <p className="text-xs text-text-secondary">{line.body}</p>}
                {status === "waiting" && (
                  <p className="text-xs text-text-muted" data-testid="pair-countdown">
                    Expires in {countdown(msLeft)}
                  </p>
                )}
              </div>
              {status === "unreachable" && <TransferInstead />}
            </>
          )}
        </DialogBody>
        <DialogFooter>
          {status === "waiting" && link && (
            <Button size="default" onClick={() => void copy()}>
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              Copy link
            </Button>
          )}
          {availability === "ready" && signaling && isEnded(status) && (
            <Button size="default" onClick={() => startHosting(signaling)}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              New code
            </Button>
          )}
          {status === "connected" && (
            <Button size="default" onClick={() => stopPairing()}>
              Disconnect
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** When the two cannot reach each other directly: a signed-in user with the
 *  Transfer Beta can send through the 7-day inbox instead (ADR-102). */
function TransferInstead() {
  const { isAuthenticated } = useCloudAuth();
  const transfer = useTransferBeta();
  if (!isAuthenticated || !transfer) return null;
  return (
    <Button
      size="default"
      onClick={() => {
        stopPairing();
        usePairStore.getState().setDialogOpen(false);
        useTransferStore.getState().setInboxOpen(true);
      }}
    >
      Use the Transfer inbox instead
    </Button>
  );
}
