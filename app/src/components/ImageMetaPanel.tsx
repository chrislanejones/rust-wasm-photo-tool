import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Fingerprint,
  Hash,
  Copy,
  Check,
  RefreshCw,
  ImageOff,
  Layers as LayersIcon,
  Camera,
  MapPin,
  CalendarClock,
} from "lucide-react";
import { settingsPanelMotion } from "@/lib/animations";
import { formatBytes } from "@/lib/format";
import { sha256Hex } from "@/lib/originalsStore";
import { getOriginal } from "@/lib/dexie/originalsAdapter";
import { parseExifFromImage, type ExifSummary } from "@/lib/exif";

/** Everything the image-meta tab needs about the currently selected photo.
 *  Assembled by AppShell, which is the only place that knows both the gallery
 *  entry and the live WASM canvas. */
export interface ImageMeta {
  /** Editor id of the active photo (also the Convex `photoKey`). null = none. */
  photoId: string | null;
  name?: string;
  mimeType?: string;
  origWidth?: number;
  origHeight?: number;
  currentWidth?: number;
  currentHeight?: number;
  originalByteSize?: number;
  currentByteSize?: number;
  /** SHA-256 hex of the untouched upload — the content key in IndexedDB. */
  originalKey?: string;
  /** Immutable upload baseline key (A/B compare). May equal originalKey. */
  uploadKey?: string;
  undoCount?: number;
  redoCount?: number;
  modified?: boolean;
  /** Returns the current composited canvas as PNG bytes, or null if no tool. */
  getCanvasPng?: () => Uint8Array | null;
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="shrink-0 text-text-muted">{label}</span>
      <span className="min-w-0 text-right text-text-primary">{children}</span>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(value).then(
          () => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          },
          () => {},
        );
      }}
      className="rounded p-1 text-text-muted transition-colors hover:bg-card hover:text-text-primary"
      title="Copy"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-success" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

/** A 64-char SHA-256 in a monospace, wrap-anywhere box with a copy control. */
function HashBox({
  icon: Icon,
  title,
  subtitle,
  hash,
  pending,
  tone = "zinc",
  onRefresh,
}: {
  icon: typeof Hash;
  title: string;
  subtitle: string;
  hash: string | null;
  pending?: boolean;
  tone?: "zinc" | "emerald";
  onRefresh?: () => void;
}) {
  const accent = tone === "emerald" ? "text-success" : "text-warning";
  return (
    <div className="rounded-lg border border-border bg-background/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${accent}`} />
          <div className="leading-tight">
            <div className="text-2xs font-semibold uppercase tracking-wider text-text-secondary">
              {title}
            </div>
            <div className="text-2xs text-text-muted">{subtitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="rounded p-1 text-text-muted transition-colors hover:bg-card hover:text-text-primary"
              title="Recompute"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${pending ? "spinner-icon" : ""}`}
              />
            </button>
          )}
          {hash && <CopyButton value={hash} />}
        </div>
      </div>
      <div
        className={`break-all font-mono text-xs leading-relaxed ${
          hash ? accent : "text-text-muted"
        }`}
      >
        {pending ? "computing…" : (hash ?? "—")}
      </div>
    </div>
  );
}

export function ImageMetaPanel({
  active,
  meta,
}: {
  active: boolean;
  meta: ImageMeta;
}) {
  const [canvasHash, setCanvasHash] = useState<string | null>(null);
  const [canvasBytes, setCanvasBytes] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [exif, setExif] = useState<ExifSummary | null>(null);
  const [exifChecked, setExifChecked] = useState(false);

  // Read the latest getter through a ref so `recompute` stays stable and the
  // effect below doesn't re-fire every render.
  const getPngRef = useRef(meta.getCanvasPng);
  getPngRef.current = meta.getCanvasPng;

  const recompute = useCallback(async () => {
    const png = getPngRef.current?.();
    if (!png || png.length === 0) {
      setCanvasHash(null);
      setCanvasBytes(null);
      return;
    }
    setPending(true);
    try {
      // .slice() copies into a fresh ArrayBuffer-backed view so the bytes
      // satisfy BufferSource regardless of the source buffer's flavour.
      const hex = await sha256Hex(png.slice().buffer as ArrayBuffer);
      setCanvasHash(hex);
      setCanvasBytes(png.length);
    } catch {
      setCanvasHash(null);
      setCanvasBytes(null);
    } finally {
      setPending(false);
    }
  }, []);

  // Recompute when the tab opens, when the photo changes, and after any edit
  // that changes the canvas dimensions or history depth.
  useEffect(() => {
    if (!active) return;
    if (!meta.photoId) {
      setCanvasHash(null);
      setCanvasBytes(null);
      return;
    }
    recompute();
  }, [
    active,
    meta.photoId,
    meta.currentWidth,
    meta.currentHeight,
    meta.undoCount,
    recompute,
  ]);

  // Read + parse EXIF from the *true* original (uploadKey). originalKey may
  // point at re-encoded/compressed bytes that no longer carry EXIF.
  useEffect(() => {
    if (!active || !meta.photoId) {
      setExif(null);
      setExifChecked(false);
      return;
    }
    let alive = true;
    setExifChecked(false);
    const key = meta.uploadKey ?? meta.originalKey;
    (async () => {
      if (!key) {
        if (alive) {
          setExif(null);
          setExifChecked(true);
        }
        return;
      }
      try {
        const orig = await getOriginal(key);
        const parsed = orig
          ? parseExifFromImage(new Uint8Array(orig.bytes), orig.mimeType)
          : null;
        if (alive) {
          setExif(parsed);
          setExifChecked(true);
        }
      } catch {
        if (alive) {
          setExif(null);
          setExifChecked(true);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [active, meta.photoId, meta.uploadKey, meta.originalKey]);

  const savings =
    meta.originalByteSize && meta.currentByteSize && meta.originalByteSize > 0
      ? Math.round((1 - meta.currentByteSize / meta.originalByteSize) * 100)
      : null;

  return (
    <motion.div
      key="imagemeta"
      {...settingsPanelMotion}
      className="space-y-4 p-4 font-mono text-xs"
    >
      {!meta.photoId ? (
        <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-text-muted">
          <ImageOff className="h-6 w-6" />
          <span>No image selected.</span>
        </div>
      ) : (
        <>
          {/* SHA-256 hashes */}
          <HashBox
            icon={Hash}
            title="Current canvas SHA-256"
            subtitle="hash of the live pixels — changes with every edit"
            hash={canvasHash}
            pending={pending}
            tone="emerald"
            onRefresh={recompute}
          />
          <HashBox
            icon={Fingerprint}
            title="Original SHA-256"
            subtitle="content key of the untouched upload (IndexedDB)"
            hash={meta.originalKey ?? null}
            tone="zinc"
          />

          {/* Identity */}
          <div className="rounded-lg border border-border bg-background/40 px-3 py-1">
            <Row label="Name">
              <span className="break-all">{meta.name ?? "—"}</span>
            </Row>
            <Row label="MIME type">{meta.mimeType ?? "—"}</Row>
            <Row label="Photo key">
              <span className="break-all text-text-secondary">{meta.photoId}</span>
            </Row>
          </div>

          {/* Dimensions + size */}
          <div className="rounded-lg border border-border bg-background/40 px-3 py-1">
            <Row label="Original size">
              {meta.origWidth && meta.origHeight
                ? `${meta.origWidth} × ${meta.origHeight}`
                : "—"}
            </Row>
            <Row label="Current size">
              {meta.currentWidth && meta.currentHeight
                ? `${meta.currentWidth} × ${meta.currentHeight}`
                : "—"}
            </Row>
            <Row label="Original bytes">
              {formatBytes(meta.originalByteSize) ?? "—"}
            </Row>
            <Row label="Current bytes">
              {formatBytes(meta.currentByteSize) ?? "—"}
              {savings != null && savings > 0 && (
                <span className="ml-2 text-success">−{savings}%</span>
              )}
            </Row>
            <Row label="Canvas PNG bytes">
              {canvasBytes != null ? formatBytes(canvasBytes) : "—"}
            </Row>
          </div>

          {/* Capture metadata (EXIF) */}
          <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
            <div className="mb-1 flex items-center gap-2 text-2xs font-semibold uppercase tracking-wider text-text-secondary">
              <Camera className="h-3.5 w-3.5 text-sky-400" />
              Capture metadata (EXIF)
            </div>
            {!exifChecked ? (
              <div className="py-2 text-center text-text-muted">reading…</div>
            ) : !exif ? (
              <div className="py-2 text-text-muted">
                No EXIF metadata in the original
                {meta.mimeType &&
                meta.mimeType !== "image/jpeg" &&
                meta.mimeType !== "image/webp"
                  ? ` (${meta.mimeType} carries none)`
                  : ""}
                .
              </div>
            ) : (
              <>
                {(exif.make || exif.model) && (
                  <Row label="Camera">
                    <span className="break-all">
                      {[exif.make, exif.model].filter(Boolean).join(" ")}
                    </span>
                  </Row>
                )}
                {exif.lens && (
                  <Row label="Lens">
                    <span className="break-all">{exif.lens}</span>
                  </Row>
                )}
                {exif.dateTaken && (
                  <Row label="Taken">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3 w-3 text-zinc-500" />
                      {exif.dateTaken}
                    </span>
                  </Row>
                )}
                {(exif.exposure || exif.fNumber || exif.iso || exif.focalLength) && (
                  <Row label="Exposure">
                    {[
                      exif.exposure,
                      exif.fNumber,
                      exif.iso ? `ISO ${exif.iso}` : null,
                      exif.focalLength,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Row>
                )}
                {exif.orientation != null && (
                  <Row label="Orientation">{exif.orientation}</Row>
                )}
                {exif.software && (
                  <Row label="Software">
                    <span className="break-all">{exif.software}</span>
                  </Row>
                )}
                <Row label="GPS">
                  {exif.gps ? (
                    <a
                      href={`https://www.google.com/maps?q=${exif.gps.lat},${exif.gps.lon}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sky-400 hover:underline"
                    >
                      <MapPin className="h-3 w-3" />
                      {exif.gps.lat.toFixed(5)}, {exif.gps.lon.toFixed(5)}
                    </a>
                  ) : (
                    <span className="text-text-muted">none</span>
                  )}
                </Row>
              </>
            )}
            {exif?.gps && (
              <div className="mt-1.5 flex items-start gap-1.5 text-2xs leading-snug text-warning/80">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                <span>
                  Location is embedded. Unlock the EXIF padlock in Compress to
                  strip it on export.
                </span>
              </div>
            )}
          </div>

          {/* Edit state */}
          <div className="rounded-lg border border-border bg-background/40 px-3 py-1">
            <Row label="Undo steps">{meta.undoCount ?? 0}</Row>
            <Row label="Redo steps">{meta.redoCount ?? 0}</Row>
            <Row label="Modified">
              {meta.modified ? (
                <span className="text-warning">yes — pending sync</span>
              ) : (
                <span className="text-text-muted">no</span>
              )}
            </Row>
          </div>

          <div className="flex items-start gap-2 px-1 text-2xs leading-relaxed text-text-muted">
            <LayersIcon className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              The full edit archive (canvas + undo/redo + layers + overlays) is
              uploaded to Convex storage keyed by the photo key; originals are
              content-addressed by SHA-256. The canvas hash above fingerprints
              the current pixels inside that archive.
            </span>
          </div>
        </>
      )}
    </motion.div>
  );
}
