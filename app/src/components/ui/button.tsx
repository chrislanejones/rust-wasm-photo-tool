import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * The app's one button primitive — a cva `size` axis instead of separate
 * files. Absorbs the old `LargeButton` (size="large") and `TinyButton`
 * (size="tiny" / size="xs") components:
 *
 * - `large` — the "large action button": Export, Apply Resize, Auto Compress,
 *   Delete All, Apply Crop… An elevated surface, bordered, with the
 *   border-highlight hover ring; disabled renders as a dark muted surface.
 * - `default` — same surface family at standard padding (for in-flow actions
 *   that don't need the large footprint).
 * - `tiny` — the 28×28 icon button matching the zoom controls (`.btn-icon`):
 *   panel close, undo/redo, user menu. Icon passed as children.
 * - `xs` — the 20×20 dense-row variant (`.btn-icon-xs`), e.g. the Layers list.
 *
 * Width/padding are overridable via `className` (cn + tailwind-merge): pass
 * `flex-1` for side-by-side, `w-full` for stacked.
 */
const buttonVariants = cva("", {
  variants: {
    size: {
      xs: "btn-icon btn-icon-xs",
      tiny: "btn-icon",
      default: [
        "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2",
        "text-xs font-semibold text-text-primary transition-all",
        "[&_svg]:size-[1em]",
        "bg-bg-elevated border border-border",
        "hover:border-border-active hover:brightness-110",
        "disabled:cursor-not-allowed disabled:bg-bg-tertiary disabled:text-text-muted",
        "disabled:border-transparent disabled:hover:brightness-100 disabled:hover:border-transparent",
      ].join(" "),
      large: [
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5",
        "text-xs font-semibold text-text-primary transition-all",
        // Match icon size to the font size (like the JPEG/PNG format dropdown).
        "[&_svg]:size-[1em]",
        "bg-bg-elevated border border-border",
        "hover:border-border-active hover:brightness-110",
        "disabled:cursor-not-allowed disabled:bg-bg-tertiary disabled:text-text-muted",
        "disabled:border-transparent disabled:hover:brightness-100 disabled:hover:border-transparent",
      ].join(" "),
    },
  },
  defaultVariants: {
    size: "default",
  },
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
