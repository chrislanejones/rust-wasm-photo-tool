import { forwardRef, type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { SKELETON_BASE } from "@/lib/styles";

/**
 * Token-driven loading placeholder — the single source of truth for "this
 * content isn't ready yet" UI, modelled on Chakra UI's Skeleton. Replaces the
 * repo's scattered `animate-pulse` / `Loader2` / bespoke `canvas-spinner`
 * loading blocks.
 *
 * The base surface is the `bg-muted` token (Refactor-Playbook §2) and the
 * shimmer sweep lives in the `.skeleton` class (styles.css), which degrades to
 * a static muted block under `prefers-reduced-motion` / Reduce Motion (§3).
 *
 * Sizing is className-driven (`h-*`, `w-*`, `size-*`) so callers control the
 * footprint; `variant` only picks the corner radius / shape.
 *
 * a11y (Refactor-Playbook §8): the placeholder is an `aria-busy` live region
 * announcing "Loading" to screen readers; purely-decorative inner bars are
 * `aria-hidden`. Pass `loading={false}` to render `children` in its place (the
 * Chakra `loading` idiom), so a component can swap skeleton ⇄ real content from
 * one boolean.
 */
const skeletonVariants = cva(SKELETON_BASE, {
  variants: {
    variant: {
      /** Default block — cards, thumbnails, image placeholders. */
      rectangle: "rounded-md",
      /** Avatars / circular thumbnails. */
      circle: "rounded-full",
      /** A single line of text (≈ one line-height tall, full width). */
      text: "h-[0.85em] rounded",
    },
  },
  defaultVariants: {
    variant: "rectangle",
  },
});

export interface SkeletonProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {
  /** When `false`, renders `children` instead of the placeholder (Chakra idiom). */
  loading?: boolean;
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant, loading = true, children, ...props }, ref) => {
    if (!loading) return <>{children}</>;
    return (
      <div
        ref={ref}
        role="status"
        aria-busy="true"
        aria-live="polite"
        className={cn(skeletonVariants({ variant }), className)}
        {...props}
      >
        <span className="sr-only">Loading…</span>
      </div>
    );
  },
);
Skeleton.displayName = "Skeleton";

export interface SkeletonTextProps extends HTMLAttributes<HTMLDivElement> {
  /** Number of lines to render (last line is shortened). Chakra's `noOfLines`. */
  noOfLines?: number;
  /** Alias for `noOfLines`. */
  lines?: number;
  /** When `false`, renders `children` instead of the placeholder. */
  loading?: boolean;
  /** Extra classes applied to each line bar. */
  lineClassName?: string;
}

export const SkeletonText = forwardRef<HTMLDivElement, SkeletonTextProps>(
  (
    {
      noOfLines,
      lines,
      loading = true,
      className,
      lineClassName,
      children,
      ...props
    },
    ref,
  ) => {
    if (!loading) return <>{children}</>;
    const count = noOfLines ?? lines ?? 3;
    return (
      <div
        ref={ref}
        role="status"
        aria-busy="true"
        aria-live="polite"
        className={cn("flex w-full flex-col gap-2", className)}
        {...props}
      >
        <span className="sr-only">Loading…</span>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            aria-hidden="true"
            className={cn(
              skeletonVariants({ variant: "text" }),
              // Shorten the final line of a multi-line block (Chakra parity).
              count > 1 && i === count - 1 && "w-3/5",
              lineClassName,
            )}
          />
        ))}
      </div>
    );
  },
);
SkeletonText.displayName = "SkeletonText";

export interface SkeletonCircleProps extends Omit<SkeletonProps, "variant"> {
  /** Diameter — a number (px) or any CSS length. Falls back to className sizing. */
  size?: number | string;
}

export const SkeletonCircle = forwardRef<HTMLDivElement, SkeletonCircleProps>(
  ({ size, className, style, ...props }, ref) => (
    <Skeleton
      ref={ref}
      variant="circle"
      className={cn("aspect-square", className)}
      style={size != null ? { width: size, height: size, ...style } : style}
      {...props}
    />
  ),
);
SkeletonCircle.displayName = "SkeletonCircle";
