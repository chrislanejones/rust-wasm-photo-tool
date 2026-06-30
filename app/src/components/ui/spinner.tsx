import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { Loader } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The single source of truth for inline / in-button "working…" spinners —
 * replaces the repo's scattered `Loader2` + `animate-spin` (which drifted on
 * both sizing and the spinner↔label gap).
 *
 * Visual: the Lucide 12-spoke `Loader` icon tinted with the accent token
 * (`text-theme-primary`) and given a "comet" lead-blade via a conic-gradient
 * mask (the `.spinner-comet` class in styles.css) — the leading spoke is
 * brightest and the tail fades, so the rotation reads clearly instead of
 * looking like a flat ring. Under `prefers-reduced-motion` / the in-app
 * `.reduce-motion` toggle both the spin and the mask are dropped
 * (Refactor-Playbook §3), leaving a static, full-strength icon.
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
  /** Icon edge length in px. Default 16. */
  size?: number;
  /** Optional text rendered to the right of the spinner (single `gap-2`). */
  label?: ReactNode;
}

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
    return (
      <span
        ref={ref}
        role="status"
        className={cn(
          "inline-flex items-center gap-2 text-theme-primary",
          className,
        )}
        {...props}
      >
        <Loader
          className="spinner-comet shrink-0"
          width={size}
          height={size}
          aria-hidden="true"
        />
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
