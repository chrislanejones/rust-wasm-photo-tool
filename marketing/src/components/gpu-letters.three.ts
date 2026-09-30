/* The WEBGPU cube word, drawn through three's WebGPURenderer.
 *
 * This file is a chunk boundary, like the blog posts' `*.three.ts`: CubeLetters
 * loads it with a dynamic `import()` the first time the section nears the
 * viewport, so three.js never ships in the home page's first bundle. It is
 * ported from the design's `gpu-letters.js` custom element, minus the DOM
 * setup, which React owns.
 *
 * ⚠️ `three/webgpu`, never `three`. The WebGPU build carries its own copy of
 * three's core, and mixing the two in one scene breaks every `instanceof` the
 * renderer does. HorseTrot's chunk imports from the same place.
 */
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  DynamicDrawUsage,
  Euler,
  Group,
  InstancedMesh,
  MathUtils,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Plane,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGPURenderer,
} from "three/webgpu";

export type Backend = "webgpu" | "webgl" | "none";

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
const GW = 5;
const GH = 7;
const GAP = 1;

/** Offsets and velocities are in GRID units, so a resize never touches the physics. */
interface Cube {
  hx: number;
  hy: number;
  dx: number;
  dy: number;
  dz: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
  sv: number;
}

function buildCubes(): { cubes: Cube[]; cols: number; rows: number } {
  const cubes: Cube[] = [];
  let x = 0;
  for (const ch of WORD) {
    const g = GLYPHS[ch];
    for (let r = 0; r < GH; r++) {
      for (let c = 0; c < GW; c++) {
        if (g[r][c] === "#") cubes.push({ hx: x + c, hy: r, dx: 0, dy: 0, dz: 0, vx: 0, vy: 0, vz: 0, spin: 0, sv: 0 });
      }
    }
    x += GW + GAP;
  }
  return { cubes, cols: x - GAP, rows: GH };
}

/** Counted without three, so the label can print it before the chunk loads. */
export const CUBE_COUNT = [...WORD].reduce(
  (n, ch) => n + GLYPHS[ch].join("").split("").filter((c) => c === "#").length,
  0,
);

/* Spring constants, the same feel as the old 2D version. REACH in grid units. */
const STIFF = 26;
const DAMP = 6.5;
const REACH = 3.4;
const PUSH = 210;
const HOVER = 34;
/** --color-accent, oklch(74% 0.18 55), in linear sRGB. */
const ACCENT = new Color(0.996, 0.451, 0.106);

export interface GpuLettersScene {
  /** Resolves with the backend three actually got. "none" means no context. */
  ready: Promise<Backend>;
  setVisible(v: boolean): void;
  pointerMove(clientX: number, clientY: number): void;
  pointerLeave(): void;
  pointerDown(clientX: number, clientY: number): void;
  pointerUp(): void;
  nudge(): void;
  fit(): void;
  dispose(): void;
}

export function createGpuLetters(host: HTMLElement, canvas: HTMLCanvasElement): GpuLettersScene {
  const model = buildCubes();
  const pointer = { x: 0, y: 0, nx: 0, ny: 0, over: false, down: false };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let renderer: WebGPURenderer | null = null;
  let disposed = false;
  let visible = true;
  let raf = 0;
  let nudge = 0;
  let last = 0;
  let t0 = 0;

  const scene = new Scene();
  const camera = new PerspectiveCamera(28, 16 / 9, 0.1, 400);
  const group = new Group();
  scene.add(group);
  const ox = -(model.cols - 1) / 2;
  const oy = (model.rows - 1) / 2;
  const dummy = new Object3D();
  const euler = new Euler();
  const ray = new Raycaster();
  const plane = new Plane(new Vector3(0, 0, 1), 0);
  const hit = new Vector3();
  const ndc = new Vector2();
  const normal = new Vector3();
  const tilt = { x: 0, y: 0 };

  const geo = new BoxGeometry(0.86, 0.86, 0.86);
  const mat = new MeshStandardMaterial({ color: ACCENT, roughness: 0.5, metalness: 0.04 });
  const mesh = new InstancedMesh(geo, mat, model.cubes.length);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  const tint = new Color();
  for (let i = 0; i < model.cubes.length; i++) {
    tint.copy(ACCENT).multiplyScalar(0.92 + Math.random() * 0.16);
    mesh.setColorAt(i, tint);
  }
  group.add(mesh);

  const key = new DirectionalLight(0xffffff, 2.4);
  key.position.set(-6, 12, 14);
  scene.add(key);
  const fill = new DirectionalLight(0xffd9b8, 0.7);
  fill.position.set(10, -6, 8);
  scene.add(fill);
  scene.add(new AmbientLight(0xffffff, 0.42));

  const setPointer = (clientX: number, clientY: number) => {
    const r = host.getBoundingClientRect();
    pointer.x = clientX;
    pointer.y = clientY;
    pointer.nx = ((clientX - r.left) / r.width) * 2 - 1;
    pointer.ny = -(((clientY - r.top) / r.height) * 2 - 1);
  };

  /** Pointer → grid coordinates on the letters' own plane, tilt included. */
  const gridAt = () => {
    ndc.set(pointer.nx, pointer.ny);
    ray.setFromCamera(ndc, camera);
    normal.set(0, 0, 1).applyQuaternion(group.quaternion);
    plane.setFromNormalAndCoplanarPoint(normal, group.position);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    group.worldToLocal(hit);
    return { gx: hit.x - ox, gy: oy - hit.y };
  };

  const shove = (gx: number, gy: number, strength: number, lift: number) => {
    for (const c of model.cubes) {
      const dx = c.hx + c.dx - gx;
      const dy = c.hy + c.dy - gy;
      const d2 = dx * dx + dy * dy;
      if (d2 > REACH * REACH) continue;
      const d = Math.sqrt(d2) || 1e-4;
      const fall = 1 - d / REACH;
      const f = (strength * fall * fall) / d;
      c.vx += dx * f;
      c.vy += dy * f;
      c.vz += lift * fall * fall;
      c.sv += (Math.random() - 0.5) * lift * fall;
    }
  };

  const tick = (now: number) => {
    raf = 0;
    if (!renderer || disposed) return;
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    const t = (now - t0) / 1000;
    const { cubes } = model;

    if (pointer.down) {
      const g = gridAt();
      if (g) shove(g.gx, g.gy, PUSH * dt, 40 * dt);
    } else if (pointer.over) {
      const g = gridAt();
      if (g) shove(g.gx, g.gy, HOVER * dt, 22 * dt);
    }
    if (nudge) {
      nudge = 0;
      for (const c of cubes) {
        c.vx += (Math.random() - 0.5) * 26;
        c.vy += (Math.random() - 0.5) * 26;
        c.vz += Math.random() * 18;
        c.sv += (Math.random() - 0.5) * 30;
      }
    }

    const damp = Math.exp(-DAMP * dt);
    for (const c of cubes) {
      c.vx += -STIFF * c.dx * dt;
      c.vy += -STIFF * c.dy * dt;
      c.vz += -STIFF * c.dz * dt;
      c.sv += -STIFF * 0.6 * c.spin * dt;
      c.vx *= damp;
      c.vy *= damp;
      c.vz *= damp;
      c.sv *= damp;
      c.dx += c.vx * dt;
      c.dy += c.vy * dt;
      c.dz += c.vz * dt;
      c.spin += c.sv * dt;
    }

    // The whole word leans toward the pointer, and breathes a little on its own.
    const tx = pointer.over ? -pointer.ny * 0.14 : Math.sin(t * 0.5) * 0.04;
    const ty = pointer.over ? pointer.nx * 0.26 : Math.sin(t * 0.37) * 0.07;
    tilt.x += (tx - tilt.x) * Math.min(1, dt * 4);
    tilt.y += (ty - tilt.y) * Math.min(1, dt * 4);
    group.rotation.set(tilt.x, tilt.y, 0);

    const wave = reduced ? 0 : 0.18;
    for (let i = 0; i < cubes.length; i++) {
      const c = cubes[i];
      const wz = wave * Math.sin(t * 1.6 + c.hx * 0.32 + c.hy * 0.45);
      dummy.position.set(ox + c.hx + c.dx, oy - c.hy - c.dy, c.dz + wz);
      euler.set(-c.dy * 0.9 + c.spin, c.dx * 0.9, c.dz * 0.35);
      dummy.rotation.copy(euler);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
    if (visible) raf = requestAnimationFrame(tick);
  };

  const wake = () => {
    if (!renderer || !visible || raf || disposed) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };

  const fit = () => {
    if (!renderer) return;
    const r = host.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    const half = Math.tan(MathUtils.degToRad(camera.fov / 2));
    const d = Math.max((model.rows / 2 + 1.6) / half, (model.cols / 2 + 1.6) / (half * camera.aspect));
    camera.position.set(0, d * 0.09, d);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  };

  const ready = (async (): Promise<Backend> => {
    let r: WebGPURenderer;
    try {
      r = new WebGPURenderer({ canvas, antialias: true, alpha: true });
      await r.init();
    } catch (err) {
      console.warn("gpu-letters: renderer failed", err);
      return "none";
    }
    if (disposed) {
      r.dispose();
      return "none";
    }
    renderer = r;
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    r.setClearColor(new Color(0x000000), 0);
    fit();
    last = t0 = performance.now();
    wake();
    // Reported, never assumed: "webgpu" only when a GPUDevice was acquired.
    const backend = (r as unknown as { backend?: { isWebGPUBackend?: boolean } }).backend;
    return backend?.isWebGPUBackend ? "webgpu" : "webgl";
  })();

  return {
    ready,
    setVisible(v) {
      visible = v;
      if (!v) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else wake();
    },
    pointerMove(x, y) {
      setPointer(x, y);
      pointer.over = true;
      wake();
    },
    pointerLeave() {
      pointer.over = false;
      pointer.down = false;
    },
    pointerDown(x, y) {
      setPointer(x, y);
      pointer.down = true;
      const g = gridAt();
      if (g) shove(g.gx, g.gy, 9 * 3.2, 6 * 3.2);
      wake();
    },
    pointerUp() {
      pointer.down = false;
    },
    nudge() {
      nudge = 1;
      wake();
    },
    fit() {
      fit();
      wake();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      geo.dispose();
      mat.dispose();
      renderer?.dispose();
      renderer = null;
    },
  };
}
