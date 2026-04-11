// ===== FILE: app/src/features/gallery/PhotoThumb.tsx =====
// Per-thumbnail component with compression animation overlay.
// `compression` is just a number (0..100 progress, -1 error)
// matching the existing GalleryBar Record<string, number>.

import { motion, AnimatePresence } from "framer-motion";
import { Check, Zap } from "lucide-react";
import type { PhotoEntry } from "./GalleryBar";

interface Props {
  entry: PhotoEntry;
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
  /** 0..100 = progress, -1 = error, undefined = not compressing */
  compression?: number;
  /** Savings percent to show after compression (from compressProgress.savings) */
  savingsPercent?: number;
}

export function PhotoThumb({
  entry,
  isActive,
  onSelect,
  onRemove,
  compression,
  savingsPercent,
}: Props) {
  const progress = compression ?? null;
  const isCompressing = progress !== null && progress > 0 && progress < 100;
  const isDone = progress === 100;
  const isError = progress === -1;

  const hasTransparency = ["image/png", "image/webp", "image/svg+xml"].includes(
    entry.file.type,
  );

  return (
    <div
      className={`photo-thumb ${isActive ? "active" : ""}`}
      onClick={onSelect}
    >
      {hasTransparency && (
        <div className="absolute inset-0 checkerboard" />
      )}
      <img
        src={entry.url}
        alt={entry.name}
        className="photo-thumb-img"
        draggable={false}
      />

      <AnimatePresence>
        {/* Compressing: bottom-to-top green opacity fill */}
        {isCompressing && (
          <motion.div
            key="compressing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg overflow-hidden"
          >
            <div className="absolute inset-0 bg-black/50" />
            <motion.div
              className="absolute inset-x-0 bottom-0 bg-emerald-500/30"
              initial={{ height: "0%" }}
              animate={{ height: `${progress}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
            <span className="relative z-20 text-white text-xs font-bold font-mono drop-shadow-lg tabular-nums">
              {progress}%
            </span>
          </motion.div>
        )}

        {/* Done: Zap + savings badge */}
        {isDone && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg"
          >
            {savingsPercent != null && savingsPercent > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="absolute top-1 left-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/90 text-white text-[9px] font-bold font-mono shadow-lg"
              >
                <Zap className="h-2.5 w-2.5" />-{savingsPercent}%
              </motion.div>
            )}
            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
              <Check className="h-3.5 w-3.5 text-white" />
            </div>
          </motion.div>
        )}

        {/* Error */}
        {isError && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-red-500/30"
          >
            <span className="text-white text-xs font-bold">!</span>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        className="photo-thumb-remove"
        title="Remove"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <svg
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" />
        </svg>
      </button>

      <span className="photo-thumb-label">{entry.name}</span>
    </div>
  );
}
