// A welcome-back-sized square tile (h-16). One component, three contents:
//   • src   → a photo thumbnail
//   • count → a "+N" overflow placeholder
//   • icon  → an icon at that size (e.g. the user / sign-in icon, which was too
//             small to see on its own)
// Used by the Welcome-back row and anywhere an icon needs to read at tile size.
import type { ComponentType } from "react";
import { ImageOff } from "lucide-react";
import { DecodedImage } from "@/components/ui/decoded-image";
import { cn } from "@/lib/utils";

interface MediaTileProps {
  /** Photo thumbnail URL. */
  src?: string;
  thumbBlob?: Blob;
  alt?: string;
  /** "+N" overflow placeholder (when there's no src/icon). */
  count?: number;
  /** An icon rendered at the tile size. */
  icon?: ComponentType<{ className?: string }>;
  onClick?: () => void;
  title?: string;
  "aria-label"?: string;
  className?: string;
}

export function MediaTile({
  src,
  thumbBlob,
  alt = "Photo preview",
  count,
  icon: Icon,
  onClick,
  title,
  className,
  ...rest
}: MediaTileProps) {
  const interactive = !!onClick;
  const Comp = interactive ? "button" : "div";
  return (
    <Comp
      {...(interactive ? { type: "button" as const } : {})}
      onClick={onClick}
      title={title}
      className={cn(
        "flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border",
        (src || thumbBlob) ? "" : "bg-bg-elevated text-text-secondary",
        interactive && "transition-colors hover:border-border-active",
        className,
      )}
      {...rest}
    >
      {src || thumbBlob ? (
        <DecodedImage source={thumbBlob ?? src!} alt={alt} fallback={<span role="img" aria-label={`${alt} could not be displayed. Resume editing to open the photo.`}><ImageOff aria-hidden className="size-4 text-text-muted" /></span>} />
      ) : Icon ? (
        <Icon className="h-7 w-7" />
      ) : count != null ? (
        <span className="text-lg font-semibold">+{count}</span>
      ) : null}
    </Comp>
  );
}
