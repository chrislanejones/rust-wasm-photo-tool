import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Small bordered box matching Button size="tiny" / `.btn-icon` (elevated surface,
 * border, 24px tall, rounded) that displays a number. Used for the history
 * count and the gallery header counts.
 *
 * The height is a MIRROR of `.btn-icon` in styles.css — these sit inline with
 * those buttons (the zoom row's "100%", the gallery counts), so if one changes
 * size and the other doesn't, the row goes ragged. Change both together.
 */
export const TinyNumberBox = forwardRef<
  HTMLSpanElement,
  HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5",
      "bg-bg-elevated border border-border text-text-primary",
      "text-xs font-semibold font-mono tabular-nums leading-none",
      className,
    )}
    {...props}
  />
));
TinyNumberBox.displayName = "TinyNumberBox";
