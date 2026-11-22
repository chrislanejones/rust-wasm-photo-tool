// Batch › Strip info (Night 11-21, 231, ADR-108). Removes the location (or
// all camera info) from every photo's STORED copy, so every later export,
// phone Save and computer-to-phone pairing send carries the stripped file.
// Main | Exceptions like every Batch tool (ADR-079); Exceptions start on
// "Leave as is".
//
// It replaces stored files and has no undo, so it asks first. It is lossless
// (lib/batchStripInfo.ts): the pixels never change, which is why the open
// photo needs no engine step and no reload — only its stored keys move.
import { useCallback, useRef, useState } from "react";
import { MapPinOff } from "lucide-react";
import { PanelAction, PanelActionBar } from "@/components/ui/panel-action-bar";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import { SectionHeader } from "@/components/ui/section-header";
import { ControlRow } from "@/components/ui/control-row";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/sonner";
import { getOriginal, putOriginal } from "@/lib/dexie/originalsAdapter";
import { deleteReplacedOriginal } from "@/lib/originalRefs";
import { collectExtraRoots } from "@/lib/extraRoots";
import { STRIP_CHOICES, confirmText, stripStoredCopy, type StripChoice } from "@/lib/batchStripInfo";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useBatchStripInfoStore } from "@/stores/useBatchStripInfoStore";
import { groupOf } from "@/stores/useBatchGroupStore";
import { useBatchGroups } from "./useBatchGroups";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";

interface Props {
  photos: PhotoEntry[];
  activePhotoId: string | null;
  setPhotos: React.Dispatch<React.SetStateAction<PhotoEntry[]>>;
}

type Row = { id: string; name: string; status: "stripped" | "clean" | "skipped" | "failed"; note?: string };

const ROW_TEXT: Record<Row["status"], string> = {
  stripped: "removed",
  clean: "nothing to remove",
  skipped: "skipped",
  failed: "failed",
};

export function StripInfoBatchPanel({ photos, activePhotoId, setPhotos }: Props) {
  const { exceptionIds, groups, hasExceptions, group: editing } = useBatchGroups(photos, activePhotoId);
  const choices = useBatchStripInfoStore((s) => s.choices);
  const setChoice = useBatchStripInfoStore((s) => s.setChoice);
  const choice = choices[editing];

  const runningRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [asking, setAsking] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  const choiceOf = useCallback(
    (id: string): StripChoice => useBatchStripInfoStore.getState().choices[groupOf(exceptionIds, id)],
    [exceptionIds],
  );
  const counts = { location: 0, all: 0 };
  for (const p of photos) {
    const c = choices[groupOf(exceptionIds, p.id)];
    if (c !== "keep") counts[c]++;
  }
  const touched = counts.location + counts.all;

  const run = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setRows([]);
    const out: Row[] = [];
    try {
      for (const photo of photos) {
        const r = await stripStoredCopy(photo, choiceOf(photo.id), { getOriginal, putOriginal });
        if (r.status === "stripped") {
          setPhotos((prev) => prev.map((x) => (x.id === photo.id ? { ...x, ...r.patch } : x)));
          for (const [oldKey, newKey] of r.replaced) {
            void deleteReplacedOriginal({
              oldKey,
              newKey,
              photoId: photo.id,
              photos: useGalleryStore.getState().photos,
              extraRoots: collectExtraRoots(),
            });
          }
          out.push({ id: photo.id, name: photo.name, status: "stripped" });
        } else {
          out.push({ id: photo.id, name: photo.name, status: r.status, note: r.note });
        }
        setRows([...out]);
      }
      const stripped = out.filter((r) => r.status === "stripped").length;
      const failed = out.filter((r) => r.status === "failed").length;
      (failed > 0 ? toast.warning : toast.success)(
        failed > 0
          ? `Camera info removed from ${stripped} — ${failed} couldn't be read`
          : `Camera info removed from ${stripped} photo${stripped === 1 ? "" : "s"}`,
      );
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }, [photos, choiceOf, setPhotos]);

  const label = (c: StripChoice) => STRIP_CHOICES.find((o) => o.id === c)!.label;
  const buttonLabel = running
    ? `Removing ${Math.min(rows.length + 1, photos.length)} of ${photos.length}…`
    : hasExceptions
      ? (["main", "exceptions"] as const)
          .filter((g) => groups[g].length > 0)
          .map((g) => `${label(choices[g])}: ${groups[g].length}`)
          .join(" · ")
      : `${label(choice)} from All Images`;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Strip info"
        info={
          <>
            Removes camera info from every photo&rsquo;s stored file, so every
            later download, phone save and pairing send carries the stripped
            copy. The picture itself is not changed. A turned photo keeps the
            one tag that shows it the right way up. Tick photos in the gallery
            to give them their own choice as Exceptions.
          </>
        }
      />

      <ControlRow label="Camera info">
        {({ labelId }) => (
          <ToolButtonGroup
            aria-labelledby={labelId}
            options={STRIP_CHOICES}
            value={choice}
            onChange={(c) => setChoice(editing, c)}
            columns={3}
          />
        )}
      </ControlRow>

      <PanelActionBar>
        <PanelAction onClick={() => setAsking(true)} disabled={running || touched === 0}>
          {buttonLabel}
        </PanelAction>
      </PanelActionBar>

      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title="Remove camera info?"
        titleIcon={MapPinOff}
        confirmLabel="Remove"
        confirmIcon={MapPinOff}
        tone="destructive"
        cancelLabel="Cancel"
        onConfirm={() => {
          setAsking(false);
          void run();
        }}
      >
        {confirmText(counts)}
      </ConfirmDialog>

      {rows.length > 0 && (
        <ul aria-label="Strip info results" className="space-y-1 text-2xs">
          {rows.map((r) => (
            <li key={r.id} data-status={r.status} className="flex justify-between gap-2 rounded-sm bg-bg-secondary px-2 py-1">
              <span className="truncate text-theme-foreground">{r.name}</span>
              <span className="shrink-0 text-theme-muted-foreground">{r.note && r.status !== "clean" ? r.note : ROW_TEXT[r.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
