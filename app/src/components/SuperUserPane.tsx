import { useId } from "react";
import { Crown, User, UserX } from "lucide-react";
import { ToggleButtonGroup } from "@/components/ui/toggle-button-group";
import type { UserMode } from "@/components/StatusBar";
import {
  fromUserMode,
  rank,
  type Entitlement,
} from "../../../convex/entitlement";
import { TIERS } from "@/lib/tiers";
import { PaneHeading } from "@/components/ui/pane-heading";

/**
 * Super User settings pane — PREVIEW AS, for checking the per-tier views.
 *
 * Picks a rung (No Login / Logged In / Paid) and shows the app that way. The
 * pane is rendered only for an admin, and the SERVER says who that is now:
 * `users.me` returns the role, computed from ADMIN_EMAILS (it used to be an
 * email compared in the browser).
 *
 * ⚠️ A PREVIEW MAY ONLY TAKE AWAY. Rungs above your own entitlement are shown
 * but disabled, so the pane can never put the UI in a state the server would
 * refuse — which is exactly what happened when this override could raise a free
 * account to "paid" and every paid action then failed. An admin is entitled to
 * paid already (convex/entitlement.ts), so nothing here needs a tier grant;
 * Apply, below, is for changing the REAL tier on the account row.
 */

export interface SuperUserControls {
  /** Tier currently in effect (override if set, else the real auth mode). */
  mode: UserMode;
  /** Whether a manual override is active. */
  overridden: boolean;
  /** Select a tier → override the effective user mode. */
  onSelect: (mode: UserMode) => void;
  /** Clear the override; fall back to the real Clerk-derived mode. */
  onReset: () => void;
  /** What this session may actually use, from the server. A rung ABOVE it is
   *  not offered: a preview may only take away (convex/entitlement.ts), so the
   *  pane can never show a view the server would refuse. */
  entitlement: Entitlement;
}

const TIERS_LIST: { mode: UserMode; label: string; icon: typeof User }[] = [
  { mode: "demo", label: "No Login", icon: UserX },
  { mode: "loggedIn", label: "Logged In", icon: User },
  { mode: "paid", label: "Paid", icon: Crown },
];

/** Tint a matrix value like the marketing pricing table. */
function valueClass(v: string): string {
  if (v === "yes" || v === "unlimited" || v === "∞") return "text-success";
  if (v === "—") return "text-text-muted";
  return "text-warning";
}

function MatrixRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-2.5 py-1.5">
      <span className="text-text-muted">{label}</span>
      <span className={`font-mono font-semibold ${valueClass(value)}`}>{value}</span>
    </div>
  );
}

// Prefilled from gitignored .env.local — never hardcoded in source.
const TEST_EMAIL = (import.meta.env.VITE_DEV_TEST_EMAIL as string | undefined) ?? "";
const TEST_PASSWORD =
  (import.meta.env.VITE_DEV_TEST_PASSWORD as string | undefined) ?? "";

export function SuperUserPane({ mode, onSelect, entitlement }: SuperUserControls) {
  const headingId = useId();
  const whyId = useId();
  return (
    <div className="space-y-4">
      <PaneHeading id={headingId} title="Super User">
        Look at the app as another kind of account. This changes what YOU see,
        on this device, and nothing else: your account, your files and what the
        server allows are untouched. Use <strong>Apply</strong> in the footer to
        change the real tier on your account, or <strong>Restore Settings</strong>{" "}
        to stop previewing.
      </PaneHeading>

      <ToggleButtonGroup
        fill
        mode="select"
        aria-labelledby={headingId}
        aria-describedby={whyId}
        items={TIERS_LIST.map(({ mode: m, label, icon }) => ({
          key: m,
          icon,
          label,
          active: mode === m,
          // A rung above the entitlement is shown, so the ladder still reads
          // as a ladder, but cannot be selected.
          disabled: rank(fromUserMode(m)) > rank(entitlement),
          onToggle: () => onSelect(m),
        }))}
      />
      <p id={whyId} className="pl-1 text-2xs leading-relaxed text-text-muted">
        You can look down the ladder, never up — a preview you are not entitled
        to would show buttons the server refuses.
      </p>

      {/* What the selected tier gets — mirrors the pricing matrix. */}
      <div className="divide-y divide-border rounded-md border border-border bg-bg-elevated/40 text-xs">
        <MatrixRow label="Gallery / session" value={`${TIERS[mode].galleryLimit} images`} />
        <MatrixRow label="File storage" value={TIERS[mode].storageLabel} />
        <MatrixRow label="Layers / image" value={TIERS[mode].layersLabel} />
        <MatrixRow label="Replicate AI" value={TIERS[mode].replicateAI ? "yes" : "—"} />
      </div>

      <div className="flex flex-col gap-2 text-xs">
        <label className="flex flex-col gap-1">
          <span className="text-text-muted">Test username</span>
          <input
            readOnly
            value={TEST_EMAIL}
            placeholder="set VITE_DEV_TEST_EMAIL in .env.local"
            className="rounded-md border border-border bg-bg-elevated px-2 py-1.5 font-mono text-text-primary"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-text-muted">Test password</span>
          <input
            readOnly
            type="password"
            value={TEST_PASSWORD}
            placeholder="set VITE_DEV_TEST_PASSWORD in .env.local"
            className="rounded-md border border-border bg-bg-elevated px-2 py-1.5 font-mono text-text-primary"
          />
        </label>
      </div>
    </div>
  );
}
