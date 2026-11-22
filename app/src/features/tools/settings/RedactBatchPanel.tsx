// Batch › Redact (Night 11-21, 230, ADR-108). Draw boxes on the open photo
// (BatchRedactFrame), pick Pixelate · Blur · Solid, and every photo in the
// batch is redacted in the same place. Main | Exceptions like every Batch
// tool (ADR-079): each group has its own boxes, and a group with none is
// skipped — so ticking a photo as an Exception keeps it out until you draw
// boxes for it.
//
// The open photo is ONE undo step; the others are written over their stored
// files with no undo, which the panel says above the button. The rules for
// each photo live in lib/batchRedactRun.ts.
import { useCallback, useRef, useState } from "react";
import { PanelAction, PanelActionBar } from "@/components/ui/panel-action-bar";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import { SectionHeader } from "@/components/ui/section-header";
import { ControlRow } from "@/components/ui/control-row";
import { SizeSlider } from "@/components/ui/size-slider";
import { Button } from "@/components/ui/button";
import { ErrorNote } from "@/components/ui/status-note";
import { toast } from "@/components/ui/sonner";
import { ColorSwatchGrid } from "@/components/ColorSwatchGrid";
import { PlacementGrid } from "@/components/PlacementGrid";
import { TEXT_COLORS } from "@/lib/colors";
import { batchOutcome } from "@/lib/batchOutcome";
import {
  BLOCK_MAX,
  BLOCK_MIN,
  BLUR_MAX,
  BLUR_MIN,
  MAX_BOXES,
  lookLabel,
  type RedactPlacement,
  type RedactStyle,
} from "@/lib/batchRedact";
import { redactOpen, redactStored, type RedactRow } from "@/lib/batchRedactRun";
import { useBatchRedactStore } from "@/stores/useBatchRedactStore";
import { groupOf } from "@/stores/useBatchGroupStore";
import { useBatchGroups } from "./useBatchGroups";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";
import type { ImageHorseTool } from "stamp_tool";

const STYLE_OPTIONS: readonly { id: RedactStyle; label: string }[] = [
  { id: "pixelate", label: "Pixelate" },
  { id: "blur", label: "Blur" },
  { id: "solid", label: "Solid" },
];

const PLACEMENT_OPTIONS: readonly { id: RedactPlacement; label: string; title: string }[] = [
  { id: "relative", label: "Same spot", title: "The same part of every photo, scaled with it (a 2x screenshot gets a 2x box)" },
  { id: "anchored", label: "Pinned to a corner", title: "The same size in pixels and the same distance from the corner you pick" },
];

interface Props {
  photos: PhotoEntry[];
  activePhotoId: string | null;
  setPhotos: React.Dispatch<React.SetStateAction<PhotoEntry[]>>;
  stampToolRef: React.MutableRefObject<ImageHorseTool | null>;
  flushToCanvas: () => void;
  syncState: () => void;
}

export function RedactBatchPanel({ photos, activePhotoId, stampToolRef, flushToCanvas, syncState }: Props) {
  const { exceptionIds, groups, hasExceptions, group: editing } = useBatchGroups(photos, activePhotoId);
  const looks = useBatchRedactStore((s) => s.looks);
  const setLook = useBatchRedactStore((s) => s.setLook);
  const clearBoxes = useBatchRedactStore((s) => s.clearBoxes);
  const look = looks[editing];

  const runningRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<RedactRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setErrorMsg(null);
    setRows([]);
    const all = useBatchRedactStore.getState().looks;
    const lookOf = (id: string) => all[groupOf(exceptionIds, id)];
    const out: RedactRow[] = [];
    const report = (row: RedactRow) => {
      out.push(row);
      setRows([...out]);
    };
    try {
      const mod = await import("stamp_tool");
      await mod.default();
      for (const photo of photos.filter((p) => p.id !== activePhotoId)) {
        try {
          report(await redactStored(mod, photo, lookOf(photo.id)));
        } catch (err) {
          console.error("Batch redact: failed on", photo.name, err);
          report({ id: photo.id, name: photo.name, status: "failed", note: err instanceof Error ? err.message : "failed" });
        }
      }
      const open = photos.find((p) => p.id === activePhotoId);
      const tool = stampToolRef.current;
      if (open && tool) {
        try {
          report(await redactOpen(open, lookOf(open.id), { tool, flushToCanvas, syncState }));
        } catch (err) {
          console.error("Batch redact: failed on the open photo", err);
          report({ id: open.id, name: open.name, status: "failed", note: err instanceof Error ? err.message : "failed" });
        }
      }
      const done = out.filter((r) => r.status === "redacted").length;
      const tried = out.filter((r) => r.status !== "skipped").length;
      const outcome = batchOutcome("Redacted", done, tried);
      (outcome.ok ? toast.success : toast.warning)(outcome.text);
    } catch (err) {
      console.error("Batch redact: fatal error", err);
      setErrorMsg("Something went wrong.");
      toast.error("Couldn't redact the photos.");
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }, [photos, exceptionIds, activePhotoId, stampToolRef, flushToCanvas, syncState]);

  const withBoxes = (["main", "exceptions"] as const).filter((g) => groups[g].length > 0 && looks[g].boxes.length > 0);
  const notOpen = photos.filter((p) => p.id !== activePhotoId && looks[groupOf(exceptionIds, p.id)].boxes.length > 0).length;
  const buttonLabel = running
    ? `Redacting ${Math.min(rows.length + 1, photos.length)} of ${photos.length}…`
    : withBoxes.length === 0
      ? "Draw a box on the photo first"
      : hasExceptions
        ? withBoxes.map((g) => `${lookLabel(looks[g])} on ${groups[g].length}`).join(" · ")
        : `${lookLabel(look)} on All Images`;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Redact"
        info={
          <>
            Drag boxes on the photo over what should not be seen, such as an
            email in a nav bar or an account number, and every photo gets them
            in the same place. Up to {MAX_BOXES}. Tick photos in the gallery to
            give them their own boxes as Exceptions; a group with no boxes is
            left alone.
          </>
        }
      />

      <ControlRow label="Style">
        {({ labelId }) => (
          <ToolButtonGroup
            aria-labelledby={labelId}
            options={STYLE_OPTIONS}
            value={look.style}
            onChange={(style) => setLook(editing, { style })}
            columns={3}
          />
        )}
      </ControlRow>

      {look.style === "pixelate" && (
        <SizeSlider
          label="Block Size"
          min={BLOCK_MIN}
          max={BLOCK_MAX}
          unit="px"
          value={look.block}
          onChange={(block) => setLook(editing, { block })}
        />
      )}
      {look.style === "blur" && (
        <SizeSlider
          label="Blur Strength"
          min={BLUR_MIN}
          max={BLUR_MAX}
          value={look.blur}
          onChange={(blur) => setLook(editing, { blur })}
        />
      )}
      {look.style === "solid" && (
        <ColorSwatchGrid colors={TEXT_COLORS} value={look.color} onChange={(color) => setLook(editing, { color })} />
      )}

      <ControlRow label="Where on the other photos">
        {({ labelId }) => (
          <ToolButtonGroup
            aria-labelledby={labelId}
            options={PLACEMENT_OPTIONS}
            value={look.placement}
            onChange={(placement) => setLook(editing, { placement })}
            columns={2}
          />
        )}
      </ControlRow>
      {look.placement === "anchored" && (
        <PlacementGrid
          label="Corner"
          value={look.anchor}
          onChange={(anchor) => setLook(editing, { anchor })}
          name="redact-anchor"
        />
      )}

      <div className="flex items-center justify-between gap-2 text-2xs text-theme-muted-foreground">
        <span data-testid="redact-box-count">
          {look.boxes.length === 0
            ? "No boxes yet — drag on the photo."
            : `${look.boxes.length} of ${MAX_BOXES} boxes${look.boxes.length >= MAX_BOXES ? " — the most" : ""}`}
        </span>
        {look.boxes.length > 0 && (
          <Button size="default" onClick={() => clearBoxes(editing)}>
            Clear boxes
          </Button>
        )}
      </div>

      {notOpen > 0 && (
        <p className="text-2xs text-theme-muted-foreground" data-testid="redact-no-undo">
          {`Redact can't be undone on photos that aren't open (${notOpen} here). Their stored files are replaced. The open photo is one undo step.`}
        </p>
      )}

      <PanelActionBar>
        <PanelAction onClick={() => void run()} disabled={running || withBoxes.length === 0}>
          {buttonLabel}
        </PanelAction>
      </PanelActionBar>

      {rows.length > 0 && (
        <ul aria-label="Redact results" className="space-y-1 text-2xs">
          {rows.map((r) => (
            <li key={r.id} data-status={r.status} className="flex flex-col rounded-sm bg-bg-secondary px-2 py-1">
              <span className="flex justify-between gap-2">
                <span className="truncate text-theme-foreground">{r.name}</span>
                <span className="shrink-0 text-theme-foreground">{r.status}</span>
              </span>
              {r.note && <span className="text-theme-muted-foreground">{r.note}</span>}
            </li>
          ))}
        </ul>
      )}

      {errorMsg && <ErrorNote>{errorMsg}</ErrorNote>}
    </div>
  );
}
