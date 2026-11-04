import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { useCloudMutation as useMutation, useCloudQuery as useQuery } from "@/lib/cloud";
import { toast } from "@/components/ui/sonner";
import { TrashView, type TrashItem } from "@/features/gallery/TrashView";

/**
 * The share-link trash, under the list in Settings › Shared (the `trash` Beta,
 * ADR-101). Signed-in only: the caller renders it only when authenticated,
 * because nothing of a logged-out user's is on the server.
 *
 * The view is UI Night 6's TrashView, unchanged; this is its wiring. The
 * relative "Removes in N days" comes from TrashView's own clock helper, fed the
 * server's answer for whether the account is paid, so the two windows are the
 * ones the purge uses (convex/entitlement.ts).
 */
export function ShareTrash({ now }: { now: number }) {
  const trash = useQuery(api.trash.listMine, {});
  const restore = useMutation(api.trash.restore);
  const deleteNow = useMutation(api.trash.deleteNow);
  const empty = useMutation(api.trash.empty);
  const [busy, setBusy] = useState(false);

  if (!trash) return null;

  const run = async (fn: () => Promise<unknown>, done: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      toast.success(done);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const items: TrashItem[] = trash.items.map((i) => ({
    id: i.token,
    name: i.title ?? "Untitled",
    thumbnailUrl: i.imageUrl ?? undefined,
    bytes: i.bytes,
    deletedAt: i.deletedAt,
  }));

  return (
    <TrashView
      items={items}
      paid={trash.paid}
      now={now}
      quota={trash.quota}
      signedIn
      overModal
      onRestore={(token) => void run(() => restore({ token }), "Share link restored")}
      onDeleteNow={(token) => void run(() => deleteNow({ token }), "Share link deleted")}
      onEmpty={() =>
        void run(async () => {
          // A batch per call; keep going while the server says there is more.
          for (let i = 0; i < 100; i++) {
            const r = await empty({});
            if (!r.more) break;
          }
        }, "Trash emptied")
      }
    />
  );
}
