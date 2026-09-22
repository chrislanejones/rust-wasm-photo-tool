import { useCallback, useEffect, useRef, useState } from "react";

/* WEBGPU, spelled in cubes, drawn by your GPU when you have one.
 *
 * ⚠️ THE LABEL UNDER THIS IS THE POINT. The section it sits in is about a
 * measurement, and the one thing a reader can check from their armchair is
 * whether their own machine ran this on the GPU. So the backend is reported,
 * never assumed: `WEBGPU · INSTANCED, ONE DRAW CALL` only appears when a
 * `GPUDevice` was actually acquired and the pipeline actually built. Anything
 * else says CANVAS 2D and means it.
 *
 * A marketing page claiming a GPU it never got is the same failure as the font
 * dropdown that listed twelve families and rendered one (ADR-051) — a control
 * that teaches people a feature works. This is the same bug with a bigger
 * audience, so the honest path is cheap: ask, and print the answer.
 *
 * WHY NOT A LIBRARY. The site inlines its own icons rather than take an icon
 * dependency; three.js to draw a hundred squares is the same trade at a
 * hundred times the weight. The WebGPU path here is ~60 lines of WGSL and
 * buffer setup, and the fallback is `fillRect`.
 *
 * SSR: everything that touches a canvas or `navigator.gpu` is inside an effect.
 * The prerender runs this under Node, gets the markup, and never runs a frame.
 */

/** 5x7 cells per glyph, one string per row. `#` is a cube. */
const GLYPHS: Record<string, string[]> = {
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
};

const WORD = "WEBGPU";
const GLYPH_W = 5;
const GLYPH_H = 7;
const GAP = 1; // blank columns between glyphs

/** One cube: where it belongs, where it is, and how fast it is moving.
 *  Positions are in GRID units, not pixels, so the layout survives a resize
 *  without re-running the physics. */
interface Cube {
  /** Rest position — the letterform. Never mutated. */
  hx: number;
  hy: number;
  /** Current offset from rest, in grid units. */
  dx: number;
  dy: number;
  vx: number;
  vy: number;
}

function buildCubes(): { cubes: Cube[]; cols: number; rows: number } {
  const cubes: Cube[] = [];
  let x = 0;
  for (const ch of WORD) {
    const g = GLYPHS[ch];
    for (let r = 0; r < GLYPH_H; r++) {
      for (let c = 0; c < GLYPH_W; c++) {
        if (g[r][c] === "#") cubes.push({ hx: x + c, hy: r, dx: 0, dy: 0, vx: 0, vy: 0 });
      }
    }
    x += GLYPH_W + GAP;
  }
  return { cubes, cols: x - GAP, rows: GLYPH_H };
}

/* Spring constants. Tuned by feel, then left alone.
 *  STIFF too high and the letters snap back before the eye reads that they
 *  moved; DAMP too low and they ring like jelly, which reads as a bug. */
const STIFF = 26;
const DAMP = 6.5;
/** How far a push reaches, in grid units. About a letter and a half. */
const REACH = 3.4;
const PUSH = 210;

type Backend = "webgpu" | "2d" | "pending";

const WGSL = /* wgsl */ `
struct Uniforms {
  scale  : vec2f,   // grid units -> clip space
  origin : vec2f,   // top-left of the word, in clip space
  size   : f32,     // cube edge, in clip units
  _pad   : f32,
};
@group(0) @binding(0) var<uniform> u : Uniforms;

struct VsOut {
  @builtin(position) pos : vec4f,
  @location(0) shade : f32,
};

// A unit quad plus a top and right face, so a flat square reads as a cube.
// Three faces, two triangles each, in one instanced draw.
const CORNERS = array<vec2f, 6>(
  vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
  vec2f(1.0, 0.0), vec2f(1.0, 1.0), vec2f(0.0, 1.0),
);

@vertex
fn vs(@builtin(vertex_index) vi : u32,
      @location(0) inst : vec2f) -> VsOut {
  let face = vi / 6u;
  var p = CORNERS[vi % 6u];
  var shade = 1.0;

  let bevel = 0.30;
  if (face == 1u) {            // top face
    p = vec2f(p.x + bevel * p.y, p.y * bevel - bevel);
    shade = 1.45;
  } else if (face == 2u) {     // right face
    p = vec2f(1.0 + bevel * (1.0 - p.y), p.y + bevel * (p.x - 1.0) * -1.0 - bevel * p.x);
    p = vec2f(1.0 + bevel * p.x, p.y - bevel * p.x);
    shade = 0.55;
  }

  let grid = inst + p * 0.88;
  let clip = vec2f(u.origin.x + grid.x * u.scale.x,
                   u.origin.y - grid.y * u.scale.y);
  var o : VsOut;
  o.pos = vec4f(clip, 0.0, 1.0);
  o.shade = shade;
  return o;
}

@fragment
fn fs(in : VsOut) -> @location(0) vec4f {
  // The site's accent, oklch(74% 0.18 55), converted once to linear sRGB.
  let base = vec3f(0.996, 0.451, 0.106);
  return vec4f(base * in.shade, 1.0);
}
`;

interface Props {
  /** Told to the parent so the section can print it. */
  onBackend?: (b: Backend) => void;
  onCount?: (n: number) => void;
}

export default function CubeLetters({ onBackend, onCount }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [backend, setBackend] = useState<Backend>("pending");

  const model = useRef(buildCubes());
  const pointer = useRef<{ x: number; y: number; down: boolean }>({ x: 0, y: 0, down: false });
  const nudge = useRef(0);
  /** Restarts the frame loop after it has gone to sleep. The loop stops when
   *  every cube is at rest or the box is off screen, so input has to wake it.
   *  Set by the effect below; a no-op until a backend is running. */
  const wake = useRef<() => void>(() => {});

  useEffect(() => {
    onCount?.(model.current.cubes.length);
  }, [onCount]);

  useEffect(() => {
    onBackend?.(backend);
  }, [backend, onBackend]);

  /** Push every cube within REACH away from a point given in grid units. */
  const shove = useCallback((gx: number, gy: number, strength: number) => {
    for (const c of model.current.cubes) {
      const px = c.hx + c.dx;
      const py = c.hy + c.dy;
      const dx = px - gx;
      const dy = py - gy;
      const d2 = dx * dx + dy * dy;
      if (d2 > REACH * REACH) continue;
      const d = Math.sqrt(d2) || 0.0001;
      // Falls off toward the edge of REACH so the push has a soft rim rather
      // than a hard circle of displaced cubes.
      const falloff = 1 - d / REACH;
      const f = (strength * falloff * falloff) / d;
      c.vx += dx * f;
      c.vy += dy * f;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;

    const { cubes, cols, rows } = model.current;
    let raf = 0;
    let disposed = false;
    let device: GPUDevice | null = null;

    /* ── when this runs at all ─────────────────────────────────────────
     * The loop used to start at hydration and run every frame for the life of
     * the page: off screen, at rest, and during the hero's first paint, where
     * it read layout (getBoundingClientRect) and redrew all 103 cubes on each
     * frame. It was the one thing on the page that never went idle.
     *
     * Now three things gate it, and none of them changes what a visitor sees:
     * - the GPU is not asked for until the box is within 300px of the viewport,
     * - frames stop while the box is off screen,
     * - frames stop once every cube is back at rest, and the pointer, a key or
     *   a resize wakes them. A still frame costs nothing to keep on screen.
     */
    let visible = false;
    let started = false;
    /** One frame: physics, then draw. Set by whichever backend came up. */
    let render: ((now: number) => void) | null = null;

    // The box's size, read when it changes rather than on every frame.
    let size = frame.getBoundingClientRect();

    // ── geometry shared by both backends ──────────────────────────────
    // One place decides where the word sits, so the 2D fallback and the GPU
    // path cannot disagree about layout.
    const layout = () => {
      const r = size;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(r.width * dpr));
      const h = Math.max(1, Math.round(r.height * dpr));
      // Fit the word with a margin, then centre it.
      const cell = Math.min((w * 0.86) / cols, (h * 0.7) / rows);
      const ox = (w - cell * cols) / 2;
      const oy = (h - cell * rows) / 2;
      return { w, h, dpr, cell, ox, oy };
    };

    const gridFromClient = (clientX: number, clientY: number) => {
      // A live read, because scrolling moves the box. Only runs while the
      // pointer is held down.
      const r = frame.getBoundingClientRect();
      const { dpr, cell, ox, oy } = layout();
      const px = (clientX - r.left) * dpr;
      const py = (clientY - r.top) * dpr;
      return { gx: (px - ox) / cell, gy: (py - oy) / cell };
    };

    // ── physics, backend-independent ──────────────────────────────────
    let last = performance.now();
    const step = (now: number) => {
      // Clamped: a backgrounded tab returns a huge dt and the spring explodes.
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      for (const c of cubes) {
        c.vx += -STIFF * c.dx * dt;
        c.vy += -STIFF * c.dy * dt;
        const damp = Math.exp(-DAMP * dt);
        c.vx *= damp;
        c.vy *= damp;
        c.dx += c.vx * dt;
        c.dy += c.vy * dt;
      }
      if (pointer.current.down) {
        const { gx, gy } = gridFromClient(pointer.current.x, pointer.current.y);
        shove(gx, gy, PUSH * dt);
      }
      if (nudge.current > 0) {
        nudge.current = 0;
        for (const c of cubes) {
          c.vx += (Math.random() - 0.5) * 26;
          c.vy += (Math.random() - 0.5) * 26;
        }
      }
    };

    /** Nothing is moving and nothing is about to push. A thousandth of a grid
     *  cell is far below one pixel at any size the box is drawn. */
    const EPS = 1e-3;
    const atRest = () =>
      !pointer.current.down &&
      nudge.current === 0 &&
      cubes.every(
        (c) =>
          Math.abs(c.dx) < EPS &&
          Math.abs(c.dy) < EPS &&
          Math.abs(c.vx) < EPS &&
          Math.abs(c.vy) < EPS,
      );

    // Always draws at least one frame, so a wake after a resize repaints the
    // canvas the resize cleared, even when nothing is moving.
    const tick = (now: number) => {
      raf = 0;
      if (disposed || !render) return;
      render(now);
      if (visible && !atRest()) raf = requestAnimationFrame(tick);
    };

    wake.current = () => {
      if (disposed || !render || !visible || raf) return;
      // Measured from now, or the first step after a long sleep would use the
      // full 1/20 s clamp and shove three times harder than a held drag does.
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };

    // ── backend: canvas 2d ────────────────────────────────────────────
    const start2d = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return false;
      setBackend("2d");
      const draw = () => {
        const { w, h, cell, ox, oy } = layout();
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        ctx.clearRect(0, 0, w, h);
        const s = cell * 0.88;
        const bevel = s * 0.3;
        for (const c of cubes) {
          const x = ox + (c.hx + c.dx) * cell;
          const y = oy + (c.hy + c.dy) * cell;
          // right face, then top, then the front — painter's order
          ctx.fillStyle = "oklch(48% 0.13 55)";
          ctx.beginPath();
          ctx.moveTo(x + s, y);
          ctx.lineTo(x + s + bevel, y - bevel);
          ctx.lineTo(x + s + bevel, y + s - bevel);
          ctx.lineTo(x + s, y + s);
          ctx.fill();
          ctx.fillStyle = "oklch(86% 0.13 55)";
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + bevel, y - bevel);
          ctx.lineTo(x + s + bevel, y - bevel);
          ctx.lineTo(x + s, y);
          ctx.fill();
          ctx.fillStyle = "oklch(74% 0.18 55)";
          ctx.fillRect(x, y, s, s);
        }
      };
      render = (now) => {
        step(now);
        draw();
      };
      wake.current();
      return true;
    };

    // ── backend: webgpu ───────────────────────────────────────────────
    const startGpu = async () => {
      const gpu = navigator.gpu;
      if (!gpu) return false;
      let adapter: GPUAdapter | null = null;
      try {
        adapter = await gpu.requestAdapter();
      } catch {
        return false;
      }
      if (!adapter || disposed) return false;

      try {
        device = await adapter.requestDevice();
      } catch {
        return false;
      }
      if (!device || disposed) return false;

      const ctx = canvas.getContext("webgpu");
      if (!ctx) return false;

      const format = gpu.getPreferredCanvasFormat();
      ctx.configure({ device, format, alphaMode: "premultiplied" });

      const shader = device.createShaderModule({ code: WGSL });
      const pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
          module: shader,
          entryPoint: "vs",
          buffers: [
            {
              arrayStride: 8,
              stepMode: "instance",
              attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
            },
          ],
        },
        fragment: {
          module: shader,
          entryPoint: "fs",
          targets: [{ format }],
        },
        primitive: { topology: "triangle-list" },
      });

      const instData = new Float32Array(cubes.length * 2);
      const instBuf = device.createBuffer({
        size: instData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      const uni = new Float32Array(6);
      const uniBuf = device.createBuffer({
        size: 32,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const bind = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniBuf } }],
      });

      setBackend("webgpu");

      render = (now) => {
        if (!device) return;
        step(now);

        const { w, h, cell, ox, oy } = layout();
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }

        for (let i = 0; i < cubes.length; i++) {
          instData[i * 2] = cubes[i].hx + cubes[i].dx;
          instData[i * 2 + 1] = cubes[i].hy + cubes[i].dy;
        }
        device.queue.writeBuffer(instBuf, 0, instData);

        // grid -> clip: x spans -1..1 across w, y is flipped.
        uni[0] = (cell / w) * 2;
        uni[1] = (cell / h) * 2;
        uni[2] = (ox / w) * 2 - 1;
        uni[3] = 1 - (oy / h) * 2;
        uni[4] = 0.88;
        device.queue.writeBuffer(uniBuf, 0, uni);

        const enc = device.createCommandEncoder();
        const pass = enc.beginRenderPass({
          colorAttachments: [
            {
              view: ctx.getCurrentTexture().createView(),
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
              loadOp: "clear",
              storeOp: "store",
            },
          ],
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bind);
        pass.setVertexBuffer(0, instBuf);
        // 18 vertices = three faces of two triangles. ONE draw call for every
        // cube on screen — which is the line the caption claims, so it has to
        // stay one.
        pass.draw(18, cubes.length);
        pass.end();
        device.queue.submit([enc.finish()]);
      };
      wake.current();
      return true;
    };

    // Try the GPU, fall back without ceremony. `startGpu` resolves false on
    // every failure path rather than throwing, so one `catch` is enough.
    const start = () => {
      started = true;
      void (async () => {
        let ok = false;
        try {
          ok = await startGpu();
        } catch {
          ok = false;
        }
        if (!ok && !disposed) start2d();
      })();
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (!visible) {
          cancelAnimationFrame(raf);
          raf = 0;
        } else if (!started) {
          start();
        } else {
          wake.current();
        }
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(frame);

    const ro = new ResizeObserver(() => {
      size = frame.getBoundingClientRect();
      wake.current();
    });
    ro.observe(frame);

    return () => {
      disposed = true;
      io.disconnect();
      ro.disconnect();
      cancelAnimationFrame(raf);
      wake.current = () => {};
      device?.destroy();
    };
  }, [shove]);

  const setFromEvent = (e: React.PointerEvent) => {
    pointer.current.x = e.clientX;
    pointer.current.y = e.clientY;
  };

  const label =
    backend === "webgpu"
      ? "WebGPU · instanced, one draw call"
      : backend === "2d"
        ? "Canvas 2D · no GPU on this machine"
        : "Starting…";

  return (
    <div
      ref={frameRef}
      className="cubes"
      tabIndex={0}
      role="img"
      aria-label={`The word WEBGPU built from ${model.current.cubes.length} cubes. Drag or press a key to scatter them; they spring back.`}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        setFromEvent(e);
        pointer.current.down = true;
        wake.current();
      }}
      onPointerMove={(e) => {
        if (pointer.current.down) setFromEvent(e);
      }}
      onPointerUp={() => {
        pointer.current.down = false;
      }}
      onPointerCancel={() => {
        pointer.current.down = false;
      }}
      onPointerLeave={() => {
        pointer.current.down = false;
      }}
      onKeyDown={(e) => {
        // Any key scatters, so a keyboard user gets the same toy. Arrow keys
        // and space would otherwise scroll the page out from under them.
        if (e.key === " " || e.key.startsWith("Arrow")) e.preventDefault();
        nudge.current = 1;
        wake.current();
      }}
    >
      <canvas ref={canvasRef} className="cubes__canvas" />
      <span className="cubes__backend">{label}</span>
      <span className="cubes__count">
        <span className="fig">{model.current.cubes.length}</span> cubes
      </span>
    </div>
  );
}
