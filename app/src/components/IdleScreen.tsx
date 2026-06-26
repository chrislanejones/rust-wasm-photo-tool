// Full-screen "paused to save power" idle screen, shown after the idle timeout.
// Uses the shared BrandRevealScreen entrance so it matches the cold-start
// surfaces: the logo settles in, then eases up to reveal the message + Continue.
// Sits above everything (z-idle) so the editor is fully covered — the browser
// can throttle the tab. Only "Continue" (→ wake) dismisses it; edits are safe.
import { useEffect, useState } from "react";
import { LargeButton } from "@/components/ui/large-button";
import { BrandRevealScreen } from "@/components/BrandRevealScreen";

export function IdleScreen({
  open,
  onContinue,
  reduceMotion = false,
}: {
  open: boolean;
  onContinue: () => void;
  reduceMotion?: boolean;
}) {
  // Brief beat with the hero alone, then ease it up and reveal the content —
  // the same entrance as cold start (no spinner; idle isn't "loading").
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!open) {
      setSettled(false);
      return;
    }
    if (reduceMotion) {
      setSettled(true);
      return;
    }
    const t = window.setTimeout(() => setSettled(true), 350);
    return () => window.clearTimeout(t);
  }, [open, reduceMotion]);

  return (
    <BrandRevealScreen
      show={open}
      showContent={settled}
      reduceMotion={reduceMotion}
      ariaLabel="Paused — idle"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            Paused to save power
          </h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-text-secondary">
            Background activity is throttled after a while idle. Your edits are
            safe.
          </p>
        </div>
        <LargeButton onClick={onContinue} autoFocus>
          Continue with Image Horse
        </LargeButton>
      </div>
    </BrandRevealScreen>
  );
}
