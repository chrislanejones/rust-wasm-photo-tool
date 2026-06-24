import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Upload, FolderOpen, Clipboard, X, Images, Loader2, SquarePen, ChevronLeft, Link, Github } from "lucide-react";
import { fadeIn, quickSpring, panelSwap } from "@/lib/animations";
import { LargeButton } from "@/components/ui/large-button";
import { TinyButton } from "@/components/ui/tiny-button";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import { ColorSwatchGrid } from "@/components/ColorSwatchGrid";
import { TEXT_COLORS } from "@/lib/colors";
import { UserMenu } from "@/components/UserMenu";
import { parseColor } from "@/lib/colorParser";
import { fetchTestImages, TEST_IMAGE_COUNT } from "@/lib/testImages";
const horseLogo = "/Image-Horse-Logo.svg";

/** Common screen / photo / print sizes for the Blank Canvas panel (px; print
 *  sizes assume ~300 DPI). Selecting one fills the width/height fields. */
const PAGE_PRESETS: { id: string; label: string; w: number; h: number }[] = [
  { id: "fhd", label: "FHD", w: 1920, h: 1080 },
  { id: "square", label: "Square", w: 1080, h: 1080 },
  { id: "story", label: "Story", w: 1080, h: 1920 },
  { id: "4x6", label: "4×6", w: 1200, h: 1800 },
  { id: "5x7", label: "5×7", w: 1500, h: 2100 },
  { id: "8x10", label: "8×10", w: 2400, h: 3000 },
];

/** Codeberg's mountain mark — lucide ships no brand icon for it, so inline the
 *  simple-icons path. `.btn-icon svg` sizes it to 14px to match lucide icons. */
function CodebergIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.955.49A12 12 0 0 0 0 12.49a12 12 0 0 0 1.832 6.373L11.838 5.928a.187.14 0 0 1 .324 0l10.006 12.935A12 12 0 0 0 24 12.49a12 12 0 0 0-12-12 12 12 0 0 0-.045 0zm.375 6.467l4.416 16.553a12 12 0 0 0 5.137-4.213L12.42 6.957a.124.093 0 0 0-.09-.003z" />
    </svg>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  onFiles: (files: File[]) => void;
  isLoading?: boolean;
  loadProgress?: number;
  canClose?: boolean;
}

export function UploadDialog({
  open,
  onClose,
  onFiles,
  isLoading = false,
  loadProgress = 0,
  canClose = true,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loadingTest, setLoadingTest] = useState(false);
  // Blank Canvas setup panel (swaps out the upload buttons when active).
  const [blankMode, setBlankMode] = useState(false);
  const [blankW, setBlankW] = useState("1500");
  const [blankH, setBlankH] = useState("1000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [transparent, setTransparent] = useState(false);
  const [blankPreset, setBlankPreset] = useState("");
  const controls = useAnimation();

  const triggerShake = useCallback(async () => {
    await controls.start({
      x: [0, -14, 14, -10, 10, -6, 6, -3, 3, 0],
      transition: { duration: 0.55, ease: "easeInOut" },
    });
    controls.set({ x: 0 });
  }, [controls]);

  const handleTryClose = useCallback(() => {
    if (!canClose) {
      triggerShake();
    } else {
      onClose();
    }
  }, [canClose, onClose, triggerShake]);

  const processFiles = useCallback(
    (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith("image/"));
      if (images.length) {
        onFiles(images);
        onClose();
      }
    },
    [onFiles, onClose],
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  };

  // Pull a fixed set of large, royalty-free Unsplash photos from UploadThing
  // (public URLs) and run them through the normal upload pipeline.
  const handleTestImages = useCallback(async () => {
    if (loadingTest) return;
    setLoadingTest(true);
    try {
      const files = await fetchTestImages();
      if (files.length) processFiles(files);
      else triggerShake();
    } catch (err) {
      console.error("Test Free Images failed:", err);
      triggerShake();
    } finally {
      setLoadingTest(false);
    }
  }, [loadingTest, processFiles, triggerShake]);

  // Apply a page-size preset to the width/height fields.
  const applyPreset = useCallback((id: string) => {
    const p = PAGE_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setBlankPreset(id);
    setBlankW(String(p.w));
    setBlankH(String(p.h));
  }, []);

  // Create the blank canvas at the chosen size + background color. The PNG is
  // generated in Rust (`blank_png`) — no JS canvas or encode/decode round-trip —
  // and the color is parsed in Rust (`parseColor`). Then it goes through the
  // normal upload pipeline.
  const createBlank = useCallback(async () => {
    const w = Math.max(1, parseInt(blankW, 10) || 0);
    const h = Math.max(1, parseInt(blankH, 10) || 0);
    if (!w || !h) return;
    // Transparent → alpha 0 (rgb irrelevant); otherwise the chosen color, opaque.
    const a = transparent ? 0 : 255;
    const parsed = transparent ? null : await parseColor(bgColor);
    const r = parsed?.r ?? 0;
    const g = parsed?.g ?? 0;
    const b = parsed?.b ?? 0;
    const mod = await import("stamp_tool");
    await mod.default(); // idempotent: returns the existing wasm if loaded
    const png = mod.blank_png(w, h, r, g, b, a);
    processFiles([
      new File([new Uint8Array(png)], "blank-canvas.png", {
        type: "image/png",
      }),
    ]);
  }, [blankW, blankH, bgColor, transparent, processFiles]);

  const handlePasteClick = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      const files: File[] = [];
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            files.push(
              new File([blob], `pasted-image.${type.split("/")[1] ?? "png"}`, {
                type,
              }),
            );
          }
        }
      }
      if (files.length) processFiles(files);
    } catch (err) {
      console.warn("Clipboard read failed — use Ctrl+V:", err);
    }
  }, [processFiles]);

  // Return to the default upload view whenever the dialog is closed.
  useEffect(() => {
    if (!open) setBlankMode(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files = Array.from(items)
        .filter((i) => i.type.startsWith("image/"))
        .map((i) => i.getAsFile())
        .filter((f): f is File => f !== null);
      if (files.length) {
        e.preventDefault();
        processFiles(files);
      }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [open, processFiles]);

  // Keyboard support: focus the first action when the dialog opens, and let
  // Escape close it (shake when closing is blocked, same as the ✕ button).
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => firstButtonRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleTryClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, handleTryClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-[var(--z-dialog)] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={handleTryClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={quickSpring}
            className="relative w-full max-w-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
          <motion.div
            animate={controls}
            className="bg-bg-secondary rounded-2xl border border-border shadow-2xl overflow-hidden"
          >
            {/* Logo + Title - Top Center */}
            <div className="flex flex-col items-center pt-6 pb-2">
              <img
                src={horseLogo}
                alt="Image Horse"
                className="w-30 h-30 mb-2 drop-shadow-lg"
              />
              <h1 className="text-lg font-bold text-text-primary tracking-wide">
                Image Horse
              </h1>
            </div>

            {/* User / sign-in — top-left, mirroring the close button's spot */}
            <div className="absolute top-4 left-4">
              <UserMenu />
            </div>

            {/* Close button */}
            <TinyButton
              className="absolute top-4 right-4"
              onClick={handleTryClose}
            >
              <X className="h-4 w-4" />
            </TinyButton>

            {/* Loading bar */}
            {isLoading && (
              <div className="px-6 pt-2">
                <div className="h-1.5 w-full rounded-full bg-bg-elevated overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-accent to-accent/60 rounded-full"
                    initial={{ width: "0%" }}
                    animate={{
                      width: `${Math.min(loadProgress, 100)}%`,
                    }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                  />
                </div>
              </div>
            )}

            <div className="px-6 pt-6 pb-4">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                // Stable min-height so the modal doesn't resize/recenter (and
                // jerk) when swapping the upload actions ⇄ Blank Canvas panel.
                // flex-col so the active panel fills it (no dead space above the
                // footer — keeps top and bottom spacing even).
                className="rounded-xl min-h-[18rem] flex flex-col"
              >
                <AnimatePresence mode="wait" initial={false}>
                {blankMode ? (
                  <motion.div
                    key="blank"
                    variants={panelSwap}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="flex flex-col gap-4"
                  >
                    {/* ── Blank Canvas setup (Photoshop-style "New Document") ── */}
                    <div className="flex items-end gap-2">
                      <div className="flex flex-1 flex-col gap-0.5">
                        <span className="text-xs text-text-secondary">width</span>
                        <input
                          type="number"
                          min={1}
                          value={blankW}
                          onChange={(e) => {
                            setBlankW(e.target.value);
                            setBlankPreset("");
                          }}
                          className="w-full px-2 py-1.5 rounded-lg bg-theme-accent border border-theme-border text-text-primary text-sm tabular-nums"
                        />
                      </div>
                      <span className="pb-2 text-text-muted">×</span>
                      <div className="flex flex-1 flex-col gap-0.5">
                        <span className="text-xs text-text-secondary">height</span>
                        <input
                          type="number"
                          min={1}
                          value={blankH}
                          onChange={(e) => {
                            setBlankH(e.target.value);
                            setBlankPreset("");
                          }}
                          className="w-full px-2 py-1.5 rounded-lg bg-theme-accent border border-theme-border text-text-primary text-sm tabular-nums"
                        />
                      </div>
                    </div>

                    <ToolButtonGroup
                      label="Page size"
                      options={PAGE_PRESETS}
                      value={blankPreset}
                      onChange={applyPreset}
                      columns={3}
                    />

                    <div
                      className={
                        transparent ? "pointer-events-none opacity-40" : ""
                      }
                    >
                      <ColorSwatchGrid
                        colors={TEXT_COLORS}
                        value={bgColor}
                        onChange={setBgColor}
                        label="Background"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setTransparent((t) => !t)}
                      aria-pressed={transparent}
                      className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                        transparent
                          ? "bg-theme-primary text-theme-primary-foreground border-theme-primary"
                          : "bg-theme-muted/20 hover:bg-theme-muted/30 text-theme-muted-foreground border-theme-border"
                      }`}
                    >
                      <span
                        className="h-3.5 w-3.5 rounded-sm border border-border"
                        style={{
                          backgroundImage:
                            "linear-gradient(45deg, rgba(255,255,255,0.3) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.3) 75%, transparent 75%)",
                          backgroundSize: "6px 6px",
                        }}
                      />
                      Transparent background
                    </button>

                    <div className="grid grid-cols-2 gap-3">
                      <LargeButton
                        onClick={() => setBlankMode(false)}
                        className="w-full"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Back
                      </LargeButton>
                      <LargeButton onClick={createBlank} className="w-full">
                        <SquarePen className="h-4 w-4" />
                        Create Canvas
                      </LargeButton>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="default"
                    variants={panelSwap}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="flex flex-1 flex-col items-center gap-4"
                  >
                  <div className="grid grid-cols-2 gap-3 w-full">
                    <LargeButton
                      ref={firstButtonRef}
                      onClick={() => inputRef.current?.click()}
                      className="w-full"
                    >
                      <FolderOpen className="h-4 w-4" />
                      Browse Files
                    </LargeButton>
                    <LargeButton onClick={handlePasteClick} className="w-full">
                      <Clipboard className="h-4 w-4" />
                      Paste (Ctrl+V)
                    </LargeButton>
                    <LargeButton
                      onClick={handleTestImages}
                      disabled={loadingTest}
                      className="w-full"
                    >
                      {loadingTest ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Images className="h-4 w-4" />
                      )}
                      {loadingTest ? `Loading ${TEST_IMAGE_COUNT}…` : "Sample Images"}
                    </LargeButton>
                    <LargeButton
                      onClick={() => setBlankMode(true)}
                      title="Start with a blank canvas"
                      className="w-full"
                    >
                      <SquarePen className="h-4 w-4" />
                      Blank Canvas
                    </LargeButton>
                  </div>

                  {/* Dotted drop zone — highlights + nudges when an image is
                      dragged over the dialog. */}
                  <div
                    className={`flex w-full flex-1 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dotted p-6 text-center transition-all duration-200 ${
                      dragging
                        ? "border-accent bg-accent/10 scale-[1.02]"
                        : "border-border bg-bg-elevated/30"
                    }`}
                  >
                    <p className="text-sm text-text-secondary">
                      or drag and drop images here
                    </p>
                    <div
                      className={`w-14 h-14 rounded-full bg-bg-elevated flex items-center justify-center transition-transform ${
                        dragging ? "scale-110" : ""
                      }`}
                    >
                      <Upload className="h-7 w-7 text-text-muted" />
                    </div>
                    <p className="text-xs text-text-secondary">
                      Supports PNG, JPG, GIF, WebP, AVIF
                    </p>
                  </div>
                </motion.div>
                )}
                </AnimatePresence>
              </div>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  processFiles(Array.from(e.target.files));
                }
              }}
            />

            {/* Marketing link — only in the default upload view, not on the
                Blank Canvas panel (keeps that panel uncluttered). */}
            {!blankMode && (
              <div className="flex items-center gap-2 px-6 pb-4">
                {/* All three share the LargeButton UI. Each renders a <button>,
                    so open its link via window.open instead of an anchor href.
                    Widths are 1/2 : 1/4 : 1/4 via flex-grow 2 : 1 : 1. */}
                <LargeButton
                  onClick={() =>
                    window.open(
                      "https://image-horse.vercel.app/",
                      "_blank",
                      "noopener",
                    )
                  }
                  className="flex-[2]"
                >
                  <Link className="h-4 w-4" />
                  Image Horse Website
                </LargeButton>
                <LargeButton
                  aria-label="View source on GitHub"
                  title="GitHub"
                  onClick={() =>
                    window.open(
                      "https://github.com/chrislanejones/rust-wasm-photo-tool",
                      "_blank",
                      "noopener",
                    )
                  }
                  className="flex-1"
                >
                  <Github />
                  GitHub
                </LargeButton>
                <LargeButton
                  aria-label="View source on Codeberg"
                  title="Codeberg"
                  onClick={() =>
                    window.open(
                      "https://codeberg.org/chrislanejones/rust-wasm-photo-tool",
                      "_blank",
                      "noopener",
                    )
                  }
                  className="flex-1"
                >
                  <CodebergIcon />
                  Codeberg
                </LargeButton>
              </div>
            )}
          </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
