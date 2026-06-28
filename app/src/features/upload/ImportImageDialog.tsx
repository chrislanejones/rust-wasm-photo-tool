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
      : "Drop it onto its own new layer (non-destructive)";
  const ontoTitle = hasActivePhoto
    ? "Composite it on top of the current layer's pixels"
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
                Drop it onto its{" "}
                <strong className="font-semibold text-text-secondary">
                  own new layer
                </strong>
                , stack it on top of the image you&rsquo;re editing, or add it to
                your gallery as a separate image.
              </>
            ) : (
              <>
                Add it to your{" "}
                <strong className="font-semibold text-text-secondary">
                  gallery
                </strong>{" "}
                to start editing. (Open an image first to drop it onto a layer.)
              </>
            )}
          </DialogDescription>

          {previewUrl && (
            <div className="import-preview">
              <img src={previewUrl} alt="Image to import" />
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
            label="New layer"
            disabled={!canUseLayers || !hasActivePhoto}
            title={newLayerTitle}
            onClick={onNewLayer}
          />
          <ActionTile
            icon={ImagePlus}
            label="Onto image"
            disabled={!hasActivePhoto}
            title={ontoTitle}
            onClick={onOntoLayer}
          />
          <ActionTile
            icon={Images}
            label="To gallery"
            title="Add as a new, separate image in the gallery"
            onClick={onAddToGallery}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
