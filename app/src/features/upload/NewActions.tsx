// The shared "start a new image" actions — Browse / Paste / Sample / Blank
// Canvas, the drag-and-drop zone, the Blank Canvas setup panel, and the
// marketing links. Extracted so the SAME body renders in two places:
//   • full-page first-run surface (FirstRunScreen) on cold start
//   • compact modal (UploadDialog) mid-session (Alt+N)
// The wrappers own the logo/title header, sign-in, close button, and any shake.
import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FolderOpen,
  Clipboard,
  Images,
  Loader2,
  SquarePen,
  ChevronLeft,
  Link,
  Github,
} from "lucide-react";
import { panelSwap } from "@/lib/animations";
import { LargeButton } from "@/components/ui/large-button";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import { ColorSwatchGrid } from "@/components/ColorSwatchGrid";
import { TEXT_COLORS } from "@/lib/colors";
import { parseColor } from "@/lib/colorParser";
import { fetchTestImages, TEST_IMAGE_COUNT } from "@/lib/testImages";

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
  onFiles: (files: File[]) => void;
  /** After a successful hand-off (the modal closes; the page lets the editor
   *  reveal naturally as photos become non-empty). */
  onFilesAdded?: () => void;
  /** A drop/fetch produced no usable images (the modal shakes). */
  onInvalidFiles?: () => void;
  isLoading?: boolean;
  loadProgress?: number;
  /** Focus the first action on mount (modal yes; page no, to avoid a scroll jump). */
  autoFocusFirst?: boolean;
  /** Hide the website/GitHub/Codeberg row. */
  showLinks?: boolean;
}

export function NewActions({
  onFiles,
  onFilesAdded,
  onInvalidFiles,
  isLoading = false,
  loadProgress = 0,
  autoFocusFirst = false,
  showLinks = true,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loadingTest, setLoadingTest] = useState(false);
  // Blank Canvas setup panel (swaps out the upload buttons when active).
  const [blankMode, setBlankMode] = useState(false);
  const [blankW, setBlankW] = useState("1500");
  const [blankH, setBlankH] = useState("1000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [transparent, setTransparent] = useState(false);
  const [blankPreset, setBlankPreset] = useState("");

  const processFiles = useCallback(
    (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith("image/"));
      if (images.length) {
        onFiles(images);
        onFilesAdded?.();
      }
    },
    [onFiles, onFilesAdded],
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
      else onInvalidFiles?.();
    } catch (err) {
      console.error("Test Free Images failed:", err);
      onInvalidFiles?.();
    } finally {
      setLoadingTest(false);
    }
  }, [loadingTest, processFiles, onInvalidFiles]);

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

  // Ctrl+V paste anywhere on the surface.
  useEffect(() => {
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
  }, [processFiles]);

  // Optionally focus the first action on mount (modal only).
  useEffect(() => {
    if (!autoFocusFirst) return;
    const t = window.setTimeout(() => firstButtonRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [autoFocusFirst]);

  return (
    <>
      {/* Loading bar */}
      {isLoading && (
        <div className="px-6 pt-2">
          <div className="h-1.5 w-full rounded-full bg-bg-elevated overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-accent to-accent/60 rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: `${Math.min(loadProgress, 100)}%` }}
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
          // Stable min-height so the surface doesn't resize/recenter (and jerk)
          // when swapping the upload actions ⇄ Blank Canvas panel.
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
                  className={transparent ? "pointer-events-none opacity-40" : ""}
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
                    dragged over the surface. */}
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
          if (e.target.files) processFiles(Array.from(e.target.files));
        }}
      />

      {/* Marketing links — only in the default upload view, not the Blank
          Canvas panel (keeps that panel uncluttered). */}
      {showLinks && !blankMode && (
        <div className="flex items-center gap-2 px-6 pb-4">
          <LargeButton
            onClick={() =>
              window.open("https://image-horse.vercel.app/", "_blank", "noopener")
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
    </>
  );
}
