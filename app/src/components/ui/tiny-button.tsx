import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Small 28×28 icon button matching the zoom in/out controls (the `.btn-icon`
 * style): elevated surface, bordered, rounded, with a 14px icon. Used for the
 * user / sign-in button and the panel close / clear-history buttons.
 */
export const TinyButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button ref={ref} className={cn("btn-icon", className)} {...props} />
));
TinyButton.displayName = "TinyButton";
