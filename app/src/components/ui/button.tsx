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
 * - `tiny` — the 24×24 icon button matching the zoom controls (`.btn-icon`):
 *   panel close, undo/redo, user menu. Icon passed as children.
 * - `xs` — the 20×20 dense-row variant (`.btn-icon-xs`), e.g. the Layers list.
 *
 * Width/padding are overridable via `className` (cn + tailwind-merge): pass
 * `flex-1` for side-by-side, `w-full` for stacked.
 */
// Geometry shared by the two TEXT sizes. Padding is the only thing that
// differs between them, so it stays on the size.
const TEXT_BOX =
  "inline-flex items-center justify-center gap-2 rounded-lg text-xs font-semibold transition-all [&_svg]:size-[1em]";

// The elevated surface every text button has worn until now. It moved OUT of
// the size axis so a second axis could exist at all — but it is applied back to
// exactly the two size/variant pairs that had it (see compoundVariants), so the
// four combinations that existed before render the same class set they always
// did. `button-variants.test.tsx` pins that, set-wise.
const ELEVATED =
  "text-text-primary bg-bg-elevated border border-border " +
  "hover:border-border-active hover:brightness-110 " +
  "disabled:cursor-not-allowed disabled:bg-bg-tertiary disabled:text-text-muted " +
  "disabled:border-transparent disabled:hover:brightness-100 disabled:hover:border-transparent";

// No surface until you touch it. For the quiet actions that were hand-rolled
// as bare <button>s: a diagnostic row's "Clear", a panel's "Reset".
const GHOST =
  "text-text-secondary bg-transparent border border-transparent " +
  "hover:bg-bg-elevated hover:text-text-primary " +
  "disabled:cursor-not-allowed disabled:text-text-muted disabled:hover:bg-transparent";

// A filled but quieter surface — the companion to a `default`-variant primary
// in the same row, where two elevated buttons read as equally important.
const SECONDARY =
  "text-text-primary bg-bg-tertiary border border-transparent " +
  "hover:brightness-110 hover:border-border " +
  "disabled:cursor-not-allowed disabled:bg-bg-tertiary disabled:text-text-muted disabled:hover:brightness-100";

// Reads as a link, not a button: no box, no padding, underline on hover.
const LINK =
  "border-0 bg-transparent px-0 py-0 text-text-secondary underline-offset-2 " +
  "hover:text-text-primary hover:underline " +
  "disabled:cursor-not-allowed disabled:text-text-muted disabled:hover:no-underline";

const buttonVariants = cva("", {
  variants: {
    size: {
      xs: "btn-icon btn-icon-xs",
      tiny: "btn-icon",
      default: `${TEXT_BOX} px-3 py-2`,
      large: `${TEXT_BOX} px-4 py-2.5`,
    },
    variant: {
      // Empty on purpose: the surface for `default` arrives through
      // compoundVariants, because the two ICON sizes take theirs from
      // `.btn-icon` in CSS and must not get a second one on top.
      default: "",
      ghost: "",
      secondary: "",
      link: "",
    },
  },
  compoundVariants: [
    { size: "default", variant: "default", class: ELEVATED },
    { size: "large", variant: "default", class: ELEVATED },

    { size: "default", variant: "ghost", class: GHOST },
    { size: "large", variant: "ghost", class: GHOST },
    // An icon ghost cannot be done with utilities: `.btn-icon` sets its
    // background, border and colour in CSS, so the override has to live beside
    // it. Same shape as the existing `.btn-icon-xs` modifier.
    { size: "tiny", variant: "ghost", class: "btn-icon-ghost" },
    { size: "xs", variant: "ghost", class: "btn-icon-ghost" },

    { size: "default", variant: "secondary", class: SECONDARY },
    { size: "large", variant: "secondary", class: SECONDARY },

    { size: "default", variant: "link", class: LINK },
    { size: "large", variant: "link", class: LINK },
  ],
  defaultVariants: {
    size: "default",
    variant: "default",
  },
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size, variant, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ size, variant }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
