import { OVER_QUOTA_LINES, formatStorage, quotaSegments, type QuotaFigures } from "@/lib/quota";
import { cn } from "@/lib/utils";

/**
 * The one storage gauge (UI Night 6 §2) — for the gallery footer, Settings ›
 * Sync and the Trash view, so the three can never disagree about a number.
 *
 *     STORAGE
 *     2.4 GB of 5 GB  ██████████░░░░
 *     Trash 180 MB · counts toward this
 *
 * Signed out there is NO gauge: nothing is on the server to measure, and an
 * empty bar would read as "you have space you are not using".
 *
 * The bar is an ARIA meter: a screen reader gets "Storage, 2.6 GB of 5 GB",
 * not a row of coloured divs. The segments are decoration for that value.
 *
 * UNWIRED (Night 6 §0): no `bytesUsed` exists yet. Fixture-tested only.
 */
export function QuotaGauge({
  figures,
  signedIn,
  className,
}: {
  figures: QuotaFigures;
  signedIn: boolean;
  className?: string;
}) {
  if (!signedIn) return null;

  const seg = quotaSegments(figures);
  const valueText = `${formatStorage(seg.totalBytes)} of ${formatStorage(figures.limitBytes)}`;

  return (
    <div data-slot="quota-gauge" className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-2xs font-semibold uppercase tracking-wide text-theme-muted-foreground">
          Storage
        </span>
        <span className="text-xs tabular-nums text-theme-foreground">{valueText}</span>
      </div>

      <div
        role="meter"
        aria-label="Storage"
        aria-valuemin={0}
        aria-valuemax={figures.limitBytes}
        aria-valuenow={Math.min(seg.totalBytes, figures.limitBytes)}
        aria-valuetext={seg.over ? `${valueText}, full` : valueText}
        className="flex h-2 w-full overflow-hidden rounded-full bg-bg-tertiary"
      >
        <span
          data-segment="used"
          className={cn("h-full", seg.over ? "bg-warning" : "bg-theme-primary")}
          style={{ width: `${seg.used * 100}%` }}
        />
        {/* Trash is a segment of its own, lighter, on the same bar — so
            emptying it is something you can see happen. */}
        <span
          data-segment="trash"
          className="h-full bg-theme-primary/40"
          style={{ width: `${seg.trash * 100}%` }}
        />
      </div>

      {figures.trashBytes > 0 && (
        <p className="text-2xs text-theme-muted-foreground">
          Trash {formatStorage(figures.trashBytes)} · counts toward this
        </p>
      )}

      {seg.over && (
        // In the status tier, not a toast — Night 5's rule for anything that
        // persists until the person acts. Both sentences, always together.
        <p data-over-quota className="text-2xs text-warning">
          {OVER_QUOTA_LINES.join(" ")}
        </p>
      )}
    </div>
  );
}
