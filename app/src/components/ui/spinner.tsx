import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { LoaderIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The single source of truth for inline / in-button "working…" spinners —
 * replaces the repo's scattered `Loader2` + `animate-spin` (which drifted on
 * both sizing and the spinner↔label gap).
 *
 * Visual: the Lucide `LoaderIcon`, tinted with the accent token
 * (`text-theme-primary`), spun via the dedicated `.spinner-icon` class. As an
 * ESSENTIAL loading indicator it keeps spinning even under reduced motion — a
 * frozen spinner reads as a hung app, and WCAG 2.3.3 exempts essential loaders
 * from the motion-reduction requirement (which targets decorative / large-scale
 * motion). Decorative `.animate-spin` elsewhere still respects the setting.
 *
 * Spacing: pass `label` (or children) and the spinner + text render as one
 * inline-flex unit with a single standard `gap-2`, so every call site lands the
 * same spinner↔text rhythm.
 *
 * a11y: the wrapper is a `role="status"` live region; the icon is decorative
 * (`aria-hidden`). When there's no visible label the `aria-label` (default
 * "Loading") is announced via an `sr-only` span.
 */
export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  /** Icon edge length in px. Default 16. Ignored when `className` sets a size
   *  utility (`size-*` / `w-*` / `h-*`) — e.g. `className="size-8"` → 32px. */
  size?: number;
  /** Optional text rendered to the right of the spinner (single `gap-2`). */
  label?: ReactNode;
}

/** Does the className carry a Tailwind sizing utility (`size-`/`w-`/`h-`)? If
 *  so we let the class drive the box and drop the inline `size` px fallback,
 *  so `className="size-8"` actually wins (inline style would otherwise beat the
 *  class). */
const hasSizeClass = (className?: string) =>
  className != null && /(?:^|\s)(?:size|w|h)-/.test(className);

export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(
  (
    {
      size = 16,
      label,
      children,
      className,
      "aria-label": ariaLabel = "Loading",
      ...props
    },
    ref,
  ) => {
    const text = label ?? children;
    const hasText = text != null && text !== false;
    const sized = hasSizeClass(className);
    return (
      <span
        ref={ref}
        role="status"
        className="inline-flex items-center gap-2 text-theme-primary"
        {...props}
      >
        {/* Icon box: its size comes from the `className` sizing utility if one
            was passed, else from the `size` px fallback. The Lucide `Loader`
            fills the box (`w-full h-full`) so both paths scale it. */}
        <span
          className={cn(
            "inline-flex shrink-0 [&>svg]:block [&>svg]:w-full [&>svg]:h-full",
            className,
          )}
          style={sized ? undefined : { width: size, height: size }}
        >
          <LoaderIcon className="spinner-icon" aria-hidden="true" />
        </span>
        {hasText ? (
          <span>{text}</span>
        ) : (
          <span className="sr-only">{ariaLabel}</span>
        )}
      </span>
    );
  },
);
Spinner.displayName = "Spinner";
