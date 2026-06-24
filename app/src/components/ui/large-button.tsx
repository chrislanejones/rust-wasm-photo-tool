import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared "large action button" — Export, Apply Resize, Auto Compress, Delete
 * All, etc. One consistent theme: an elevated dark surface, white text, and the
 * border-highlight hover ring. When disabled it renders as a dark, muted
 * surface (like an unpressed toolbar button) rather than a faded one.
 *
 * Width/padding are overridable via `className` (cn + tailwind-merge): pass
 * `flex-1` for side-by-side, `w-full` for stacked, or smaller paddings for a
 * compact variant.
 */
export const LargeButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5",
      "text-xs font-semibold text-text-primary transition-all",
      // Match icon size to the font size (like the JPEG/PNG format dropdown).
      "[&_svg]:size-[1em]",
      "bg-bg-elevated border border-border",
      "hover:border-border-active hover:brightness-110",
      "disabled:cursor-not-allowed disabled:bg-bg-tertiary disabled:text-text-muted",
      "disabled:border-transparent disabled:hover:brightness-100 disabled:hover:border-transparent",
      className,
    )}
    {...props}
  />
));
LargeButton.displayName = "LargeButton";
