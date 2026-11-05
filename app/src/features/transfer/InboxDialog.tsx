// The Transfer Inbox (ADR-102): photos sent from the phone, waiting to be
// added to this browser's gallery. Add runs the gallery's own import, and a
// photo leaves only after its import is saved (features/transfer/inbox.ts).
import { useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
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
import { DecodedImage } from "@/components/ui/decoded-image";
import { ErrorNote } from "@/components/ui/status-note";
import { formatStorage } from "@/lib/quota";
import { expiresIn } from "./inbox";
import { useTransferStore } from "./transferStore";
import { useInbox } from "./useInbox";

export function InboxDialog() {
  const open = useTransferStore((s) => s.inboxOpen);
  const setOpen = useTransferStore((s) => s.setInboxOpen);
  const inbox = useInbox();
  // Read on open and after each action; the expiry line needs no live clock.
  const [now] = useState(() => Date.now());
  const anyBusy = inbox.busy.size > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent size="default" data-testid="transfer-inbox">
        <DialogHeader>
          <DialogTitle>Inbox</DialogTitle>
          <DialogDescription>
            Photos sent from your phone. Each waits 7 days and counts toward your storage until you add or delete it.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="max-h-[60vh] space-y-3 overflow-y-auto">
          {inbox.items.length === 0 ? (
            <p className="text-xs text-text-muted">Nothing is waiting.</p>
          ) : (
            <ul className="space-y-2" aria-label="Photos waiting in the inbox">
              {inbox.items.map((it) => {
                const busy = inbox.busy.has(it.id);
                const error = inbox.errors[it.id];
                return (
                  <li key={it.id} data-inbox-item={it.id} className="rounded-md border border-border p-2">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-sm bg-bg-tertiary">
                        {it.url && <DecodedImage key={it.url} source={it.url} alt={it.name} loading="lazy" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-text-primary">{it.name}</p>
                        <p className="text-2xs text-text-muted">
                          {formatStorage(it.bytes)} · from {it.fromDevice}
                        </p>
                        <p className="text-2xs text-text-muted">{expiresIn(it.expiresAt, now)}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="default"
                          disabled={!inbox.canAdd || anyBusy}
                          onClick={() => void inbox.add([it.id])}
                          aria-label={`Add ${it.name} to the gallery`}
                        >
                          <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                          {busy ? "Adding…" : "Add to gallery"}
                        </Button>
                        <Button
                          size="default"
                          disabled={anyBusy}
                          onClick={() => void inbox.remove(it.id)}
                          aria-label={`Delete ${it.name} from the inbox`}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Delete
                        </Button>
                      </div>
                    </div>
                    {error && (
                      <div className="mt-1">
                        <ErrorNote polite>{error}</ErrorNote>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-xs text-text-primary" role="status" aria-live="polite">
            {inbox.note}
          </p>
        </DialogBody>
        <DialogFooter>
          <Button size="large" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button
            size="large"
            disabled={!inbox.canAdd || anyBusy || inbox.items.length === 0}
            onClick={() => void inbox.add(inbox.items.map((i) => i.id))}
          >
            Add all
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
