import { Skeleton } from "@/components/ui/skeleton";
import { useDelayedFlag } from "@/hooks/usePhotoSwitching";
import { MASTER_BAR_CHROME_H, MASTER_BAR_SHELL } from "./constants";

/** New, the three tabs, Export, settings, user: the bar's seven 30px slots. */
const SLOTS = 7;

/**
 * Shown while the lazy MasterBar chunk loads (the first time a window goes
 * ≤1000 px). It was `fallback={null}`: the canvas had already cleared 252 px
 * on the left for the bar, so that strip sat empty and the bar popped in.
 *
 * The shell is the bar's own box and paints at once, since the space is
 * already reserved; the slot blocks wait out the 300 ms grace, so a cached
 * chunk shows no grey. Static import on purpose: a fallback inside the lazy
 * chunk could not show while that chunk loads.
 *
 * Decorative, like the sign-in slot skeleton: the arriving bar names itself
 * ("Master bar"), and chrome that says "Loading" on a resize is noise.
 */
export function MasterBarFallback() {
  const showSlots = useDelayedFlag(true);
  return (
    <div
      aria-hidden="true"
      data-testid="master-bar-fallback"
      className={MASTER_BAR_SHELL}
      style={{ height: MASTER_BAR_CHROME_H }}
    >
      {showSlots &&
        Array.from({ length: SLOTS }, (_, i) => (
          <Skeleton key={i} decorative variant="block" className="size-[30px]" />
        ))}
    </div>
  );
}
