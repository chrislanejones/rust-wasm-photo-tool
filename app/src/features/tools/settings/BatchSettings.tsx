// Bulk-logo stamper: pick a logo file, then stamp it onto every photo at a
// chosen corner/center with a chosen size + opacity. The active photo's stamp
// goes through the live WASM tool so it gets a normal undo entry; all other
// photos are persisted to IDB irreversibly.
import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToolButton } from "@/components/ui/tool-button";
import { TabGroup } from "@/components/TabGroup";
import { SizeSlider } from "@/components/SizeSlider";
import { ColorSwatchGrid } from "@/components/ColorSwatchGrid";
import { TEXT_COLORS } from "@/lib/colors";
import { getOriginal, putOriginal } from "@/lib/originalsStore";
import {
  makeWorkingCopy,
  makeThumbnail,
  makeThumbnailFromPixels,
} from "@/lib/workingCopy";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";
import type { ImageHorseTool } from "stamp_tool";

const LOGO_SIZE_PRESETS = [5, 15, 25, 40] as const;

type LogoPosition =
  | "top-left"
  | "top-right"
  | "center"
  | "bottom-left"
  | "bottom-right";

interface LogoState {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  previewUrl: string;
}

interface BatchSettingsProps {
  photos: PhotoEntry[];
  activePhotoId: string | null;
  setPhotos: React.Dispatch<React.SetStateAction<PhotoEntry[]>>;
  stampToolRef: React.MutableRefObject<ImageHorseTool | null>;
  /** Re-blit the WASM buffer to the live canvas without touching history. */
  flushToCanvas: () => void;
  /** Notify parent that the active photo's history was mutated. */
  syncState: () => void;
}

const POSITIONS: { id: LogoPosition; label: string }[] = [
  { id: "top-left", label: "TL" },
  { id: "top-right", label: "TR" },
  { id: "center", label: "C" },
  { id: "bottom-left", label: "BL" },
  { id: "bottom-right", label: "BR" },
];

function computeOffset(
  pos: LogoPosition,
  workW: number,
  workH: number,
  logoW: number,
  logoH: number,
  margin: number,
): { dx: number; dy: number } {
  switch (pos) {
    case "top-left":
      return { dx: margin, dy: margin };
    case "top-right":
      return { dx: workW - logoW - margin, dy: margin };
    case "center":
      return {
        dx: Math.round((workW - logoW) / 2),
        dy: Math.round((workH - logoH) / 2),
      };
    case "bottom-left":
      return { dx: margin, dy: workH - logoH - margin };
    case "bottom-right":
    default:
      return { dx: workW - logoW - margin, dy: workH - logoH - margin };
  }
}

/**
 * Decode an image file to an ImageBitmap. `createImageBitmap(file)` is
 * unreliable for SVGs (some browsers fail outright), so when the file looks
 * like an SVG we rasterize via an `<img>` element + OffscreenCanvas instead.
 */
async function decodeImageFile(file: File): Promise<ImageBitmap> {
  const isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
  if (!isSvg) return createImageBitmap(file);

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("SVG load failed"));
      i.src = url;
    });
    // SVGs without explicit width/height attributes report 0 — pick a sane default.
    const w = img.naturalWidth > 0 ? img.naturalWidth : 512;
    const h = img.naturalHeight > 0 ? img.naturalHeight : 512;
    const oc = new OffscreenCanvas(w, h);
    const ctx = oc.getContext("2d");
    if (!ctx) throw new Error("OffscreenCanvas 2D ctx unavailable");
    ctx.drawImage(img, 0, 0, w, h);
    return await createImageBitmap(oc);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Decode the full-resolution logo bitmap to raw RGBA pixels once, then hand
 * them to the WASM bilinear resizer for the actual scaling math. This keeps
 * the per-photo work in Rust instead of round-tripping through OffscreenCanvas
 * for every photo.
 */
async function scaleLogoToWidth(
  bitmap: ImageBitmap,
  targetW: number,
  resizePixels: (
    pixels: Uint8Array,
    oldW: number,
    oldH: number,
    newW: number,
    newH: number,
  ) => Uint8Array,
): Promise<{ pixels: Uint8ClampedArray; width: number; height: number }> {
  const aspect = bitmap.height / bitmap.width;
  const w = Math.max(1, Math.floor(targetW));
  const h = Math.max(1, Math.floor(w * aspect));

  // 1) Extract full-res RGBA from the decoded bitmap (this initial decode
  //    is unavoidable in JS — createImageBitmap doesn't give pixel access).
  const srcOc = new OffscreenCanvas(bitmap.width, bitmap.height);
  const srcCtx = srcOc.getContext("2d", { willReadFrequently: true })!;
  srcCtx.drawImage(bitmap, 0, 0);
  const srcData = srcCtx.getImageData(0, 0, bitmap.width, bitmap.height);
  const srcBytes = new Uint8Array(srcData.data.buffer as ArrayBuffer);

  // 2) Scale in Rust.
  const resized = resizePixels(srcBytes, bitmap.width, bitmap.height, w, h);
  const clamped = new Uint8ClampedArray(
    resized.buffer as ArrayBuffer,
    resized.byteOffset,
    resized.byteLength,
  );
  return { pixels: clamped, width: w, height: h };
}

export function BatchSettings({
  photos,
  activePhotoId,
  setPhotos,
  stampToolRef,
  flushToCanvas,
  syncState,
}: BatchSettingsProps) {
  const [logo, setLogo] = useState<LogoState | null>(null);
  const [position, setPosition] = useState<LogoPosition>("bottom-right");
  const [sizePercent, setSizePercent] = useState(15);
  const [opacity, setOpacity] = useState(100);
  const [margin, setMargin] = useState(24);
  const [isDragOver, setIsDragOver] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [appliedCount, setAppliedCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-dismiss the "Applied to N images" confirmation chip after 3s.
  useEffect(() => {
    if (appliedCount === null) return;
    const t = window.setTimeout(() => setAppliedCount(null), 3000);
    return () => window.clearTimeout(t);
  }, [appliedCount]);

  // Clean up the preview blob URL when the logo changes/unmounts.
  useEffect(() => {
    return () => {
      if (logo) {
        URL.revokeObjectURL(logo.previewUrl);
        logo.bitmap.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logo?.previewUrl]);

  const handleFile = useCallback(
    async (file: File) => {
      setErrorMsg(null);
      if (!file.type.startsWith("image/")) {
        setErrorMsg("Pick an image file (PNG, JPG, WebP, SVG).");
        return;
      }
      try {
        const bitmap = await decodeImageFile(file);
        const previewUrl = URL.createObjectURL(file);
        setLogo((prev) => {
          if (prev) {
            URL.revokeObjectURL(prev.previewUrl);
            prev.bitmap.close();
          }
          return {
            bitmap,
            width: bitmap.width,
            height: bitmap.height,
            previewUrl,
          };
        });
      } catch (err) {
        console.error("Failed to decode logo:", err);
        setErrorMsg("Could not decode that file");
      }
    },
    [],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) void handleFile(f);
    },
    [handleFile],
  );

  const onPickClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) void handleFile(f);
      e.target.value = "";
    },
    [handleFile],
  );

  const clearLogo = useCallback(() => {
    setLogo((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev.previewUrl);
        prev.bitmap.close();
      }
      return null;
    });
  }, []);

  const applyToAll = useCallback(async () => {
    if (!logo) return;
    setRunning(true);
    setErrorMsg(null);
    setProgress({ done: 0, total: photos.length });

    try {
      const { default: init, composite_pixels, resize_pixels, encode_png_pixels } =
        await import("stamp_tool");
      await init();

      const opacity01 = opacity / 100;
      let done = 0;
      let succeeded = 0;

      // First pass: every photo that's NOT the active one — write back to IDB.
      const others = photos.filter((p) => p.id !== activePhotoId);
      for (const photo of others) {
        try {
          const original = await getOriginal(photo.originalKey);
          if (!original) {
            done++;
            setProgress({ done, total: photos.length });
            continue;
          }
          const file = new File([original.bytes], original.name, {
            type: original.mimeType,
          });
          const working = await makeWorkingCopy(file);

          const targetLogoW = Math.max(
            1,
            Math.floor((working.width * sizePercent) / 100),
          );
          const scaled = await scaleLogoToWidth(
            logo.bitmap,
            targetLogoW,
            resize_pixels,
          );
          const { dx, dy } = computeOffset(
            position,
            working.width,
            working.height,
            scaled.width,
            scaled.height,
            margin,
          );

          // Safer byteOffset/byteLength-aware Uint8Array wraps: some platforms
          // return non-zero-offset ImageData buffers, so the bare
          // `new Uint8Array(buffer)` view wouldn't line up with the pixel data.
          const targetBytes = new Uint8Array(
            working.pixels.buffer as ArrayBuffer,
            working.pixels.byteOffset,
            working.pixels.byteLength,
          );
          const srcBytes = new Uint8Array(
            scaled.pixels.buffer as ArrayBuffer,
            scaled.pixels.byteOffset,
            scaled.pixels.byteLength,
          );
          const composited = composite_pixels(
            targetBytes,
            working.width,
            working.height,
            srcBytes,
            scaled.width,
            scaled.height,
            dx,
            dy,
            opacity01,
          );

          // Encode as PNG entirely in Rust — no canvas round-trip.
          const pngBytes = encode_png_pixels(
            composited,
            working.width,
            working.height,
          );
          const pngBlob = new Blob([pngBytes.buffer as ArrayBuffer], {
            type: "image/png",
          });
          const newName = photo.name.replace(/\.[^.]+$/, "") + ".png";
          const newFile = new File([pngBlob], newName, { type: "image/png" });

          // Build the thumbnail directly from the composited RGBA buffer —
          // no need to re-decode the PNG we just encoded.
          const [newKey, newThumbCandidate] = await Promise.all([
            putOriginal(newFile, working.origWidth, working.origHeight),
            makeThumbnailFromPixels(
              composited,
              working.width,
              working.height,
              resize_pixels,
            ),
          ]);

          // Defensive fallback: if the pixel-based thumbnail came back
          // suspiciously empty (encode glitch, transparent buffer, etc.),
          // decode the freshly-encoded PNG instead. Slower but known-good.
          let newThumb = newThumbCandidate;
          if (newThumb.size < 200) {
            console.warn(
              "[batch-logo] thumb from pixels was tiny",
              { id: photo.id, size: newThumb.size },
              "— falling back to PNG decode",
            );
            try {
              newThumb = await makeThumbnail(newFile);
            } catch (fallbackErr) {
              console.error(
                "[batch-logo] thumbnail fallback also failed",
                photo.id,
                fallbackErr,
              );
            }
          }

          setPhotos((prev) =>
            prev.map((x) =>
              x.id !== photo.id
                ? x
                : {
                    ...x,
                    mimeType: "image/png",
                    byteSize: pngBlob.size,
                    originalKey: newKey,
                    thumbBlob: newThumb,
                  },
            ),
          );
          succeeded++;
        } catch (err) {
          console.error("Bulk-logo: failed on photo", photo.id, err);
        }
        done++;
        setProgress({ done, total: photos.length });
      }

      // Second pass: the active photo, via the live tool so we get an undo entry.
      const active = photos.find((p) => p.id === activePhotoId);
      if (active) {
        try {
          const tool = stampToolRef.current;
          if (tool) {
            // Use the current canvas dimensions so we composite onto exactly
            // what the user sees.
            const workW = tool.width();
            const workH = tool.height();
            const targetLogoW = Math.max(
              1,
              Math.floor((workW * sizePercent) / 100),
            );
            const scaled = await scaleLogoToWidth(
              logo.bitmap,
              targetLogoW,
              resize_pixels,
            );
            const { dx, dy } = computeOffset(
              position,
              workW,
              workH,
              scaled.width,
              scaled.height,
              margin,
            );
            const srcBytes = new Uint8Array(
              scaled.pixels.buffer as ArrayBuffer,
              scaled.pixels.byteOffset,
              scaled.pixels.byteLength,
            );
            // stamp_pixels pushes a snapshot, giving us undo support.
            tool.stamp_pixels(srcBytes, scaled.width, scaled.height, dx, dy);
            // Re-blit WASM pixels onto the canvas WITHOUT reloading — calling
            // load_image() here would wipe the undo entry we just created.
            // Then sync React state so the history panel + undo button update.
            flushToCanvas();
            syncState();
            succeeded++;
          }
        } catch (err) {
          console.error("Bulk-logo: failed on active photo", err);
        }
        done++;
        setProgress({ done, total: photos.length });
      }

      setAppliedCount(succeeded);
    } catch (err) {
      console.error("Bulk-logo: fatal error", err);
      setErrorMsg("Something went wrong. Check the console.");
    } finally {
      setRunning(false);
    }
  }, [
    logo,
    photos,
    activePhotoId,
    sizePercent,
    opacity,
    margin,
    position,
    setPhotos,
    stampToolRef,
    flushToCanvas,
    syncState,
  ]);

  const [mode, setMode] = useState<"logo" | "text">("logo");

  return (
    <div className="space-y-5">
      <TabGroup
        tabs={[
          { id: "logo", label: "Logo" },
          { id: "text", label: "Text" },
        ]}
        active={mode}
        onChange={(id) => setMode(id as "logo" | "text")}
      />
      {mode === "text" ? (
        <TextBatchPanel />
      ) : (
      <>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-theme-muted-foreground mb-2">
          Logo
        </p>
        {!logo ? (
          <div
            onClick={onPickClick}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center cursor-pointer transition-colors ${
              isDragOver
                ? "border-theme-primary bg-theme-primary/10"
                : "border-theme-muted/50 bg-theme-muted/20 hover:bg-theme-muted/30"
            }`}
          >
            <ImagePlus className="h-5 w-5 text-theme-muted-foreground" />
            <p className="text-[11px] text-theme-muted-foreground leading-relaxed">
              Drop a logo or click to pick.
              <br />
              PNG, JPG, WebP, SVG.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-theme-muted/20 px-3 py-2">
            <div className="checkerboard flex h-[60px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded">
              <img
                src={logo.previewUrl}
                alt="logo preview"
                className="max-h-[60px] max-w-[60px] object-contain"
                draggable={false}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-theme-foreground truncate">
                {logo.width}×{logo.height}
              </p>
              <button
                onClick={clearLogo}
                className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-theme-muted-foreground hover:text-theme-foreground"
                type="button"
              >
                <X className="h-3 w-3" /> Remove
              </button>
            </div>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,image/svg+xml,.svg"
          className="hidden"
          onChange={onFileInputChange}
        />
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-theme-muted-foreground mb-2">
          Position
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {POSITIONS.map((p) => (
            <ToolButton
              key={p.id}
              active={position === p.id}
              onClick={() => setPosition(p.id)}
            >
              {p.label}
            </ToolButton>
          ))}
        </div>
      </div>

      <SizeSlider
        variant="dots"
        label="Logo size"
        value={sizePercent}
        onChange={setSizePercent}
        presets={LOGO_SIZE_PRESETS}
        unit="%"
        valueDisplay={`${sizePercent}% of width`}
      />

      <SizeSlider
        label="Opacity"
        value={opacity}
        onChange={setOpacity}
        min={0}
        max={100}
        unit="%"
      />

      <SizeSlider
        label="Margin"
        value={margin}
        onChange={setMargin}
        min={0}
        max={80}
        unit="px"
        disabled={position === "center"}
      />

      <Button
        onClick={applyToAll}
        disabled={!logo || running || photos.length === 0}
        className="w-full"
      >
        {running
          ? `Processing ${progress.done}/${progress.total}…`
          : "Apply Logo to All Images"}
      </Button>

      {appliedCount !== null && !running && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-300"
        >
          {`✓ Applied to ${appliedCount} image${appliedCount === 1 ? "" : "s"}`}
        </div>
      )}

      {errorMsg && (
        <p className="text-[11px] text-red-400 leading-relaxed">{errorMsg}</p>
      )}
      </>
      )}
    </div>
  );
}

type TextPosition =
  | "top-left"
  | "top-right"
  | "center"
  | "bottom-left"
  | "bottom-right";

const TEXT_POSITIONS: { id: TextPosition; label: string }[] = [
  { id: "top-left", label: "TL" },
  { id: "top-right", label: "TR" },
  { id: "center", label: "C" },
  { id: "bottom-left", label: "BL" },
  { id: "bottom-right", label: "BR" },
];

function TextBatchPanel() {
  const [text, setText] = useState("");
  const [fontSize, setFontSize] = useState(32);
  const [fontFamily, setFontFamily] = useState("sans-serif");
  const [textColor, setTextColor] = useState("#ffffff");
  const [position, setPosition] = useState<TextPosition>("bottom-right");
  const [margin, setMargin] = useState(24);
  const [opacity, setOpacity] = useState(100);

  const handleApply = useCallback(() => {
    alert("Coming soon");
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-theme-muted-foreground mb-2">
          Text
        </p>
        <textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter overlay text…"
          className="w-full rounded-md border border-border bg-theme-muted/20 px-2 py-1.5 text-[11px] text-theme-foreground placeholder:text-theme-muted-foreground focus:outline-none focus:ring-1 focus:ring-theme-primary"
        />
      </div>

      <SizeSlider
        label="Font size"
        value={fontSize}
        onChange={setFontSize}
        min={12}
        max={96}
        unit="px"
      />

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-theme-muted-foreground mb-2">
          Font family
        </p>
        <select
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value)}
          className="w-full rounded-md border border-border bg-theme-muted/20 px-2 py-1.5 text-[11px] text-theme-foreground focus:outline-none focus:ring-1 focus:ring-theme-primary"
        >
          <option value="sans-serif">sans-serif</option>
          <option value="serif">serif</option>
          <option value="monospace">monospace</option>
          <option value="Liberation Sans">Liberation Sans</option>
        </select>
      </div>

      <ColorSwatchGrid
        colors={TEXT_COLORS}
        value={textColor}
        onChange={setTextColor}
      />

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-theme-muted-foreground mb-2">
          Position
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {TEXT_POSITIONS.map((p) => (
            <ToolButton
              key={p.id}
              active={position === p.id}
              onClick={() => setPosition(p.id)}
            >
              {p.label}
            </ToolButton>
          ))}
        </div>
      </div>

      <SizeSlider
        label="Margin"
        value={margin}
        onChange={setMargin}
        min={0}
        max={80}
        unit="px"
        disabled={position === "center"}
      />

      <SizeSlider
        label="Opacity"
        value={opacity}
        onChange={setOpacity}
        min={0}
        max={100}
        unit="%"
      />

      <button
        type="button"
        onClick={handleApply}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-theme-muted/30 px-3 py-2 text-[11px] font-medium text-theme-muted-foreground cursor-not-allowed"
      >
        Apply Text to All Images
        <span className="rounded-full bg-theme-muted/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-theme-foreground/70">
          Coming Soon
        </span>
      </button>
    </div>
  );
}
