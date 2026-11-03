// Copy look / Paste look, mounted where the live engine already is.
//
// WHY IT LIVES BESIDE SETTINGS. Copying reads the open photo's op log and
// pasting writes through the engine, so this needs the engine handles. The
// Settings button is the one component that already receives them in BOTH
// layouts (the top bar, and the compact master bar's settings slot), as
// `openRaster`. Mounting here adds nothing to AppShell, which is being taken
// apart (CLAUDE.md). The gallery menus and Ctrl+Alt+C / Ctrl+Alt+V only talk
// to stores/useLookStore.
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { toast } from "@/components/ui/sonner";
import { batchOutcome } from "@/lib/batchOutcome";
import {
  decodeLook,
  describeKind,
  kindsIn,
  LOOK_KIND_LABEL,
  pickKinds,
  type LookKind,
} from "@/lib/look";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useLookStore } from "@/stores/useLookStore";
import { pasteLook, pasteTargets, type LiveEngine, type PasteRow } from "./pasteLook";

export function LookHost(engine: LiveEngine) {
  const { stampToolRef } = engine;
  const setCopyFromOpen = useLookStore((s) => s.setCopyFromOpen);

  const copyFromOpen = useCallback(async () => {
    const tool = stampToolRef.current;
    const { activePhotoId, photos } = useGalleryStore.getState();
    const photo = photos.find((p) => p.id === activePhotoId);
    if (!tool || !photo) {
      toast.info("Open a photo to copy its look.");
      return;
    }
    // Optional: `oplog_look` exists only in builds with the op log (tiles).
    // Awaited: on the worker engine every call answers with a promise.
    const wire = await tool.oplog_look?.();
    const steps = wire ? decodeLook(wire) : [];
    if (steps.length === 0) {
      toast.info("This photo has no Adjustments, Preset or Levels to copy.");
      return;
    }
    useLookStore.getState().setCopied({ steps, fromId: photo.id, fromName: photo.name });
    toast.success(`Copied the look of ${photo.name}: ${kindsIn(steps).map((k) => LOOK_KIND_LABEL[k]).join(", ")}.`);
  }, [stampToolRef]);

  useEffect(() => {
    setCopyFromOpen(copyFromOpen);
    return () => setCopyFromOpen(null);
  }, [copyFromOpen, setCopyFromOpen]);

  return <PasteLookDialog engine={engine} />;
}

function PasteLookDialog({ engine }: { engine: LiveEngine }) {
  const open = useLookStore((s) => s.pasteOpen);
  const copied = useLookStore((s) => s.copied);
  const close = useLookStore((s) => s.closePaste);
  // Re-read on open: the ticks and the open photo may have changed since.
  const selectedIds = useGalleryStore((s) => s.selectedIds);
  const activePhotoId = useGalleryStore((s) => s.activePhotoId);
  const targets = useMemo(
    () => (copied ? pasteTargets(copied.fromId) : []),
    // selectedIds/activePhotoId are what pasteTargets reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [copied, selectedIds, activePhotoId, open],
  );
  const kinds = useMemo(() => (copied ? kindsIn(copied.steps) : []), [copied]);
  const [keep, setKeep] = useState<Set<LookKind>>(new Set());
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<PasteRow[]>([]);

  useEffect(() => {
    if (!open) return;
    setKeep(new Set(kinds));
    setRows([]);
  }, [open, kinds]);

  const notOpen = targets.filter((p) => p.id !== activePhotoId).length;
  const canPaste = !!copied && targets.length > 0 && keep.size > 0 && !running;

  const paste = async () => {
    if (!copied || !canPaste) return;
    setRunning(true);
    setRows([]);
    const out: PasteRow[] = [];
    try {
      await pasteLook(pickKinds(copied.steps, keep), targets, engine, (row) => {
        out.push(row);
        setRows([...out]);
      });
      const pasted = out.filter((r) => r.status === "pasted").length;
      const outcome = batchOutcome("Pasted the look on", pasted, targets.length);
      (outcome.ok ? toast.success : toast.warning)(outcome.text);
      if (outcome.ok) close();
    } catch (err) {
      console.error("Paste look: fatal error", err);
      toast.error("Couldn't paste the look.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !running && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Paste look</DialogTitle>
          <DialogDescription>
            {copied
              ? `From ${copied.fromName}, onto ${targets.length} ticked photo${targets.length === 1 ? "" : "s"}.`
              : "Copy a look first: Ctrl+Alt+C on the open photo, or Select ▾ › Copy look."}
          </DialogDescription>
        </DialogHeader>
        {copied && (
          <DialogBody className="space-y-3">
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Paste</legend>
              {kinds.map((k) => (
                <label key={k} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4"
                    checked={keep.has(k)}
                    disabled={running}
                    onChange={(e) =>
                      setKeep((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(k);
                        else next.delete(k);
                        return next;
                      })
                    }
                  />
                  <span>
                    <span className="font-semibold">{LOOK_KIND_LABEL[k]}</span>
                    <span className="block text-xs text-theme-muted-foreground">{describeKind(copied.steps, k)}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            {targets.length === 0 && (
              <p className="text-sm text-theme-muted-foreground">Tick the photos to paste onto in the gallery first.</p>
            )}
            {notOpen > 0 && (
              <p className="text-xs text-theme-muted-foreground">
                Paste can't be undone on photos that aren't open ({notOpen} here). Their stored files are replaced.
              </p>
            )}
            {rows.length > 0 && (
              <ul className="space-y-1 text-xs" aria-live="polite">
                {rows.map((r) => (
                  <li key={r.id}>
                    {r.name}: {r.status}
                    {r.note ? ` (${r.note})` : ""}
                  </li>
                ))}
              </ul>
            )}
          </DialogBody>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={close} disabled={running}>
            Cancel
          </Button>
          <Button onClick={() => void paste()} disabled={!canPaste}>
            {running ? `Pasting ${Math.min(rows.length + 1, targets.length)} of ${targets.length}…` : `Paste to ${targets.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
