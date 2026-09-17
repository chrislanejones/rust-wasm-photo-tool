import { Component, Suspense, lazy, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/* The three 3D figures in /blog/engine-in-a-worker, and the four gates they
 * have to pass before a single byte of three.js is fetched.
 *
 * This module deliberately does NOT import three or @react-three/fiber. It
 * holds the gates; `WorkerSceneGL` holds the scenes, and it is reached only
 * through the `lazy()` below. That split is the whole point of the file — see
 * each gate.
 *
 * ── gate 1: the prerender ─────────────────────────────────────────────────
 * `pnpm build:marketing` runs this tree under Node (entry-server.tsx), which
 * states outright that it will not stub `window` or `document` and that a
 * component reaching for a browser global should fail the build loudly. A
 * WebGL canvas reaches for several. So nothing but the placeholder exists until
 * an effect has run, and an effect never runs on the server.
 *
 * `useState(false)` plus an effect — not `typeof window !== "undefined"`. The
 * latter is true during hydration, so the first client render would disagree
 * with the HTML React was handed, and React's recovery is to throw the
 * prerendered markup away and re-render the route. That is the
 * empty-page-for-crawlers problem the prerender exists to prevent, reintroduced
 * through a diagram. (Same reasoning as useMediaQuery.ts, which is why the
 * reduced-motion check below goes through it rather than calling matchMedia.)
 *
 * ── gate 2: the viewport ──────────────────────────────────────────────────
 * three.js is ~170 kB gzipped and this post has three scenes in it. A reader
 * who opens the page and leaves should pay for none of them, so the import
 * fires when a figure comes within a screen of the viewport, not on mount.
 *
 * ── gate 3: WebGL itself ──────────────────────────────────────────────────
 * Context creation fails on a blocklisted driver, in a hardened browser, and
 * under most headless crawlers. R3F throws when it does, and an unhandled throw
 * here would blank the whole article. The boundary puts the placeholder back.
 *
 * ── gate 4: the reader ────────────────────────────────────────────────────
 * `prefers-reduced-motion` does not mean "no diagram". It means no loop: the
 * scene renders one still and stops. Handled inside WorkerSceneGL, which is the
 * only side that knows what a frame is.
 */

const WorkerSceneGL = lazy(() => import("./WorkerSceneGL"));

export type SceneKind = "threads" | "doors" | "canvas";

interface WorkerSceneProps {
  kind: SceneKind;
  /** Short description of what the scene shows, for the pre-WebGL placeholder.
   *  Not the caption — the <figcaption> carries the meaning of the figure. */
  placeholder: string;
}

/* Puts the placeholder back if the scene throws.
 *
 * Scoped to one figure on purpose: a failure in the doors scene should cost the
 * reader the doors scene, not the two that work and not the post. */
class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Worth a line in the console — a reader reporting "the diagrams are grey"
    // has no other way to tell us which gate they fell through.
    console.warn("[worker-figure] scene unavailable, showing placeholder", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function WorkerScene({ kind, placeholder }: WorkerSceneProps) {
  const host = useRef<HTMLDivElement>(null);
  // `near` is one-way: once a figure has been approached it stays mounted, so
  // scrolling back up does not re-run the WebGL context setup.
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    // No IntersectionObserver (or no element) is not a reason to withhold the
    // figure — mount it and let the other gates do their work.
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      // A screen of lead time, so the scene is up by the time it is read.
      { rootMargin: "100% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* aria-hidden, and not reluctantly.
   *
   * The scene's own labels are positioned fragments — "engine", "linear
   * memory", "← reply { id, ok, value }" — that carry their meaning by where
   * they sit. Read in DOM order by a screen reader they are a word list, and a
   * misleading one. The <figcaption> beside every one of these figures says in
   * a sentence what the picture shows, and that is the accessible content.
   */
  return (
    <div className="fig-scene" ref={host} aria-hidden="true">
      {near ? (
        <SceneBoundary fallback={<ScenePlaceholder text={placeholder} />}>
          <Suspense fallback={<ScenePlaceholder text={placeholder} />}>
            <WorkerSceneGL kind={kind} />
          </Suspense>
        </SceneBoundary>
      ) : (
        <ScenePlaceholder text={placeholder} />
      )}
    </div>
  );
}

/* What the server writes, what a crawler reads, and what a reader without WebGL
 * keeps. Hatched rather than blank so it reads as a diagram that did not load
 * rather than as a layout hole. */
function ScenePlaceholder({ text }: { text: string }) {
  return <p className="fig-scene__placeholder">{text}</p>;
}
