// A slow photo switch, on the canvas: after 150 ms the OLD photo dims and goes
// inert, and "Loading <name>" sits over it, so the canvas never passes off the
// previous photo as the one you asked for. Fast switches show nothing.
//
// No fade, so Reduce Motion needs no special case. The PANEL's lock and its
// screen-reader line live in PerPhotoRegion; this is the visual half only.
import { StatusMark } from "@/components/ui/status-mark";
import { useDelayedFlag, usePhotoSwitching } from "@/hooks/usePhotoSwitching";
import { useGalleryStore } from "@/stores/useGalleryStore";

export function SwitchLoadingVeil() {
  const show = useDelayedFlag(usePhotoSwitching(), 150);
  const name = useGalleryStore(
    (s) => s.photos.find((p) => p.id === s.activePhotoId)?.name ?? null,
  );
  if (!show || !name) return null;
  return (
    <div
      data-testid="switch-loading-veil"
      // Swallows clicks, drags and wheel so nothing lands on the outgoing photo.
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      className="absolute inset-0 flex items-center justify-center bg-background/60"
      style={{ zIndex: "var(--z-canvas-overlay)" }}
    >
      <span
        aria-hidden="true"
        className="flex items-center gap-2 rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-xs text-text-primary shadow-lg"
      >
        <StatusMark kind="working" />
        {`Loading ${name}`}
      </span>
    </div>
  );
}
