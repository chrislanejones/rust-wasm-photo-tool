import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Small bordered box matching Button size="tiny" / `.btn-icon` (elevated surface,
 * border, ~28px tall, rounded) that displays a number. Used for the history
 * count and the gallery header counts.
 */
export const TinyNumberBox = forwardRef<
  HTMLSpanElement,
  HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5",
      "bg-bg-elevated border border-border text-text-primary",
      "text-xs font-semibold font-mono tabular-nums leading-none",
      className,
    )}
    {...props}
  />
));
TinyNumberBox.displayName = "TinyNumberBox";
