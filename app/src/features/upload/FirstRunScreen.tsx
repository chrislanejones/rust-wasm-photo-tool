// Cold-start full-page surface. The boot splash AND the first-run screen in one:
// logo + spinner while "loading", then the spinner fades, the logo eases up, and
// the passed `children` (New actions / Welcome-back) reveal. Auto-reopen just
// fades it out. Thin wrapper over the shared BrandRevealScreen entrance.
import type { ReactNode } from "react";
import { BrandRevealScreen } from "@/components/BrandRevealScreen";
import { HalloweenBanner } from "@/features/halloween";

export function FirstRunScreen({
  show,
  phase,
  reduceMotion = false,
  children,
}: {
  show: boolean;
  phase: "loading" | "ready";
  reduceMotion?: boolean;
  /** The revealed content (New actions / Welcome-back), shown once ready. */
  children?: ReactNode;
}) {
  const ready = phase === "ready";
  return (
    <>
      <BrandRevealScreen
        show={show}
        showContent={ready}
        loading={!ready}
        reduceMotion={reduceMotion}
        ariaLabel={ready ? "Get started" : "Loading Image Horse"}
        // Below z-dialog (unlike the real IdleScreen): this is just the app's
        // empty state, so dialogs opened over it (e.g. Alt+Delete Diagnostics)
        // must render visibly on top instead of getting trapped underneath.
        zIndexClass="z-[var(--z-panel)]"
      >
        {children}
      </BrandRevealScreen>
      {/* This page covers the top bar, and with it the bar's garland, so it
        carries its own (late October only). A sibling, not a child: fixed
        positioning inside the reveal's animated layers would not hold. */}
      {show && ready && <HalloweenBanner placement="centered" />}
    </>
  );
}
