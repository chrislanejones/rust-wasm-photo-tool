// Shared full-page "brand reveal" shell: the horse logo + "Image Horse" sit as a
// hero, and when `showContent` flips true the hero eases UPWARD (framer `layout`)
// while the children reveal below. Used by the cold-start FirstRunScreen (New /
// Welcome-back) and the IdleScreen, so all three share one entrance.
//
// While `!showContent`, it shows either a spinner (`loading`) or just the hero.
// z-index is caller-supplied (`zIndexClass`) rather than hardcoded: the true
// IdleScreen needs to ride above z-dialog (it must cover any open dialog while
// the tab is throttled), but FirstRunScreen is just the app's empty state — it
// must stay BELOW z-dialog so dialogs opened from it (e.g. the Alt+Delete
// Diagnostics window) are actually visible/clickable instead of getting
// trapped under an opaque full-viewport layer with Radix's body pointer-events
// lock engaged and no visible way to close it.
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Spinner } from "@/components/ui/spinner";

const horseLogo = "/Image-Horse-Logo.svg";

export function BrandRevealScreen({
  show,
  showContent,
  loading = false,
  reduceMotion = false,
  ariaLabel,
  topRight,
  children,
  zIndexClass = "z-[var(--z-idle)]",
}: {
  show: boolean;
  /** Reveal the children + ease the hero up. */
  showContent: boolean;
  /** Show a spinner in the gap while not yet revealed (the boot-loading phase). */
  loading?: boolean;
  reduceMotion?: boolean;
  ariaLabel: string;
  /** Pinned top-right once revealed (e.g. sign-in). */
  topRight?: ReactNode;
  children?: ReactNode;
  /** Stacking tier for the full-page layer. Defaults to z-idle (covers
   *  dialogs too) — pass a lower tier for non-idle callers like
   *  FirstRunScreen that should yield to dialogs opened over them. */
  zIndexClass?: string;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="brand-reveal"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.35 }}
          className={`fixed inset-0 ${zIndexClass} overflow-y-auto bg-background`}
          role={showContent ? "region" : "status"}
          aria-label={ariaLabel}
        >
          {showContent && topRight && (
            <div className="absolute right-4 top-4 z-10">{topRight}</div>
          )}

          <div className="flex min-h-full flex-col items-center justify-center px-4 py-10">
            {/* Hero: logo + title. `layout` eases it upward as the content grows
                the column below it. */}
            <motion.div
              layout={!reduceMotion}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 260, damping: 28 }
              }
              className="flex flex-col items-center"
            >
              <img
                src={horseLogo}
                alt=""
                draggable={false}
                className="h-32 w-32 drop-shadow-lg sm:h-36 sm:w-36"
              />
              <h1 className="mt-2 text-xl font-bold tracking-wide text-text-primary">
                Image Horse
              </h1>
            </motion.div>

            {/* Spinner — only in the gap before reveal, when loading. */}
            <AnimatePresence>
              {!showContent && loading && (
                <motion.div
                  key="spinner"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.15 }}
                  className="mt-6 flex flex-col items-center gap-3"
                >
                  {/* `Spinner` uses `.spinner-icon` — an essential loading
                      indicator, so it keeps spinning even under reduced motion
                      (a frozen boot spinner reads as a hung app). */}
                  <Spinner size={24} />
                  <p className="text-xs text-text-muted" aria-hidden="true">
                    Loading your workspace…
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Revealed content. */}
            <AnimatePresence>
              {showContent && (
                <motion.div
                  key="content"
                  initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.3,
                    ease: "easeOut",
                    delay: reduceMotion ? 0 : 0.12,
                  }}
                  className="mt-6 flex w-full flex-col items-center"
                >
                  {children}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
