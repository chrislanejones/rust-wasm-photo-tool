// Batch → AI Rename. Scans every loaded photo with the engine's `describe_image`
// and names each one from what it saw.
//
// Two steps on purpose. Scanning decodes every photo, so it is a button press,
// not something that happens the moment the panel opens; and once scanned, the
// descriptions are held in state so editing the name pattern re-previews
// instantly instead of re-decoding a hundred images.
//
// Names only — no pixels are touched, nothing is written to IndexedDB, and no
// account or network is involved. It works in demo mode like the rest of the
// local tools.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScanEye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { toast } from "@/components/ui/sonner";
import { getOriginal } from "@/lib/dexie/originalsAdapter";
import { getWorkingCopy, putWorkingCopy } from "@/lib/workingCopyCache";
import { makeWorkingCopy } from "@/lib/workingCopy";
import {
  applyDescriptionPattern,
  dedupeNames,
  parseDescription,
  splitExtension,
  UNKNOWN_DESCRIPTION,
  type ImageDescription,
} from "@/lib/describeImage";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";

interface Props {
  photos: PhotoEntry[];
  setPhotos: React.Dispatch<React.SetStateAction<PhotoEntry[]>>;
}

const DEFAULT_PATTERN = "{desc}-{n}";

/** How many photos to scan between yields back to the event loop, so the
 *  progress counter actually paints on a gallery of cached working copies
 *  (where nothing else in the loop awaits). */
const YIELD_EVERY = 8;

/** The engine's read of one image, for the preview tooltip. Axes are LABELLED:
 *  several of them share vocabulary — a head-and-shoulders shot in a tall frame
 *  is `subject portrait` and `orientation portrait` — and an unlabelled join
 *  renders that as the baffling "portrait, portrait". */
function describedAs(d: ImageDescription): string {
  return (
    [
      ["kind", d.kind],
      ["subject", d.subject],
      ["colour", d.color],
      ["tone", d.tone],
      ["palette", d.palette],
      ["contrast", d.contrast],
      ["orientation", d.orientation],
      ["detail", d.detail],
    ] as const
  )
    .filter(([, v]) => v)
    .map(([k, v]) => `${k} ${v}`)
    .join(", ");
}

export function AIRenamePanel({ photos, setPhotos }: Props) {
  const [pattern, setPattern] = useState(DEFAULT_PATTERN);
  const [start, setStart] = useState(1);
  const [pad, setPad] = useState(2);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  /** photo id → what the engine saw. Empty until the first scan. */
  const [described, setDescribed] = useState<Map<string, ImageDescription>>(new Map());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [renamedCount, setRenamedCount] = useState<number | null>(null);
  // Cancels an in-flight scan when the panel unmounts (tool switch) so a
  // long run cannot setState into a dead component.
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (renamedCount === null) return;
    const t = window.setTimeout(() => setRenamedCount(null), 3000);
    return () => window.clearTimeout(t);
  }, [renamedCount]);

  /** Photos in the gallery that have never been scanned. Adding photos after a
   *  scan leaves them here rather than silently naming them "image". */
  const unscanned = useMemo(
    () => photos.filter((p) => !described.has(p.id)),
    [photos, described],
  );

  const scan = useCallback(async () => {
    if (photos.length === 0) return;
    setScanning(true);
    setErrorMsg(null);
    setProgress({ done: 0, total: photos.length });

    try {
      const { default: init, describe_image } = await import("stamp_tool");
      await init();

      const next = new Map<string, ImageDescription>();
      let done = 0;
      for (const photo of photos) {
        if (!aliveRef.current) return;
        try {
          // Reuse the decode cache the gallery already fills — re-scanning a
          // gallery you have been clicking through costs almost nothing.
          let working = getWorkingCopy(photo.originalKey);
          if (!working) {
            const original = await getOriginal(photo.originalKey);
            if (original) {
              const file = new File([original.bytes], original.name, {
                type: original.mimeType,
              });
              working = await makeWorkingCopy(file);
              putWorkingCopy(photo.originalKey, working);
            }
          }
          if (!working) {
            next.set(photo.id, UNKNOWN_DESCRIPTION);
          } else {
            // byteOffset/byteLength-aware view: some platforms hand back
            // non-zero-offset ImageData buffers. `describe_image` takes a
            // `&[u8]`, which wasm-bindgen COPIES in — the cached working copy
            // is not detached and stays reusable.
            const bytes = new Uint8Array(
              working.pixels.buffer as ArrayBuffer,
              working.pixels.byteOffset,
              working.pixels.byteLength,
            );
            next.set(
              photo.id,
              parseDescription(describe_image(bytes, working.width, working.height)),
            );
          }
        } catch (err) {
          // One unreadable photo costs one name, not the run.
          console.error("[ai-rename] failed to describe", photo.id, err);
          next.set(photo.id, UNKNOWN_DESCRIPTION);
        }
        done++;
        setProgress({ done, total: photos.length });
        if (done % YIELD_EVERY === 0) {
          await new Promise((r) => window.setTimeout(r, 0));
        }
      }
      if (!aliveRef.current) return;
      setDescribed(next);
    } catch (err) {
      console.error("[ai-rename] fatal", err);
      setErrorMsg("Couldn't read the images. Check the console.");
      toast.error("Couldn't scan the images. Check the console.");
    } finally {
      if (aliveRef.current) setScanning(false);
    }
  }, [photos]);

  /** The photos this run will actually rename: the ones that were scanned.
   *  Anything added since the scan keeps its name until a rescan — better a
   *  stale name than confidently calling an unexamined photo "image". */
  const targets = useMemo(
    () => photos.filter((p) => described.has(p.id)),
    [photos, described],
  );

  /** Final names for `targets`, in gallery order, collisions already resolved.
   *  Recomputed from the descriptions on every pattern keystroke — no re-scan. */
  const proposed = useMemo(() => {
    if (targets.length === 0) return [];
    const raw = targets.map((p, i) =>
      applyDescriptionPattern(pattern, {
        description: described.get(p.id) ?? UNKNOWN_DESCRIPTION,
        originalName: p.name,
        index: i,
        start,
        pad,
      }),
    );
    // Seed the dedupe with the names of the photos we are NOT renaming, so a
    // generated name cannot collide with one that is staying put. They are
    // first in the list, so they win and the generated names step around them.
    const keeping = photos
      .filter((p) => !described.has(p.id))
      .map((p) => splitExtension(p.name)[0]);
    return dedupeNames([...keeping, ...raw]).slice(keeping.length);
  }, [photos, targets, described, pattern, start, pad]);

  const apply = useCallback(() => {
    if (proposed.length === 0) return;
    const byId = new Map(targets.map((p, i) => [p.id, proposed[i]]));
    setPhotos((prev) =>
      prev.map((p) => {
        const base = byId.get(p.id);
        if (!base) return p; // added since the scan — leave its name alone
        // Gallery names are stored without an extension, but a photo whose
        // name carries one keeps it rather than losing it here.
        const [, ext] = splitExtension(p.name);
        return { ...p, name: base + ext };
      }),
    );
    setRenamedCount(byId.size);
    toast.success(`Renamed ${byId.size} image${byId.size === 1 ? "" : "s"}`);
  }, [targets, proposed, setPhotos]);

  const inputCls =
    "w-full rounded-md border border-border bg-bg-elevated px-2 py-1.5 text-xs text-text-primary";

  const preview = targets.slice(0, 5).map((p, i) => ({
    from: p.name,
    to: proposed[i] ?? "",
    desc: described.get(p.id),
  }));

  return (
    <div className="space-y-3 pt-1">
      <SectionHeader
        title="AI Rename"
        info={
          <>
            Scans each photo in the Rust engine and names it from what it sees —
            dominant colour, tone, whether it&rsquo;s a photo, a graphic or a
            screenshot, and a coarse subject guess (portrait / nature / sky).
            Runs offline, no account needed. It describes an image; it
            doesn&rsquo;t recognise objects in it, so expect{" "}
            <span className="font-mono">dark-blue-portrait</span>, not{" "}
            <span className="font-mono">golden-retriever</span>. Tokens:{" "}
            <span className="font-mono">{"{desc}"}</span>,{" "}
            <span className="font-mono">{"{color}"}</span>,{" "}
            <span className="font-mono">{"{subject}"}</span>,{" "}
            <span className="font-mono">{"{kind}"}</span>,{" "}
            <span className="font-mono">{"{tone}"}</span>,{" "}
            <span className="font-mono">{"{orientation}"}</span>,{" "}
            <span className="font-mono">{"{detail}"}</span>,{" "}
            <span className="font-mono">{"{name}"}</span>,{" "}
            <span className="font-mono">{"{n}"}</span>.
          </>
        }
      />

      <Button
        size="large"
        onClick={() => void scan()}
        disabled={scanning || photos.length === 0}
        className="w-full"
      >
        <ScanEye className="h-4 w-4" />
        {scanning
          ? `Scanning ${progress.done}/${progress.total}…`
          : described.size > 0
            ? `Rescan ${photos.length} image${photos.length === 1 ? "" : "s"}`
            : `Scan ${photos.length} image${photos.length === 1 ? "" : "s"}`}
      </Button>

      {described.size > 0 && unscanned.length > 0 && (
        <div
          role="status"
          className="rounded-md border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-2xs text-warning"
        >
          {`${unscanned.length} image${unscanned.length === 1 ? "" : "s"} added since the scan — rescan to name ${unscanned.length === 1 ? "it" : "them"} too`}
        </div>
      )}

      {described.size > 0 && (
        <>
          <div className="space-y-1">
            <span className="text-2xs text-theme-muted-foreground">Name pattern</span>
            <input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder={DEFAULT_PATTERN}
              className={`${inputCls} font-mono`}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-2xs text-theme-muted-foreground">Start #</span>
              <input
                type="number"
                min={0}
                value={start}
                onChange={(e) => setStart(parseInt(e.target.value, 10) || 0)}
                className={`${inputCls} tabular-nums`}
              />
            </label>
            <label className="space-y-1">
              <span className="text-2xs text-theme-muted-foreground">Pad digits</span>
              <input
                type="number"
                min={1}
                max={6}
                value={pad}
                onChange={(e) =>
                  setPad(Math.max(1, Math.min(6, parseInt(e.target.value, 10) || 1)))
                }
                className={`${inputCls} tabular-nums`}
              />
            </label>
          </div>

          <div className="space-y-1">
            <span className="text-2xs text-theme-muted-foreground">Preview</span>
            {preview.map((row, i) => (
              <div
                key={i}
                className="full-width-badge"
                title={
                  row.desc
                    ? `${row.from} → ${row.to} — seen as: ${describedAs(row.desc)}`
                    : `${row.from} → ${row.to}`
                }
              >
                <span className="large-badge text-theme-muted-foreground line-through">
                  {row.from}
                </span>
                <span className="history-index">→</span>
                <span className="large-badge font-mono text-text-primary">{row.to}</span>
              </div>
            ))}
            {targets.length > preview.length && (
              <p className="text-2xs text-theme-muted-foreground">
                +{targets.length - preview.length} more
              </p>
            )}
          </div>

          <Button
            size="large"
            onClick={apply}
            disabled={scanning || proposed.length === 0}
            className="w-full"
          >
            Rename {targets.length} image{targets.length === 1 ? "" : "s"}
          </Button>
        </>
      )}

      {renamedCount !== null && !scanning && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-md border border-success/40 bg-success/10 px-2.5 py-1.5 text-2xs text-success"
        >
          {`✓ Renamed ${renamedCount} image${renamedCount === 1 ? "" : "s"}`}
        </div>
      )}

      {errorMsg && (
        <p className="text-2xs text-destructive leading-relaxed">{errorMsg}</p>
      )}
    </div>
  );
}
