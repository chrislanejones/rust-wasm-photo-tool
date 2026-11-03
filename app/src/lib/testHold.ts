// Named test holds: a spec arms one, and the first time the app reaches that
// point it waits for the spec's release. Inert unless a spec arms it, so a
// production session never waits. A race is held open with one, so it
// happens every run instead of now and then:
//
//   "load-committed": a document load is past its last stale check (it WILL
//     replace the document) and has not claimed it yet. The A → B → A bounce
//     (e2e/photo-switch-bounce.spec.ts) needs the click back to A right there.
//
// One-shot: after an armed hold is reached once it passes straight through,
// so the loads that come after it are never held.

export type HoldName = "load-committed";

interface Hold {
  armed: boolean;
  reached: boolean;
  release?: () => void;
}

declare global {
  interface Window {
    __ihHolds?: Partial<Record<HoldName, Hold>>;
  }
}

/** Wait here if a spec armed `name`; return at once otherwise. */
export async function holdPoint(name: HoldName): Promise<void> {
  const hold = typeof window === "undefined" ? undefined : window.__ihHolds?.[name];
  if (!hold?.armed) return;
  hold.armed = false;
  await new Promise<void>((resolve) => {
    hold.release = resolve;
    hold.reached = true;
  });
}
