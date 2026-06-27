// A welcome-back-sized square tile (h-16). One component, three contents:
//   • src   → a photo thumbnail
//   • count → a "+N" overflow placeholder
//   • icon  → an icon at that size (e.g. the user / sign-in icon, which was too
//             small to see on its own)
// Used by the Welcome-back row and anywhere an icon needs to read at tile size.
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

interface MediaTileProps {
  /** Photo thumbnail URL. */
  src?: string;
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
        src ? "" : "bg-bg-elevated text-text-secondary",
        interactive && "transition-colors hover:border-border-active",
        className,
      )}
      {...rest}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : Icon ? (
        <Icon className="h-7 w-7" />
      ) : count != null ? (
        <span className="text-lg font-semibold">+{count}</span>
      ) : null}
    </Comp>
  );
}
