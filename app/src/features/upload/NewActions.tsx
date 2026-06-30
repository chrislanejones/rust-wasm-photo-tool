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
  SquarePen,
  ChevronLeft,
  Link,
  Github,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { panelSwap } from "@/lib/animations";
import { LargeButton } from "@/components/ui/large-button";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import { ColorSwatchGrid } from "@/components/ColorSwatchGrid";
import { TEXT_COLORS } from "@/lib/colors";
import { parseColor } from "@/lib/colorParser";
import { fetchTestImages, TEST_IMAGE_COUNT } from "@/lib/testImages";

interface SizePreset {
  id: string;
  label: string;
  w: number;
  h: number;
}

/** Blank-canvas size presets grouped by use-case. The category toggle
 *  (Social / Web / Video / Paper) swaps which set of sizes is shown so people
 *  can start a LinkedIn post, a YouTube thumbnail, or an A4 page in one click.
 *  Print sizes assume ~300 DPI. Selecting one fills the width/height fields. */
const PRESET_CATEGORIES: {
  id: string;
  label: string;
  presets: SizePreset[];
}[] = [
  {
    id: "social",
    label: "Social",
    presets: [
      { id: "ig-square", label: "Instagram", w: 1080, h: 1080 },
      { id: "ig-portrait", label: "IG Portrait", w: 1080, h: 1350 },
      { id: "ig-story", label: "Story / Reel", w: 1080, h: 1920 },
      { id: "fb-post", label: "Facebook", w: 1200, h: 630 },
      { id: "fb-cover", label: "FB Cover", w: 820, h: 312 },
      { id: "li-post", label: "LinkedIn", w: 1200, h: 1200 },
      { id: "li-cover", label: "LI Banner", w: 1584, h: 396 },
      { id: "x-post", label: "X / Twitter", w: 1600, h: 900 },
      { id: "pin", label: "Pinterest", w: 1000, h: 1500 },
    ],
  },
  {
    id: "web",
    label: "Web",
    presets: [
      { id: "fhd", label: "FHD 1080p", w: 1920, h: 1080 },
      { id: "hd", label: "HD 720p", w: 1280, h: 720 },
      { id: "4k", label: "4K", w: 3840, h: 2160 },
      { id: "og", label: "OG / Share", w: 1200, h: 630 },
      { id: "leaderboard", label: "Leaderboard", w: 728, h: 90 },
      { id: "banner", label: "Billboard", w: 970, h: 250 },
      { id: "mrec", label: "Med. Rect.", w: 300, h: 250 },
      { id: "favicon", label: "Favicon", w: 512, h: 512 },
    ],
  },
  {
    id: "video",
    label: "Video",
    presets: [
      { id: "yt-thumb", label: "YT Thumb", w: 1280, h: 720 },
      { id: "yt-banner", label: "YT Banner", w: 2560, h: 1440 },
      { id: "v-1080p", label: "1080p", w: 1920, h: 1080 },
      { id: "v-4k", label: "4K UHD", w: 3840, h: 2160 },
      { id: "v-vertical", label: "Vertical", w: 1080, h: 1920 },
      { id: "v-square", label: "Square", w: 1080, h: 1080 },
      { id: "tiktok", label: "TikTok", w: 1080, h: 1920 },
    ],
  },
  {
    id: "paper",
    label: "Paper",
    presets: [
      { id: "a3", label: "A3", w: 3508, h: 4961 },
      { id: "a4", label: "A4", w: 2480, h: 3508 },
      { id: "a5", label: "A5", w: 1748, h: 2480 },
      { id: "letter", label: "Letter", w: 2550, h: 3300 },
      { id: "legal", label: "Legal", w: 2550, h: 4200 },
      { id: "4x6", label: "4×6", w: 1200, h: 1800 },
      { id: "5x7", label: "5×7", w: 1500, h: 2100 },
      { id: "8x10", label: "8×10", w: 2400, h: 3000 },
    ],
  },
];

/** Flat id → preset lookup so a chosen size can be resolved regardless of which
 *  category tab it came from. */
const PRESET_BY_ID = new Map<string, SizePreset>(
  PRESET_CATEGORIES.flatMap((c) => c.presets).map((p) => [p.id, p]),
);

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
  /** Notified whenever the Blank Canvas ("New Document") panel opens/closes, so
   *  the wrapper can drop its logo/title header for the uncluttered setup view. */
  onBlankModeChange?: (active: boolean) => void;
}

export function NewActions({
  onFiles,
  onFilesAdded,
  onInvalidFiles,
  isLoading = false,
  loadProgress = 0,
  autoFocusFirst = false,
  showLinks = true,
  onBlankModeChange,
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
  // Which size-preset category tab is showing (Social / Web / Video / Paper).
  const [blankCat, setBlankCat] = useState(PRESET_CATEGORIES[0].id);

  // Let the wrapper drop its logo/title header while the Blank Canvas panel is
  // open. Fires on mount (false) too, so reopening the dialog restores it.
  useEffect(() => {
    onBlankModeChange?.(blankMode);
  }, [blankMode, onBlankModeChange]);

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
    const p = PRESET_BY_ID.get(id);
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

                {/* Use-case tabs — swap which preset sizes are offered. */}
                <ToolButtonGroup
                  label="Canvas type"
                  options={PRESET_CATEGORIES.map((c) => ({
                    id: c.id,
                    label: c.label,
                  }))}
                  value={blankCat}
                  onChange={setBlankCat}
                  columns={4}
                />

                <ToolButtonGroup
                  label="Page size"
                  options={
                    (
                      PRESET_CATEGORIES.find((c) => c.id === blankCat) ??
                      PRESET_CATEGORIES[0]
                    ).presets
                  }
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
                      <Spinner size={16} />
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
