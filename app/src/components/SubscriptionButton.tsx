// Gear button + Settings modal (GNOME-style: a category rail on the left, the
// selected pane on the right). General (app preferences), Plan & Billing (Stripe
// tier/subscription), and an admin-only Super User tab. Drop it anywhere (e.g.
// the TopBar).
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAction, useQuery, useMutation } from "convex/react";
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
  Shield,
  ShieldCheck,
  FlaskConical,
  Layers,
  Check,
  ExternalLink,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SuperUserPane, type SuperUserControls } from "@/components/SuperUserPane";
import { GeneralPane, type GeneralControls } from "@/components/GeneralPane";
import { LayersCanvasPane } from "@/components/LayersCanvasPane";
import { AppearancePane } from "@/components/AppearancePane";
import { SecurityPane } from "@/components/SecurityPane";
import { RulersGridsPane } from "@/components/RulersGridsPane";
import { ExportPane, type OpenRasterControls } from "@/components/ExportPane";
import { StoragePane } from "@/components/StoragePane";
import { AIUsagePane } from "@/components/AIUsagePane";
import { DevTestsPane } from "@/components/DevTestsPane";
import { UserMenu } from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  DEFAULT_PREFERENCES,
  serializePreferences,
  type Preferences,
} from "@/lib/preferences";
import { useUIStore } from "@/stores/useUIStore";

const PRO_FEATURES = [
  "All AI tools — background removal, OCR, object removal",
  "100 images per session",
  "Unlimited layers & projects",
  "5 GB persistent storage",
  "Unlimited share links",
];

export type SettingsTab =
  | "general"
  | "canvas"
  | "appearance"
  | "security"
  | "rulers"
  | "export"
  | "storage"
  | "billing"
  | "aiusage"
  | "devtests"
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
  if (prev.canvasArtboard !== next.canvasArtboard)
    out.push(`Canvas on import → ${next.canvasArtboard ? "Canvas + photo" : "Photo only"}`);
  if (prev.canvasPadding !== next.canvasPadding)
    out.push(`Canvas border → ${next.canvasPadding} px`);
  if (prev.canvasBgColor !== next.canvasBgColor)
    out.push(
      `Backing canvas → ${next.canvasBgColor === "transparent" ? "Transparent" : next.canvasBgColor}`,
    );
  return out;
}

interface Props {
  /** App-wide preferences for the General tab. */
  general: GeneralControls;
  /** When set (admin only), adds a gated "Super User" tab with the tier
   *  override. Omit / null for everyone else. */
  superUser?: SuperUserControls | null;
  /** Live-tool access for the Import / Export (.ora) tab. */
  openRaster: OpenRasterControls;
}

export function SubscriptionButton({
  general,
  superUser,
  openRaster,
}: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<SettingsTab>("general");

  // Alt+S (and any other caller) opens Settings via a window event — keeps the
  // open state here without threading a controlled prop through the tree.
  // (Grandfathered Stage-3 CustomEvent — new callers use the store signal
  // below instead.)
  useEffect(() => {
    const openSettings = () => setOpen(true);
    window.addEventListener("image-horse:open-settings", openSettings);
    return () =>
      window.removeEventListener("image-horse:open-settings", openSettings);
  }, []);

  // Store-routed "open Settings on tab X" signal (command palette et al.).
  // One-shot: handled → cleared, so a remount never replays a stale request.
  const settingsRequest = useUIStore((s) => s.settingsRequest);
  const clearSettingsRequest = useUIStore((s) => s.clearSettingsRequest);
  useEffect(() => {
    if (!settingsRequest) return;
    setTab(settingsRequest.tab);
    setOpen(true);
    clearSettingsRequest();
  }, [settingsRequest, clearSettingsRequest]);

  const tabs: { id: SettingsTab; label: string; icon: typeof SlidersHorizontal }[] = [
    { id: "general", label: "General", icon: SlidersHorizontal },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "canvas", label: "Layers and Canvas", icon: Layers },
    { id: "security", label: "Security", icon: Shield },
    { id: "rulers", label: "Rulers & Grids", icon: Ruler },
    { id: "export", label: "Import / Export", icon: Package },
    { id: "storage", label: "S3 / Image Hosting", icon: Cloud },
    { id: "billing", label: "Plan & Billing", icon: CreditCard },
    { id: "aiusage", label: "AI Usage", icon: Gauge },
    { id: "devtests", label: "Dev Tests", icon: FlaskConical },
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

  // Super User: footer "Apply" grants the REAL Convex tier (admin-gated) so AI
  // can be tested. "Restore Settings" / preference restore both confirm first.
  const setMyTier = useMutation(api.users.setMyTier);
  const [granting, setGranting] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);

  const handleApplyTier = async () => {
    if (!superUser) return;
    setGranting(true);
    const grant = superUser.mode === "paid" ? "pro" : "free";
    try {
      await setMyTier({ tier: grant });
      toast.success(
        `Your account is now ${grant} — AI ${grant === "pro" ? "unlocked" : "locked"}.`,
      );
    } catch (e) {
      toast.error(
        e instanceof Error && /authenticated|authorized/i.test(e.message)
          ? "Sign in as the admin account first, then Apply."
          : e instanceof Error
            ? e.message
            : "Couldn't apply tier.",
      );
    } finally {
      setGranting(false);
    }
  };

  const handleRestore = () => {
    if (tab === "superuser") superUser?.onReset();
    else setDraft(DEFAULT_PREFERENCES);
    setRestoreConfirmOpen(false);
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

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent
          size="xl"
          aria-describedby={undefined}
          className="z-[var(--z-modal)] flex h-[80vh] flex-col"
          overlayClassName="z-[var(--z-modal)]"
        >
          <DialogHeader className="px-4 py-2.5">
            <DialogTitle className="flex items-center gap-2 font-mono text-xs font-normal uppercase tracking-wider text-text-secondary">
              <Settings className="h-4 w-4" />
              Settings
            </DialogTitle>
          </DialogHeader>

          <div className="flex min-h-0 flex-1">
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
            ) : tab === "canvas" ? (
              <LayersCanvasPane
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
            ) : tab === "security" ? (
              <SecurityPane
                value={draft.exifKeep}
                onChange={(exifKeep) => setDraft((d) => ({ ...d, exifKeep }))}
                stripMode={draft.exifStripMode}
                onStripModeChange={(exifStripMode) =>
                  setDraft((d) => ({ ...d, exifStripMode }))
                }
              />
            ) : tab === "rulers" ? (
              <RulersGridsPane
                value={draft}
                onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
              />
            ) : tab === "export" ? (
              <ExportPane {...openRaster} />
            ) : tab === "storage" ? (
              <StoragePane isPaid={isPaid} tier={tier} />
            ) : tab === "aiusage" ? (
              <AIUsagePane />
            ) : tab === "devtests" ? (
              <DevTestsPane />
            ) : tab === "superuser" && superUser ? (
              <SuperUserPane {...superUser} />
            ) : (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-text-primary">
                  Plan &amp; Billing
                </h3>
                {me === undefined ? (
                  /* Plan & Billing is still loading — one larger spinner,
                     centered above the panel body (replaces the small inline
                     skeleton). */
                  <div className="flex justify-center pt-1 pb-6">
                    <Spinner className="size-8" aria-label="Loading your plan" />
                  </div>
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
                            <Spinner size={14} />
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
                            <Spinner size={14} />
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

          <DialogFooter className="block border-t border-border px-4 py-2.5">
            <div className="flex items-center justify-between gap-2">
              {/* Clerk user button / sign-in — same component as the top bar. */}
              <UserMenu />
              {(tab === "general" ||
                tab === "canvas" ||
                tab === "appearance" ||
                tab === "security" ||
                tab === "rulers" ||
                tab === "superuser") && (
                <div className="flex items-center gap-2">
                  <Button
                    size="large"
                    onClick={() => setRestoreConfirmOpen(true)}
                    disabled={
                      tab === "superuser" ? !superUser?.overridden : atDefaults
                    }
                  >
                    Restore Settings
                  </Button>
                  {tab === "superuser" ? (
                    <Button
                      size="large"
                      onClick={handleApplyTier}
                      disabled={granting}
                    >
                      {granting
                        ? "Applying…"
                        : `Apply ${superUser?.mode === "paid" ? "Paid" : "Free"}`}
                    </Button>
                  ) : (
                    <Button
                      size="large"
                      onClick={handleApplySettings}
                      disabled={!settingsDirty}
                    >
                      Apply
                    </Button>
                  )}
                </div>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore confirmation — portaled above the Settings modal (z-modal). */}
      {restoreConfirmOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[var(--z-idle)] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setRestoreConfirmOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Restore settings"
              className="w-full max-w-sm rounded-xl border border-border bg-bg-secondary p-5 text-text-primary shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold">Restore settings?</h3>
              <p className="mt-2 text-sm text-text-muted leading-relaxed">
                {tab === "superuser"
                  ? "This clears the Super User tier override and returns to your real account tier."
                  : "This resets all your preferences to their defaults. Your images and edits aren't affected."}
              </p>
              <div className="mt-4 flex gap-2">
                <Button size="large"
                  className="flex-1"
                  onClick={() => setRestoreConfirmOpen(false)}
                >
                  Cancel
                </Button>
                <Button size="large" className="flex-1" onClick={handleRestore}>
                  Restore
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
