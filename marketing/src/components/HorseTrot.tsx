import { useEffect, useRef, useState } from "react";
import type { HorseTrotScene } from "./horse-trot.three";

/* The trotting horse beside the home page's closing line (Footer.dc.html,
 * `horse`). Pure decoration: aria-hidden, no controls, no text.
 *
 * Desktop pointers only, the design's own query. On a phone it would be a
 * 178 KB model plus three.js for a picture that sits under the fold, so the
 * query decides before anything is requested, not after.
 *
 * Reduced motion gets a still picture of the same horse, `horse-still.webp`,
 * instead of the canvas. The scene used to handle it by drawing one frame and
 * stopping, which still cost the reader 155 KB of gzipped three.js plus the
 * 178 KB model for a picture that never moves. The still is a snapshot of that
 * scene, so the two look the same.
 *
 * SSR renders nothing. Both queries start false on server and client, so
 * hydration matches; the effect flips them and only then mounts anything. */

const DESKTOP = "(min-width: 64rem) and (hover: hover) and (pointer: fine)";
const REDUCED = "(prefers-reduced-motion: reduce)";
const SRC = "/horse.glb";
const STILL = "/horse-still.webp";

function useMedia(query: string) {
  const [match, setMatch] = useState(false);

  useEffect(() => {
    const mq = matchMedia(query);
    setMatch(mq.matches);
    const on = (e: MediaQueryListEvent) => setMatch(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);

  return match;
}

export default function HorseTrot() {
  const desktop = useMedia(DESKTOP);
  const reduced = useMedia(REDUCED);
  if (!desktop) return null;
  return reduced ? <HorseStill /> : <HorseCanvas />;
}

function HorseStill() {
  return (
    <div className="sfoot__horse" aria-hidden="true">
      <img className="sfoot__horse-canvas" src={STILL} alt="" width={420} height={240} decoding="async" />
    </div>
  );
}

function HorseCanvas() {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas) return;
    let scene: HorseTrotScene | null = null;
    let cancelled = false;
    let loading = false;

    const io = new IntersectionObserver(
      ([e]) => {
        scene?.setVisible(e.isIntersecting);
        if (!e.isIntersecting || loading) return;
        loading = true;
        import("./horse-trot.three").then(({ createHorseTrot }) => {
          if (!cancelled) scene = createHorseTrot(frame, canvas, SRC);
        });
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(frame);
    const ro = new ResizeObserver(() => scene?.fit());
    ro.observe(frame);

    return () => {
      cancelled = true;
      io.disconnect();
      ro.disconnect();
      scene?.dispose();
    };
  }, []);

  return (
    <div ref={frameRef} className="sfoot__horse" aria-hidden="true">
      <canvas ref={canvasRef} className="sfoot__horse-canvas" />
    </div>
  );
}
