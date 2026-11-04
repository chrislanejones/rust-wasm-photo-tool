// The phone's "Send to computer" (ADR-102), a section of the phone's Settings
// sheet beside Sync. A plain file input and `fetch` uploads: no engine, no
// processing, each photo goes up as the phone has it.
//
// The online switch has no other home on the phone (Settings › Security is a
// desktop pane), so when it is off this section offers the SAME switch,
// `useUIStore.onlineFeaturesEnabled`, per device, as the New dialog and
// Security do. It is the consent for this device; nothing is sent without it.
import { useRef } from "react";
import { CheckCircle2, CircleSlash, Loader2, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaneHeading } from "@/components/ui/pane-heading";
import { Switch } from "@/components/ui/switch";
import { formatStorage } from "@/lib/quota";
import { useUIStore } from "@/stores/useUIStore";
import {
  AVAILABILITY_MESSAGE,
  useSendToComputer,
  useTransferAvailability,
  useTransferBeta,
  type SendItem,
} from "./useTransfer";

/** What the picker offers. `image/*` plus the HEIC extensions, which some
 *  Android pickers do not count as images. */
const ACCEPT = "image/*,.heic,.heif";

export function SendToComputer() {
  const on = useTransferBeta();
  if (!on) return null;
  return <SendToComputerSection />;
}

function SendToComputerSection() {
  const availability = useTransferAvailability();
  const setOnline = useUIStore((s) => s.setOnlineFeaturesEnabled);
  const { items, busy, result, send, cancel } = useSendToComputer();
  const input = useRef<HTMLInputElement>(null);

  return (
    <section aria-labelledby="send-to-computer-heading" className="space-y-3" data-testid="send-to-computer">
      <PaneHeading id="send-to-computer-heading" title="Send to computer">
        Pick photos here and they wait in the editor&rsquo;s Inbox on your computer for 7 days.
      </PaneHeading>

      {availability !== "ready" ? (
        <div className="space-y-2">
          <p className="text-xs text-text-secondary" role="status">
            {/* The phone has no Settings › Security; its switch is right below. */}
            {availability === "online-off"
              ? "Transfer is off while everything stays in your browser."
              : AVAILABILITY_MESSAGE[availability]}
          </p>
          {availability === "online-off" && (
            <div className="flex min-h-11 items-center justify-between gap-3">
              <label htmlFor="transfer-online-switch" className="text-xs text-text-secondary">
                Allow online features on this phone
              </label>
              <Switch
                id="transfer-online-switch"
                checked={false}
                onCheckedChange={(v) => setOnline(v)}
                aria-label="Online features — lets this phone send data to a server"
              />
            </div>
          )}
        </div>
      ) : (
        <>
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="send-to-computer-input"
            onChange={(e) => {
              const files = Array.from(e.currentTarget.files ?? []);
              e.currentTarget.value = ""; // the same photo can be picked again
              void send(files);
            }}
          />
          <div className="flex gap-2">
            <Button size="large" className="min-h-11 flex-1" disabled={busy} onClick={() => input.current?.click()}>
              <Send className="h-4 w-4" aria-hidden="true" />
              Choose photos
            </Button>
            {busy && (
              <Button size="large" className="min-h-11" onClick={cancel}>
                Cancel
              </Button>
            )}
          </div>
        </>
      )}

      {items.length > 0 && (
        <ul className="space-y-1" aria-label="Photos being sent">
          {items.map((it) => (
            <SendRow key={it.key} item={it} />
          ))}
        </ul>
      )}
      <p className="text-xs text-text-primary" role="status" aria-live="polite">
        {result}
      </p>
    </section>
  );
}

const STATUS_TEXT: Record<SendItem["status"], string> = {
  waiting: "Waiting",
  sending: "Sending…",
  sent: "Sent",
  failed: "Not sent",
  canceled: "Canceled",
};

function SendRow({ item }: { item: SendItem }) {
  const Icon =
    item.status === "sent"
      ? CheckCircle2
      : item.status === "failed"
        ? XCircle
        : item.status === "canceled"
          ? CircleSlash
          : Loader2;
  return (
    <li className="flex items-start gap-2 text-xs" data-send-status={item.status}>
      <Icon
        aria-hidden="true"
        className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${item.status === "sending" ? "animate-spin" : ""} ${
          item.status === "failed" ? "text-destructive" : "text-text-secondary"
        }`}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-text-primary">{item.name}</p>
        <p className={item.status === "failed" ? "text-destructive" : "text-text-muted"}>
          {STATUS_TEXT[item.status]} · {formatStorage(item.bytes)}
          {item.message && item.status !== "canceled" ? ` — ${item.message}` : ""}
        </p>
      </div>
    </li>
  );
}
