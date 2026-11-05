import { useCallback, useState } from "react";
import { useCloudMutation, useCloudQuery } from "@/lib/cloud";
import { loadGalleryManifest } from "@/lib/galleryManifest";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { addToGallery, downloadEntry, waitForManifest, type AddReport } from "./inbox";
import { useTransferStore } from "./transferStore";
import { useTransferAvailability, useTransferBeta } from "./useTransfer";

/** Just the waiting photos, for the badge and the arrival toast. Convex
 *  shares one subscription between every caller of the same query. */
export function useInboxItems() {
  const beta = useTransferBeta();
  const availability = useTransferAvailability();
  const enabled = beta && availability === "ready";
  const data = useCloudQuery(api.transfers.listMine, enabled ? {} : "skip");
  return enabled ? (data?.items ?? []) : [];
}

/** The editor's view of the Transfer inbox. The live query runs only with the
 *  Beta on, signed in, and the online switch on for this device; otherwise
 *  there is no inbox and nothing is asked of the server. */
export function useInbox() {
  const beta = useTransferBeta();
  const availability = useTransferAvailability();
  const enabled = beta && availability === "ready";
  const items = useInboxItems();
  const receive = useCloudMutation(api.transfers.receive);
  const remove = useCloudMutation(api.transfers.remove);
  const addPhotos = useTransferStore((s) => s.addPhotos);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [note, setNote] = useState("");

  const add = useCallback(
    async (ids: readonly string[]) => {
      if (!addPhotos) return;
      const chosen = items.filter((i) => ids.includes(i.id));
      setBusy(new Set(ids));
      setNote("");
      let report: AddReport;
      try {
        report = await addToGallery(chosen, {
          download: (item) => downloadEntry(item),
          addPhotos,
          confirmSaved: (photoIds) => waitForManifest(photoIds, loadGalleryManifest),
          receive: (id) => receive({ id: id as Id<"transfers"> }),
        });
      } finally {
        setBusy(new Set());
      }
      setErrors((prev) => {
        const next = { ...prev };
        for (const id of report.added) delete next[id];
        return { ...next, ...report.errors };
      });
      const parts: string[] = [];
      if (report.added.length) {
        parts.push(`${report.added.length} added to the gallery.`);
      }
      if (report.overLimit.length) {
        const n = report.overLimit.length;
        parts.push(`The gallery is full: ${n} ${n === 1 ? "photo is" : "photos are"} still in the inbox.`);
      }
      setNote(parts.join(" "));
    },
    [addPhotos, items, receive],
  );

  const del = useCallback(
    async (id: string) => {
      setBusy(new Set([id]));
      try {
        await remove({ id: id as Id<"transfers"> });
      } catch {
        setErrors((prev) => ({ ...prev, [id]: "Couldn't delete it. Try again." }));
      } finally {
        setBusy(new Set());
      }
    },
    [remove],
  );

  return { enabled, items, errors, busy, note, canAdd: addPhotos !== null, add, remove: del };
}
