// Self-contained mask painter for AI Object Removal. Renders the current frame
// on a canvas, lets the user brush over the object to erase, then builds a
// black/white mask PNG (white = region to remove) at the image's native
// resolution and hands it back. No dependency on the main WASM canvas.
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { X, Eraser, Loader2, Undo2 } from "lucide-react";
import { fadeIn, quickSpring } from "@/lib/animations";

interface Props {
  open: boolean;
  busy?: boolean;
  /** Source frame as PNG bytes (current canvas export). */
  sourcePng: Uint8Array | null;
  onClose: () => void;
  onConfirm: (maskPng: Uint8Array) => void;
}

export function ObjectRemovalModal({
  open,
  busy = false,
  sourcePng,
  onClose,
  onConfirm,
}: Props) {
  const imgCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [brush, setBrush] = useState(40);
  const [hasMask, setHasMask] = useState(false);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  // Decode the source PNG and paint it onto the image canvas; reset the mask.
  useEffect(() => {
    if (!open || !sourcePng) return;
    let cancelled = false;
    const blob = new Blob([sourcePng.buffer as ArrayBuffer], { type: "image/png" });
    void createImageBitmap(blob).then((bmp) => {
      if (cancelled) {
        bmp.close();
        return;
      }
      setDims({ w: bmp.width, h: bmp.height });
      requestAnimationFrame(() => {
        const ic = imgCanvasRef.current;
        const mc = maskCanvasRef.current;
        if (ic) {
          ic.width = bmp.width;
          ic.height = bmp.height;
          ic.getContext("2d")?.drawImage(bmp, 0, 0);
        }
        if (mc) {
          mc.width = bmp.width;
          mc.height = bmp.height;
          mc.getContext("2d")?.clearRect(0, 0, mc.width, mc.height);
        }
        setHasMask(false);
        bmp.close();
      });
    });
    return () => {
      cancelled = true;
    };
  }, [open, sourcePng]);

  const toNative = (e: React.PointerEvent) => {
    const mc = maskCanvasRef.current!;
    const rect = mc.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * mc.width,
      y: ((e.clientY - rect.top) / rect.height) * mc.height,
    };
  };

  const paint = (x: number, y: number) => {
    const mc = maskCanvasRef.current;
    const ctx = mc?.getContext("2d");
    if (!mc || !ctx) return;
    ctx.fillStyle = "rgba(239,68,68,1)";
    ctx.strokeStyle = "rgba(239,68,68,1)";
    ctx.lineWidth = brush;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (last.current) {
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, brush / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    last.current = { x, y };
    setHasMask(true);
  };

  const onDown = (e: React.PointerEvent) => {
    if (busy) return;
    drawing.current = true;
    last.current = null;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = toNative(e);
    paint(p.x, p.y);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const p = toNative(e);
    paint(p.x, p.y);
  };
  const onUp = () => {
    drawing.current = false;
    last.current = null;
  };

  const clearMask = () => {
    const mc = maskCanvasRef.current;
    mc?.getContext("2d")?.clearRect(0, 0, mc.width, mc.height);
    setHasMask(false);
  };

  const confirm = async () => {
    const mc = maskCanvasRef.current;
    if (!mc) return;
    // Binarize: white where painted (alpha > threshold), black elsewhere.
    const src = mc.getContext("2d")!.getImageData(0, 0, mc.width, mc.height);
    const out = new ImageData(mc.width, mc.height);
    for (let i = 0; i < src.data.length; i += 4) {
      const v = src.data[i + 3] > 10 ? 255 : 0;
      out.data[i] = v;
      out.data[i + 1] = v;
      out.data[i + 2] = v;
      out.data[i + 3] = 255;
    }
    const tmp = document.createElement("canvas");
    tmp.width = mc.width;
    tmp.height = mc.height;
    tmp.getContext("2d")!.putImageData(out, 0, 0);
    const blob: Blob = await new Promise((res) =>
      tmp.toBlob((b) => res(b!), "image/png"),
    );
    onConfirm(new Uint8Array(await blob.arrayBuffer()));
  };

  // Portal to <body> so the modal escapes the transformed sidebar's stacking
  // context — otherwise the gallery/panels (their own stacking contexts) cover
  // it, same reason the Settings modal is portaled.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={busy ? undefined : onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Object Removal"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={quickSpring}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-[min(720px,95vw)] flex-col overflow-hidden rounded-xl border border-border bg-background text-text-primary shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Eraser className="h-4 w-4" /> Object Removal
              </div>
              <button
                onClick={onClose}
                disabled={busy}
                aria-label="Close"
                className="rounded p-1 text-text-secondary hover:bg-card hover:text-text-primary disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-4 pt-3 text-2xs text-text-secondary">
              Paint over the object you want to remove, then click Remove Object.
            </div>

            <div className="flex-1 overflow-auto p-4">
              <div
                className="relative mx-auto w-full"
                style={{ maxWidth: dims ? Math.min(dims.w, 640) : 640 }}
              >
                <canvas ref={imgCanvasRef} className="block w-full rounded-md" />
                <canvas
                  ref={maskCanvasRef}
                  className="absolute inset-0 w-full cursor-crosshair touch-none rounded-md opacity-50"
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerLeave={onUp}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-border px-4 py-3">
              <label className="flex items-center gap-2 text-2xs text-text-secondary">
                Brush
                <input
                  type="range"
                  min={8}
                  max={120}
                  value={brush}
                  onChange={(e) => setBrush(Number(e.target.value))}
                  className="w-24"
                />
                <span className="w-6 tabular-nums">{brush}</span>
              </label>
              <button
                onClick={clearMask}
                disabled={!hasMask || busy}
                className="flex items-center gap-1 rounded px-2 py-1 text-2xs text-text-secondary hover:bg-card hover:text-text-primary disabled:opacity-40"
              >
                <Undo2 className="h-3.5 w-3.5" /> Clear
              </button>
              <div className="flex-1" />
              <button
                onClick={onClose}
                disabled={busy}
                className="rounded-md px-3 py-1.5 text-xs text-text-secondary hover:bg-card disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={confirm}
                disabled={!hasMask || busy}
                className="flex items-center justify-center gap-2 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {busy ? "Removing..." : "Remove Object"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
