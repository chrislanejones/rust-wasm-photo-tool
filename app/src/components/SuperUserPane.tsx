import { Crown, User, UserX } from "lucide-react";
import { ToggleButtonGroup } from "@/components/ui/toggle-button-group";
import type { UserMode } from "@/components/StatusBar";
import { TIERS } from "@/lib/tiers";

/**
 * Super User settings pane — the account-tier override (was the Alt+L dialog).
 * Flips the app's effective tier (No Login / Logged In / Paid) to test per-tier
 * behavior WITHOUT real auth. The override only changes client-side UI gating;
 * the real tier (and AI access) stays enforced server-side by Convex. Rendered
 * only for the admin account (see ADMIN_EMAIL).
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

export function SuperUserPane({ mode, onSelect }: SuperUserControls) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">Super User</h3>
        <p className="mt-1 text-xs leading-relaxed text-text-muted">
          The toggle is a local UI override. Use <strong>Apply</strong> in the
          footer to grant the tier to your real account (admin only) so AI works
          for real, or <strong>Restore Settings</strong> to clear the override.
        </p>
      </div>

      <ToggleButtonGroup
        fill
        items={TIERS_LIST.map(({ mode: m, label, icon }) => ({
          key: m,
          icon,
          label,
          active: mode === m,
          onToggle: () => onSelect(m),
        }))}
      />

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
