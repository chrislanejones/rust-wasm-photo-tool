// Transfer's hooks (ADR-102). Shared by the phone's Send to computer and the
// editor's Inbox. Nothing here imports the engine.
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { isBetaOn, subscribeBeta } from "@/lib/beta";
import { useCloudAuth, useCloudMutation } from "@/lib/cloud";
import { isNetworkPathAllowed } from "@/lib/networkPaths";
import { useUIStore } from "@/stores/useUIStore";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { deviceLabel, resultLine, sendOne, type SendDeps } from "./send";

/** Is Transfer on for this device (Settings › Beta › "transfer", or `?beta=transfer`)? */
export function useTransferBeta(): boolean {
  return useSyncExternalStore(subscribeBeta, () => isBetaOn("transfer"), () => false);
}

/** Why this device can or cannot use Transfer right now. */
export type TransferAvailability = "ready" | "connecting" | "signed-out" | "online-off";

function availabilityOf(auth: { isAuthenticated: boolean; isLoading: boolean }, online: boolean): TransferAvailability {
  if (!auth.isAuthenticated) return auth.isLoading ? "connecting" : "signed-out";
  return isNetworkPathAllowed("transfer", online) ? "ready" : "online-off";
}

export function useTransferAvailability(): TransferAvailability {
  const auth = useCloudAuth();
  const online = useUIStore((s) => s.onlineFeaturesEnabled);
  return availabilityOf(auth, online);
}

export const AVAILABILITY_MESSAGE: Record<Exclude<TransferAvailability, "ready">, string> = {
  connecting: "Connecting to your account…",
  "signed-out": "Sign in to send photos to your computer.",
  "online-off": "Transfer is off while everything stays in your browser (Settings › Security).",
};

// ── The phone: a queue of files, one upload at a time ────────────────────────

export type SendStatus = "waiting" | "sending" | "sent" | "failed" | "canceled";

export interface SendItem {
  key: string;
  name: string;
  bytes: number;
  status: SendStatus;
  message?: string;
}

export function useSendToComputer() {
  const generateUploadUrl = useCloudMutation(api.transfers.generateUploadUrl);
  const create = useCloudMutation(api.transfers.create);
  const [items, setItems] = useState<SendItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const patch = (key: string, next: Partial<SendItem>) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...next } : it)));

  const send = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      // Read at call time, like useShare: the switch may have moved since the
      // render, and the refusal must come before any upload URL is asked for.
      if (!isNetworkPathAllowed("transfer", useUIStore.getState().onlineFeaturesEnabled)) {
        setResult(AVAILABILITY_MESSAGE["online-off"]);
        return;
      }
      const abort = new AbortController();
      abortRef.current = abort;
      const stamp = Date.now();
      const queue: SendItem[] = files.map((f, i) => ({ key: `${stamp}-${i}`, name: f.name, bytes: f.size, status: "waiting" }));
      setItems(queue);
      setResult("");
      setBusy(true);
      const from = deviceLabel(navigator.userAgent, navigator.maxTouchPoints ?? 0);
      const deps: SendDeps = {
        generateUploadUrl: () => generateUploadUrl({}),
        create: (args) => create({ ...args, storageId: args.storageId as Id<"_storage"> }),
      };
      let sent = 0;
      for (const [i, file] of files.entries()) {
        const key = queue[i]!.key;
        if (abort.signal.aborted) {
          patch(key, { status: "canceled", message: "Canceled." });
          continue;
        }
        patch(key, { status: "sending" });
        const out = await sendOne(file, from, deps, abort.signal);
        if (out.ok) {
          sent += 1;
          patch(key, { status: "sent", message: undefined });
        } else {
          patch(key, { status: out.canceled ? "canceled" : "failed", message: out.message });
        }
      }
      abortRef.current = null;
      setBusy(false);
      setResult(resultLine(sent, files.length));
    },
    [generateUploadUrl, create],
  );

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  return { items, busy, result, send, cancel };
}
