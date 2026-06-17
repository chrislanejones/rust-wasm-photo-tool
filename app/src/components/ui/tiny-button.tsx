import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Small 28×28 icon button matching the zoom in/out controls (the `.btn-icon`
 * style): elevated surface, bordered, rounded, with a 14px icon. Used for the
 * user / sign-in button and the panel close / clear-history buttons.
 *
 * `size="xs"` renders a 20×20 variant (`.btn-icon-xs`) with a 12px icon for
 * dense rows like the Layers list — same surface/hover/disabled behaviour, just
 * smaller. The icon is passed as children, so callers that swap icons (e.g. an
 * eye open/closed toggle) keep that logic outside this component.
 */
interface TinyButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "default" | "xs";
}

export const TinyButton = forwardRef<HTMLButtonElement, TinyButtonProps>(
  ({ className, size = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={cn("btn-icon", size === "xs" && "btn-icon-xs", className)}
      {...props}
    />
  ),
);
TinyButton.displayName = "TinyButton";
