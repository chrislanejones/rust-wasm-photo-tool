import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { slideFromBottom, panelSpacingTransition, thumbEnter } from "@/lib/animations";
import { X, Image, Check, Zap, ChevronLeft, ChevronRight } from "lucide-react";

export interface PhotoEntry {
  id: string;
  url: string;
  name: string;
  file: File;
}

interface Props {
  photos: PhotoEntry[];
  activeId: string | null;
  onSelect: (entry: PhotoEntry) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
  showTools: boolean;
  showHistory: boolean;
  compressionProgress: Record<string, number>;
  compressionSavings?: Record<string, { savingsPercent: number }>;
}

interface ThumbProps {
  entry: PhotoEntry;
  index: number;
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
  progress?: number;
  savings?: { savingsPercent: number };
}

function Thumb({ entry, index, isActive, onSelect, onRemove, progress, savings }: ThumbProps) {
  const [loading, setLoading] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setLoading(true);
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) setLoading(false);
  }, [entry.url]);

  const isCompressing = progress !== undefined && progress >= 0 && progress < 100;
  const isDone = progress === 100;
  const isError = progress === -1;
  const hasSavings = savings != null && savings.savingsPercent > 0;

  return (
    <motion.div
      data-id={entry.id}
      className={`photo-thumb ${isActive ? "active" : ""} relative`}
      onClick={onSelect}
      title={entry.name}
      {...thumbEnter(index)}
    >
      <img
        ref={imgRef}
        src={entry.url}
        alt={entry.name}
        draggable={false}
        onLoad={() => setLoading(false)}
        onError={() => setLoading(false)}
      />

      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg-elevated rounded-lg">
          <div className="canvas-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
        </div>
      )}

      <AnimatePresence>
        {isCompressing && (
          <motion.div
            key="compressing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg overflow-hidden"
          >
            <div
              className="absolute inset-0 bg-black/60 transition-all duration-300 ease-out"
              style={{ clipPath: `inset(0 0 ${100 - (progress ?? 0)}% 0)` }}
            />
            <div
              className="absolute inset-0 bg-emerald-500/20 transition-all duration-300 ease-out"
              style={{ clipPath: `inset(0 0 ${100 - (progress ?? 0)}% 0)` }}
            />
            <span className="relative z-20 text-white text-xs font-bold font-mono drop-shadow-lg tabular-nums">
              {progress}%
            </span>
          </motion.div>
        )}

        {isDone && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-emerald-500/30"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
              <Check className="h-3.5 w-3.5 text-white" />
            </div>
          </motion.div>
        )}

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

      {hasSavings && (
        <div className="absolute top-1 left-1 z-20 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/90 text-white text-[9px] font-bold font-mono shadow-lg pointer-events-none">
          <Zap className="h-2.5 w-2.5" />-{savings!.savingsPercent}%
        </div>
      )}

      <button
        className="photo-thumb-remove"
        title="Remove"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
      >
        <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" />
        </svg>
      </button>
      <span className="photo-thumb-label">{entry.name}</span>
    </motion.div>
  );
}

export function GalleryBar({
  photos,
  activeId,
  onSelect,
  onRemove,
  onClose,
  showTools,
  showHistory,
  compressionProgress,
  compressionSavings,
}: Props) {
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeId || !stripRef.current) return;
    const el = stripRef.current.querySelector<HTMLElement>(`[data-id="${activeId}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [activeId, photos.length]);

  if (photos.length === 0) return null;

  return (
    <motion.div
      variants={slideFromBottom}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="fixed left-0 right-0 bottom-[48px] z-40"
    >
      <motion.div
        animate={{
          marginLeft: showTools ? 320 : 12,
          marginRight: showHistory ? 244 : 12,
        }}
        transition={panelSpacingTransition}
        style={{ position: "relative" }}
        className="bg-bg-secondary/90 backdrop-blur-sm rounded-xl shadow-2xl border border-border"
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Image className="h-4 w-4" />
              Gallery
              <span className="text-xs text-text-muted">({photos.length})</span>
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-center">
            <button
              onClick={() => stripRef.current?.scrollBy({ left: -220, behavior: "smooth" })}
              className="btn-icon flex-shrink-0"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div
              ref={stripRef}
              className="flex gap-2 overflow-x-auto py-1.5 pl-2"
              style={{ scrollbarWidth: "none" }}
            >
              {photos.map((entry, i) => (
                <Thumb
                  key={entry.id}
                  entry={entry}
                  index={i}
                  isActive={entry.id === activeId}
                  onSelect={() => onSelect(entry)}
                  onRemove={() => onRemove(entry.id)}
                  progress={compressionProgress?.[entry.id]}
                  savings={compressionSavings?.[entry.id]}
                />
              ))}
            </div>

            <button
              onClick={() => stripRef.current?.scrollBy({ left: 220, behavior: "smooth" })}
              className="btn-icon flex-shrink-0"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
