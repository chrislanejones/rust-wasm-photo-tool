// The gallery loads like Tools (UI Night 8 §1).
//
// `PerPhotoRegion` locks a per-photo panel through a photo switch and, past
// 300 ms, turns its controls into skeletons IN PLACE. This is the same grammar
// for the gallery card: while any tile IN VIEW has nothing to show, or an
// import is still opening files, the card's chrome (count, Compress, the action
// buttons, both chevrons) goes skeleton as one piece and comes back as one
// piece. Before this the header was real from the first frame while the tiles
// under it filled in one at a time — a ragged card.
//
// What is NOT loading, on purpose:
//   · an edit regenerating a thumbnail. The tile keeps its previous picture
//     (`shownUrl` only moves forward in useThumbImage), so it never reports
//     pending, so it can never put the card into loading (#285).
//   · a tile that failed to decode. It shows its error state, not pending.
//   · a tile scrolled out of view. An IntersectionObserver on the strip decides
//     "in view"; one far tile must not hold the whole card hostage.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useDelayedFlag } from "@/hooks/usePhotoSwitching";
import { THUMB_SKELETON_DELAY_MS, type ThumbImage } from "./useThumbImage";

/**
 * HOW TILES REVEAL — the one constant §1.4 asks for.
 *
 *   "fill"      Fill in: a decoded tile shows its photo the moment it lands;
 *               the chrome unlocks when the last tile in view lands. SHIPPED.
 *   "together"  All at once: every tile that was empty when the skeleton began
 *               stays a skeleton until all in view have decoded, or
 *               GALLERY_REVEAL_TOGETHER_MAX_MS has passed, then they reveal
 *               together. Built and screenshotted for comparison.
 */
type GalleryRevealMode = "fill" | "together";
const GALLERY_REVEAL_MODE: GalleryRevealMode = "fill";

/** Mode "together" never holds decoded photos back longer than this. */
const GALLERY_REVEAL_TOGETHER_MAX_MS = 1_500;

/** Like `SWITCH_LOCK_MAX_MS` in PerPhotoRegion: a decode that never finishes
 *  must not lock the gallery's chrome for ever. Past this, unlock and log. */
const GALLERY_LOADING_MAX_MS = 15_000;

/**
 * How long "nothing is empty" must hold before the card counts as settled.
 *
 * The pending set is fed from tile EFFECTS, so there are commits in which an
 * import tile has gone and the real tile that replaces it has not reported yet.
 * Without this, each such gap unlocked the chrome for a frame and restarted the
 * 300 ms grace — a 10-file import blinked ten times.
 */
const GALLERY_SETTLE_MS = 120;

type Phase = "idle" | "grace" | "loading" | "capped";

/** "Every observed tile is in view" — no IntersectionObserver (jsdom). */
const ALL_IN_VIEW = "all" as const;

export interface GalleryLoading {
  /** Callback ref for the scroll container the tiles live in — the
   *  IntersectionObserver root. A callback, not a RefObject: the phone grid
   *  mounts its scroller only after boot, and an effect keyed on a RefObject
   *  never hears that it arrived (measured: the phone never went loading). */
  setRoot: (el: HTMLElement | null) => void;
  /** Tiles call this from an effect: does this tile have pixels yet? */
  reportPending: (id: string, pending: boolean) => void;
  /** The gallery's ONE busy flag (any tile pending, in view or not). */
  busy: boolean;
  /** Past the grace and under the cap: chrome is skeleton + inert. */
  loading: boolean;
  /** Mode "together": tiles that were empty when the skeleton began stay held. */
  holdReveal: boolean;
  /** The 15 s cap fired: chrome unlocked, a tile still waiting shows its error. */
  capped: boolean;
  /** Empty tiles in view (plus imports) when the skeleton began — the number
   *  the one `role="status"` reads out. Frozen so it is said once, not counted
   *  down tile by tile. */
  announceCount: number;
}

export function useGalleryLoading({
  itemIds,
  pendingImports,
  mode = GALLERY_REVEAL_MODE,
}: {
  /** Tile ids in order; a change re-observes the tiles (`[data-id]`). */
  itemIds: readonly string[];
  /** Files an import is still opening. Not observed: an import is loading. */
  pendingImports: number;
  mode?: GalleryRevealMode;
}): GalleryLoading {
  // Which tiles have no pixels yet. A Set of ids, not a count: a tile can
  // report the same value twice (React may re-run the effect) and a counter
  // would drift; the id is idempotent.
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());
  const reportPending = useCallback((id: string, pending: boolean) => {
    setPendingIds((prev) => {
      // Returning `prev` unchanged when nothing moved matters: this is called
      // from a tile effect on every decode, and a fresh Set every time would
      // re-render the whole gallery per tile.
      if (prev.has(id) === pending) return prev;
      const next = new Set(prev);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  // Which tiles are inside the strip's visible box.
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [inView, setInView] = useState<ReadonlySet<string> | typeof ALL_IN_VIEW>(() => new Set());
  const itemsKey = itemIds.join("\n");
  useEffect(() => {
    if (!root) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(ALL_IN_VIEW);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        setInView((prev) => {
          const next = new Set(prev === ALL_IN_VIEW ? [] : prev);
          let changed = prev === ALL_IN_VIEW;
          for (const e of entries) {
            const id = (e.target as HTMLElement).dataset.id;
            if (!id) continue;
            if (e.isIntersecting) {
              if (!next.has(id)) {
                next.add(id);
                changed = true;
              }
            } else if (next.delete(id)) {
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      },
      { root },
    );
    root.querySelectorAll<HTMLElement>("[data-id]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [root, itemsKey]);

  let emptyInView = 0;
  for (const id of pendingIds) if (inView === ALL_IN_VIEW || inView.has(id)) emptyInView++;
  const empty = emptyInView + pendingImports;
  const raw = empty > 0;

  // ── The phase machine: idle → grace (300 ms) → loading → (capped) → idle ──
  const [phase, setPhase] = useState<Phase>("idle");
  // Read by the grace timer when it fires: did it settle inside the grace?
  const rawRef = useRef(raw);
  useEffect(() => {
    rawRef.current = raw;
  }, [raw]);

  useEffect(() => {
    if (raw) {
      if (phase === "idle") setPhase("grace");
      return;
    }
    if (phase === "idle") return;
    const t = window.setTimeout(() => setPhase("idle"), GALLERY_SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [raw, phase]);

  useEffect(() => {
    if (phase !== "grace") return;
    // A cached restore lands inside this and never shows a skeleton.
    const t = window.setTimeout(() => {
      setPhase((p) => (p === "grace" && rawRef.current ? "loading" : p));
    }, THUMB_SKELETON_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  const active = phase !== "idle";
  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => {
      setPhase((p) => (p === "idle" ? p : "capped"));
      // console.warn rather than logDiagnostic: the app's console capture
      // (installConsoleCapture) mirrors it into the Diagnostics log anyway, and
      // a warning is something an e2e run can actually observe.
      console.warn(`Gallery thumbnails did not finish loading in ${GALLERY_LOADING_MAX_MS / 1000}s — gallery unlocked`);
    }, GALLERY_LOADING_MAX_MS);
    return () => window.clearTimeout(t);
  }, [active]);

  const loading = phase === "loading";

  // Frozen at the moment the skeleton begins (derived-state pattern, so it is
  // right on the very render the status first appears).
  const [announceCount, setAnnounceCount] = useState(0);
  const [prevLoading, setPrevLoading] = useState(loading);
  if (prevLoading !== loading) {
    setPrevLoading(loading);
    if (loading) setAnnounceCount(empty);
  }

  const holdOver = useDelayedFlag(loading, GALLERY_REVEAL_TOGETHER_MAX_MS);
  const holdReveal = mode === "together" && loading && !holdOver;

  return {
    setRoot,
    reportPending,
    busy: pendingIds.size > 0 || pendingImports > 0,
    loading,
    holdReveal,
    capped: phase === "capped",
    announceCount,
  };
}

/** What a tile needs from the region it sits in. Default: no region. */
export const GalleryRevealContext = createContext<{ regionLoading: boolean; holdReveal: boolean; capped: boolean }>({
  regionLoading: false,
  holdReveal: false,
  capped: false,
});

/**
 * A tile's view, given its decode and the card it sits in. Shared by the
 * desktop `Thumb` and the phone's `MobileThumb`, which share the decode
 * (`useThumbImage`) but not their markup.
 *
 *   · While the card is loading, a tile with nothing to show is a skeleton AT
 *     ONCE — the card has already waited out the grace, the tile must not wait
 *     out a second one of its own.
 *   · Mode "together": a tile that was empty when the hold began keeps its
 *     skeleton until the hold ends, even once decoded. A tile already showing a
 *     photo keeps it — a photo never turns back into a placeholder.
 *   · Past the cap, a tile still waiting shows its error state.
 */
export function useGalleryTile(thumb: ThumbImage): { src: string; showSkeleton: boolean; failed: boolean } {
  const { regionLoading, holdReveal, capped } = useContext(GalleryRevealContext);
  // A tile mounted mid-hold (an import landing) has nothing yet: held.
  const [heldTile, setHeldTile] = useState(holdReveal);
  const [prevHold, setPrevHold] = useState(holdReveal);
  if (prevHold !== holdReveal) {
    setPrevHold(holdReveal);
    setHeldTile(holdReveal && !thumb.src);
  }
  const held = holdReveal && heldTile && !thumb.failed;
  // Past the 15 s cap a decode that never answered is treated as failed: the
  // tile says so in words (#285) instead of shimmering for ever.
  const lost = capped && thumb.pending;
  return {
    src: held ? "" : thumb.src,
    failed: thumb.failed || lost,
    showSkeleton: !lost && (held || (thumb.pending && (thumb.showSkeleton || regionLoading))),
  };
}

/** For a tile with no decode of its own (a pending import). */
export function useGalleryRegionLoading(): boolean {
  return useContext(GalleryRevealContext).regionLoading;
}
