import { Crown, User, UserX } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { LargeButton } from "@/components/ui/large-button";
import { ToggleButtonGroup } from "@/components/ui/toggle-button-group";
import type { UserMode } from "@/components/StatusBar";
import { TIERS } from "@/lib/tiers";

/**
 * Dev-only tier switcher (Alt+L). Lets the developer flip the app between the
 * three account tiers — No Login (demo) / Logged In (free) / Paid — to test
 * per-tier behavior (gallery caps, cap toasts) WITHOUT real authentication.
 *
 * The username/password are prefilled for convenience only; they are inert
 * (this dialog does not call Clerk). Values come from gitignored env vars so
 * no credential is ever committed. The whole dialog is gated behind
 * `import.meta.env.DEV` at the call site, so it never ships to production —
 * a tier override that grants "Paid" must not be reachable on the live site.
 */

const TIERS_LIST: { mode: UserMode; label: string; icon: typeof User }[] = [
  { mode: "demo", label: "No Login", icon: UserX },
  { mode: "loggedIn", label: "Logged In", icon: User },
  { mode: "paid", label: "Paid", icon: Crown },
];

/** Tint a matrix value like the marketing pricing table. */
function valueClass(v: string): string {
  if (v === "yes" || v === "unlimited" || v === "∞") return "text-emerald-400";
  if (v === "—") return "text-text-muted";
  return "text-amber-400";
}

function MatrixRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-2.5 py-1.5">
      <span className="text-text-muted">{label}</span>
      <span className={`font-mono font-medium ${valueClass(value)}`}>{value}</span>
    </div>
  );
}

// Prefilled from gitignored .env.local — never hardcoded in source.
const TEST_EMAIL =
  (import.meta.env.VITE_DEV_TEST_EMAIL as string | undefined) ?? "";
const TEST_PASSWORD =
  (import.meta.env.VITE_DEV_TEST_PASSWORD as string | undefined) ?? "";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The tier currently in effect (override if set, else the real auth mode). */
  mode: UserMode;
  /** Select a tier → overrides the app's effective user mode. */
  onSelect: (mode: UserMode) => void;
  /** Clear the override and fall back to the real Clerk-derived mode. */
  onReset: () => void;
  /** Whether a manual override is currently active. */
  overridden: boolean;
}

export function DevTierDialog({
  open,
  onOpenChange,
  mode,
  onSelect,
  onReset,
  overridden,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Dev · Test Tier</DialogTitle>
          <DialogDescription>
            Switch the app between account tiers to test each version. Dev-only
            override — does not sign in.
          </DialogDescription>
        </DialogHeader>

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
        <div className="rounded-md border border-border bg-bg-elevated/40 divide-y divide-border text-xs">
          <MatrixRow label="Gallery / session" value={`${TIERS[mode].galleryLimit} images`} />
          <MatrixRow label="File storage" value={TIERS[mode].storageLabel} />
          <MatrixRow label="Layers / image" value={TIERS[mode].layersLabel} />
          <MatrixRow label="Replicate AI" value={TIERS[mode].replicateAI ? "yes" : "—"} />
        </div>

        <div className="flex flex-col gap-2 text-xs">
          <label className="flex flex-col gap-1">
            <span className="text-text-muted">Username</span>
            <input
              readOnly
              value={TEST_EMAIL}
              placeholder="set VITE_DEV_TEST_EMAIL in .env.local"
              className="rounded-md border border-border bg-bg-elevated px-2 py-1.5 font-mono text-text-primary"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-text-muted">Password</span>
            <input
              readOnly
              type="password"
              value={TEST_PASSWORD}
              placeholder="set VITE_DEV_TEST_PASSWORD in .env.local"
              className="rounded-md border border-border bg-bg-elevated px-2 py-1.5 font-mono text-text-primary"
            />
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <LargeButton
            className="flex-1"
            onClick={onReset}
            disabled={!overridden}
            title="Clear override; use the real auth mode"
          >
            Reset
          </LargeButton>
          <DialogClose asChild>
            <LargeButton className="flex-1">Done</LargeButton>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
