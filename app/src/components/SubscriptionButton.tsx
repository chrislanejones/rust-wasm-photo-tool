// Gear button + Settings modal (GNOME-style: a category rail on the left, the
// selected pane on the right). General (app preferences), Plan & Billing (Stripe
// tier/subscription), and an admin-only Super User tab. Drop it anywhere (e.g.
// the TopBar).
import { useState, useEffect } from "react";
import { useAction, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  Settings,
  SlidersHorizontal,
  Palette,
  Ruler,
  Package,
  Cloud,
  CreditCard,
  Gauge,
  ShieldCheck,
  Check,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Modal } from "@/components/ui/Modal";
import { SuperUserPane, type SuperUserControls } from "@/components/SuperUserPane";
import { GeneralPane, type GeneralControls } from "@/components/GeneralPane";
import { AppearancePane } from "@/components/AppearancePane";
import { RulersGridsPane } from "@/components/RulersGridsPane";
import { ExportPane } from "@/components/ExportPane";
import { StoragePane } from "@/components/StoragePane";
import { AIUsagePane } from "@/components/AIUsagePane";
import { UserMenu } from "@/components/UserMenu";
import { LargeButton } from "@/components/ui/large-button";
import {
  DEFAULT_PREFERENCES,
  serializePreferences,
  type Preferences,
} from "@/lib/preferences";

const PRO_FEATURES = [
  "All AI tools — background removal, OCR, object removal",
  "100 images per session",
  "Unlimited layers & projects",
  "5 GB persistent storage",
  "Unlimited share links",
];

type SettingsTab =
  | "general"
  | "appearance"
  | "rulers"
  | "export"
  | "storage"
  | "billing"
  | "aiusage"
  | "superuser";

/** Human-readable summary of what changed, for the Apply toast. */
function describeChanges(prev: Preferences, next: Preferences): string[] {
  const out: string[] = [];
  if (prev.maxHistory !== next.maxHistory)
    out.push(`Undo history → ${next.maxHistory}`);
  if (prev.idleTimeoutMin !== next.idleTimeoutMin)
    out.push(
      `Idle screen → ${next.idleTimeoutMin === 0 ? "Never" : `${next.idleTimeoutMin} min`}`,
    );
  if (prev.theme !== next.theme)
    out.push(
      `Theme → ${next.theme === "system" ? "System" : next.theme === "dark" ? "Dark mode" : "Light mode"}`,
    );
  if (prev.rulers !== next.rulers)
    out.push(`Rulers → ${next.rulers ? "On" : "Off"}`);
  if (prev.grid !== next.grid) out.push(`Grid → ${next.grid ? "On" : "Off"}`);
  if (prev.gridKind !== next.gridKind)
    out.push(`Grid layout → ${next.gridKind}`);
  if (prev.reduceMotion !== next.reduceMotion)
    out.push(`Motion → ${next.reduceMotion ? "Reduced" : "Full"}`);
  return out;
}

interface Props {
  /** App-wide preferences for the General tab. */
  general: GeneralControls;
  /** When set (admin only), adds a gated "Super User" tab with the tier
   *  override. Omit / null for everyone else. */
  superUser?: SuperUserControls | null;
}

export function SubscriptionButton({ general, superUser }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<SettingsTab>("general");

  // Alt+S (and any other caller) opens Settings via a window event — keeps the
  // open state here without threading a controlled prop through the tree.
  useEffect(() => {
    const openSettings = () => setOpen(true);
    window.addEventListener("image-horse:open-settings", openSettings);
    return () =>
      window.removeEventListener("image-horse:open-settings", openSettings);
  }, []);

  const tabs: { id: SettingsTab; label: string; icon: typeof SlidersHorizontal }[] = [
    { id: "general", label: "General", icon: SlidersHorizontal },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "rulers", label: "Rulers & Grids", icon: Ruler },
    { id: "export", label: "Export", icon: Package },
    { id: "storage", label: "S3 / Image Hosting", icon: Cloud },
    { id: "billing", label: "Plan & Billing", icon: CreditCard },
    { id: "aiusage", label: "AI Usage", icon: Gauge },
    ...(superUser
      ? [{ id: "superuser" as SettingsTab, label: "Super User", icon: ShieldCheck }]
      : []),
  ];

  // Draft prefs the General pane edits; committed by the footer's Apply.
  const [draft, setDraft] = useState<Preferences>(general.current);
  useEffect(() => {
    if (open) setDraft(general.current); // re-sync on open / after a commit
  }, [open, general.current]);
  const settingsDirty =
    serializePreferences(draft) !== serializePreferences(general.current);
  const atDefaults =
    serializePreferences(draft) === serializePreferences(DEFAULT_PREFERENCES);
  const handleApplySettings = () => {
    const changes = describeChanges(general.current, draft);
    general.onApply(draft);
    toast.success(
      "Settings applied",
      changes.length ? { description: changes.join(" · ") } : undefined,
    );
  };

  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const me = useQuery(api.users.me, {});
  const sub = useQuery(api.subscriptions.getByUser, {});
  const checkout = useAction(api.stripe.createCheckoutSession);
  const portal = useAction(api.stripe.createPortalSession);

  const tier = me?.tier ?? null;
  const isPaid = tier === "pro" || tier === "team";

  const redirect = async (which: "checkout" | "portal") => {
    setErr(null);
    setBusy(which);
    try {
      const fn = which === "checkout" ? checkout : portal;
      const { url } = await fn({ origin: window.location.origin });
      window.location.href = url;
    } catch (e) {
      setBusy(null);
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-icon"
        title="Settings"
        aria-label="Settings"
      >
        <Settings className="h-4 w-4" />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Settings"
        icon={Settings}
        fill
        footer={
          <div className="flex items-center justify-between gap-2">
            {/* Clerk user button / sign-in — same component as the top bar. */}
            <UserMenu />
            {(tab === "general" ||
              tab === "appearance" ||
              tab === "rulers" ||
              tab === "superuser") && (
              <div className="flex items-center gap-2">
                <LargeButton
                  onClick={() => setDraft(DEFAULT_PREFERENCES)}
                  disabled={atDefaults}
                >
                  Restore Settings
                </LargeButton>
                <LargeButton onClick={handleApplySettings} disabled={!settingsDirty}>
                  Apply
                </LargeButton>
              </div>
            )}
          </div>
        }
      >
        <div className="flex h-full">
          {/* GNOME-style category rail (left) */}
          <nav className="w-48 shrink-0 space-y-1 overflow-y-auto border-r border-border bg-bg-tertiary/30 p-2">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  tab === id
                    ? "bg-bg-elevated text-text-primary"
                    : "text-text-secondary hover:bg-bg-elevated/60"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>

          {/* Selected pane (right) */}
          <div className="flex-1 overflow-y-auto p-5">
            {tab === "general" ? (
              <GeneralPane
                value={draft}
                onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
              />
            ) : tab === "appearance" ? (
              <AppearancePane
                value={draft.theme}
                onChange={(theme) => setDraft((d) => ({ ...d, theme }))}
                reduceMotion={draft.reduceMotion}
                onReduceMotionChange={(reduceMotion) =>
                  setDraft((d) => ({ ...d, reduceMotion }))
                }
              />
            ) : tab === "rulers" ? (
              <RulersGridsPane
                value={draft}
                onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
              />
            ) : tab === "export" ? (
              <ExportPane />
            ) : tab === "storage" ? (
              <StoragePane isPaid={isPaid} tier={tier} />
            ) : tab === "aiusage" ? (
              <AIUsagePane />
            ) : tab === "superuser" && superUser ? (
              <SuperUserPane {...superUser} />
            ) : (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-text-primary">
                  Plan &amp; Billing
                </h3>
                {me === undefined ? (
                  <p className="text-xs text-zinc-400">Loading…</p>
                ) : me === null ? (
                  <p className="text-xs text-zinc-400">
                    Sign in to view and manage your plan.
                  </p>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400">Current plan</span>
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 font-semibold capitalize">
                        {tier}
                      </span>
                    </div>

                    <div className="rounded-lg border border-violet-500/40 bg-violet-500/5 p-4">
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm font-semibold">Pro</span>
                        <span className="text-2xl font-semibold">
                          $10
                          <span className="text-xs font-normal text-zinc-400">
                            /mo
                          </span>
                        </span>
                      </div>
                      <ul className="mt-3 space-y-1.5">
                        {PRO_FEATURES.map((f) => (
                          <li
                            key={f}
                            className="flex items-start gap-2 text-2xs text-zinc-300"
                          >
                            <Check className="mt-0.5 h-3 w-3 shrink-0 text-violet-400" />
                            {f}
                          </li>
                        ))}
                      </ul>

                      {isPaid ? (
                        <button
                          type="button"
                          onClick={() => redirect("portal")}
                          disabled={busy !== null}
                          className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-zinc-800 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-700 disabled:opacity-40"
                        >
                          {busy === "portal" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ExternalLink className="h-3.5 w-3.5" />
                          )}
                          Manage subscription
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => redirect("checkout")}
                          disabled={busy !== null}
                          className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-40"
                        >
                          {busy === "checkout" && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          )}
                          Upgrade to Pro
                        </button>
                      )}
                    </div>

                    {sub?.cancelAtPeriodEnd && (
                      <p className="text-2xs text-amber-400">
                        Your plan cancels at the end of the current period.
                      </p>
                    )}
                    {err && (
                      <p className="text-2xs leading-relaxed text-red-400">{err}</p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
