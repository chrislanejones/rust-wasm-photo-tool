// Gear button + Plan & Billing modal. Self-contained: holds its own modal
// state, reads tier/subscription from Convex, and drives Stripe Checkout /
// Customer Portal via the convex/stripe actions. Drop it anywhere (e.g. the
// TopBar next to the user menu).
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { Settings, X, Check, Loader2, ExternalLink } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { fadeIn, quickSpring } from "@/lib/animations";

const PRO_FEATURES = [
  "All AI tools — background removal, OCR, object removal",
  "100 images per session",
  "Unlimited layers & projects",
  "5 GB persistent storage",
  "Unlimited share links",
];

export function SubscriptionButton() {
  const [open, setOpen] = useState(false);
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
        title="Plan & billing"
        aria-label="Plan & billing"
      >
        <Settings className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={quickSpring}
              onClick={(e) => e.stopPropagation()}
              className="w-[min(440px,95vw)] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
                <span className="text-sm font-semibold">Plan &amp; Billing</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 p-4">
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
                            className="flex items-start gap-2 text-[11px] text-zinc-300"
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
                      <p className="text-[10px] text-amber-400">
                        Your plan cancels at the end of the current period.
                      </p>
                    )}
                    {err && (
                      <p className="text-[10px] leading-relaxed text-red-400">{err}</p>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
