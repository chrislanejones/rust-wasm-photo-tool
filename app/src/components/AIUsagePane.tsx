// Settings → "AI Usage". Usage-meter card styled after the t3.chat "Usage
// Limits" widget, adapted to this app's Replicate-backed AI credits.
//
// NOTE: FAKE / illustrative data for now — wires into the real `dailyUsage`
// counter + plan period later.
import { Info, Clock3 } from "lucide-react";

interface Meter {
  label: string;
  used: number;
  limit: number;
  /** Reset countdown shown top-right (e.g. the daily window). */
  resetHint?: string;
}

const METERS: Meter[] = [
  { label: "Base", used: 34, limit: 50, resetHint: "2h 57m" },
  { label: "Burst overage", used: 6, limit: 20 },
];

const RENEWS_ON = "Jun 27, 2026";

export function AIUsagePane() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">AI Usage</h3>
        <p className="mt-0.5 text-2xs text-text-muted">
          Replicate-backed jobs — background removal, upscale, object removal,
          alt text.
        </p>
      </div>

      <div className="space-y-3 rounded-lg bg-card p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-text-primary">Usage Limits</p>
          <button
            type="button"
            title="How does the usage meter work?"
            aria-label="How does the usage meter work?"
            className="text-text-muted opacity-50 transition-opacity hover:opacity-100"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-3">
          {METERS.map((m) => (
            <UsageBar key={m.label} meter={m} />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 text-xs text-text-muted">
          <p>Plan renews on {RENEWS_ON}</p>
        </div>
      </div>

      <p className="text-2xs leading-relaxed text-text-muted">
        Illustrative figures — live metering wires into the Replicate usage
        counter once it lands.
      </p>
    </div>
  );
}

function UsageBar({ meter }: { meter: Meter }) {
  const { label, used, limit, resetHint } = meter;
  const pct = Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
  return (
    <div className="space-y-0.5">
      <div className="relative -mx-2 rounded-sm px-2 py-1">
        <div>
          <span className="text-sm text-text-secondary">{label}</span>
          <span className="ml-2 text-2xs text-text-muted">
            {used}/{limit}
          </span>
        </div>
        <div className="mt-0.5">
          {/* Track + fill: the fill is a full-width bar translated left by the
              unused fraction, mirroring the reference meter. */}
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-[var(--accent-dim)]">
            <div
              className="h-full w-full bg-[var(--accent)] transition-all"
              style={{ transform: `translateX(-${100 - pct}%)` }}
            />
          </div>
        </div>
        {resetHint && (
          <span className="absolute top-1 right-0 z-10 inline-flex items-center gap-1 whitespace-nowrap text-xs text-text-muted opacity-70">
            <Clock3 className="h-3 w-3" />
            {resetHint}
          </span>
        )}
      </div>
    </div>
  );
}
