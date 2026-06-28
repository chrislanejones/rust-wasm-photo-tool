// ===== FILE: app/src/app/AppShell.tsx =====
// Changes:
//   Item 2: Spacebar pan mode
//   Item 4: PgUp/PgDn gallery cycling
//   Item 7: blur → effects rename, brightness/contrast in effects panel
//   All other existing functionality preserved
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { useStoreUser } from "@/hooks/useStoreUser";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useCloneStamp } from "@/hooks/useCloneStamp";
import { useBrushPreview } from "@/hooks/useBrushPreview";
import { useDrawingTools } from "@/hooks/useDrawingTools";
import { useEmojiTool } from "@/hooks/useEmojiTool";
import { useMoveLayerTool } from "@/hooks/useMoveLayerTool";
import { usePaintTool } from "@/hooks/usePaintTool";
import { useTextTool } from "@/hooks/useTextTool";
import { useRedStampTool } from "@/hooks/useRedStampTool";
import type { ToolType, StampSettings, ToolSettings } from "@/lib/types";
import { defaultToolSettings } from "@/lib/defaultToolSettings";
import { panelSpacingTransition, instantTransition, fadeIn, imageLoadBarFade, imageLoadBarProgress } from "@/lib/animations";
import { useBreakpoint } from "@/lib/useBreakpoint";
import { SmallWindowNotice } from "@/components/SmallWindowNotice";
import { TopBar } from "@/components/TopBar";
import { StatusBar, type UserMode, type ShortcutHint } from "@/components/StatusBar";
import { ShortcutModal } from "@/components/ShortcutModal";
import { CelebrationDialog } from "@/components/CelebrationDialog";
import { ADMIN_EMAIL } from "@/lib/superuser";
import type { SuperUserControls } from "@/components/SuperUserPane";
import type { GeneralControls } from "@/components/GeneralPane";
import { usePreferences } from "@/lib/preferences";
import { useTheme, useReduceMotion } from "@/lib/useTheme";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { IdleScreen } from "@/components/IdleScreen";
import { Toaster, toast } from "@/components/ui/sonner";
import { ToolsSidebar } from "@/features/tools";
import type { PlacementCell } from "@/components/PlacementGrid";
import { CanvasArea } from "@/features/canvas/CanvasArea";
import { GridThumbnails } from "@/features/canvas/GridThumbnails";
import { ReviewPanel } from "@/features/canvas/ReviewPanel";
import type { ReselectObject } from "@/features/canvas/ReviewPanel";
import { GalleryBar, type PhotoEntry } from "@/features/gallery/GalleryBar";
import { UploadDialog } from "@/features/upload/UploadDialog";
import { ImageDropOverlay } from "@/features/upload/ImageDropOverlay";
import { ImportImageDialog } from "@/features/upload/ImportImageDialog";
import { FirstRunScreen } from "@/features/upload/FirstRunScreen";
import { NewActions } from "@/features/upload/NewActions";
import { ResumeContent } from "@/features/upload/ResumeContent";
import {
  loadGalleryManifest,
  saveGalleryManifest,
  clearGalleryManifest,
  type GalleryManifest,
} from "@/lib/galleryManifest";
import { getPhotoLimit, DEFAULT_PHOTO_LIMIT } from "@/lib/photoLimits";
import { hasReplicateAI, TIERS } from "@/lib/tiers";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { useColorPicker } from "@/hooks/useColorPicker";
import { MagnifierOverlay } from "@/components/MagnifierOverlay";
import type { EffectsMode } from "@/features/tools/settings/EffectsSettings";
import { useAutoCompress } from "@/hooks/useAutoCompress";
import { useEditPersistence } from "@/hooks/useEditPersistence";
import { useRecentTexts } from "@/hooks/useRecentTexts";
import { putOriginal, getOriginal, getOriginalAsBlobUrl, deleteOriginal } from "@/lib/originalsStore";
import { compositeSavedEdit, encodeRgba, EXT, extFromMime } from "@/lib/exportImage";
import type { ExportFormat } from "@/lib/exportImage";
import { RadioCards } from "@/components/ui/radio-cards";
import {
  readExifTiff,
  applyExifToReencoded,
  applyExifToVerbatim,
} from "@/lib/exif";
import { pinLabelText } from "@/lib/pinLabel";
import { PANEL_OPEN_GUTTER } from "@/lib/layout";
import { makeWorkingCopy, makeThumbnail, makeThumbnailFromPixels, ImageTooLargeError } from "@/lib/workingCopy";
import { DiagnosticLogOverlay } from "@/components/DiagnosticLogOverlay";
import { logDiagnostic, installConsoleCapture } from "@/lib/diagnosticsLog";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { LargeButton } from "@/components/ui/large-button";
import { ActionTile } from "@/components/ui/action-tile";
import { ShareButton } from "@/components/ShareButton";
import {
  Undo,
  Redo,
  Download,
  Clipboard,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Archive,
  ImagePlus,
  Image as ImageIcon,
  Pipette,
} from "lucide-react";

/** Digit-key shortcut + label per tool (mirrors TOOL_BY_DIGIT in useKeyboardShortcuts). */
const TOOL_SHORTCUT: Partial<Record<ToolType, ShortcutHint>> = {
  compress: { keys: "1", label: "compress" },
  crop: { keys: "2", label: "crop" },
  brush: { keys: "3", label: "brush" },
  text: { keys: "4", label: "text" },
  arrow: { keys: "5", label: "arrow" },
  ai: { keys: "6", label: "AI" },
  shapes: { keys: "7", label: "shapes" },
  effects: { keys: "8", label: "effects" },
  stamp: { keys: "9", label: "stamp" },
  emoji: { keys: "0", label: "batch" },
};

const AUTH_ENABLED = !!(
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY &&
  import.meta.env.VITE_CONVEX_URL
);

/** User-facing message when the gallery cap is reached, nudging toward the next tier. */
function capMessage(mode: UserMode, max: number): string {
  if (mode === "demo")
    return `Demo galleries hold ${max} photos. Sign in to load up to 24.`;
  if (mode === "loggedIn")
    return `Free accounts hold ${max} photos. Pro (100) is coming soon.`;
  return `Gallery is limited to ${max} photos.`;
}

// Format choices shown in the Download dialog — a second chance to pick a
// format for anyone who missed the dropdown in the Compress panel.
const DOWNLOAD_FORMATS: { value: ExportFormat; label: string; hint: string }[] = [
  { value: "jpeg", label: "JPEG", hint: "Small · no transparency" },
  { value: "png", label: "PNG", hint: "Lossless · transparency" },
  { value: "webp", label: "WebP", hint: "Small · transparency" },
  { value: "avif", label: "AVIF", hint: "Smallest · modern" },
];

/** Decode an image Blob to RGBA pixels (off the main canvas). Used by the
 *  drag/paste import flow before the user picks where the image should land. */
async function decodeImageSource(
  source: Blob,
): Promise<{ pixels: Uint8ClampedArray; w: number; h: number }> {
  const bitmap = await createImageBitmap(source);
  const w = bitmap.width;
  const h = bitmap.height;
  const oc = new OffscreenCanvas(w, h);
  const ctx = oc.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const rgba = ctx.getImageData(0, 0, w, h).data;
  return { pixels: new Uint8ClampedArray(rgba.buffer as ArrayBuffer), w, h };
}

function AuthModeWatcher({ onMode }: { onMode: (m: UserMode) => void }) {
  const { isLoaded, isSignedIn } = useUser();
  // Create/refresh the Convex users row on sign-in (tier lives there).
  useStoreUser();

  useEffect(() => {
    if (!isLoaded) return;
    onMode(isSignedIn ? "loggedIn" : "demo");
  }, [isLoaded, isSignedIn, onMode]);

  return null;
}

// Minimum time the boot splash stays up, even on an instant load. The spinner's
// animate-spin is 1s per rotation, so ~900ms lets it complete roughly one full
// turn — the splash reads as intentional instead of a one-frame flash. (0 under
// reduce-motion: no forced wait when the spinner isn't animating anyway.)
const BOOT_MIN_SPLASH_MS = 900;

export function AppShell() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stamp = useCloneStamp(canvasRef);
  const { savePhotoEdit, loadPhotoEdit, deletePhotoEdit, duplicatePhotoEdit, clearAllEdits } = useEditPersistence();
  const { addRecentText } = useRecentTexts();

  const [stampSettings, setStampSettings] = useState<StampSettings>({
    brushSize: 20,
    hardness: 0.8,
    opacity: 1.0,
  });

  const handleStampSettingsChange = useCallback(
    (s: StampSettings) => {
      setStampSettings(s);
      stamp.setBrushSize(s.brushSize);
      stamp.setHardness(s.hardness);
      stamp.setOpacity(s.opacity);
    },
    [stamp],
  );

  const [toolSettings, setToolSettings] =
    useState<ToolSettings>(defaultToolSettings);

  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [resumeManifest, setResumeManifest] = useState<GalleryManifest | null>(null);
  // Cold-start boot splash (logo + spinner). True until WASM is up and the
  // IndexedDB session check has resolved, so we route to New vs Resume without a
  // flash.
  const [booting, setBooting] = useState(true);
  // True until the user first enters the editor (a photo becomes active). While
  // true, the "New" surface is the full-page FirstRunScreen; once you've been in
  // the app, every later empty/New state uses the compact UploadDialog instead.
  const [firstRun, setFirstRun] = useState(true);
  useEffect(() => {
    if (photos.length > 0) setFirstRun(false); // latches false for the session
  }, [photos.length]);
  const [imageSavings, setImageSavings] = useState<Record<string, { savingsPercent: number }>>({});
  const [modifiedPhotos, setModifiedPhotos] = useState<Set<string>>(new Set());
  // originalUrl is populated by the compare effect; not set on photo select
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [compareActive, setCompareActive] = useState(false);
  const [hasBeenModified, setHasBeenModified] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const loadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Item 2: Pan mode state
  const [isPanning, setIsPanning] = useState(false);

  const [brushMode, setBrushMode] = useState<"paint" | "blur" | "pen">("paint");
  // Edit & Transform → Eraser toggle (canvas strokes erase while on).
  const [cropEraserActive, setCropEraserActive] = useState(false);
  // Layer Settings → Move-layer toggle (canvas drags reposition the layer).
  const [moveActive, setMoveActive] = useState(false);
  // Layer-mask editing: when on, the Paint brush paints the active layer's mask
  // (maskPaintValue 0 = hide / black, 255 = reveal / white) instead of pixels.
  const [maskEditing, setMaskEditing] = useState(false);
  const [maskPaintValue, setMaskPaintValue] = useState(0);
  const [effectsMode, setEffectsMode] = useState<EffectsMode>("levels");
  const [colorPickerActive, setColorPickerActive] = useState(false);
  const [stampSubMode, setStampSubMode] = useState<"clone" | "red" | "emojis">("clone");
  const [shapesMode, setShapesMode] = useState<"shapes" | "pens" | "arrows">("shapes");
  /** Active Crop-tool aspect ratio. `null` ≡ "Free" (no constraint).
   *  Drags in useDrawingTools snap to this ratio via Rust when set. */
  const [cropRatio, setCropRatio] = useState<[number, number] | null>(null);
  const [userMode, setUserMode] = useState<UserMode>("demo");
  const [authResolved, setAuthResolved] = useState(false);
  const handleAuthMode = useCallback((m: UserMode) => {
    setUserMode(m);
    setAuthResolved(true);
  }, []);

  // Tier override (set from the Super User settings tab). When set, it wins over
  // the Clerk-derived mode so the No Login / Logged In / Paid versions can be
  // tested without real auth. Only the admin can reach the tab that sets it.
  const [devTierOverride, setDevTierOverride] = useState<UserMode | null>(null);
  const effectiveUserMode = devTierOverride ?? userMode;

  // Super User settings tab — only the admin account sees it. The tier override
  // is client-side UI gating only (the real tier stays enforced server-side by
  // Convex), so this is a convenience gate, not a security boundary.
  const { user } = useUser();
  const isSuperUser =
    user?.primaryEmailAddress?.emailAddress?.toLowerCase() === ADMIN_EMAIL;
  const superUser: SuperUserControls | null = isSuperUser
    ? {
        mode: effectiveUserMode,
        overridden: devTierOverride !== null,
        onSelect: (m) => setDevTierOverride(m),
        onReset: () => setDevTierOverride(null),
      }
    : null;

  // App-wide preferences (Settings → General), persisted to localStorage.
  const [prefs, applyPreferences] = usePreferences();
  // EXIF keep/strip now lives in preferences (Settings → Security); all export
  // paths read this committed value.
  const exifKeep = prefs.exifKeep;
  // Apply the saved theme to <html> (light/dark/system); index.html sets the
  // initial class pre-paint, this keeps it in sync as the choice changes.
  useTheme(prefs.theme);
  // Reduce motion (Settings → Appearance): toggles the `.reduce-motion` class for
  // CSS transitions; the <MotionConfig> wrapper below handles framer-motion.
  useReduceMotion(prefs.reduceMotion);
  // Shared responsive breakpoints (one resize listener) — drives the top bar's
  // compact collapse, the narrow overlay-drawer behaviour for the side panels,
  // and the too-small notice.
  const bp = useBreakpoint();
  // Canvas "Rulers & Grids" overlay config (Settings → Rulers & Grids). Inline
  // object is fine — the overlay's memos key on the primitive values, not its
  // identity, so a fresh wrapper per render doesn't recompute geometry.
  const guidesConfig = {
    rulers: prefs.rulers,
    grid: prefs.grid,
    gridKind: prefs.gridKind,
    gridSpacing: prefs.gridSpacing,
    gridCols: prefs.gridCols,
    gridRows: prefs.gridRows,
    gridColor: prefs.gridColor,
    gridOpacity: prefs.gridOpacity,
  };
  // The Settings modal owns the draft; here we just expose live prefs + the
  // commit. maxHistory reaches the engine via the effect below; idle reaches
  // the hook below — both keyed on the committed prefs.
  const general: GeneralControls = {
    current: prefs,
    onApply: applyPreferences,
  };

  // Re-apply the saved undo depth to the engine on first load, image swap, and
  // change — each new image creates a fresh engine that defaults to 50.
  useEffect(() => {
    stamp.setMaxHistory(prefs.maxHistory);
  }, [prefs.maxHistory, stamp.state.ready, activePhotoId, stamp.setMaxHistory]);

  // Idle screen — dims to "Continue with Image Horse" after the configured
  // timeout (0 = never) and lets the browser throttle the tab.
  const { idle, wake } = useIdleTimeout(prefs.idleTimeoutMin);

  // Gallery photo cap for the current tier. Resolved from Rust (`photo_limit`)
  // so the WASM layer is the single source of truth. Starts at the most
  // restrictive limit until the wasm lookup resolves.
  const [maxPhotos, setMaxPhotos] = useState(DEFAULT_PHOTO_LIMIT);
  useEffect(() => {
    let alive = true;
    void getPhotoLimit(effectiveUserMode).then((n) => {
      if (alive) setMaxPhotos(n);
    });
    return () => {
      alive = false;
    };
  }, [effectiveUserMode]);

  const handleTextCommit = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      void addRecentText({
        id: 0,
        text,
        fontSize: toolSettings.fontSize,
        fontFamily: toolSettings.fontFamily ?? "sans-serif",
        fontWeight: toolSettings.fontWeight,
        textColor: toolSettings.textColor,
      });
    },
    [addRecentText, toolSettings.fontSize, toolSettings.fontFamily, toolSettings.fontWeight, toolSettings.textColor],
  );

  useEffect(() => {
    const handler = (e: CustomEvent<{ text: string }>) =>
      handleTextCommit(e.detail.text);
    window.addEventListener("text-committed", handler as EventListener);
    return () =>
      window.removeEventListener("text-committed", handler as EventListener);
  }, [handleTextCommit]);

  // ── Pixel-based loading (downscaled working copy) ──────────────────────────
  const loadImageFromPixels = useCallback(
    (pixels: Uint8ClampedArray, width: number, height: number) => {
      setIsImageLoading(true);
      setLoadProgress(0);
      if (loadIntervalRef.current) clearInterval(loadIntervalRef.current);
      loadIntervalRef.current = setInterval(() => {
        setLoadProgress((prev) => (prev >= 90 ? 90 : prev + Math.random() * 15));
      }, 100);
      void stamp.loadImageFromPixels(pixels, width, height);
    },
    [stamp],
  );

  /** Apply a finished AI image result (decoded RGBA) back to the canvas as the
   *  new working image, and mark the photo modified so it persists. */
  const handleAIResult = useCallback(
    (r: { pixels: Uint8ClampedArray; width: number; height: number }) => {
      loadImageFromPixels(r.pixels, r.width, r.height);
      setHasBeenModified(true);
    },
    [loadImageFromPixels],
  );

  /** Load a photo entry from IndexedDB → downscale → hand to the tool. */
  const loadPhotoFromEntry = useCallback(
    async (entry: PhotoEntry) => {
      const original = await getOriginal(entry.originalKey);
      if (!original) return;
      const file = new File([original.bytes], original.name, { type: original.mimeType });
      const working = await makeWorkingCopy(file);
      loadImageFromPixels(working.pixels, working.width, working.height);
    },
    [loadImageFromPixels],
  );

  useEffect(() => {
    if (stamp.state.ready && isImageLoading) {
      if (loadIntervalRef.current) {
        clearInterval(loadIntervalRef.current);
        loadIntervalRef.current = null;
      }
      setLoadProgress(100);
      const t = setTimeout(() => {
        setIsImageLoading(false);
        setLoadProgress(0);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [stamp.state.ready, isImageLoading]);

  // ── Compare: fetch original from IndexedDB when slider activates ───────────
  const activeEntry = photos.find((p) => p.id === activePhotoId) ?? null;
  const activeOriginalKey =
    activeEntry?.uploadKey ?? activeEntry?.originalKey ?? null;

  useEffect(() => {
    if (!compareActive || !activeOriginalKey) {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
      setOriginalUrl(null);
      return;
    }
    let cancelled = false;
    let createdUrl: string | null = null;
    void (async () => {
      const u = await getOriginalAsBlobUrl(activeOriginalKey);
      if (cancelled || !u) return;
      createdUrl = u;
      setOriginalUrl(u);
    })();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareActive, activeOriginalKey]);

  // ── Add photos ─────────────────────────────────────────────────────────────
  const handleAddPhotos = useCallback(
    async (files: File[]) => {
      // ── Tier cap ─────────────────────────────────────────────────────────
      // Enforce the per-tier gallery limit (from Rust `photo_limit`). Accept
      // as many as fit, then notify if the batch was trimmed or already full.
      const remaining = Math.max(0, maxPhotos - photos.length);
      if (remaining <= 0) {
        toast.error(capMessage(effectiveUserMode, maxPhotos));
        return;
      }
      const accepted = files.length > remaining ? files.slice(0, remaining) : files;
      if (files.length > remaining) {
        toast.error(capMessage(effectiveUserMode, maxPhotos));
      }

      if (activePhotoId && (stamp.state.undoCount > 0 || hasBeenModified)) {
        setModifiedPhotos((prev) => {
          if (prev.has(activePhotoId)) return prev;
          const next = new Set(prev);
          next.add(activePhotoId);
          return next;
        });
      }
      if (activePhotoId && stamp.toolRef.current) {
        await savePhotoEdit(activePhotoId, stamp.toolRef);
      }

      let firstLoaded = false;
      for (const f of accepted) {
        try {
          const t0 = performance.now();
          const working = await makeWorkingCopy(f);
          logDiagnostic(
            "UI_THREAD",
            `decode ${f.name} → ${working.width}×${working.height}`,
            performance.now() - t0,
          );
          // Build the gallery thumbnail from the already-decoded working pixels
          // (downscaled in Rust via resize_pixels) instead of decoding the
          // source file a second time.
          const mod = await import("stamp_tool");
          await mod.default();
          const [originalKey, thumbBlob] = await Promise.all([
            putOriginal(f, working.origWidth, working.origHeight),
            makeThumbnailFromPixels(
              working.pixels,
              working.width,
              working.height,
              mod.resize_pixels,
            ),
          ]);
          const entry: PhotoEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name: f.name.replace(/\.[^.]+$/, ""),
            mimeType: f.type || "application/octet-stream",
            byteSize: f.size,
            originalByteSize: f.size,
            origWidth: working.origWidth,
            origHeight: working.origHeight,
            workingWidth: working.width,
            workingHeight: working.height,
            thumbBlob,
            originalKey,
            uploadKey: originalKey,
          };

          setPhotos((prev) => [...prev, entry]);

          if (!firstLoaded) {
            firstLoaded = true;
            loadImageFromPixels(working.pixels, working.width, working.height);
            setHasBeenModified(false);
            setActivePhotoId(entry.id);
            setCompareActive(false);
          }
        } catch (err) {
          console.error("Failed to add photo:", f.name, err);
          toast.error(
            err instanceof ImageTooLargeError
              ? `${f.name}: ${err.message}`
              : `Couldn't open ${f.name}.`,
          );
        }
      }
    },
    [activePhotoId, hasBeenModified, stamp, loadImageFromPixels, savePhotoEdit, photos.length, maxPhotos, effectiveUserMode],
  );

  // ── Select photo ───────────────────────────────────────────────────────────
  const handleSelectPhoto = useCallback(
    async (entry: PhotoEntry) => {
      if (entry.id === activePhotoId) return;

      if (activePhotoId && (stamp.state.undoCount > 0 || hasBeenModified)) {
        setModifiedPhotos((prev) => {
          if (prev.has(activePhotoId)) return prev;
          const next = new Set(prev);
          next.add(activePhotoId);
          return next;
        });
      }

      if (activePhotoId && stamp.toolRef.current) {
        await savePhotoEdit(activePhotoId, stamp.toolRef);
      }

      setHasBeenModified(false);
      setActivePhotoId(entry.id);
      setCompareActive(false);
      // Flag loading synchronously, before any await: switching photos briefly
      // leaves the *outgoing* photo's undo count > 0 while activePhotoId already
      // points at the incoming one. The modified-dot effect gates on this so it
      // doesn't falsely dot the newly-selected photo during the transition.
      setIsImageLoading(true);

      const saved = await loadPhotoEdit(entry.id);
      if (saved) {
        setLoadProgress(20);
        await stamp.loadFromSaved(saved);
        setLoadProgress(100);
        setTimeout(() => { setIsImageLoading(false); setLoadProgress(0); }, 400);
      } else {
        void loadPhotoFromEntry(entry);
      }
    },
    [activePhotoId, hasBeenModified, stamp, loadPhotoFromEntry, savePhotoEdit, loadPhotoEdit],
  );

  // Auto-select the first photo when none is active but photos exist. Keeps
  // the grid hero (and normal canvas) populated after session restore or after
  // the user deletes the previously active photo.
  useEffect(() => {
    if (!activePhotoId && photos.length > 0) {
      void handleSelectPhoto(photos[0]);
    }
  }, [activePhotoId, photos, handleSelectPhoto]);

  // Item 4: PgUp/PgDn gallery cycling
  const handleNextPhoto = useCallback(() => {
    if (photos.length === 0) return;
    const idx = photos.findIndex((p) => p.id === activePhotoId);
    const next = photos[(idx + 1) % photos.length];
    if (next) void handleSelectPhoto(next);
  }, [photos, activePhotoId, handleSelectPhoto]);

  const handlePrevPhoto = useCallback(() => {
    if (photos.length === 0) return;
    const idx = photos.findIndex((p) => p.id === activePhotoId);
    const prev = photos[(idx - 1 + photos.length) % photos.length];
    if (prev) void handleSelectPhoto(prev);
  }, [photos, activePhotoId, handleSelectPhoto]);

  const handleRemovePhoto = useCallback(
    (id: string) => {
      deletePhotoEdit(id).catch(() => {});
      setImageSavings((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setModifiedPhotos((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setPhotos((prev) => {
        const idx = prev.findIndex((p) => p.id === id);
        const next = prev.filter((p) => p.id !== id);
        if (id === activePhotoId && next.length > 0) {
          const na = next[Math.min(idx, next.length - 1)]!;
          void loadPhotoFromEntry(na);
          setActivePhotoId(na.id);
          setHasBeenModified(false);
          setCompareActive(false);
        } else if (next.length === 0) {
          setActivePhotoId(null);
          setHasBeenModified(false);
          setCompareActive(false);
        }
        return next;
      });
    },
    [activePhotoId, loadPhotoFromEntry, deletePhotoEdit],
  );

  // Bulk delete from the gallery multi-select.
  // ── Gallery multi-select (lifted here so Compress/Export can use it) ────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelectPhoto = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Drop selections for photos that no longer exist.
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const ids = new Set(photos.map((p) => p.id));
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => (ids.has(id) ? next.add(id) : (changed = true)));
      return changed ? next : prev;
    });
  }, [photos]);

  const handleDeleteSelected = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    ids.forEach((id) => {
      deletePhotoEdit(id).catch(() => {});
    });
    setImageSavings((prev) => {
      const next = { ...prev };
      ids.forEach((id) => delete next[id]);
      return next;
    });
    setModifiedPhotos((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setPhotos((prev) => {
      const next = prev.filter((p) => !idSet.has(p.id));
      if (activePhotoId && idSet.has(activePhotoId)) {
        if (next.length > 0) {
          const na = next[0]!;
          void loadPhotoFromEntry(na);
          setActivePhotoId(na.id);
        } else {
          setActivePhotoId(null);
        }
        setHasBeenModified(false);
        setCompareActive(false);
      }
      return next;
    });
    clearSelection();
  }, [selectedIds, activePhotoId, loadPhotoFromEntry, deletePhotoEdit, clearSelection]);

  // Duplicate the selected photos. Originals are content-addressed (SHA-256), so
  // the copies reuse the same originalKey/thumbBlob — zero pixel copy. The
  // source's persisted edit (Rust-rendered PNG archive) is cloned to the new id
  // so the duplicate carries any edits. Each copy lands right after its source.
  const handleDuplicateSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    // Flush the active photo's in-progress edits first so a copy of it is current.
    if (activePhotoId && selectedIds.has(activePhotoId) && stamp.toolRef.current) {
      await savePhotoEdit(activePhotoId, stamp.toolRef);
    }
    const room = Math.max(0, maxPhotos - photos.length);
    if (room <= 0) {
      toast.error(capMessage(effectiveUserMode, maxPhotos));
      return;
    }
    const sources = photos.filter((p) => selectedIds.has(p.id)).slice(0, room);
    if (sources.length < selectedIds.size) {
      toast.error(capMessage(effectiveUserMode, maxPhotos));
    }
    const dups = sources.map((src) => ({
      srcId: src.id,
      entry: {
        ...src,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: `${src.name} copy`,
        uploadKey: src.uploadKey ?? src.originalKey,
      } as PhotoEntry,
    }));
    await Promise.all(
      dups.map(({ srcId, entry }) =>
        duplicatePhotoEdit(srcId, entry.id).catch(() => {}),
      ),
    );
    setPhotos((prev) => {
      const out: PhotoEntry[] = [];
      for (const p of prev) {
        out.push(p);
        const dup = dups.find((d) => d.srcId === p.id);
        if (dup) out.push(dup.entry);
      }
      return out;
    });
    clearSelection();
    toast.success(
      `Duplicated ${dups.length} image${dups.length === 1 ? "" : "s"}`,
    );
  }, [
    selectedIds,
    photos,
    maxPhotos,
    activePhotoId,
    stamp,
    savePhotoEdit,
    duplicatePhotoEdit,
    effectiveUserMode,
    clearSelection,
  ]);

  // Starts false: the boot splash covers the first paint, and the boot effect
  // opens this (the "New" dialog) only if there's no prior session to resume.
  const [showUpload, setShowUpload] = useState(false);
  const [showTopBar, setShowTopBar] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  // Small-window notice: dismissed for this stretch of being too-small; reset
  // once the window grows back so it re-appears if they snap small again.
  const [smallNoticeDismissed, setSmallNoticeDismissed] = useState(false);
  // Most-recently-opened side panel — narrow mode closes the *other* one.
  const lastPanelRef = useRef<"tools" | "history" | null>(null);
  const [showShortcutModal, setShowShortcutModal] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // ── Narrow-window (overlay-drawer) bookkeeping ──────────────────────────
  useEffect(() => {
    if (showTools) lastPanelRef.current = "tools";
  }, [showTools]);
  useEffect(() => {
    if (showHistory) lastPanelRef.current = "history";
  }, [showHistory]);
  // Below BP_NARROW the side panels are overlay drawers that can't coexist —
  // when both end up open, close whichever opened first.
  useEffect(() => {
    if (bp.narrow && showTools && showHistory) {
      if (lastPanelRef.current === "history") setShowTools(false);
      else setShowHistory(false);
    }
  }, [bp.narrow, showTools, showHistory]);
  // Re-arm the too-small notice once the window is wide enough again.
  useEffect(() => {
    if (!bp.tooSmall) setSmallNoticeDismissed(false);
  }, [bp.tooSmall]);
  useEffect(() => {
    installConsoleCapture();
  }, []);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  // Per-image + selected delete confirmations (mirror the Delete All dialog).
  // `deletePhotoId` holds the id awaiting confirmation (null = closed).
  const [deletePhotoId, setDeletePhotoId] = useState<string | null>(null);
  const [deleteSelectedOpen, setDeleteSelectedOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const [activeTool, setActiveTool] = useState<ToolType>("compress");

  // Bézier pen (Paint → Pen sub-mode): the PenOverlay captures the canvas and
  // commits finished paths as live kind-7 annotations.
  const penActive = activeTool === "brush" && brushMode === "pen";
  const handlePenCommit = useCallback(
    (flatPoints: number[]) => {
      const tool = stamp.toolRef.current;
      if (!tool || flatPoints.length < 8) return; // need ≥ 2 anchors
      // Any path with a background colour fills its interior — Rust's fill_polygon
      // auto-closes the flattened curve, so an open curve OR a full (closed) loop
      // both fill. (Previously this was gated on an explicit `close`, so a curve
      // or circle finished without closing never filled.)
      const fillKind = toolSettings.fillMode !== "none" ? 1 : 0;
      tool.add_bezier_annotation(
        new Float64Array(flatPoints),
        toolSettings.strokeColor,
        toolSettings.strokeWidth,
        fillKind,
        toolSettings.fillColor,
      );
      stamp.flushToCanvas();
      stamp.syncState();
    },
    [
      stamp,
      toolSettings.strokeColor,
      toolSettings.strokeWidth,
      toolSettings.fillMode,
      toolSettings.fillColor,
    ],
  );

  // Pen re-edit (Stage 3b): hit-test → load a committed kind-7 path → reshape →
  // commit. The baked copy is hidden via set_editing_shape while editing.
  const handlePenHitTest = useCallback(
    (ix: number, iy: number): { id: number; points: number[] } | null => {
      const tool = stamp.toolRef.current;
      if (!tool) return null;
      const id = tool.shape_annotation_at(ix, iy);
      if (id < 0) return null;
      try {
        const shapes = JSON.parse(tool.get_shape_annotations()) as Array<{
          id: number;
          kind: number;
          points: number[][];
        }>;
        const path = shapes.find((s) => s.id === id && s.kind === 7);
        return path ? { id, points: path.points.flat() } : null;
      } catch {
        return null;
      }
    },
    [stamp],
  );
  const handlePenEditStart = useCallback(
    (id: number) => {
      const tool = stamp.toolRef.current;
      if (!tool) return;
      tool.set_editing_shape(id); // hide the baked path; the overlay shows it
      stamp.flushToCanvas();
      stamp.syncState();
    },
    [stamp],
  );
  const handlePenEditCommit = useCallback(
    (id: number, flatPoints: number[]) => {
      const tool = stamp.toolRef.current;
      if (!tool) return;
      tool.update_bezier_annotation(id, new Float64Array(flatPoints));
      tool.set_editing_shape(-1);
      stamp.flushToCanvas();
      stamp.syncState();
    },
    [stamp],
  );
  const handlePenEditCancel = useCallback(() => {
    const tool = stamp.toolRef.current;
    if (!tool) return;
    tool.set_editing_shape(-1);
    stamp.flushToCanvas();
    stamp.syncState();
  }, [stamp]);

  useEffect(() => {
    if (activeTool !== "effects") setColorPickerActive(false);
  }, [activeTool]);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("jpeg");
  const [quality, setQuality] = useState(75);

  const effectiveBrushSize = (() => {
    switch (activeTool) {
      case "brush":
        if (maskEditing) return toolSettings.brushSize / 2;
        if (brushMode === "blur") return toolSettings.blurSize / 2;
        return toolSettings.brushSize / 2;
      case "crop":
        // Eraser now lives in Edit & Transform — show its ring while active.
        return cropEraserActive ? toolSettings.eraserSize / 2 : 0;
      case "stamp":
        if (stampSubMode === "emojis") return (toolSettings.emojiSize * 1.2) / 2;
        return stampSettings.brushSize;
      default:
        return stampSettings.brushSize;
    }
  })();

  const { pos, visible, diameter, onCanvasEnter, onCanvasLeave } =
    useBrushPreview(effectiveBrushSize, stamp.state.zoom, canvasRef);

  const handleQualityChange = useCallback((q: number) => {
    setQuality(q);
    setHasBeenModified(true);
  }, []);

  const { progress: compressProgress, compressAll } = useAutoCompress();

  const prevPhotoCount = useRef(0);
  const revealTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Stable binding — `stamp` is a fresh object each render, but `stamp.reset`
  // is a stable useCallback, so the effect below only re-fires on count change.
  const stampReset = stamp.reset;
  useEffect(() => {
    const prev = prevPhotoCount.current;
    const curr = photos.length;
    prevPhotoCount.current = curr;
    if (revealTimers.current.length === 0 && prev === 0 && curr > 0) {
      setShowUpload(false);
      revealTimers.current = [
        setTimeout(() => setShowTopBar(true), 150),
        setTimeout(() => setShowTools(true), 500),
        setTimeout(() => setShowGallery(true), 850),
      ];
    }
    if (curr === 0) {
      revealTimers.current.forEach(clearTimeout);
      revealTimers.current = [];
      // Catch-all for EVERY path that empties the gallery (Delete All, bulk
      // multi-select delete, removing the last photo): blank the canvas and
      // reset the WASM tool so the last image doesn't ghost behind the
      // re-opened upload dialog. Runs in the same commit as setShowUpload.
      if (prev > 0) stampReset();
      setShowUpload(true);
      setShowTopBar(false);
      setShowTools(false);
      setShowGallery(false);
      setShowHistory(false);
    }
  }, [photos.length, stampReset]);
  useEffect(() => () => { revealTimers.current.forEach(clearTimeout); }, []);

  // ── Returning-session resume ───────────────────────────────────────────────
  // Originals + per-photo edits already persist in IndexedDB, but the gallery
  // LIST is React-only — so a tab close (Ctrl+W) or reload would drop it. We
  // save a manifest whenever the gallery changes, and on a fresh load with an
  // empty gallery either prompt to Resume (anonymous) or silently reopen
  // (signed in, per Settings → General → "When you return").
  const resumeChecked = useRef(false);
  const galleryWasNonEmpty = useRef(false);
  // Live mirrors so the once-on-mount boot reads the CURRENT auth state without
  // hard-blocking on it (Clerk can take seconds to load — it must not trap the
  // splash).
  const authResolvedRef = useRef(authResolved);
  authResolvedRef.current = authResolved;
  const userModeRef = useRef(userMode);
  userModeRef.current = userMode;

  // Boot sequence (runs once on mount): init WASM, give Clerk a brief CAPPED
  // window to resolve (so we know signed-in vs anonymous) WITHOUT blocking the
  // splash on it, check IndexedDB for a saved session, then mount exactly one of
  // New / Resume — deciding before paint so there's no flash. A short minimum
  // duration keeps the spinner from flashing on a fast load.
  useEffect(() => {
    if (resumeChecked.current || photos.length > 0) return;
    resumeChecked.current = true; // run-once latch (AppShell persists for the session)
    const startedAt = performance.now();
    void (async () => {
      // 1) WASM ready — the biggest boot cost; idempotent if already loaded.
      try {
        const mod = await import("stamp_tool");
        await mod.default();
      } catch (e) {
        console.error("WASM init failed during boot:", e);
      }
      // 2) Give Clerk a brief, capped window to resolve so the route knows
      // signed-in vs anonymous — but never hard-wait on it (a slow / blocked
      // Clerk must not trap the app on the spinner). Treats unresolved as
      // anonymous.
      const deadline = performance.now() + 1200;
      while (!authResolvedRef.current && performance.now() < deadline) {
        await new Promise((r) => window.setTimeout(r, 50));
      }
      // 3) Look for a prior session saved on this device.
      const m = await loadGalleryManifest().catch(() => null);
      // 4) Route (unresolved auth → treat as anonymous demo).
      const mode = userModeRef.current;
      if (m && m.photos.length > 0) {
        if (mode === "demo") {
          setResumeManifest(m); // anonymous → Resume prompt
        } else if (prefs.reopenLastSession) {
          setPhotos(m.photos); // signed in → auto-reopen (auto-select loads photo 0)
        } else {
          setShowUpload(true); // signed in + "Start fresh" pref → New dialog
        }
      } else {
        setShowUpload(true); // nothing saved (incl. fresh / cache-cleared browser) → New
      }
      // 5) Hold the splash for a minimum beat so a fast load doesn't flash the
      // spinner for a few ms (which looks broken) — it spins ~one full turn.
      const minMs = prefs.reduceMotion ? 0 : BOOT_MIN_SPLASH_MS;
      const wait = Math.max(0, minMs - (performance.now() - startedAt));
      window.setTimeout(() => setBooting(false), wait);
    })();
    // Runs once on mount; live auth/mode read via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the manifest on every gallery change; drop it once the gallery is
  // emptied during the session (Delete All etc.) so we never offer to resume
  // photos the user just removed.
  useEffect(() => {
    if (photos.length > 0) {
      galleryWasNonEmpty.current = true;
      void saveGalleryManifest(photos, activePhotoId);
    } else if (galleryWasNonEmpty.current) {
      void clearGalleryManifest();
    }
  }, [photos, activePhotoId]);

  const handleResumeSession = useCallback(() => {
    const m = resumeManifest;
    setResumeManifest(null);
    if (m) setPhotos(m.photos); // 0 → N reveals the chrome + auto-selects photo 0
  }, [resumeManifest]);

  const handleStartFresh = useCallback(() => {
    setResumeManifest(null);
    void clearGalleryManifest();
    setShowUpload(true);
  }, []);

  const handleExport = useCallback(async () => {
    const entry = photos.find((p) => p.id === activePhotoId) ?? null;
    const activeName = entry?.name ?? "image";
    const blob = await stamp.exportBlob(exportFormat, quality / 100);
    if (!blob) return;

    let bytes = new Uint8Array(await blob.arrayBuffer());
    // The canvas export is always freshly re-encoded, so it carries no EXIF.
    // Keep → transplant the true original's EXIF (JPEG/WebP); strip → leave clean.
    let sourceTiff: Uint8Array<ArrayBuffer> | null = null;
    if (exifKeep && entry && (exportFormat === "jpeg" || exportFormat === "webp")) {
      const orig = await getOriginal(entry.uploadKey ?? entry.originalKey);
      if (orig) sourceTiff = readExifTiff(new Uint8Array(orig.bytes), orig.mimeType);
    }
    bytes = applyExifToReencoded(
      bytes,
      exportFormat,
      exifKeep ? "keep" : "strip",
      sourceTiff,
      stamp.state.width,
      stamp.state.height,
    );

    const stem = activeName.replace(/\.[^.]+$/, "");
    const url = URL.createObjectURL(new Blob([bytes], { type: blob.type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${stem}-revised${EXT[exportFormat]}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [stamp, exportFormat, quality, photos, activePhotoId, exifKeep]);

  const handleDeleteAll = useCallback(() => {
    setDeleteAllOpen(true);
  }, []);

  const confirmDeleteAll = useCallback(() => {
    setDeleteAllOpen(false);
    clearAllEdits().catch(() => {});
    setImageSavings({});
    setModifiedPhotos(new Set());
    // Blank the canvas + drop the WASM tool immediately (the empty-gallery
    // effect below also fires, but reset is idempotent).
    stamp.reset();
    setActivePhotoId(null);
    setOriginalUrl(null);
    setHasBeenModified(false);
    setCompareActive(false);
    setPhotos([]);
  }, [clearAllEdits, stamp]);

  const handlePickColor = useCallback((hex: string) => {
    setToolSettings((prev) => ({ ...prev, brushColor: hex, textColor: hex }));
    setColorPickerActive(false);
  }, []);

  /** Context-menu shortcut: open the Effects panel on its Color Picker tab
   *  with the eyedropper already armed. */
  const handleActivateEyedropper = useCallback(() => {
    setShowTools(true);
    setActiveTool("effects");
    setEffectsMode("picker");
    setColorPickerActive(true);
  }, []);

  const colorPicker = useColorPicker({
    toolRef: stamp.toolRef,
    canvasRef,
    containerRef,
    active: colorPickerActive && activeTool === "effects",
    onPickColor: handlePickColor,
  });

  const flushAndSync = useCallback(() => {
    stamp.flushToCanvas();
    stamp.syncState();
  }, [stamp]);

  const isBlurringRef = useRef(false);

  const getCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * c.width) / r.width,
      y: ((e.clientY - r.top) * c.height) / r.height,
    };
  }, []);

  // ── Selection Marker (magic-wand) — Edit & Move → Selection (above Align) ──
  // All masking math is Rust; JS just stores the returned overlay + routes ops.
  const [selectionTolerance, setSelectionTolerance] = useState(24);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectionMask, setSelectionMask] = useState<Uint8Array | null>(null);

  const handleSelectionClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const tool = stamp.toolRef.current;
      if (!tool) return;
      const { x, y } = getCoords(e);
      const mask = tool.magic_wand_select(x, y, selectionTolerance);
      setSelectionMask(mask.length ? mask : null);
    },
    [stamp, getCoords, selectionTolerance],
  );
  const handleSelectAll = useCallback(() => {
    const tool = stamp.toolRef.current;
    if (!tool) return;
    const mask = tool.select_all();
    setSelectionMask(mask.length ? mask : null);
  }, [stamp]);
  const handleDeselect = useCallback(() => {
    stamp.toolRef.current?.clear_selection();
    setSelectionMask(null);
  }, [stamp]);
  const handleDeleteSelection = useCallback(() => {
    const tool = stamp.toolRef.current;
    if (tool?.delete_selection()) {
      stamp.flushToCanvas();
      stamp.syncState();
    }
    setSelectionMask(null);
  }, [stamp]);
  // Move-layer toggle (Layer Settings + Ctrl+M). Switches to the Layer Settings
  // tool and is mutually exclusive with the Selection marker.
  const handleToggleMove = useCallback(() => {
    setActiveTool("arrow");
    setSelectionMode(false);
    setMoveActive((m) => !m);
  }, []);
  // Selection toggle — mutually exclusive with Move.
  const handleToggleSelectionMode = useCallback(() => {
    setMoveActive(false);
    setSelectionMode((m) => !m);
  }, []);

  // Selection + Move now live on the Layer Settings ("arrow") tool; leaving it
  // clears both toggles. Leaving Edit & Transform ("crop") clears the eraser.
  useEffect(() => {
    if (activeTool !== "arrow") {
      setSelectionMode(false);
      setMoveActive(false);
    }
    if (activeTool !== "crop") setCropEraserActive(false);
  }, [activeTool]);

  const blurDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const t = stamp.toolRef.current;
      if (!t || e.button !== 0) return;
      isBlurringRef.current = true;
      const { x, y } = getCoords(e);
      // Mode branch, hex parse (redaction), undo-snap, and per-stroke
      // interpolation all live in Rust now (effect_down / effect_move / _up).
      t.effect_down(
        x,
        y,
        toolSettings.blurSize,
        toolSettings.blurMode,
        toolSettings.blurIntensity,
        toolSettings.pixelSize,
        toolSettings.redactColor,
      );
      stamp.flushToCanvas();
    },
    [
      stamp,
      getCoords,
      toolSettings.blurMode,
      toolSettings.blurSize,
      toolSettings.blurIntensity,
      toolSettings.pixelSize,
      toolSettings.redactColor,
    ],
  );

  const blurMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isBlurringRef.current) return;
      const t = stamp.toolRef.current;
      if (!t) return;
      const { x, y } = getCoords(e);
      if (t.effect_move(x, y)) stamp.flushToCanvas();
    },
    [stamp, getCoords],
  );

  const blurUp = useCallback(() => {
    if (!isBlurringRef.current) return;
    isBlurringRef.current = false;
    stamp.toolRef.current?.effect_up();
    stamp.syncState();
  }, [stamp]);

  const effectiveDrawingTool =
    activeTool === "shapes" && shapesMode === "arrows"
      ? ("arrow" as const)
      : activeTool;

  const drawingTools = useDrawingTools({
    toolRef: stamp.toolRef,
    canvasRef,
    activeTool: effectiveDrawingTool,
    settings: toolSettings,
    flushToCanvas: flushAndSync,
    syncState: stamp.syncState,
    penMode:
      activeTool === "shapes" && shapesMode === "pens" ? "pins" : null,
    cropRatio,
    imageWidth: stamp.state.width,
    imageHeight: stamp.state.height,
  });

  const emojiTool = useEmojiTool({
    toolRef: stamp.toolRef,
    canvasRef,
    flushToCanvas: flushAndSync,
    emoji: toolSettings.emoji,
    emojiSize: toolSettings.emojiSize,
  });

  const paintTool = usePaintTool({
    toolRef: stamp.toolRef,
    canvasRef,
    settings: toolSettings,
    flushToCanvas: stamp.flushToCanvas,
    syncState: stamp.syncState,
  });

  // Eraser (Paint → Eraser sub-mode): same hook, erase variant — scrubs the
  // active layer's alpha via Rust's erase_down/move/up.
  const eraserTool = usePaintTool({
    toolRef: stamp.toolRef,
    canvasRef,
    settings: toolSettings,
    flushToCanvas: stamp.flushToCanvas,
    syncState: stamp.syncState,
    erase: true,
  });

  // Layer-mask brush: same hook, mask variant — paints the active layer's mask
  // (non-destructive) via Rust's mask_paint_down/move/up. Active when the user
  // is editing a mask from the Layers panel.
  const maskTool = usePaintTool({
    toolRef: stamp.toolRef,
    canvasRef,
    settings: toolSettings,
    flushToCanvas: stamp.flushToCanvas,
    syncState: stamp.syncState,
    maskMode: true,
    maskValue: maskPaintValue,
  });

  // Mask edit-mode handlers (wired into the Layers panel). Entering mask edit
  // selects the layer + switches to the Paint brush so strokes hit the mask.
  const handleAddMask = useCallback(
    (id: number) => {
      stamp.setActiveLayer(id);
      stamp.addLayerMask(id);
      setActiveTool("brush");
      setBrushMode("paint");
      setMaskEditing(true);
    },
    [stamp],
  );
  const handleToggleMaskEdit = useCallback(
    (id: number) => {
      const activeId = stamp.toolRef.current?.active_layer_id();
      if (maskEditing && activeId === id) {
        setMaskEditing(false);
        return;
      }
      stamp.setActiveLayer(id);
      setActiveTool("brush");
      setBrushMode("paint");
      setMaskEditing(true);
    },
    [stamp, maskEditing],
  );

  // Mask editing is a brush activity — drop it when leaving the Paint tool so
  // the panel highlight and canvas routing don't get stuck on.
  useEffect(() => {
    if (activeTool !== "brush") setMaskEditing(false);
  }, [activeTool]);

  // Move tool (the repurposed "arrow" slot): drag the active layer's content.
  const moveLayerTool = useMoveLayerTool({
    toolRef: stamp.toolRef,
    canvasRef,
    flushToCanvas: stamp.flushToCanvas,
    syncState: stamp.syncState,
  });

  const textTool = useTextTool({
    toolRef: stamp.toolRef,
    canvasRef,
    containerRef,
    settings: toolSettings,
    flushToCanvas: stamp.flushToCanvas,
    syncState: stamp.syncState,
    active: activeTool === "text",
  });

  /**
   * Canvas resize-handle drags land here. The open text input renders from
   * its OWN style snapshot (`textInput.fontSize` — see effFontSize in
   * CanvasArea), so updating `toolSettings.fontSize` alone moved the panel
   * slider but never resized the text (the original "broken squares" bug).
   * Forward to setTextFontSize so the live input grows AND keep ToolSettings
   * in sync so the slider tracks the drag and commitText agrees with both.
   */
  const handleTextFontSizeChange = useCallback(
    (size: number) => {
      setToolSettings((prev) => ({ ...prev, fontSize: size }));
      textTool.setTextFontSize(size);
    },
    [textTool.setTextFontSize],
  );

  /**
   * Wrap setToolSettings so that when the text-input overlay is open, any
   * change to textColor / fontWeight / fontSize is forwarded to the text
   * tool's setters too. Without this, the toolbar updates `toolSettings`
   * but the open textarea keeps showing the captured-on-open style. BG
   * fields are read directly from `toolSettings` by CanvasArea, so they
   * already update live without forwarding.
   */
  const handleToolSettingsChange = useCallback(
    (next: ToolSettings) => {
      setToolSettings((prev) => {
        if (textTool.textInput) {
          if (next.textColor !== prev.textColor)
            textTool.setTextColor(next.textColor);
          if (next.fontWeight !== prev.fontWeight)
            textTool.setTextFontWeight(next.fontWeight);
          if (next.fontSize !== prev.fontSize)
            textTool.setTextFontSize(next.fontSize);
        }
        return next;
      });
    },
    [textTool],
  );

  // Live-annotation bounding boxes for the CanvasArea hover highlight.
  const annotationBoxes = textTool.annotations.map((a) => ({
    id: a.id,
    x: a.x + a.tile_offset_x,
    y: a.y + a.tile_offset_y,
    tile_w: a.tile_w,
    tile_h: a.tile_h,
  }));

  // ── Reselect list: live placed objects (text + shapes) ─────────────────
  // Names are per-kind ordinals computed in list order: Text #1, Square #1,
  // Line #2, etc. The id is stable within its own (text vs shape) id-space.
  const reselectObjects = useMemo<ReselectObject[]>(() => {
    const items: ReselectObject[] = [];
    textTool.annotations.forEach((a, i) => {
      items.push({ key: `t${a.id}`, type: "text", id: a.id, label: `Text #${i + 1}` });
    });
    const KIND_LABEL: Record<number, string> = {
      0: "Square",
      1: "Circle",
      2: "Line",
      3: "Hand-drawn",
      4: "Arrow",
      5: "Pin",
      6: "Pen",
      7: "Pen Path",
    };
    const counters: Record<number, number> = {};
    drawingTools.shapes.forEach((s) => {
      counters[s.kind] = (counters[s.kind] ?? 0) + 1;
      // Pins show their own callout label (number or letter); everything else
      // gets an ordinal.
      const label =
        s.kind === 5
          ? `Pin ${pinLabelText(s.number, s.label_kind)}`
          : `${KIND_LABEL[s.kind] ?? "Shape"} #${counters[s.kind]}`;
      items.push({ key: `s${s.id}`, type: "shape", id: s.id, label });
    });
    return items;
  }, [textTool.annotations, drawingTools.shapes]);

  // Keep the Reselect list fresh after any history mutation or photo switch
  // (undo/redo/jump/load all change the live overlays under the hood).
  useEffect(() => {
    drawingTools.refreshShapes();
    textTool.refreshAnnotations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp.state.history, activePhotoId]);

  // The object the Align row acts on (set by reselect / "Select bounding box").
  const [selectedObject, setSelectedObject] = useState<ReselectObject | null>(
    null,
  );

  const handleSelectObject = useCallback(
    (o: ReselectObject) => {
      setSelectedObject(o);
      if (o.type === "text") {
        setActiveTool("text");
        textTool.selectAnnotation(o.id);
      } else {
        drawingTools.selectShape(o.id);
      }
    },
    [textTool, drawingTools],
  );

  // Place the selected object into one of the nine grid cells — Rust centers the
  // bbox in that ninth of the canvas (`align_annotation` with a cell mode); JS
  // flushes and re-syncs the live overlays afterward.
  const handlePlace = useCallback(
    (cell: PlacementCell) => {
      const tool = stamp.toolRef.current;
      if (!tool || !selectedObject) return;
      const moved = tool.align_annotation(
        selectedObject.id,
        selectedObject.type === "text",
        cell,
        stamp.state.width,
        stamp.state.height,
      );
      if (!moved) return;
      tool.set_editing_shape(-1);
      stamp.flushToCanvas();
      stamp.syncState();
      drawingTools.refreshShapes();
      textTool.refreshAnnotations();
    },
    [stamp, selectedObject, drawingTools, textTool],
  );

  // Histogram bins straight from Rust (`calculate_histogram` over the composite
  // buffer) — replaces HistogramView's old per-resample canvas sampling loop.
  const getHistogram = useCallback((): Uint32Array | null => {
    const tool = stamp.toolRef.current;
    return tool ? tool.calculate_histogram() : null;
  }, [stamp]);

  // Drop the Align selection when switching photos (annotation ids are per-photo).
  useEffect(() => {
    setSelectedObject(null);
  }, [activePhotoId]);

  const handleDeleteObject = useCallback(
    (o: ReselectObject) => {
      if (o.type === "text") {
        stamp.toolRef.current?.remove_text_annotation(o.id);
        stamp.flushToCanvas();
        stamp.syncState();
        textTool.refreshAnnotations();
        window.dispatchEvent(new Event("text-annotations-changed"));
      } else {
        drawingTools.removeShape(o.id);
      }
    },
    [stamp, textTool, drawingTools],
  );

  const redStampTool = useRedStampTool({
    toolRef: stamp.toolRef,
    canvasRef,
    flushToCanvas: flushAndSync,
    syncState: stamp.syncState,
    active: activeTool === "stamp",
    brushSize: stampSettings.brushSize,
  });

  const effectiveStamp = (() => {
    // Idle handlers for tools that don't paint on the canvas. The clone stamp's
    // own onMouseDown/Move/Up ride along on `...stamp`; without overriding them
    // they "leak" — e.g. on the Effects tool the clone stamp would keep drawing.
    const idle = {
      ...stamp,
      onMouseDown: (() => {}) as typeof stamp.onMouseDown,
      onMouseMove: (() => {}) as typeof stamp.onMouseMove,
      onMouseUp: (() => {}) as typeof stamp.onMouseUp,
    };
    if (activeTool === "effects") {
      if (colorPickerActive) {
        return {
          ...stamp,
          onMouseDown: colorPicker.onMouseDown as typeof stamp.onMouseDown,
          onMouseMove: colorPicker.onMouseMove as typeof stamp.onMouseMove,
          onMouseUp: stamp.onMouseUp,
        };
      }
      return idle;
    }
    // Layer Settings tool: Move drags the layer (when its toggle is on);
    // otherwise idle so canvas clicks fall through to the Selection marker.
    if (activeTool === "arrow") {
      if (moveActive)
        return {
          ...stamp,
          onMouseDown: moveLayerTool.onMouseDown as typeof stamp.onMouseDown,
          onMouseMove: moveLayerTool.onMouseMove as typeof stamp.onMouseMove,
          onMouseUp: moveLayerTool.onMouseUp as typeof stamp.onMouseUp,
        };
      return idle;
    }
    // Edit & Transform: the Eraser toggle takes over the canvas while on;
    // otherwise the crop-rectangle drag (drawingTools).
    if (activeTool === "crop") {
      if (cropEraserActive)
        return {
          ...stamp,
          onMouseDown: eraserTool.onMouseDown as typeof stamp.onMouseDown,
          onMouseMove: eraserTool.onMouseMove as typeof stamp.onMouseMove,
          onMouseUp: eraserTool.onMouseUp as typeof stamp.onMouseUp,
        };
      return {
        ...stamp,
        onMouseDown: drawingTools.onMouseDown as typeof stamp.onMouseDown,
        onMouseMove: drawingTools.onMouseMove as typeof stamp.onMouseMove,
        onMouseUp: drawingTools.onMouseUp as typeof stamp.onMouseUp,
      };
    }
    if (activeTool === "shapes")
      return {
        ...stamp,
        onMouseDown: drawingTools.onMouseDown as typeof stamp.onMouseDown,
        onMouseMove: drawingTools.onMouseMove as typeof stamp.onMouseMove,
        onMouseUp: drawingTools.onMouseUp as typeof stamp.onMouseUp,
      };
    if (activeTool === "brush") {
      if (maskEditing) {
        return {
          ...stamp,
          onMouseDown: maskTool.onMouseDown as typeof stamp.onMouseDown,
          onMouseMove: maskTool.onMouseMove as typeof stamp.onMouseMove,
          onMouseUp: maskTool.onMouseUp as typeof stamp.onMouseUp,
        };
      }
      if (brushMode === "blur") {
        return {
          ...stamp,
          onMouseDown: blurDown,
          onMouseMove: blurMove,
          onMouseUp: blurUp,
        };
      }
      // "pen" mode draws via the PenOverlay; the canvas itself uses the paint
      // handlers (harmless when the overlay is capturing).
      return {
        ...stamp,
        onMouseDown: paintTool.onMouseDown as typeof stamp.onMouseDown,
        onMouseMove: paintTool.onMouseMove as typeof stamp.onMouseMove,
        onMouseUp: paintTool.onMouseUp as typeof stamp.onMouseUp,
      };
    }
    if (activeTool === "stamp") {
      if (stampSubMode === "emojis") {
        return {
          ...stamp,
          onMouseDown: emojiTool.onMouseDown as typeof stamp.onMouseDown,
          onMouseMove: emojiTool.onMouseMove as typeof stamp.onMouseMove,
          onMouseUp: emojiTool.onMouseUp as typeof stamp.onMouseUp,
        };
      }
      const combinedDown: typeof stamp.onMouseDown = (e) => {
        if (redStampTool.hasPendingStamp()) {
          redStampTool.onMouseDown(e as React.MouseEvent<HTMLCanvasElement>);
        } else {
          stamp.onMouseDown(e);
        }
      };
      return {
        ...stamp,
        onMouseDown: combinedDown,
      };
    }
    // No painting tool selected → idle handlers, so the clone stamp only acts
    // when the Stamp tool itself is active (it used to leak onto other tools).
    return idle;
  })();

  const handleZoomIn = useCallback(() => {
    stamp.toolRef.current?.adjust_zoom(1);
    stamp.syncState();
  }, [stamp]);

  const handleZoomOut = useCallback(() => {
    stamp.toolRef.current?.adjust_zoom(-1);
    stamp.syncState();
  }, [stamp]);

  const handleZoomReset = useCallback(() => {
    stamp.toolRef.current?.set_zoom(1.0);
    stamp.syncState();
  }, [stamp]);

  const handleCopyToClipboard = useCallback(async () => {
    const tool = stamp.toolRef.current;
    if (!tool) {
      toast.error("No image to copy");
      return;
    }
    try {
      // Match the export-path semantics: bake any live text overlays into
      // pixels first so the clipboard image reflects what's on screen.
      if (tool.text_annotation_count() > 0) {
        tool.flatten_text_annotations();
        stamp.flushToCanvas();
        stamp.syncState();
      }
      // Important: `tool.export_png()` returns a Uint8Array view into wasm
      // memory. Passing `.buffer` to Blob() would include the entire wasm
      // heap, not just the PNG slice — the resulting blob is huge and the
      // clipboard write fails. Copy the slice into a fresh ArrayBuffer
      // (detached from wasm memory) before handing it to Blob.
      const pngView = tool.export_png();
      const pngBytes = new Uint8Array(pngView.length);
      pngBytes.set(pngView);
      const blob = new Blob([pngBytes], { type: "image/png" });
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      toast.success("Copied to clipboard");
    } catch (err) {
      console.error("Copy to clipboard failed:", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Couldn't copy to clipboard: ${msg}`);
    }
  }, [stamp]);

  /**
   * Paste a bitmap from the clipboard into the **active layer**, centred on the
   * canvas. Accepts either the `clipboardData.items` from a native paste event
   * or, when called without them, falls back to the async Clipboard API (for an
   * explicit button/menu invocation). Decodes the image to RGBA and composites
   * it via the active-layer `paste_region` (one "Paste" history entry in Rust).
   */
  // ── Drag / paste image import ────────────────────────────────────────────
  // A dropped or pasted image doesn't act immediately — it opens a choice
  // dialog (New layer / Onto image / To gallery). `isDraggingImage` drives the
  // full-window drop affordance; `importImage` holds the decoded image + a File
  // (for the gallery path) + a preview URL while the dialog is open.
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [importImage, setImportImage] = useState<{
    pixels: Uint8ClampedArray;
    w: number;
    h: number;
    file: File;
    previewUrl: string;
  } | null>(null);

  const closeImportDialog = useCallback(() => {
    setImportImage((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }, []);

  const openImportDialog = useCallback(async (source: Blob, file: File) => {
    try {
      const { pixels, w, h } = await decodeImageSource(source);
      const previewUrl = URL.createObjectURL(source);
      setImportImage((prev) => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        return { pixels, w, h, file, previewUrl };
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Couldn't read image: ${msg}`);
    }
  }, []);

  const handlePasteFromClipboard = useCallback(
    async (items?: DataTransferItemList | null) => {
      let source: Blob | null = null;
      let fileName = "pasted.png";
      if (items) {
        for (const it of Array.from(items)) {
          if (it.kind === "file" && it.type.startsWith("image/")) {
            const f = it.getAsFile();
            if (f) {
              source = f;
              if (f.name) fileName = f.name;
            }
            break;
          }
        }
      }
      if (!source) {
        try {
          const read = await navigator.clipboard.read();
          for (const clip of read) {
            const t = clip.types.find((x) => x.startsWith("image/"));
            if (t) {
              source = await clip.getType(t);
              break;
            }
          }
        } catch {
          /* clipboard API unavailable / denied — nothing to paste */
        }
      }
      if (!source) return;
      const file =
        source instanceof File
          ? source
          : new File([source], fileName, {
              type: source.type || "image/png",
            });
      await openImportDialog(source, file);
    },
    [openImportDialog],
  );

  // Native Ctrl/Cmd+V paste of an image → open the import choice dialog.
  // Skipped while the upload dialog is open (it imports pastes as new photos)
  // or when focus is in a text field (text tool, layer rename, etc.).
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (showUpload) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      const hasImage = Array.from(items).some(
        (it) => it.kind === "file" && it.type.startsWith("image/"),
      );
      if (!hasImage) return;
      e.preventDefault();
      void handlePasteFromClipboard(items);
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [showUpload, handlePasteFromClipboard]);

  // Drag an image anywhere over the app → show the full-window drop affordance;
  // on drop, open the import choice dialog (NOT the New/upload dialog). A depth
  // counter keeps the overlay steady as the drag crosses child elements.
  useEffect(() => {
    if (showUpload) return; // let the upload dialog own drops while it's open
    const isFileDrag = (e: DragEvent) =>
      !!e.dataTransfer &&
      Array.from(e.dataTransfer.types || []).includes("Files");
    let depth = 0;
    const onEnter = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      depth += 1;
      setIsDraggingImage(true);
    };
    const onOver = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault(); // required so the browser fires `drop`
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const onLeave = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setIsDraggingImage(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault(); // stop the browser from navigating to the image
      depth = 0;
      setIsDraggingImage(false);
      const file = Array.from(e.dataTransfer?.files ?? []).find((f) =>
        f.type.startsWith("image/"),
      );
      if (!file) {
        toast.error("That doesn't look like an image");
        return;
      }
      void openImportDialog(file, file);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
      setIsDraggingImage(false);
    };
  }, [showUpload, openImportDialog]);

  // ── Import choice actions ──
  /** Center the imported image over the canvas. */
  const importDest = useCallback(
    (w: number, h: number) => {
      const cw = stamp.state.width || w;
      const ch = stamp.state.height || h;
      return { x: Math.round((cw - w) / 2), y: Math.round((ch - h) / 2) };
    },
    [stamp.state.width, stamp.state.height],
  );
  const importToNewLayer = useCallback(() => {
    const img = importImage;
    if (!img) return;
    const { x, y } = importDest(img.w, img.h);
    stamp.addLayer("Pasted Image"); // creates + activates a fresh layer
    stamp.pasteRegion(img.pixels, img.w, img.h, x, y);
    toast.success("Added as a new layer");
    closeImportDialog();
  }, [importImage, importDest, stamp, closeImportDialog]);
  const importOntoLayer = useCallback(() => {
    const img = importImage;
    if (!img) return;
    const { x, y } = importDest(img.w, img.h);
    stamp.pasteRegion(img.pixels, img.w, img.h, x, y);
    toast.success("Added onto the image");
    closeImportDialog();
  }, [importImage, importDest, stamp, closeImportDialog]);
  const importToGallery = useCallback(() => {
    const img = importImage;
    if (!img) return;
    void handleAddPhotos([img.file]);
    closeImportDialog();
  }, [importImage, handleAddPhotos, closeImportDialog]);

  const handleToggleCompare = useCallback(() => {
    setCompareActive((v) => !v);
  }, []);

  /**
   * Apply Compression & Resize. Resamples the WASM canvas with the chosen
   * filter, then re-encodes the (annotation-free) canvas buffer at the chosen
   * format + quality and persists it as the photo's stored bytes — mirroring
   * the Auto Compress pattern: putOriginal → deleteOriginal(old) → PhotoEntry
   * update (byteSize / mimeType / dims / thumbnail). The StatusBar size label
   * and the gallery tooltip both read from the entry, so they update on their
   * own. Text annotations stay live overlays (not flattened), like
   * Auto Compress.
   */
  const handleApplyCompression = useCallback(
    async (w: number, h: number, filter: number) => {
      const origW = stamp.state.width;
      const origH = stamp.state.height;
      if (w !== origW || h !== origH) {
        stamp.resizeWithFilter(w, h, filter);
      } else {
        // Quality/format-only apply: pixels are unchanged but the stored file
        // is re-encoded — record a "Compress" entry so History reflects it.
        stamp.toolRef.current?.push_compress_marker();
        stamp.syncState();
      }
      setHasBeenModified(true);
      if (activePhotoId) {
        setModifiedPhotos((prev) =>
          prev.has(activePhotoId) ? prev : new Set(prev).add(activePhotoId),
        );
      }
      // Instant estimate so the gallery badge reacts immediately; replaced by
      // the real measured savings once the re-encode below lands.
      if (activePhotoId) {
        const areaRatio = origW * origH > 0 ? (w * h) / (origW * origH) : 1;
        const qualityRatio = quality / 100;
        const savingsPercent = Math.max(
          0,
          Math.round((1 - areaRatio * qualityRatio) * 100),
        );
        if (savingsPercent > 0) {
          setImageSavings((prev) => ({
            ...prev,
            [activePhotoId]: { savingsPercent },
          }));
        }
      }

      // ── Re-encode + persist (Auto Compress pattern) ──────────────────────
      const entry = photos.find((p) => p.id === activePhotoId);
      const tool = stamp.toolRef.current;
      if (!entry || !tool) return;
      try {
        // Fresh copy of the (possibly just-resized) canvas buffer — live text
        // annotations are intentionally NOT flattened.
        const pixels = new Uint8Array(tool.get_image_data());
        const tw = tool.width();
        const th = tool.height();
        const blob = await encodeRgba(pixels, tw, th, exportFormat, quality / 100);
        // convertToBlob may fall back (e.g. AVIF → PNG on some browsers);
        // trust the blob's actual MIME for the stored metadata.
        const mime = blob.type || `image/${exportFormat}`;
        const newFile = new File([blob], `${entry.name}${extFromMime(mime)}`, {
          type: mime,
        });

        const mod = await import("stamp_tool");
        await mod.default();
        const oldKey = entry.originalKey;
        const [newKey, newThumb] = await Promise.all([
          putOriginal(newFile, tw, th),
          makeThumbnailFromPixels(pixels, tw, th, mod.resize_pixels),
        ]);
        if (oldKey && oldKey !== newKey && oldKey !== entry.uploadKey) {
          deleteOriginal(oldKey).catch(() => {});
        }

        setPhotos((prev) =>
          prev.map((p) =>
            p.id !== entry.id
              ? p
              : {
                  ...p,
                  originalKey: newKey,
                  byteSize: blob.size,
                  mimeType: mime,
                  origWidth: tw,
                  origHeight: th,
                  workingWidth: tw,
                  workingHeight: th,
                  thumbBlob: newThumb,
                },
          ),
        );

        // Real savings vs. the immutable upload-size baseline.
        const realSavings =
          entry.originalByteSize > 0
            ? Math.max(
                0,
                Math.round((1 - blob.size / entry.originalByteSize) * 100),
              )
            : 0;
        setImageSavings((prev) => ({
          ...prev,
          [entry.id]: { savingsPercent: realSavings },
        }));
      } catch (err) {
        console.error("Apply Compression & Resize failed:", err);
        toast.error("Couldn't apply compression");
      }
    },
    [stamp, activePhotoId, photos, quality, exportFormat],
  );

  const handleAutoCompress = useCallback(
    async (scope: "selected" | "all" = "all") => {
    // "selected" compresses the gallery multi-selection, or — when nothing is
    // multi-selected — just the active photo in the ring. "all" does everything.
    const targets =
      scope === "selected"
        ? selectedIds.size > 0
          ? photos.filter((p) => selectedIds.has(p.id))
          : photos.filter((p) => p.id === activePhotoId)
        : photos;
    // Load originals from IndexedDB to build File objects for the compress hook
    const photosForCompress = (
      await Promise.all(
        targets.map(async (p) => {
          const orig = await getOriginal(p.originalKey);
          if (!orig) return null;
          return { id: p.id, file: new File([orig.bytes], orig.name, { type: orig.mimeType }) };
        }),
      )
    ).filter((x): x is { id: string; file: File } => x !== null);

    compressAll(
      photosForCompress,
      {
        maxWidth: 2200,
        maxHeight: 2200,
        quality: quality / 100,
        format: `image/${exportFormat === "png" ? "webp" : exportFormat}`,
      },
      (id: string, nf: File, nu: string) => {
        URL.revokeObjectURL(nu); // We store to IDB, don't need the blob URL
        const photo = photos.find((p) => p.id === id);
        if (!photo) return;
        void (async () => {
          const [newKey, newThumb] = await Promise.all([
            putOriginal(nf, photo.workingWidth, photo.workingHeight),
            makeThumbnail(nf),
          ]);
          setPhotos((p) =>
            p.map((x) =>
              x.id !== id
                ? x
                : { ...x, originalKey: newKey, thumbBlob: newThumb, byteSize: nf.size },
            ),
          );
        })();
      },
    );
    // NOTE: intentionally does NOT set `hasBeenModified` — Auto Compress is a
    // batch op over stored files and must not light the active photo's modified
    // dot. Its result is tracked separately via `imageSavings`.
  }, [photos, selectedIds, activePhotoId, quality, exportFormat, compressAll]);

  // Track per-photo modification state. Any single-image edit marks the active
  // photo with the "modified" dot immediately: canvas edits bump the WASM undo
  // count, and resize/quality set `hasBeenModified`. Batch ops and Auto Compress
  // touch stored files (not the live canvas / `hasBeenModified`), so they never
  // light the dot here.
  useEffect(() => {
    // Skip while a photo is loading: switching to an unedited photo briefly
    // leaves the previous photo's undoCount > 0, which would otherwise dot the
    // newly-selected one. Wait until the load settles and undoCount reflects the
    // photo that's actually on the canvas.
    if (isImageLoading) return;
    // Only light the "altered" dot for *applied* canvas edits (which bump the
    // WASM undo count) — not for transient control changes like dragging the
    // quality slider (which only sets `hasBeenModified` pending an apply).
    if (activePhotoId && stamp.state.undoCount > 0) {
      setModifiedPhotos((prev) => {
        if (prev.has(activePhotoId)) return prev;
        const next = new Set(prev);
        next.add(activePhotoId);
        return next;
      });
    }
  }, [activePhotoId, stamp.state.undoCount, isImageLoading]);

  // Persist compression savings
  useEffect(() => {
    const entries = Object.entries(compressProgress.savings);
    if (entries.length === 0) return;
    setImageSavings((prev) => {
      const merged = { ...prev };
      for (const [id, s] of entries) {
        merged[id] = { savingsPercent: s.savingsPercent };
      }
      return merged;
    });
  }, [compressProgress.savings]);

  // Surface Auto-Compress progress as a sonner toast (with a progress bar)
  // instead of an inline bar in the toolbar.
  const compressToastRef = useRef<string | number | null>(null);
  const compressTotalRef = useRef(0);
  useEffect(() => {
    const { running, completed, total } = compressProgress;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    if (running) {
      compressTotalRef.current = total;
      const node = (
        <div className="flex w-full min-w-[220px] flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3 pr-6 text-sm font-semibold">
            <span>Compressing…</span>
            <span className="font-mono text-xs tabular-nums text-theme-muted-foreground">
              {completed}/{total} · {pct}%
            </span>
          </div>
          {/* -mx-4 cancels the toast's px-4 so the bar bleeds to both edges. */}
          <div className="-mx-4 h-1.5 overflow-hidden bg-foreground/10">
            <div
              className="h-full bg-success transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      );
      // Plain toast (not toast.loading) so there's no leading spinner eating the
      // row — the node spans the full toast width, letting the text sit
      // space-between and the progress bar run edge-to-edge.
      if (compressToastRef.current == null) {
        compressToastRef.current = toast(node, { duration: Infinity });
      } else {
        toast(node, { id: compressToastRef.current, duration: Infinity });
      }
    } else if (compressToastRef.current != null) {
      const n = compressTotalRef.current;
      // Dismiss the infinite-duration loading toast and raise a fresh success
      // toast so it gets its own auto-dismiss timer (updating the loading toast
      // in place keeps its Infinity duration and never expires).
      toast.dismiss(compressToastRef.current);
      toast.success(`Compressed ${n} image${n === 1 ? "" : "s"}`, {
        duration: 3000,
      });
      compressToastRef.current = null;
    }
  }, [compressProgress]);

  const exportPhotosToZip = useCallback(
    async (list: PhotoEntry[], filename: string) => {
    if (list.length === 0) return;

    // Persist the active photo's in-progress edits so every photo reads
    // uniformly from the edit store below.
    const activeChanged =
      !!activePhotoId && (stamp.state.undoCount > 0 || hasBeenModified);
    if (activeChanged && activePhotoId && stamp.toolRef.current) {
      await savePhotoEdit(activePhotoId, stamp.toolRef);
    }

    // A photo is "changed" if it was edited on the canvas (modifiedPhotos) or
    // compressed/quality-changed (imageSavings), or is the active photo with
    // pending edits. Changed photos export their processed result re-encoded at
    // the chosen format/quality; untouched photos export the original verbatim.
    const isChanged = (id: string) =>
      modifiedPhotos.has(id) ||
      imageSavings[id] != null ||
      (id === activePhotoId && activeChanged);

    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    const usedNames = new Set<string>();

    // EXIF padlock: keep metadata (transplant onto re-encodes) or strip it.
    const mode = exifKeep ? "keep" : "strip";

    for (const photo of list) {
      let bytes: Uint8Array<ArrayBuffer>;
      let mime: string;
      let ext: string;

      if (isChanged(photo.id)) {
        const edit = await loadPhotoEdit(photo.id);
        if (edit) {
          // Canvas edits (draw / text / crop / resize / transform) →
          // composite via Rust + re-encode at the chosen format/quality.
          const { pixels, w, h } = await compositeSavedEdit(edit);
          const enc = await encodeRgba(pixels, w, h, exportFormat, quality / 100);
          bytes = new Uint8Array(await enc.arrayBuffer());
          mime = enc.type || "application/octet-stream";
          ext = EXT[exportFormat];
          // The re-encode carries no EXIF; keep → transplant the true
          // original's metadata (JPEG/WebP), strip → already clean.
          let sourceTiff: Uint8Array<ArrayBuffer> | null = null;
          if (mode === "keep" && (exportFormat === "jpeg" || exportFormat === "webp")) {
            const src = await getOriginal(photo.uploadKey ?? photo.originalKey);
            if (src) sourceTiff = readExifTiff(new Uint8Array(src.bytes), src.mimeType);
          }
          bytes = applyExifToReencoded(bytes, exportFormat, mode, sourceTiff, w, h);
        } else {
          // Compressed/quality-changed only (no canvas snapshot): the processed
          // bytes already live at originalKey.
          const orig = await getOriginal(photo.originalKey);
          if (!orig) continue;
          bytes = applyExifToVerbatim(new Uint8Array(orig.bytes), orig.mimeType, mode);
          mime = orig.mimeType;
          ext = extFromMime(orig.mimeType);
        }
      } else {
        // Untouched → original bytes in their original format. Keep passes them
        // through verbatim; strip scrubs EXIF/GPS before they leave the device.
        const orig = await getOriginal(photo.originalKey);
        if (!orig) continue;
        bytes = applyExifToVerbatim(new Uint8Array(orig.bytes), orig.mimeType, mode);
        mime = orig.mimeType;
        ext = extFromMime(orig.mimeType);
      }

      // De-dupe filenames within the archive.
      const base = photo.name || "image";
      let name = `${base}${ext}`;
      for (let n = 2; usedNames.has(name); n++) name = `${base}-${n}${ext}`;
      usedNames.add(name);
      zip.file(name, new Blob([bytes], { type: mime }));
    }

    const out = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(out);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    },
    [
      activePhotoId,
      hasBeenModified,
      stamp,
      exportFormat,
      quality,
      modifiedPhotos,
      imageSavings,
      loadPhotoEdit,
      savePhotoEdit,
      exifKeep,
    ],
  );

  const handleExportAll = useCallback(
    () => exportPhotosToZip(photos, "photos.zip"),
    [exportPhotosToZip, photos],
  );

  // The single Download button always opens the chooser dialog (Canvas Image /
  // All / Clipboard Copy). The "All" button is hidden when only one image is
  // loaded. The plural label ("JPEGs") reflects the gallery count.
  const handleExportClick = useCallback(() => setExportDialogOpen(true), []);

  // Ctrl+[ / Ctrl+] — resize the active brush. Routes to whichever brush the
  // current tool uses (paint / blur / clone+redaction stamp / emoji), each
  // clamped to its own slider range and pushed to the WASM tool where needed.
  const adjustBrushSize = useCallback(
    (direction: -1 | 1) => {
      const step = 5 * direction;
      const clamp = (v: number, lo: number, hi: number) =>
        Math.max(lo, Math.min(hi, v));
      if (activeTool === "brush") {
        if (brushMode === "paint") {
          setToolSettings((p) => ({ ...p, brushSize: clamp(p.brushSize + step, 1, 50) }));
        } else if (brushMode === "blur") {
          setToolSettings((p) => ({ ...p, blurSize: clamp(p.blurSize + step, 4, 128) }));
        }
        // pen mode draws vector paths — no brush size
      } else if (activeTool === "crop" && cropEraserActive) {
        // Eraser now lives in Edit & Transform.
        setToolSettings((p) => ({ ...p, eraserSize: clamp(p.eraserSize + step, 1, 100) }));
      } else if (activeTool === "stamp") {
        if (stampSubMode === "emojis") {
          setToolSettings((p) => ({ ...p, emojiSize: clamp(p.emojiSize + step, 16, 128) }));
        } else {
          // clone + redaction share the stamp brush size (React state + WASM tool)
          setStampSettings((p) => {
            const next = clamp(p.brushSize + step, 4, 64);
            stamp.setBrushSize(next);
            return { ...p, brushSize: next };
          });
        }
      }
    },
    [activeTool, brushMode, cropEraserActive, stampSubMode, setToolSettings, setStampSettings, stamp],
  );

  useKeyboardShortcuts({
    onUndo: stamp.undo,
    onRedo: stamp.redo,
    onExport: handleExport,
    onExportAll: handleExportAll,
    onDeleteAll: handleDeleteAll,
    onSelectAll: handleSelectAll,
    onDeselect: handleDeselect,
    hasSelection: selectionMask !== null,
    onToggleMove: handleToggleMove,
    onShowCelebration: () => setShowCelebration(true),
    onAdjustBrushSize: adjustBrushSize,
    setShowUpload,
    setShowTools,
    setShowGallery,
    setShowHistory,
    setShowShortcutModal,
    // Diagnostics Window (Alt+Delete) is always available — not gated.
    setShowDiagnostics,
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onZoomReset: handleZoomReset,
    onToolChange: (t) => {
      // Batch Image Editor requires 2+ photos; ignore the shortcut otherwise
      // so the keyboard path matches the disabled sidebar icon.
      if (t === "emoji" && photos.length <= 1) return;
      setActiveTool(t);
    },
    onFlipH: stamp.flipHorizontal,
    onFlipV: stamp.flipVertical,
    onRotateCw: stamp.rotate90Cw,
    onCopyToClipboard: handleCopyToClipboard,
    onNextPhoto: handleNextPhoto,
    onPrevPhoto: handlePrevPhoto,
    onSpaceDown: () => setIsPanning(true),
    onSpaceUp: () => setIsPanning(false),
  });

  const hasImage = stamp.state.ready;
  const canUndo = stamp.state.undoCount > 0;
  const canRedo = stamp.state.redoCount > 0;

  return (
    <MotionConfig reducedMotion={prefs.reduceMotion ? "always" : "never"}>
    <div className="app-shell">
      {/* Keyboard a11y: jump straight to the canvas, past all the chrome.
          Visually hidden until focused (Tab on load). */}
      <a
        href="#main-canvas"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[var(--z-progress)] focus:rounded-lg focus:bg-[var(--accent)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--accent-foreground)] focus:shadow-2xl focus:outline-none focus:ring-2 focus:ring-white/60"
      >
        Skip to canvas
      </a>
      <AnimatePresence>
        {isImageLoading && (
          <motion.div
            variants={imageLoadBarFade}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed top-0 left-0 right-0 z-[var(--z-progress)] h-1 bg-bg-elevated"
          >
            <motion.div
              className="h-full bg-linear-to-r from-accent via-accent to-accent/60 rounded-r-full"
              {...imageLoadBarProgress}
              animate={{ width: `${Math.min(loadProgress, 100)}%` }}
              transition={
                prefs.reduceMotion ? instantTransition : imageLoadBarProgress.transition
              }
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Narrow-window drawer scrim — dims the canvas behind an open side panel
          and click-to-closes it. Sits above the canvas (z 10) but below the top
          bar (30) / panels (40) so all chrome stays bright + interactive. */}
      <AnimatePresence>
        {bp.narrow && (showTools || showHistory) && (
          <motion.div
            key="drawer-scrim"
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => {
              setShowTools(false);
              setShowHistory(false);
            }}
            className="fixed inset-0 z-[20] bg-black/40"
          />
        )}
      </AnimatePresence>

      {/* Too-small window (< BP_MIN): a dismissible notice, not a layout fork. */}
      {bp.tooSmall && !smallNoticeDismissed && (
        <SmallWindowNotice onDismiss={() => setSmallNoticeDismissed(true)} />
      )}

      {/* Cold start: one full-page surface. It's the splash (logo + spinner)
          while booting, then the spinner fades, the logo eases up, and EITHER
          the New actions or the Welcome-back content reveal — same entrance for
          both. Auto-reopen just fades it out. Mid-session "New" uses the compact
          UploadDialog below. */}
      <FirstRunScreen
        show={booting || (firstRun && (showUpload || !!resumeManifest))}
        phase={booting ? "loading" : "ready"}
        reduceMotion={prefs.reduceMotion}
      >
        {resumeManifest ? (
          <ResumeContent
            photos={resumeManifest.photos}
            onResume={handleResumeSession}
            onStartFresh={handleStartFresh}
          />
        ) : (
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-bg-secondary shadow-2xl">
            <NewActions
              onFiles={handleAddPhotos}
              isLoading={isImageLoading}
              loadProgress={loadProgress}
            />
          </div>
        )}
      </FirstRunScreen>

      <UploadDialog
        open={showUpload && !resumeManifest && !booting && !firstRun}
        onClose={() => setShowUpload(false)}
        onFiles={handleAddPhotos}
        isLoading={isImageLoading}
        loadProgress={loadProgress}
        canClose={photos.length > 0}
      />

      {/* Drag-an-image-anywhere affordance + the import choice dialog. */}
      <ImageDropOverlay show={isDraggingImage} />
      <ImportImageDialog
        open={importImage !== null}
        onOpenChange={(o) => {
          if (!o) closeImportDialog();
        }}
        previewUrl={importImage?.previewUrl ?? null}
        width={importImage?.w ?? 0}
        height={importImage?.h ?? 0}
        canUseLayers={TIERS[effectiveUserMode].layersPerImage > 0}
        hasActivePhoto={activePhotoId !== null}
        onNewLayer={importToNewLayer}
        onOntoLayer={importOntoLayer}
        onAddToGallery={importToGallery}
      />

      <ShortcutModal
        open={showShortcutModal}
        onClose={() => setShowShortcutModal(false)}
      />

      <CelebrationDialog
        open={showCelebration}
        onOpenChange={setShowCelebration}
      />

      <IdleScreen open={idle} onContinue={wake} reduceMotion={prefs.reduceMotion} />

      {/* Diagnostics Window (Alt+Delete) is always available. */}
      <DiagnosticLogOverlay
        open={showDiagnostics}
        onClose={() => setShowDiagnostics(false)}
        imageMeta={{
          photoId: activePhotoId,
          name: activeEntry?.name,
          mimeType: activeEntry?.mimeType,
          origWidth: activeEntry?.origWidth,
          origHeight: activeEntry?.origHeight,
          currentWidth: stamp.state.width,
          currentHeight: stamp.state.height,
          originalByteSize: activeEntry?.originalByteSize,
          currentByteSize: activeEntry?.byteSize,
          originalKey: activeEntry?.originalKey,
          uploadKey: activeEntry?.uploadKey,
          undoCount: stamp.state.undoCount,
          redoCount: stamp.state.redoCount,
          modified:
            activePhotoId != null &&
            (modifiedPhotos.has(activePhotoId) ||
              hasBeenModified ||
              stamp.state.undoCount > 0),
          getCanvasPng: () => {
            const t = stamp.toolRef.current;
            return t ? new Uint8Array(t.export_png()) : null;
          },
        }}
      />

      <Toaster />

      <Dialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete all images?</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <DialogDescription>
              This will remove all {photos.length} image{photos.length !== 1 ? "s" : ""} and their edit history. This cannot be undone.
            </DialogDescription>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <LargeButton className="flex-1">Cancel</LargeButton>
            </DialogClose>
            <LargeButton
              onClick={confirmDeleteAll}
              className="flex-1 border-destructive/40 bg-destructive/15 text-destructive hover:border-destructive hover:bg-destructive/25 hover:brightness-100"
            >
              <Trash2 className="h-4 w-4" />
              Delete all
            </LargeButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single-image delete confirm — per-image trashcan + right-click "Delete image". */}
      <Dialog
        open={deletePhotoId !== null}
        onOpenChange={(o) => !o && setDeletePhotoId(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this image?</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <DialogDescription>
              This removes the image and its edit history. This cannot be undone.
            </DialogDescription>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <LargeButton className="flex-1">Cancel</LargeButton>
            </DialogClose>
            <LargeButton
              onClick={() => {
                const id = deletePhotoId;
                setDeletePhotoId(null);
                if (id) handleRemovePhoto(id);
              }}
              className="flex-1 border-destructive/40 bg-destructive/15 text-destructive hover:border-destructive hover:bg-destructive/25 hover:brightness-100"
            >
              <Trash2 className="h-4 w-4" />
              Delete image
            </LargeButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete-selected confirm. */}
      <Dialog open={deleteSelectedOpen} onOpenChange={setDeleteSelectedOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete selected images?</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <DialogDescription>
              This removes the {selectedIds.size} selected image
              {selectedIds.size !== 1 ? "s" : ""} and their edit history. This
              cannot be undone.
            </DialogDescription>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <LargeButton className="flex-1">Cancel</LargeButton>
            </DialogClose>
            <LargeButton
              onClick={() => {
                setDeleteSelectedOpen(false);
                handleDeleteSelected();
              }}
              className="flex-1 border-destructive/40 bg-destructive/15 text-destructive hover:border-destructive hover:bg-destructive/25 hover:brightness-100"
            >
              <Trash2 className="h-4 w-4" />
              Delete selected
            </LargeButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Download, Copy, or Share</DialogTitle>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <DialogDescription>
              {photos.length > 1 ? (
                <>
                  Save the selected image — or all of them as a{" "}
                  <span className="font-mono">.zip</span> — copy the canvas to
                  your clipboard, or create a public{" "}
                  <strong className="font-semibold text-text-secondary">
                    share link
                  </strong>{" "}
                  anyone can open.
                </>
              ) : (
                <>
                  Save this image, copy the canvas to your clipboard, or create a
                  public{" "}
                  <strong className="font-semibold text-text-secondary">
                    share link
                  </strong>{" "}
                  anyone can open.
                </>
              )}
            </DialogDescription>

            {/* Format picker — a second shot at the format for anyone who missed
                the Compress dropdown. */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-text-muted">Format</span>
              <RadioCards
                name="download-format"
                value={exportFormat}
                onValueChange={setExportFormat}
                options={DOWNLOAD_FORMATS}
                columns={2}
              />
            </div>
          </DialogBody>

          <DialogFooter className="flex-row gap-2">
            <ActionTile
              icon={ImageIcon}
              label={`Download & Share ${exportFormat.toUpperCase()}`}
              onClick={() => {
                setExportDialogOpen(false);
                void handleExport();
              }}
            />
            <ShareButton
              exportPng={() => stamp.exportBlob("png")}
              canvasW={stamp.state.width}
              canvasH={stamp.state.height}
              fileName={photos.find((p) => p.id === activePhotoId)?.name}
              disabled={!hasImage}
              onShared={() => setExportDialogOpen(false)}
            />
            {photos.length > 1 && (
              <ActionTile
                icon={Archive}
                label={`All (${photos.length})`}
                onClick={() => {
                  setExportDialogOpen(false);
                  handleExportAll();
                }}
              />
            )}
            <ActionTile
              icon={Clipboard}
              label="Clipboard"
              onClick={() => {
                setExportDialogOpen(false);
                void handleCopyToClipboard();
              }}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {showTopBar && (
          <TopBar
            zoom={stamp.state.zoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onUndo={stamp.undo}
            onRedo={stamp.redo}
            canUndo={canUndo}
            canRedo={canRedo}
            showUpload={showUpload}
            showTools={showTools}
            showGallery={showGallery}
            showHistory={showHistory}
            onToggleUpload={() => setShowUpload((v) => !v)}
            onToggleTools={() => setShowTools((v) => !v)}
            onToggleGallery={() => setShowGallery((v) => !v)}
            onToggleHistory={() => setShowHistory((v) => !v)}
            winWidth={bp.width}
            drawerMode={bp.narrow}
            reduceMotion={prefs.reduceMotion}
            general={general}
            superUser={superUser}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTools && (
          <ToolsSidebar
            onClose={() => setShowTools(false)}
            activeTool={activeTool}
            onToolChange={(t) => { setActiveTool(t); }}
            stampSettings={stampSettings}
            onStampSettingsChange={handleStampSettingsChange}
            hasSource={stamp.state.hasSource}
            onExport={handleExportClick}
            canExport={hasImage}
            photoCount={photos.length}
            exportFormat={exportFormat}
            onExportFormatChange={setExportFormat}
            onFlipH={stamp.flipHorizontal}
            onFlipV={stamp.flipVertical}
            onRotate90Cw={stamp.rotate90Cw}
            onBrightness={stamp.adjustBrightness}
            onContrast={stamp.adjustContrast}
            onGlobalBlur={stamp.applyGlobalBlur}
            imageReady={hasImage}
            onResize={handleApplyCompression}
            imageWidth={stamp.state.width}
            imageHeight={stamp.state.height}
            currentByteSize={activeEntry?.byteSize ?? 0}
            currentMime={activeEntry?.mimeType}
            originalByteSize={activeEntry?.originalByteSize ?? 0}
            activePhotoId={activePhotoId}
            undoCount={stamp.state.undoCount}
            quality={quality}
            onQualityChange={handleQualityChange}
            hasBeenModified={hasBeenModified}
            compareActive={compareActive}
            onToggleCompare={handleToggleCompare}
            onAutoCompress={handleAutoCompress}
            isCompressing={compressProgress.running}
            compressProgress={compressProgress}
            selectedCount={selectedIds.size}
            onApplyCrop={drawingTools.applyCrop}
            onSetCropSelection={drawingTools.setCropSelection}
            cropRatio={cropRatio}
            onCropRatioChange={setCropRatio}
            onPlace={handlePlace}
            selectedKind={selectedObject?.type ?? null}
            selection={{
              tolerance: selectionTolerance,
              onToleranceChange: setSelectionTolerance,
              mode: selectionMode,
              onToggleMode: handleToggleSelectionMode,
              onSelectAll: handleSelectAll,
              onDeselect: handleDeselect,
              onDelete: handleDeleteSelection,
              active: selectionMask !== null,
            }}
            moveActive={moveActive}
            onToggleMove={handleToggleMove}
            eraser={{
              active: cropEraserActive,
              onToggle: () => setCropEraserActive((v) => !v),
              size: toolSettings.eraserSize,
              onSizeChange: (v) =>
                setToolSettings((p) => ({ ...p, eraserSize: v })),
              opacity: toolSettings.eraserOpacity,
              onOpacityChange: (v) =>
                setToolSettings((p) => ({ ...p, eraserOpacity: v })),
              hardness: toolSettings.eraserHardness,
              onHardnessChange: (v) =>
                setToolSettings((p) => ({ ...p, eraserHardness: v })),
            }}
            toolSettings={toolSettings}
            onToolSettingsChange={handleToolSettingsChange}
            shapesMode={shapesMode}
            onShapesModeChange={setShapesMode}
            brushMode={brushMode}
            onBrushModeChange={setBrushMode}
            effectsMode={effectsMode}
            onEffectsModeChange={setEffectsMode}
            colorPickerActive={colorPickerActive}
            onSetColorPickerActive={setColorPickerActive}
            pickedColor={toolSettings.brushColor}
            stampSubMode={stampSubMode}
            onStampSubModeChange={setStampSubMode}
            stampEmoji={toolSettings.emoji}
            stampEmojiSize={toolSettings.emojiSize}
            onStampEmojiChange={(e) => setToolSettings((prev) => ({ ...prev, emoji: e }))}
            onStampEmojiSizeChange={(s) => setToolSettings((prev) => ({ ...prev, emojiSize: s }))}
            photos={photos}
            setPhotos={setPhotos}
            stampToolRef={stamp.toolRef}
            flushToCanvas={stamp.flushToCanvas}
            syncState={stamp.syncState}
            aiEnabled={hasReplicateAI(effectiveUserMode)}
            onAIResult={handleAIResult}
          />
        )}
      </AnimatePresence>

      <ContextMenu>
        <ContextMenuTrigger asChild>
          <motion.main
            id="main-canvas"
            aria-label="Image canvas"
            tabIndex={-1}
            animate={{
              marginLeft: !bp.narrow && showTools ? PANEL_OPEN_GUTTER : 0,
              marginRight: !bp.narrow && showHistory ? PANEL_OPEN_GUTTER : 0,
            }}
            transition={prefs.reduceMotion ? instantTransition : panelSpacingTransition}
            className="main-content focus:outline-none"
            style={{ position: "relative" }}
          >
            <>
              {/* Emoji-grid mode: wrap the grid host in a flex pane sized to
                  fit between the fixed TopBar and GalleryBar. The grid sits
                  inside, capped at a 5:3 aspect ratio with gap + padding for
                  breathing room. Non-emoji mode falls through to the regular
                  full-size canvas host. The CanvasArea below is rendered ONCE
                  (a stable React subtree) so the canvas DOM + WASM pixels
                  survive tool switches; only the wrapper around it changes. */}
              {activeTool === "emoji" ? (
                <div
                  style={{
                    position: "absolute",
                    top: showTopBar ? 80 : 12,
                    bottom: showGallery ? 168 : 56,
                    left: 12,
                    right: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 0,
                    minWidth: 0,
                  }}
                >
                  <div
                    className="canvas-grid-host checkerboard-canvas"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(5, 1fr)",
                      gridTemplateRows: "repeat(3, 1fr)",
                      gap: "12px",
                      padding: "12px",
                      maxWidth: "100%",
                      maxHeight: "100%",
                      width: "auto",
                      margin: "auto",
                      aspectRatio: "5 / 3",
                    }}
                  >
                    <div
                      className={`canvas-grid-hero${
                        activePhotoId && photos.length > 0
                          ? " ring-2 ring-orange-400"
                          : ""
                      }`}
                      style={{
                        gridArea: "1 / 1 / 3 / 3",
                        position: "relative",
                        overflow: "hidden",
                        borderRadius: "0.375rem",
                      }}
                    >
                      <div style={{ position: "absolute", inset: 0 }}>
                        <CanvasArea
                          ref={canvasRef}
                          hookResult={effectiveStamp}
                          brushDiameter={diameter}
                          cursorPos={pos}
                          cursorVisible={visible}
                          onCanvasEnter={onCanvasEnter}
                          onCanvasLeave={() => { onCanvasLeave(); colorPicker.onMouseLeave(); }}
                          beforeUrl={originalUrl}
                          compareActive={compareActive}
                          activeTool={activeTool}
                          textInput={textTool.textInput}
                          textareaRef={textTool.textareaRef}
                          onCanvasClick={textTool.onCanvasClick}
                          onTextKeyDown={textTool.onTextKeyDown}
                          onTextChange={textTool.onTextChange}
                          onTextBlur={textTool.onTextBlur}
                          textSettings={{
                            fontSize: toolSettings.fontSize,
                            fontFamily: toolSettings.fontFamily,
                            fontWeight: toolSettings.fontWeight,
                            textColor: toolSettings.textColor,
                            bgKind: toolSettings.bgKind,
                            bgColor: toolSettings.bgColor,
                            bgOpacity: toolSettings.bgOpacity,
                            bgPadding: toolSettings.bgPadding,
                            bgCornerRadius: toolSettings.bgCornerRadius,
                            bgTail: toolSettings.bgTail,
                          }}
                          containerRef={containerRef}
                          onTextPositionChange={textTool.setTextPosition}
                          onTextFontSizeChange={handleTextFontSizeChange}
                          onTextRotationChange={textTool.setTextRotation}
                          annotations={annotationBoxes}
                          hoveredAnnotationId={textTool.hoveredAnnotationId}
                          onCanvasHover={textTool.onCanvasHover}
                          isPanning={isPanning}
                          cropSelection={drawingTools.cropSelection}
                          onCropChange={(sel) => drawingTools.setCropSelection(sel)}
                          colorPickerActive={colorPickerActive}
                          drawEditState={drawingTools.editState}
                          onDrawEditChange={drawingTools.updateEditGeometry}
                          drawSettings={{
                            strokeColor: toolSettings.strokeColor,
                            strokeWidth: toolSettings.strokeWidth,
                            arrowStyle: toolSettings.arrowStyle,
                            shape: toolSettings.shape ?? "rect",
                            fillMode: toolSettings.fillMode,
                            fillColor: toolSettings.fillColor,
                            fillColor2: toolSettings.fillColor2,
                            gradientAngle: toolSettings.gradientAngle,
                          }}
                          penActive={penActive}
                          penColor={toolSettings.strokeColor}
                          penStrokeWidth={toolSettings.strokeWidth}
                          penFillMode={toolSettings.fillMode}
                          penFillColor={toolSettings.fillColor}
                          onPenCommit={handlePenCommit}
                          onPenHitTest={handlePenHitTest}
                          onPenEditStart={handlePenEditStart}
                          onPenEditCommit={handlePenEditCommit}
                          onPenEditCancel={handlePenEditCancel}
                        />
                      </div>
                      {(!activePhotoId || photos.length === 0) && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/95 text-center text-theme-muted-foreground">
                          <ImagePlus className="h-10 w-10 opacity-60" />
                          <p className="text-sm font-semibold">No photos loaded</p>
                          <p className="text-xs">Upload images to start batch editing</p>
                        </div>
                      )}
                      {activePhotoId && photos.length > 0 && (
                        <div className="absolute top-2 left-2 z-20 rounded-full bg-orange-500 px-2.5 py-0.5 text-2xs font-semibold uppercase tracking-wider text-white shadow-md">
                          Selected
                        </div>
                      )}
                    </div>
                    <GridThumbnails
                      photos={photos}
                      activePhotoId={activePhotoId}
                      onSelectPhoto={handleSelectPhoto}
                    />
                  </div>
                </div>
              ) : (
                <div className="canvas-fullsize-host">
                  <div className="canvas-fullsize-slot">
                    <CanvasArea
                      ref={canvasRef}
                      hookResult={effectiveStamp}
                      brushDiameter={diameter}
                      cursorPos={pos}
                      cursorVisible={visible}
                      onCanvasEnter={onCanvasEnter}
                      onCanvasLeave={() => { onCanvasLeave(); colorPicker.onMouseLeave(); }}
                      beforeUrl={originalUrl}
                      compareActive={compareActive}
                      activeTool={activeTool}
                      textInput={textTool.textInput}
                      textareaRef={textTool.textareaRef}
                      onCanvasClick={textTool.onCanvasClick}
                      selectionActive={activeTool === "arrow" && selectionMode}
                      onSelectionClick={handleSelectionClick}
                      selectionMask={activeTool === "arrow" ? selectionMask : null}
                      selectionWidth={stamp.state.width}
                      selectionHeight={stamp.state.height}
                      onTextKeyDown={textTool.onTextKeyDown}
                      onTextChange={textTool.onTextChange}
                      onTextBlur={textTool.onTextBlur}
                      guides={guidesConfig}
                      textSettings={{
                        fontSize: toolSettings.fontSize,
                        fontFamily: toolSettings.fontFamily,
                        fontWeight: toolSettings.fontWeight,
                        textColor: toolSettings.textColor,
                        bgKind: toolSettings.bgKind,
                        bgColor: toolSettings.bgColor,
                        bgOpacity: toolSettings.bgOpacity,
                        bgPadding: toolSettings.bgPadding,
                        bgCornerRadius: toolSettings.bgCornerRadius,
                        bgTail: toolSettings.bgTail,
                      }}
                      containerRef={containerRef}
                      onTextPositionChange={textTool.setTextPosition}
                      onTextFontSizeChange={handleTextFontSizeChange}
                      onTextRotationChange={textTool.setTextRotation}
                      annotations={annotationBoxes}
                      hoveredAnnotationId={textTool.hoveredAnnotationId}
                      onCanvasHover={textTool.onCanvasHover}
                      isPanning={isPanning}
                      cropSelection={drawingTools.cropSelection}
                      onCropChange={(sel) => drawingTools.setCropSelection(sel)}
                      colorPickerActive={colorPickerActive}
                      drawEditState={drawingTools.editState}
                      onDrawEditChange={drawingTools.updateEditGeometry}
                      drawSettings={{
                        strokeColor: toolSettings.strokeColor,
                        strokeWidth: toolSettings.strokeWidth,
                        arrowStyle: toolSettings.arrowStyle,
                        shape: toolSettings.shape ?? "rect",
                        fillMode: toolSettings.fillMode,
                        fillColor: toolSettings.fillColor,
                        fillColor2: toolSettings.fillColor2,
                        gradientAngle: toolSettings.gradientAngle,
                      }}
                      penActive={penActive}
                      penColor={toolSettings.strokeColor}
                      penStrokeWidth={toolSettings.strokeWidth}
                      penFillMode={toolSettings.fillMode}
                      penFillColor={toolSettings.fillColor}
                      onPenCommit={handlePenCommit}
                      onPenHitTest={handlePenHitTest}
                      onPenEditStart={handlePenEditStart}
                      onPenEditCommit={handlePenEditCommit}
                      onPenEditCancel={handlePenEditCancel}
                    />
                  </div>
                </div>
              )}
              <MagnifierOverlay magnifier={colorPicker.magnifier} />
            </>
          </motion.main>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-72">
          <ContextMenuItem onClick={stamp.undo} disabled={!canUndo}>
            <Undo className="h-4 w-4 mr-2" /> Undo
            <ContextMenuShortcut>Ctrl+Z</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={stamp.redo} disabled={!canRedo}>
            <Redo className="h-4 w-4 mr-2" /> Redo
            <ContextMenuShortcut>Ctrl+Shift+Z</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleCopyToClipboard} disabled={!hasImage}>
            <Clipboard className="h-4 w-4 mr-2" /> Copy to Clipboard
            <ContextMenuShortcut>Ctrl+Shift+C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={handleExport} disabled={!hasImage}>
            <Download className="h-4 w-4 mr-2" /> Export{" "}
            {exportFormat.toUpperCase()}
            <ContextMenuShortcut>Alt+E</ContextMenuShortcut>
          </ContextMenuItem>
          {photos.length > 1 && (
            <ContextMenuItem onClick={handleExportAll}>
              <Archive className="h-4 w-4 mr-2" /> Export All (ZIP)
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={handleActivateEyedropper}
            disabled={!hasImage}
          >
            <Pipette className="h-4 w-4 mr-2" /> Activate Eyedropper
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4 mr-2" /> Zoom In
            <ContextMenuShortcut>Alt+=</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4 mr-2" /> Zoom Out
            <ContextMenuShortcut>Alt+-</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={stamp.flipHorizontal} disabled={!hasImage}>
            <RotateCcw className="h-4 w-4 mr-2" /> Flip Horizontal
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => activePhotoId && setDeletePhotoId(activePhotoId)}
            disabled={!activePhotoId}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" /> Delete image
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <AnimatePresence>
        {showGallery && (
          <GalleryBar
            photos={photos}
            activeId={activePhotoId}
            onSelect={handleSelectPhoto}
            onRemove={(id) => setDeletePhotoId(id)}
            onClose={() => setShowGallery(false)}
            showTools={showTools}
            showHistory={showHistory}
            reduceMotion={prefs.reduceMotion}
            narrow={bp.narrow}
            compressionProgress={compressProgress.items ?? {}}
            compressionSavings={imageSavings}
            modifiedPhotos={modifiedPhotos}
            maxPhotos={maxPhotos}
            onDeleteAll={handleDeleteAll}
            onDeleteSelected={() => setDeleteSelectedOpen(true)}
            onDuplicateSelected={handleDuplicateSelected}
            onExportSelected={handleExportClick}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelectPhoto}
            onClearSelection={clearSelection}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHistory && (
          <ReviewPanel
            history={stamp.state.history}
            onJump={stamp.jumpToHistory}
            onDelete={stamp.deleteHistoryEntry}
            onClose={() => setShowHistory(false)}
            onUndo={stamp.undo}
            canUndo={canUndo}
            onRedo={stamp.redo}
            canRedo={canRedo}
            objects={reselectObjects}
            onSelectObject={handleSelectObject}
            onDeleteObject={handleDeleteObject}
            userMode={effectiveUserMode}
            layers={stamp.state.layers}
            onAddLayer={() => stamp.addLayer()}
            onDuplicateLayer={stamp.duplicateLayer}
            onDeleteLayer={stamp.removeLayer}
            onSelectLayer={stamp.setActiveLayer}
            onToggleLayerVisible={stamp.setLayerVisible}
            onSetLayerOpacity={stamp.setLayerOpacity}
            onRenameLayer={stamp.renameLayer}
            onMoveLayer={stamp.moveLayer}
            onMergeDown={stamp.mergeDown}
            onFlattenAll={stamp.flattenAll}
            mask={{
              editing: maskEditing,
              value: maskPaintValue,
              onAdd: handleAddMask,
              onRemove: stamp.removeLayerMask,
              onApply: stamp.applyLayerMask,
              onInvert: stamp.invertLayerMask,
              onToggleEdit: handleToggleMaskEdit,
              onSetValue: setMaskPaintValue,
            }}
            getHistogram={getHistogram}
            histogramSignature={`${activePhotoId ?? ""}:${stamp.state.undoCount}:${stamp.state.redoCount}:${stamp.state.width}x${stamp.state.height}:${isImageLoading ? "loading" : "ready"}`}
            histogramPhotoKey={activePhotoId ?? ""}
          />
        )}
      </AnimatePresence>

      {AUTH_ENABLED && <AuthModeWatcher onMode={handleAuthMode} />}

      {photos.length > 0 && (
        <StatusBar
          state={stamp.state}
          fileSize={photos.find((p) => p.id === activePhotoId)?.byteSize}
          activeToolHint={
            drawingTools.editState
              ? { keys: "Enter/Esc", label: "place / cancel" }
              : TOOL_SHORTCUT[activeTool]
          }
        />
      )}

      {/* Brush cursor — hidden during pan mode */}
      {visible &&
        !isPanning &&
        !colorPickerActive &&
        (activeTool === "stamp" ||
          activeTool === "brush" ||
          activeTool === "emoji" ||
          (activeTool === "crop" && cropEraserActive)) && (
          <div
            className="brush-cursor"
            style={{
              left: pos.x,
              top: pos.y,
              width: diameter,
              height: diameter,
            }}
          />
        )}
    </div>
    </MotionConfig>
  );
}
