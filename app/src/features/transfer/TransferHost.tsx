// Mounted where the gallery's import funnel already arrives: beside Copy
// look's LookHost in SubscriptionButton, which gets `openRaster` in both
// layouts. It registers that funnel for the Inbox, says when photos arrive,
// and holds the Inbox dialog. AppShell gains nothing (ADR-102).
import { useEffect, useRef } from "react";
import { toast } from "@/components/ui/sonner";
import { InboxDialog } from "./InboxDialog";
import { useTransferStore, type AddPhotosFn } from "./transferStore";
import { useInboxItems } from "./useInbox";
import { useTransferBeta } from "./useTransfer";

export function TransferHost({ onAddPhotos }: { onAddPhotos: AddPhotosFn }) {
  const on = useTransferBeta();
  const setAddPhotos = useTransferStore((s) => s.setAddPhotos);
  // handleAddPhotos is a new function on most renders (its deps move with the
  // gallery). Register ONE stable wrapper for the host's lifetime that calls
  // the latest, rather than re-registering, and blanking, on every render.
  const latest = useRef(onAddPhotos);
  latest.current = onAddPhotos;
  useEffect(() => {
    setAddPhotos((files) => latest.current(files));
    return () => setAddPhotos(null);
  }, [setAddPhotos]);
  if (!on) return null;
  return (
    <>
      <ArrivalToast />
      <InboxDialog />
    </>
  );
}

/** One toast when the count goes UP: on the first answer with photos waiting,
 *  and whenever the phone sends more. The gallery's Inbox button is only on
 *  screen with the gallery open; this reaches an empty editor too. */
function ArrivalToast() {
  const items = useInboxItems();
  const seen = useRef(0);
  const count = items.length;
  useEffect(() => {
    if (count > seen.current) {
      const n = count;
      toast.info(n === 1 ? "1 photo from your phone is waiting." : `${n} photos from your phone are waiting.`, {
        action: { label: "Open Inbox", onClick: () => useTransferStore.getState().setInboxOpen(true) },
      });
    }
    seen.current = count;
  }, [count]);
  return null;
}
