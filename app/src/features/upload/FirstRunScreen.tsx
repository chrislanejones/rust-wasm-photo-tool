// Cold-start full-page surface. The boot splash AND the first-run screen in one:
// logo + spinner while "loading", then the spinner fades, the logo eases up, and
// the passed `children` (New actions / Welcome-back) reveal. Auto-reopen just
// fades it out. Thin wrapper over the shared BrandRevealScreen entrance.
import type { ReactNode } from "react";
import { UserMenu } from "@/components/UserMenu";
import { BrandRevealScreen } from "@/components/BrandRevealScreen";

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
    <BrandRevealScreen
      show={show}
      showContent={ready}
      loading={!ready}
      reduceMotion={reduceMotion}
      ariaLabel={ready ? "Get started" : "Loading Image Horse"}
      // Sign-in pinned top-right (new browser / cache-cleared users restore here).
      topRight={<UserMenu />}
    >
      {children}
    </BrandRevealScreen>
  );
}
