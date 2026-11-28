// Gallery › Select ▾ › Find duplicates (ticket 232).
//
// Shows the look-alike groups side by side, each photo with its size on disk,
// its dimensions and whether it has been edited. One per group is marked Keep;
// the others start ticked (lib/duplicates.ts decides both, and never pre-ticks
// an edited photo). "Tick in gallery" makes those ticks the gallery
// selection, and that is all it does: deleting them is the gallery's own
// Delete Selected, behind its own confirmation. This dialog deletes nothing.
//
// The fingerprints are the engine's (src/dhash.rs), from each photo's stored
// thumbnail, cached in memory per photo (photoFingerprints.ts).
import { useEffect, useMemo, useState } from "react";
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
import { toast } from "@/components/ui/sonner";
import { planDuplicates, type GroupPlan, type Prints } from "@/lib/duplicates";
import { formatBytes } from "@/lib/format";
import { photoDims } from "@/lib/selectBy";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { fingerprintPhotos, type StoredPrints } from "./photoFingerprints";

type Scan =
  | { status: "working" }
  | { status: "failed" }
  | { status: "ready"; plans: GroupPlan[]; checked: number; ms: number };

export function FindDuplicatesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const photos = useGalleryStore((s) => s.photos);
  const modified = useGalleryStore((s) => s.modifiedPhotos);
  const [scan, setScan] = useState<Scan>({ status: "working" });
  const [ticks, setTicks] = useState<Set<string>>(new Set());

  // One scan per opening, on the gallery as it is at that moment.
  useEffect(() => {
    if (!open) return;
    let live = true;
    setScan({ status: "working" });
    setTicks(new Set());
    const { photos: list, modifiedPhotos } = useGalleryStore.getState();
    const t0 = performance.now();
    // ADR-112: a fingerprint computed here is stored on the photo, so the
    // next opening (and the next reload) hashes nothing; the original rides
    // beside the current one, so an edited photo still matches its copy.
    const remember = (id: string, patch: StoredPrints) =>
      useGalleryStore.getState().setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    fingerprintPhotos(list, { remember })
      .then((fps) => {
        if (!live) return;
        const prints = new Map<string, Prints>();
        for (const p of list) {
          const cur = fps.get(p.id);
          if (!cur) continue;
          const orig = p.fingerprintOriginal;
          prints.set(p.id, orig ? [cur, orig] : cur);
        }
        const plans = planDuplicates(
          list.map((p) => {
            const { w, h } = photoDims(p);
            return { id: p.id, width: w, height: h, byteSize: p.byteSize, edited: modifiedPhotos.has(p.id) };
          }),
          prints,
        );
        setScan({ status: "ready", plans, checked: fps.size, ms: Math.round(performance.now() - t0) });
        setTicks(new Set(plans.flatMap((g) => g.ticked)));
      })
      .catch((err: unknown) => {
        console.error("Find duplicates failed", err);
        if (live) setScan({ status: "failed" });
      });
    return () => {
      live = false;
    };
  }, [open]);

  const byId = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const plans = scan.status === "ready" ? scan.plans : [];
  // A photo deleted while the dialog is open drops out of its group.
  const groups = plans
    .map((g) => ({ ...g, ids: g.ids.filter((id) => byId.has(id)) }))
    .filter((g) => g.ids.length > 1);
  const live = new Set(groups.flatMap((g) => g.ids));
  const ticked = [...ticks].filter((id) => live.has(id));

  const toggle = (id: string, on: boolean) =>
    setTicks((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const apply = () => {
    // The ticks REPLACE the selection, as a Select ▾ rule does: a photo ticked
    // before (maybe a Keep) must not ride along into Delete Selected.
    useGalleryStore.getState().setSelectedIds(new Set(ticked));
    onOpenChange(false);
    toast.success(
      `Ticked ${ticked.length} look-alike${ticked.length === 1 ? "" : "s"}. Delete Selected removes ${ticked.length === 1 ? "it" : "them"}.`,
    );
  };

  let summary: string;
  if (scan.status === "working") summary = `Comparing ${photos.length} photos…`;
  else if (scan.status === "failed") summary = "Couldn't compare the photos.";
  else if (groups.length === 0) summary = `No look-alikes among ${scan.checked} photos.`;
  else
    summary = `${groups.length} group${groups.length === 1 ? "" : "s"} of look-alikes among ${scan.checked} photos. Ticked photos join the gallery selection; nothing is deleted here.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="flex max-h-[85vh] flex-col" data-testid="find-duplicates">
        <DialogHeader>
          <DialogTitle>Find duplicates</DialogTitle>
          <DialogDescription aria-live="polite" data-ms={scan.status === "ready" ? scan.ms : undefined}>
            {summary}
          </DialogDescription>
        </DialogHeader>
        {groups.length > 0 && (
          <DialogBody className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            {groups.map((g, gi) => {
              const editedCount = g.ids.filter((id) => modified.has(id)).length;
              return (
                <section key={g.ids[0]} aria-labelledby={`dupe-group-${gi}`} className="space-y-2">
                  <h3 id={`dupe-group-${gi}`} className="text-sm font-semibold">
                    Group {gi + 1}: {g.ids.length} photos
                  </h3>
                  {editedCount >= 2 && (
                    <p className="text-xs text-text-secondary">
                      {editedCount} of these are edited, so none is ticked. Tick the ones to delete yourself.
                    </p>
                  )}
                  <ul className="flex flex-wrap gap-3">
                    {g.ids.map((id) => {
                      const p = byId.get(id)!;
                      const { w, h } = photoDims(p);
                      const keep = id === g.keep;
                      const edited = modified.has(id);
                      return (
                        <li
                          key={id}
                          data-photo={p.name}
                          data-keep={keep || undefined}
                          className={`flex w-36 shrink-0 flex-col gap-1 rounded-md border p-2 ${keep ? "border-theme-primary" : "border-border"}`}
                        >
                          <div className="relative aspect-square overflow-hidden rounded-sm bg-bg-tertiary">
                            <DecodedImage source={p.thumbBlob} alt={p.name} className="size-full object-contain" />
                            {keep && (
                              <span className="absolute left-1 top-1 rounded-sm bg-theme-primary px-1.5 py-0.5 text-2xs font-semibold text-theme-primary-foreground">
                                Keep
                              </span>
                            )}
                          </div>
                          <span className="truncate text-xs font-semibold" title={p.name}>
                            {p.name}
                          </span>
                          <span className="text-xs text-text-secondary">
                            {w} × {h}
                          </span>
                          <span className="text-xs text-text-secondary">{formatBytes(p.byteSize) ?? "Size unknown"}</span>
                          <span className="text-xs text-text-secondary">{edited ? "Edited" : "Not edited"}</span>
                          <label className="mt-1 flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={ticks.has(id)}
                              onChange={(e) => toggle(id, e.target.checked)}
                              aria-label={`Tick ${p.name}`}
                            />
                            Tick
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </DialogBody>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {groups.length > 0 ? "Cancel" : "Close"}
          </Button>
          {groups.length > 0 && (
            <Button onClick={apply} disabled={ticked.length === 0}>
              Tick {ticked.length} in gallery
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
