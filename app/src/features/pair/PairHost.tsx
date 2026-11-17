// Pairing's mount (ADR-105), at the composition root beside CommandPalette:
// App.tsx, not AppShell, which gains nothing. It renders in both layouts and
// outlives the gallery, so a connection is not dropped with a panel.
//
//  - The computer: holds the Pair a phone dialog (Beta `pair`).
//  - The phone: starts the join when this page was opened from a QR code and
//    the online switch allows it. The phone view (MobileShell) shows it in
//    PairPhoneCard; a wider screen opened from the link gets the same card in
//    a dialog.
//  - Either: the online switch turned off ends any attempt at once.
import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useBreakpoint } from "@/lib/useBreakpoint";
import { PairDialog } from "./PairDialog";
import { PairPhoneCard } from "./PairPhoneCard";
import { isPairingActive, startJoining, stopPairing } from "./pairController";
import { usePairStore } from "./pairStore";
import { usePairAvailability, usePairBeta, usePairSignaling } from "./usePair";

export function PairHost() {
  const beta = usePairBeta();
  const signaling = usePairSignaling();
  const availability = usePairAvailability(signaling);
  const invite = usePairStore((s) => s.invite);
  const bp = useBreakpoint();
  const joined = useRef<string | null>(null);

  // "Everything in your browser" switched on: nothing more goes to the server,
  // and an open connection is closed.
  useEffect(() => {
    if (availability === "online-off" && isPairingActive()) {
      stopPairing();
      joined.current = null;
    }
  }, [availability]);

  // The phone: join once per link, as soon as it is allowed.
  useEffect(() => {
    if (invite === null || availability !== "ready" || !signaling) return;
    if (joined.current === invite) return;
    joined.current = invite;
    startJoining(signaling, invite);
  }, [invite, availability, signaling]);

  return (
    <>
      {beta && <PairDialog signaling={signaling} />}
      {invite !== null && !bp.mobile && (
        <Dialog
          open
          onOpenChange={(o) => {
            if (o) return;
            stopPairing();
            usePairStore.getState().setInvite(null);
          }}
        >
          <DialogContent size="default" className="p-0">
            <DialogTitle className="sr-only">Pair with your computer</DialogTitle>
            <DialogDescription className="sr-only">This page was opened from a pairing code.</DialogDescription>
            <PairPhoneCard />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
