import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { slideFromBottom, panelSpacingTransition } from "@/lib/animations";
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

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 8;
const THUMBNAIL_SIZE = 96;
const GAP = 8;

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
  const [page, setPage] = useState(0);
  const [photosPerPage, setPhotosPerPage] = useState(MIN_PHOTOS);

  const calculatePhotosPerPage = useCallback(() => {
    const availableWidth =
      showTools && showHistory
        ? window.innerWidth - 320 - 244 - 48
        : showTools || showHistory
          ? window.innerWidth - 320 - 48
          : window.innerWidth - 48;
    const containerWidth = Math.max(300, availableWidth);
    const count = Math.floor((containerWidth - 80) / (THUMBNAIL_SIZE + GAP));
    return Math.max(MIN_PHOTOS, Math.min(MAX_PHOTOS, count));
  }, [showTools, showHistory]);

  useEffect(() => {
    const update = () => setPhotosPerPage(calculatePhotosPerPage());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [calculatePhotosPerPage]);

  const totalPages = Math.ceil(photos.length / photosPerPage);
  const startIdx = page * photosPerPage;
  const visiblePhotos = photos.slice(startIdx, startIdx + photosPerPage);

  useEffect(() => {
    setPage(0);
  }, [photos.length, photosPerPage]);

  useEffect(() => {
    if (!activeId || !stripRef.current) return;
    const el = stripRef.current.querySelector<HTMLElement>(
      `[data-id="${activeId}"]`,
    );
    el?.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [activeId, photos.length, page]);

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
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="btn-icon disabled:opacity-30"
              aria-label="Previous photos"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div ref={stripRef} className="flex gap-2 justify-center">
              {visiblePhotos.map((entry) => {
                const progress = compressionProgress?.[entry.id];
                const savings = compressionSavings?.[entry.id];
                const isCompressing =
                  progress !== undefined && progress >= 0 && progress < 100;
                const isDone = progress === 100;
                const isError = progress === -1;
                const hasSavings =
                  savings != null && savings.savingsPercent > 0;

                return (
                  <div
                    key={entry.id}
                    data-id={entry.id}
                    className={`photo-thumb ${entry.id === activeId ? "active" : ""} relative`}
                    onClick={() => onSelect(entry)}
                    title={entry.name}
                  >
                    <img src={entry.url} alt={entry.name} draggable={false} />

                    <AnimatePresence>
                      {/* Compressing: bottom-to-top fill */}
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
                            style={{
                              clipPath: `inset(0 0 ${100 - (progress ?? 0)}% 0)`,
                            }}
                          />
                          <div
                            className="absolute inset-0 bg-emerald-500/20 transition-all duration-300 ease-out"
                            style={{
                              clipPath: `inset(0 0 ${100 - (progress ?? 0)}% 0)`,
                            }}
                          />
                          <span className="relative z-20 text-white text-xs font-bold font-mono drop-shadow-lg tabular-nums">
                            {progress}%
                          </span>
                        </motion.div>
                      )}

                      {/* Done checkmark (fades out after 2s) */}
                      {isDone && (
                        <motion.div
                          key="done"
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{
                            type: "spring",
                            stiffness: 500,
                            damping: 25,
                          }}
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
                          <span className="text-white text-xs font-bold">
                            !
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* ── PERSISTENT savings badge — stays after animation clears ── */}
                    {hasSavings && (
                      <div className="absolute top-1 left-1 z-20 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/90 text-white text-[9px] font-bold font-mono shadow-lg pointer-events-none">
                        <Zap className="h-2.5 w-2.5" />-{savings.savingsPercent}
                        %
                      </div>
                    )}

                    <button
                      className="photo-thumb-remove"
                      title="Remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(entry.id);
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
              })}
            </div>

            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="btn-icon disabled:opacity-30"
              aria-label="Next photos"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-1 mt-2">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    i === page
                      ? "bg-accent"
                      : "bg-bg-elevated hover:bg-text-muted"
                  }`}
                  aria-label={`Go to page ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
