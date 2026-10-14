import type { CSSProperties } from "react";
import { Images, Layers, ImagePlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { ActionTile } from "@/components/ui/action-tile";
import { DecodedImage } from "@/components/ui/decoded-image";

/** The preview's tallest edge; matches the old `<img>` cap. */
const PREVIEW_MAX_H = 200;

/**
 * The box the preview settles into, worked out from the size the import
 * already decoded: as tall as `PREVIEW_MAX_H` allows, never wider than the
 * photo, and the dialog's width can still shrink it (`max-width: 100%` keeps
 * the ratio through `aspect-ratio`). Reserving it up front is what stops the
 * frame collapsing to its padding and then growing when the `<img>` arrives.
 * Unknown dimensions get a square.
 */
function importPreviewBox(w: number, h: number): CSSProperties {
  if (!(w > 0 && h > 0)) return { width: PREVIEW_MAX_H, aspectRatio: "1 / 1" };
  return {
    width: Math.min(w, (PREVIEW_MAX_H * w) / h),
    aspectRatio: `${w} / ${h}`,
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Object URL of the dropped / pasted image, for the preview thumbnail. */
  previewUrl: string | null;
  width: number;
  height: number;
  /** Whether the user's tier can use layers (logged-in or paid). */
  canUseLayers: boolean;
  /** Whether an image is currently open (the layer actions need one). */
  hasActivePhoto: boolean;
  onNewLayer: () => void;
  onOntoLayer: () => void;
  onAddToGallery: () => void;
}

/**
 * Choice dialog shown after an image is dropped or pasted into the app. Mirrors
 * the Download dialog exactly — same Dialog primitives, the same stacked
 * `ActionTile` footer, matching header/body/footer structure — and asks where
 * the image should go: its own new layer, on top of the current image, or as a
 * new gallery image. Layer actions are gated by tier (login/paid) and by having
 * an image open; disabled tiles explain why via their tooltip.
 */
export function ImportImageDialog({
  open,
  onOpenChange,
  previewUrl,
  width,
  height,
  canUseLayers,
  hasActivePhoto,
  onNewLayer,
  onOntoLayer,
  onAddToGallery,
}: Props) {
  const newLayerTitle = !hasActivePhoto
    ? "Open an image first"
    : !canUseLayers
      ? "Log in to use layers"
      : "Stack it above the current layer as its own new layer — non-destructive, keeps both images separately editable";
  const ontoTitle = hasActivePhoto
    ? "Merge it directly into the current layer's pixels — destructive, can't be un-stacked later"
    : "Open an image first";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add this image</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <DialogDescription>
            {hasActivePhoto ? (
              <>
                Stack it as a{" "}
                <strong className="font-semibold text-text-secondary">
                  new layer
                </strong>{" "}
                you can move and edit separately, permanently{" "}
                <strong className="font-semibold text-text-secondary">
                  merge
                </strong>{" "}
                it into the layer you&rsquo;re already editing, or keep it apart
                as a new image in your gallery.
              </>
            ) : (
              <>
                Add it to your{" "}
                <strong className="font-semibold text-text-secondary">
                  gallery
                </strong>{" "}
                to start editing. (Open an image first to stack or merge it onto
                a layer.)
              </>
            )}
          </DialogDescription>

          {previewUrl && (
            <div className="import-preview">
              <span
                className="import-preview-box"
                style={importPreviewBox(width, height)}
                data-testid="import-preview-box"
              >
                <DecodedImage
                  key={previewUrl}
                  source={previewUrl}
                  alt="Image to import"
                  className="size-full object-contain"
                  fallback={
                    <span className="flex size-full items-center justify-center bg-bg-elevated text-xs text-text-secondary">
                      Preview unavailable
                    </span>
                  }
                />
              </span>
              {width > 0 && height > 0 && (
                <span className="import-preview-dims">
                  {width} × {height}
                </span>
              )}
            </div>
          )}
        </DialogBody>

        <DialogFooter className="flex-row gap-2">
          <ActionTile
            icon={Layers}
            label="Stack as layer"
            disabled={!canUseLayers || !hasActivePhoto}
            title={newLayerTitle}
            onClick={onNewLayer}
          />
          <ActionTile
            icon={ImagePlus}
            label="Merge into layer"
            disabled={!hasActivePhoto}
            title={ontoTitle}
            onClick={onOntoLayer}
          />
          <ActionTile
            icon={Images}
            label="New gallery image"
            title="Add as a new, separate image in the gallery — unrelated to the image you're editing"
            onClick={onAddToGallery}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
