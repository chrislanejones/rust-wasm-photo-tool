import { useEffect, useRef, useState } from "react";
import type { HorseTrotScene } from "./horse-trot.three";

/* The trotting horse beside the home page's closing line (Footer.dc.html,
 * `horse`). Pure decoration: aria-hidden, no controls, no text.
 *
 * Desktop pointers only, the design's own query. On a phone it would be a
 * 178 KB model plus three.js for a picture that sits under the fold, so the
 * query decides before anything is requested, not after.
 *
 * SSR renders nothing. `desktop` starts false on both server and client, so
 * hydration matches; the effect flips it and only then mounts the canvas. */

const DESKTOP = "(min-width: 64rem) and (hover: hover) and (pointer: fine)";
const SRC = "/horse.glb";

export default function HorseTrot() {
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const mq = matchMedia(DESKTOP);
    setDesktop(mq.matches);
    const on = (e: MediaQueryListEvent) => setDesktop(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  return desktop ? <HorseCanvas /> : null;
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
