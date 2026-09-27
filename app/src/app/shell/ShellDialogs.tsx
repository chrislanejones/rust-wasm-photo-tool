// The app-level overlays: start surfaces, dialogs, confirms, toasts — moved
// out of AppShell's return verbatim (B3, docs/AppShell-Refactor-Plan.md).
// Everything here is either store state (dialog open flags, the gallery) or a
// session handler AppShell still owns (resume, add photos, the three deletes).
import { useEngine, useEngineState } from "@/app/session/SessionContext";
import type { useImageImport } from "@/app/session/useImageImport";
import { useTabClaim } from "@/hooks/useTabClaim";
import { useUIStore } from "@/stores/useUIStore";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { TIERS, type UserMode } from "@/lib/tiers";
import { FirstRunScreen } from "@/features/upload/FirstRunScreen";
import { NewActions } from "@/features/upload/NewActions";
import { ResumeContent } from "@/features/upload/ResumeContent";
import { UploadDialog } from "@/features/upload/UploadDialog";
import { ImageDropOverlay } from "@/features/upload/ImageDropOverlay";
import { ImportImageDialog } from "@/features/upload/ImportImageDialog";
import { ShortcutModal } from "@/components/ShortcutModal";
import { CelebrationDialog } from "@/components/CelebrationDialog";
import { IdleScreen } from "@/components/IdleScreen";
import { MultiTabScreen } from "@/components/MultiTabScreen";
import { DiagnosticLogOverlay } from "@/components/DiagnosticLogOverlay";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Toaster } from "@/components/ui/sonner";
import { Trash2 } from "lucide-react";
import { ExportDialog, type ExportDialogProps } from "./ExportDialog";

export interface ShellDialogsProps {
  /** Phone width — MobileShell owns the whole surface there. */
  mobile: boolean;
  reduceMotion: boolean;
  effectiveUserMode: UserMode;
  onResumeSession: () => void;
  onStartFresh: () => void;
  onAddPhotos: (files: File[]) => Promise<void>;
  imageImport: ReturnType<typeof useImageImport>;
  /** Idle screen (useIdleTimeout — keyed on a preference AppShell owns). */
  idle: boolean;
  onWake: () => void;
  onConfirmDeleteAll: () => void;
  onRemovePhoto: (id: string) => void;
  onDeleteSelected: () => void;
  exportDialog: ExportDialogProps;
}

export function ShellDialogs({
  mobile,
  reduceMotion,
  effectiveUserMode,
  onResumeSession: handleResumeSession,
  onStartFresh: handleStartFresh,
  onAddPhotos: handleAddPhotos,
  imageImport,
  idle,
  onWake: wake,
  onConfirmDeleteAll: confirmDeleteAll,
  onRemovePhoto: handleRemovePhoto,
  onDeleteSelected: handleDeleteSelected,
  exportDialog,
}: ShellDialogsProps) {
  const engine = useEngine();
  const state = useEngineState();
  const { isDraggingImage, importImage, closeImportDialog, importToNewLayer, importOntoLayer, importToGallery } =
    imageImport;
  const booting = useUIStore((s) => s.booting);
  const firstRun = useUIStore((s) => s.firstRun);
  const showUpload = useUIStore((s) => s.showUpload);
  const setShowUpload = useUIStore((s) => s.setShowUpload);
  const showShortcutModal = useUIStore((s) => s.showShortcutModal);
  const setShowShortcutModal = useUIStore((s) => s.setShowShortcutModal);
  const showCelebration = useUIStore((s) => s.showCelebration);
  const setShowCelebration = useUIStore((s) => s.setShowCelebration);
  const showDiagnostics = useUIStore((s) => s.showDiagnostics);
  const setShowDiagnostics = useUIStore((s) => s.setShowDiagnostics);
  const deleteAllOpen = useUIStore((s) => s.deleteAllOpen);
  const setDeleteAllOpen = useUIStore((s) => s.setDeleteAllOpen);
  const deletePhotoId = useUIStore((s) => s.deletePhotoId);
  const setDeletePhotoId = useUIStore((s) => s.setDeletePhotoId);
  const deleteSelectedOpen = useUIStore((s) => s.deleteSelectedOpen);
  const setDeleteSelectedOpen = useUIStore((s) => s.setDeleteSelectedOpen);
  const photos = useGalleryStore((s) => s.photos);
  const activePhotoId = useGalleryStore((s) => s.activePhotoId);
  const resumeManifest = useGalleryStore((s) => s.resumeManifest);
  const selectedIds = useGalleryStore((s) => s.selectedIds);
  const modifiedPhotos = useGalleryStore((s) => s.modifiedPhotos);
  const hasBeenModified = useGalleryStore((s) => s.hasBeenModified);
  const activeEntry = photos.find((p) => p.id === activePhotoId) ?? null;
  // Single editing tab. Every tab shares one set of IndexedDB databases, so two
  // open at once silently overwrite each other; whichever tab claimed last wins
  // and the others park behind MultiTabScreen until "Use here".
  const { isStale: isStaleTab, claimHere: claimTabHere } = useTabClaim();

  return (
    <>
      {/* Cold start: one full-page surface. It's the splash (logo + spinner)
          while booting, then the spinner fades, the logo eases up, and EITHER
          the New actions or the Welcome-back content reveal — same entrance for
          both. Auto-reopen just fades it out. Mid-session "New" uses the compact
          UploadDialog below. Not on mobile: MobileShell owns the whole surface
          there (its own splash, its own empty state, auto-resume). */}
      <FirstRunScreen
        show={!mobile && (booting || (firstRun && (showUpload || !!resumeManifest)))}
        phase={booting ? "loading" : "ready"}
        reduceMotion={reduceMotion}
      >
        {resumeManifest ? (
          <ResumeContent
            photos={resumeManifest.photos}
            onResume={handleResumeSession}
            onStartFresh={handleStartFresh}
          />
        ) : (
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-bg-secondary shadow-2xl">
            <NewActions onFiles={handleAddPhotos} />
          </div>
        )}
      </FirstRunScreen>

      <UploadDialog
        open={!mobile && showUpload && !resumeManifest && !booting && !firstRun}
        onClose={() => setShowUpload(false)}
        onFiles={handleAddPhotos}
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

      <IdleScreen open={idle} onContinue={wake} />
      {/* Another tab took the session. Sits beside IdleScreen because it is
          the same idea — this tab is parked until you say otherwise — and
          shares its z-layer so it covers every panel. */}
      <MultiTabScreen open={isStaleTab} onUseHere={claimTabHere} />

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
          currentWidth: state.width,
          currentHeight: state.height,
          originalByteSize: activeEntry?.originalByteSize,
          currentByteSize: activeEntry?.byteSize,
          originalKey: activeEntry?.originalKey,
          uploadKey: activeEntry?.uploadKey,
          undoCount: state.undoCount,
          redoCount: state.redoCount,
          modified:
            activePhotoId != null &&
            (modifiedPhotos.has(activePhotoId) ||
              hasBeenModified ||
              state.undoCount > 0),
          // The `await` sits INSIDE the wrapper: `new Uint8Array` of a Promise is
          // an EMPTY typed array, not a throw. Its consumer
          // (`ImageMetaPanel.recompute`) guards `!png || png.length === 0` rather
          // than `!png` alone, which is the only reason that would have degraded
          // safely instead of hashing a zero-byte buffer.
          getCanvasPng: async () => {
            const t = engine.toolRef.current;
            return t ? new Uint8Array(await t.export_png()) : null;
          },
        }}
      />

      <Toaster />

      {/* "A new version is ready" — Yes / No. Mounted here beside Toaster,
          IdleScreen and MultiTabScreen because it is the same kind of thing:
          an app-level overlay with no place in the tool tree. Nothing else is
          added to AppShell for it — the state lives in lib/pwa/updatePrompt.ts
          (reachable from the non-React service-worker triggers) and the markup
          in components/UpdatePrompt.tsx. */}
      <UpdatePrompt />

      <ConfirmDialog
        open={deleteAllOpen}
        onOpenChange={setDeleteAllOpen}
        title="Delete all images?"
        cancelLabel="Cancel"
        confirmLabel="Delete all"
        confirmIcon={Trash2}
        tone="destructive"
        onConfirm={confirmDeleteAll}
      >
        This will remove all {photos.length} image{photos.length !== 1 ? "s" : ""} and their edit history. This cannot be undone.
      </ConfirmDialog>

      {/* Single-image delete confirm — per-image trashcan + right-click "Delete image". */}
      <ConfirmDialog
        open={deletePhotoId !== null}
        onOpenChange={(o) => !o && setDeletePhotoId(null)}
        title="Delete this image?"
        cancelLabel="Cancel"
        confirmLabel="Delete image"
        confirmIcon={Trash2}
        tone="destructive"
        onConfirm={() => {
          const id = deletePhotoId;
          setDeletePhotoId(null);
          if (id) handleRemovePhoto(id);
        }}
      >
        This removes the image and its edit history. This cannot be undone.
      </ConfirmDialog>

      {/* Delete-selected confirm. */}
      <ConfirmDialog
        open={deleteSelectedOpen}
        onOpenChange={setDeleteSelectedOpen}
        title={selectedIds.size === 1 ? "Delete this image?" : "Delete selected images?"}
        cancelLabel="Cancel"
        confirmLabel={selectedIds.size === 1 ? "Delete image" : "Delete selected"}
        confirmIcon={Trash2}
        tone="destructive"
        onConfirm={() => {
          setDeleteSelectedOpen(false);
          handleDeleteSelected();
        }}
      >
        {selectedIds.size === 1
          ? "This removes the selected image and its edit history. This cannot be undone."
          : `This removes the ${selectedIds.size} selected images and their edit history. This cannot be undone.`}
      </ConfirmDialog>

      <ExportDialog {...exportDialog} />
    </>
  );
}
