// The gallery header's Inbox button (ADR-102): shown only when photos from the
// phone are waiting, with their count. Opens the dialog TransferHost holds, so
// it shows only while a host is mounted to hold it.
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTransferStore } from "./transferStore";
import { useInboxItems } from "./useInbox";

export function InboxButton({ labelClassName, className }: { labelClassName?: string; className?: string }) {
  const count = useInboxItems().length;
  const hosted = useTransferStore((s) => s.addPhotos !== null);
  const open = useTransferStore((s) => s.setInboxOpen);
  if (count === 0 || !hosted) return null;
  const name = `Inbox: ${count} ${count === 1 ? "photo" : "photos"} from your phone`;
  return (
    <Button size="default" onClick={() => open(true)} title={name} aria-label={name} className={className} data-testid="inbox-button">
      <Inbox className="h-3.5 w-3.5" aria-hidden="true" />
      <span className={labelClassName}>Inbox</span>
      <span
        aria-hidden="true"
        data-testid="inbox-count"
        className="rounded-full bg-theme-primary-foreground px-1.5 text-2xs font-semibold leading-4 text-on-photo"
      >
        {count}
      </span>
    </Button>
  );
}
