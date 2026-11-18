// The gallery's "Send to phone" (ADR-105, "Sending"), beside Pair a phone.
// Only while a phone is connected. Sends the selected photos' stored
// ORIGINALS, or the open photo with nothing selected; edits are not included
// (the dialog says so). A send that would carry none says why.
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { usePairStore } from "./pairStore";
import { sendGalleryPhotos } from "./sendController";
import { usePairSendStore } from "./sendStore";

export function SendToPhoneButton({ labelClassName, className }: { labelClassName?: string; className?: string }) {
  const connected = usePairStore((s) => s.role === "computer" && s.status === "connected");
  const moving = usePairSendStore((s) => s.view !== null && s.view.phase !== "ended");
  const selected = useGalleryStore((s) => s.selectedIds.size);
  if (!connected) return null;
  const name = selected > 1 ? `Send ${selected} to phone` : "Send to phone";
  return (
    <Button
      size="default"
      className={className}
      disabled={moving}
      title={`${name}. Sends the originals; edits aren't included.`}
      aria-label={name}
      data-testid="pair-send-to-phone"
      onClick={() => {
        void sendGalleryPhotos().then((refused) => {
          if (refused.length && !usePairSendStore.getState().view) {
            toast.error(`Nothing was sent. ${refused[0]!.name}: ${refused[0]!.reason}.`);
          }
        });
      }}
    >
      <Send className="h-3.5 w-3.5" aria-hidden="true" />
      <span className={labelClassName}>{name}</span>
    </Button>
  );
}
