import { useEffect, useRef, useState } from "react";
import type { Backend, GpuLettersScene } from "./gpu-letters.three";

/* WEBGPU, spelled in 3D cubes, drawn by three's WebGPURenderer.
 *
 * ⚠️ THE LABEL UNDER THIS IS THE POINT. The section it sits in is about a
 * measurement, and the one thing a reader can check from their armchair is
 * whether their own machine ran this on the GPU. So the backend is reported,
 * never assumed: "WebGPU" only appears when three actually acquired a
 * GPUDevice. Its WebGL 2 fallback says WebGL 2, and no context at all says so.
 *
 * A marketing page claiming a GPU it never got is the same failure as the font
 * dropdown that listed twelve families and rendered one (ADR-051): a control
 * that teaches people a feature works.
 *
 * WHY THREE.JS NOW. The first version was hand-written WGSL drawing flat
 * squares with a faked bevel. The design (Home bottom section) asks for real
 * lit cubes that tilt toward the pointer, and that is a renderer's job. The
 * cost is kept off the page's first load: three lives in `gpu-letters.three.ts`,
 * a chunk requested only when this box nears the viewport.
 *
 * SSR: everything that touches a canvas, `navigator.gpu` or three is inside an
 * effect. The prerender gets the markup and the count, and never runs a frame.
 */

/** Cells set in the 5x7 glyphs of W E B G P U. The chunk holds the glyphs and
 *  exports the same number, but the label needs it before the chunk loads. */
const CUBE_COUNT = 103;

const LABEL: Record<Backend | "pending", string> = {
  webgpu: "WebGPU · three.js, one instanced draw",
  webgl: "WebGL 2 · no WebGPU in this browser",
  none: "No GPU context on this machine",
  pending: "Starting…",
};

export default function CubeLetters() {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<GpuLettersScene | null>(null);
  const [backend, setBackend] = useState<Backend | "pending">("pending");
  const [grabbing, setGrabbing] = useState(false);

  useEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas) return;
    let cancelled = false;
    let loading = false;

    const io = new IntersectionObserver(
      ([e]) => {
        sceneRef.current?.setVisible(e.isIntersecting);
        if (!e.isIntersecting || loading) return;
        loading = true;
        import("./gpu-letters.three").then(({ createGpuLetters, CUBE_COUNT: n }) => {
          if (cancelled) return;
          if (import.meta.env.DEV && n !== CUBE_COUNT) console.warn(`CubeLetters: CUBE_COUNT is ${CUBE_COUNT}, glyphs have ${n}`);
          const scene = createGpuLetters(frame, canvas);
          sceneRef.current = scene;
          scene.ready.then((b) => {
            if (!cancelled) setBackend(b);
          });
        });
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(frame);
    const ro = new ResizeObserver(() => sceneRef.current?.fit());
    ro.observe(frame);

    return () => {
      cancelled = true;
      io.disconnect();
      ro.disconnect();
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  return (
    <div
      ref={frameRef}
      className={`cubes${grabbing ? " is-grabbing" : ""}`}
      tabIndex={0}
      role="img"
      aria-label={`The word WEBGPU built from ${CUBE_COUNT} cubes. Hover to ripple them, drag to scatter, or press a key; they spring back.`}
      onPointerEnter={(e) => sceneRef.current?.pointerMove(e.clientX, e.clientY)}
      onPointerMove={(e) => sceneRef.current?.pointerMove(e.clientX, e.clientY)}
      onPointerLeave={() => {
        setGrabbing(false);
        sceneRef.current?.pointerLeave();
      }}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        setGrabbing(true);
        sceneRef.current?.pointerDown(e.clientX, e.clientY);
      }}
      onPointerUp={() => {
        setGrabbing(false);
        sceneRef.current?.pointerUp();
      }}
      onPointerCancel={() => {
        setGrabbing(false);
        sceneRef.current?.pointerUp();
      }}
      onKeyDown={(e) => {
        // Any key scatters, so a keyboard user gets the same toy. Tab still
        // moves focus; arrows and space would otherwise scroll the page.
        if (e.key === "Tab") return;
        if (e.key === " " || e.key.startsWith("Arrow")) e.preventDefault();
        sceneRef.current?.nudge();
      }}
    >
      <canvas ref={canvasRef} className="cubes__canvas" />
      <span className="cubes__backend">{LABEL[backend]}</span>
      <span className="cubes__count">
        <span className="fig">{CUBE_COUNT}</span> cubes
      </span>
    </div>
  );
}
