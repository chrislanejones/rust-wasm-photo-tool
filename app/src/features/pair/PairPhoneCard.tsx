// The phone's side (ADR-105): opened from the QR code, `#/pair/<secret>`.
// "Pairing with computer…" → "Connected", in the phone view, without the
// engine. PairHost starts the join; this only shows it.
//
// The online switch has no other home on the phone (Settings › Security is a
// desktop pane), so while it is off this card offers the SAME switch,
// `useUIStore.onlineFeaturesEnabled`, as Send to computer does (ADR-102).
import { useRef } from "react";
import { CheckCircle2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { useCloudAuth } from "@/lib/cloud";
import { useUIStore } from "@/stores/useUIStore";
import { useTransferBeta } from "@/features/transfer/useTransfer";
import { PHOTO_PICKER_ACCEPT } from "@/features/transfer/send";
import { NO_SERVER_LINE, ONLINE_OFF_LINE, isEnded, phoneLine } from "./messages";
import { stopPairing } from "./pairController";
import { sendFiles } from "./sendController";
import { usePairSendStore } from "./sendStore";
import { usePairStore } from "./pairStore";
import { usePairAvailability, usePairSignaling } from "./usePair";

export function PairPhoneCard() {
  const invite = usePairStore((s) => s.invite);
  if (invite === null) return null;
  return <Card />;
}

function Card() {
  const signaling = usePairSignaling();
  const availability = usePairAvailability(signaling);
  const status = usePairStore((s) => (s.role === "computer" ? "idle" : s.status));
  const setOnline = useUIStore((s) => s.setOnlineFeaturesEnabled);
  const line = phoneLine(status);
  const busy = availability === "ready" && (status === "idle" || status === "starting" || status === "connecting");

  const dismiss = () => {
    stopPairing();
    usePairStore.getState().setInvite(null);
  };

  return (
    <section
      aria-labelledby="pair-phone-heading"
      data-testid="pair-phone"
      data-status={availability === "ready" ? status : availability}
      className="mx-3 mt-3 rounded-lg border border-border bg-bg-secondary p-4"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0" aria-hidden="true">
          {status === "connected" ? (
            <CheckCircle2 className="h-5 w-5 text-success" />
          ) : busy ? (
            <Spinner size={18} />
          ) : null}
        </div>
        <div className="min-w-0 flex-1 space-y-1" role="status" aria-live="polite">
          <h2 id="pair-phone-heading" className="text-sm font-semibold text-text-primary">
            {availability === "ready" ? line.title : "Pair with your computer"}
          </h2>
          {availability === "online-off" ? (
            <p className="text-xs text-text-secondary">{ONLINE_OFF_LINE}</p>
          ) : availability === "no-server" ? (
            <p className="text-xs text-text-secondary">{NO_SERVER_LINE}</p>
          ) : (
            line.body && <p className="text-xs text-text-secondary">{line.body}</p>
          )}
        </div>
        {/* 44px, the phone's touch floor, like the header's cog. */}
        <IconButton icon={X} label="Close pairing" title="Close pairing" standalone className="h-11 w-11 shrink-0 rounded-lg" onClick={dismiss} />
      </div>

      {availability === "online-off" && (
        <div className="mt-3 flex min-h-11 items-center justify-between gap-3">
          <label htmlFor="pair-online-switch" className="text-xs text-text-secondary">
            Allow online features on this phone
          </label>
          <Switch
            id="pair-online-switch"
            checked={false}
            onCheckedChange={(v) => setOnline(v)}
            aria-label="Online features — lets this phone send data to a server"
          />
        </div>
      )}
      {availability === "ready" && status === "connected" && <SendToComputer />}
      {availability === "ready" && status === "unreachable" && <TransferInstead />}
      {availability === "ready" && isEnded(status) && status !== "unreachable" && (
        <p className="mt-2 text-xs text-text-muted">Close this to keep using the gallery.</p>
      )}
    </section>
  );
}

/** Signed in, with the Transfer Beta: the phone's Send to computer is in its
 *  Settings sheet, and goes through the 7-day inbox instead (ADR-102). */
function TransferInstead() {
  const { isAuthenticated } = useCloudAuth();
  const transfer = useTransferBeta();
  const openSettings = useUIStore((s) => s.setMobileSettingsOpen);
  if (!isAuthenticated || !transfer) return null;
  return (
    <Button size="large" className="mt-3 min-h-11 w-full" onClick={() => openSettings(true)}>
      Send through the Transfer inbox instead
    </Button>
  );
}

/** Connected: pick photos from the phone's own library or camera roll (the
 *  same picker Send to computer offers) and send them straight over. Nothing
 *  is processed here; each goes as the phone has it. */
function SendToComputer() {
  const input = useRef<HTMLInputElement>(null);
  const moving = usePairSendStore((s) => s.view !== null && s.view.phase !== "ended");
  return (
    <div className="mt-3">
      <Button size="large" className="min-h-11 w-full" disabled={moving} onClick={() => input.current?.click()}>
        <Send className="h-4 w-4" aria-hidden="true" />
        Send photos to computer
      </Button>
      <input
        ref={input}
        type="file"
        accept={PHOTO_PICKER_ACCEPT}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="pair-send-input"
        onChange={(e) => {
          const files = Array.from(e.currentTarget.files ?? []);
          e.currentTarget.value = "";
          if (!files.length) return;
          const refused = sendFiles(files);
          if (refused.length === files.length) {
            toast.error(`Nothing was sent. ${refused[0]!.name}: ${refused[0]!.reason}.`);
          }
        }}
      />
    </div>
  );
}
