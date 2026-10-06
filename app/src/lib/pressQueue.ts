// Canvas presses whose handling has to wait on the engine.
//
// A press on the Shapes / Arrows / Crop canvas first commits the pending shape
// and hit-tests the engine (`useDrawingTools.onMouseDown`). Those are worker
// round trips, and they slow as shapes pile up. The pointer does not wait for
// them: it used to move and lift into a hook that had not started drawing, so
// the drag vanished, and the hook then started drawing anyway with the button
// already up — the NEXT drag ran from the vanished one's start point. With
// presses overlapping, a quick second drag also overtook the first.
//
// So a press is recorded the instant it happens, the moves and the release
// that follow are buffered on it, and presses are handled strictly in order.
import type { Point } from "@/lib/shapeSloppiness";

export interface Press {
  /** Where the pointer was last seen while the press waited. */
  last: Point;
  /** The button came up while the press waited. */
  released: boolean;
}

export class PressQueue {
  private latest: Press | null = null;
  private chain: Promise<void> = Promise.resolve();

  /** Record a press at `start` now, and run `handle` once every earlier press
   *  has been handled — so a press can rely on the one before it having
   *  landed. `handle` calls `settle` when it starts a live drag; the press is
   *  settled for it in any case when it returns. */
  run(start: Point, handle: (press: Press) => Promise<void>): Promise<void> {
    const press: Press = { last: start, released: false };
    this.latest = press;
    const run = this.chain.then(() => handle(press)).finally(() => this.settle(press));
    this.chain = run.catch(() => {});
    return run;
  }

  /** Buffer a move on the waiting press. False when none waits — the move
   *  belongs to the live drag — or when it was already released: a pointer
   *  hovering toward the next press is not where the last drag ended. */
  move(p: Point): boolean {
    if (!this.latest || this.latest.released) return false;
    this.latest.last = p;
    return true;
  }

  /** Buffer the release on the waiting press. False when none waits. */
  release(): boolean {
    if (!this.latest) return false;
    this.latest.released = true;
    return true;
  }

  /** `press` has been decided: from here on, moves and the release go to the
   *  live drag rather than to it. A newer press keeps waiting. */
  settle(press: Press): void {
    if (this.latest === press) this.latest = null;
  }
}
