// Settings → "AI Usage". What you have actually spent, and what is left.
//
// This pane showed FAKE numbers until 2026-09-17 — a hardcoded 34/50 with a
// "2h 57m" countdown and a plan renewing in June. It is live now: every figure
// below comes from `api.aiJobs.usage`, which reads the same counters
// `startJob` increments inside the job's own transaction, and hands back the
// CAPS as well as the counts.
//
// ⚠️ THE CAPS ARE NOT WRITTEN DOWN HERE ON PURPOSE. They live once, in
// convex/aiJobs.ts, and travel with the numbers. A second copy of a limit is
// exactly how the pricing page ended up advertising "unlimited AI passes"
// against a 50-a-day cap for months.
//
// Demo mode is sacred, so the query is skipped when Convex has not completed
// its handshake and the pane explains itself instead of rendering empty bars.
import { useEffect, useMemo, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { Info, Clock3 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { PaneHeading } from "@/components/ui/pane-heading";

interface Meter {
  label: string;
  used: number;
  cap: number;
  /** When this window empties, as epoch ms. */
  resetsAt: number;
  hint: string;
}

/** "2h 57m", "6d", "under a minute". Coarse on purpose — this is a reassurance,
 *  not a countdown, and a ticking second hand invites staring at it. */
function untilText(resetsAt: number, now: number): string {
  const ms = resetsAt - now;
  if (ms <= 60_000) return "under a minute";
  const mins = Math.floor(ms / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days >= 1) return `${days}d ${hours % 24}h`;
  if (hours >= 1) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

export function AIUsagePane() {
  const { isAuthenticated } = useConvexAuth();
  const usage = useQuery(api.aiJobs.usage, isAuthenticated ? {} : "skip");

  /* One `now` for the whole pane, held in state rather than read during
   * render. Two reasons, and the second is the one that matters:
   *
   *   - `Date.now()` in a render body is an impure call, and the compiler lint
   *     fails the build on it. It is right to: a render that reads the clock
   *     cannot be replayed.
   *   - The countdowns would otherwise freeze at whatever the clock said when
   *     the dialog opened. Ticking makes them true.
   *
   * Every 30 seconds, because the formatter's finest unit is a minute — a
   * faster timer would re-render for a string that cannot have changed. */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const meters: Meter[] = useMemo(() => {
    if (!usage) return [];
    return [
      {
        label: "Today",
        used: usage.daily.used,
        cap: usage.daily.cap,
        resetsAt: usage.daily.resetsAt,
        hint: "resets",
      },
      {
        label: "This month",
        used: usage.monthly.used,
        cap: usage.monthly.cap,
        resetsAt: usage.monthly.resetsAt,
        hint: "resets",
      },
    ];
  }, [usage]);

  return (
    <div className="space-y-4">
      <PaneHeading title="AI Usage" compact>
        Replicate-backed jobs — background removal, object removal and reading
        text out of an image. Everything else in the editor runs on your
        machine and is never counted here.
      </PaneHeading>

      {!isAuthenticated ? (
        <p className="rounded-lg bg-card p-4 text-xs leading-relaxed text-text-muted">
          Sign in to see your usage. The AI passes need an account because they
          run on someone else's hardware and cost money per run; every other
          tool works signed out.
        </p>
      ) : usage === undefined ? (
        // `undefined` is "in flight", distinct from `null` ("signed out").
        <p className="rounded-lg bg-card p-4 text-xs text-text-muted">Loading your usage…</p>
      ) : usage === null || usage.daily.cap === 0 ? (
        <p className="rounded-lg bg-card p-4 text-xs leading-relaxed text-text-muted">
          Your plan does not include AI passes. Upgrading adds background
          removal, object removal and text extraction.
        </p>
      ) : (
        <div className="space-y-3 rounded-lg bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-text-primary">Usage limits</p>
            <button
              type="button"
              title="Two windows: a daily cap so one day cannot empty the month, and a monthly cap that bounds what the plan costs to run."
              aria-label="How does the usage meter work?"
              className="text-text-muted opacity-50 transition-opacity hover:opacity-100"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {meters.map((m) => (
              <UsageBar key={m.label} meter={m} now={now} />
            ))}
          </div>

          <p className="mt-4 text-xs text-text-muted">
            Whichever limit you reach first is the one that applies.
          </p>
        </div>
      )}
    </div>
  );
}

function UsageBar({ meter, now }: { meter: Meter; now: number }) {
  const { label, used, cap, resetsAt, hint } = meter;
  // Guard the divide: a cap of zero is a real state (a free account that
  // somehow reaches this pane) and NaN would render as an empty track with no
  // explanation.
  const pct = cap > 0 ? Math.max(0, Math.min(100, Math.round((used / cap) * 100))) : 0;
  const spent = cap > 0 && used >= cap;
  return (
    <div className="space-y-0.5">
      <div className="relative -mx-2 rounded-sm px-2 py-1">
        <div>
          <span className="text-sm text-text-secondary">{label}</span>
          <span className="ml-2 text-2xs text-text-muted">
            {used}/{cap}
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
        <span className="absolute top-1 right-0 z-10 inline-flex items-center gap-1 whitespace-nowrap text-xs text-text-muted opacity-70">
          <Clock3 className="h-3 w-3" />
          {hint} in {untilText(resetsAt, now)}
        </span>
      </div>
      {/* Said in words as well as by a full bar — a bar at 100% and a bar at
          96% are hard to tell apart, and this is the one that stops working. */}
      {spent && (
        <p className="text-2xs text-text-muted">
          Spent. New passes resume in {untilText(resetsAt, now)}.
        </p>
      )}
    </div>
  );
}
