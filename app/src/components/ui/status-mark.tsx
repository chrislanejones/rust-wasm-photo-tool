// StatusMark — one status vocabulary for the whole app (Night 5 §4).
//
// Same mark, same colour, same meaning, everywhere:
//
//   complete   ✓   Check          text-success
//   working    ↻   RefreshCw      text-theme-muted-foreground  (spins)
//   attention  ⚠   TriangleAlert  text-warning
//   failed     ×   CircleX        text-destructive
//   backedUp   ☁   Cloud          text-theme-muted-foreground
//   localOnly  •   Dot            text-theme-muted-foreground
//
// Built tonight for the status bar; the Sync and Shared panes adopt it next,
// and the gallery on Night 6 is its biggest consumer. Before it existed each
// surface picked its own icon and colour for "failed", so the same state read
// differently depending on where you met it.
//
// Accessibility: the icon is decorative (aria-hidden) and the MEANING travels
// as text. Pass `label` to announce it; without one the mark is purely visual
// and must sit next to text that already says the state. Colour is never the
// only signal — every state has its own glyph, so it reads in greyscale and to
// someone who cannot tell the reds from the greens.
import type { LucideIcon } from "lucide-react";
import { Check, CircleX, Cloud, Dot, RefreshCw, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusKind =
  | "complete"
  | "working"
  | "attention"
  | "failed"
  | "backedUp"
  | "localOnly";

const MARKS: Record<StatusKind, { icon: LucideIcon; tone: string }> = {
  complete: { icon: Check, tone: "text-success" },
  working: { icon: RefreshCw, tone: "text-theme-muted-foreground" },
  attention: { icon: TriangleAlert, tone: "text-warning" },
  failed: { icon: CircleX, tone: "text-destructive" },
  backedUp: { icon: Cloud, tone: "text-theme-muted-foreground" },
  localOnly: { icon: Dot, tone: "text-theme-muted-foreground" },
};

export function StatusMark({
  kind,
  label,
  className,
}: {
  kind: StatusKind;
  /** Announced to assistive tech. Omit only when adjacent text says it. */
  label?: string;
  className?: string;
}) {
  const { icon: Icon, tone } = MARKS[kind];
  return (
    <span
      data-slot="status-mark"
      data-status={kind}
      className={cn("inline-flex shrink-0 items-center", tone, className)}
    >
      <Icon
        aria-hidden
        className={cn("size-3.5", kind === "working" && "motion-safe:animate-spin")}
      />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
