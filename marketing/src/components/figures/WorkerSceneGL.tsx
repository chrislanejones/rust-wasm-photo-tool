import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FROZEN_T, GL, ease, seg } from "./figureTokens";
import type { SceneKind } from "./WorkerScene";
import { useMediaQuery } from "../../useMediaQuery";

/* The three 3D figures for /blog/engine-in-a-worker.
 *
 * Reached only through `WorkerScene`'s lazy import — see that file for the four
 * gates in front of this one. By the time anything here runs we are in a
 * browser, near the viewport, and WebGL is available.
 *
 * ── every scene is a pure function of one number ──────────────────────────
 * Seconds since mount, and nothing else. Nothing accumulates, nothing
 * integrates a delta, no object carries state between frames. That is worth the
 * discipline it costs, because it is what makes the reduced-motion path honest:
 * render once at FROZEN_T and the reader gets a real frame of the animation —
 * a moment the moving scene actually passes through — rather than a second,
 * separately-maintained drawing that can drift away from it.
 *
 * ── the one convention ────────────────────────────────────────────────────
 * The thread boundary is x = 0 in all three scenes. Main thread is negative x,
 * worker positive, every time. A reader who works out which side is which in
 * the first figure does not have to do it again.
 */

/* ── the clock ─────────────────────────────────────────────────────────────
 * Context carries the frozen FLAG, never a time value. A time value in context
 * would re-render the tree sixty times a second, which is the one thing a
 * render loop must not do. Each animated leaf reads the flag once at mount and
 * then pulls time off R3F's shared clock inside useFrame, where it is free.
 */
const FrozenContext = createContext(false);
const useFrozen = () => useContext(FrozenContext);

type Vec3 = [number, number, number];

/* ── labels ───────────────────────────────────────────────────────────────
 * The scenes' text is DOM, not textures in the scene: it stays crisp at any
 * device pixel ratio and reads at the same size whether the figure is 1100px
 * wide or 340. The cost is that its position has to be projected out of the
 * camera every frame, which is `LabelProjector`'s whole job.
 */
interface LabelSpec {
  text: string;
  /** Live, and a scene may move it — that is how the two labels on the
   *  travelling surface ride along with it instead of recomputing the same arc
   *  a second time and drifting out of step. */
  anchor: THREE.Vector3;
  /** A `var(--color-*)` reference. Raw color is banned outside tokens.css, and
   *  unlike the WebGL materials these labels are DOM and can honor that. */
  color?: string;
  size?: number;
  weight?: number;
  /** Monospace unless told otherwise — most of these are code or wire format. */
  mono?: boolean;
  /** Percentage self-offset: -50/-50 centres on the projected point, and a
   *  label nudges off its anchor from there. */
  dx?: number;
  dy?: number;
  /** For labels that only mean anything once something has happened. */
  show?: (t: number) => boolean;
}

const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Label ink. The same five colors the materials use, on the DOM side where the
 *  real custom properties are reachable. */
const INK = {
  ink: "var(--color-ink)",
  ink2: "var(--color-ink-2)",
  ink3: "var(--color-ink-3)",
  accent: "var(--color-accent)",
  accent2: "var(--color-accent-2)",
} as const;

function LabelProjector({ labels, host }: { labels: LabelSpec[]; host: RefObject<HTMLDivElement | null> }) {
  const frozen = useFrozen();
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock, camera, size }) => {
    const nodes = host.current?.children;
    if (!nodes) return;
    const t = frozen ? FROZEN_T : clock.elapsedTime;

    labels.forEach((label, i) => {
      const el = nodes[i] as HTMLElement | undefined;
      if (!el) return;

      // A hidden label is skipped rather than projected — this runs per label
      // per frame, and the threads scene has fourteen of them.
      if (label.show && !label.show(t)) {
        el.style.visibility = "hidden";
        return;
      }

      v.copy(label.anchor).project(camera);
      el.style.left = `${((v.x + 1) / 2) * size.width}px`;
      el.style.top = `${((1 - v.y) / 2) * size.height}px`;
      el.style.visibility = "visible";
    });
  });

  return null;
}

/** The DOM half. Lives outside <Canvas>, in document order after it, and is
 *  positioned entirely by the projector above — so every label starts
 *  `visibility: hidden` (in CSS) and is only shown once it has a real place to
 *  be. Otherwise all of them paint at the top-left corner for one frame. */
function LabelLayer({ labels, host }: { labels: LabelSpec[]; host: RefObject<HTMLDivElement | null> }) {
  return (
    <div className="fig-scene__labels" ref={host}>
      {labels.map((l, i) => (
        <span
          key={`${l.text}-${i}`}
          className="fig-scene__label"
          data-sans={l.mono === false ? true : undefined}
          style={{
            color: l.color ?? INK.ink2,
            fontSize: `${l.size ?? 12}px`,
            fontWeight: l.weight ?? 500,
            transform: `translate(${l.dx ?? -50}%, ${l.dy ?? -50}%)`,
          }}
        >
          {l.text}
        </span>
      ))}
    </div>
  );
}

/* ── building blocks ──────────────────────────────────────────────────────── */

/** A box's edges, as their own geometry.
 *
 * R3F disposes what it creates from JSX, but an EdgesGeometry has to be built
 * by hand from a source box — so it is disposed by hand too. The source box is
 * thrown away at once: EdgesGeometry has already copied the positions it needs
 * out of it. */
function useBoxEdges(w: number, h: number, d: number): THREE.EdgesGeometry {
  const edges = useMemo(() => {
    const box = new THREE.BoxGeometry(w, h, d);
    const e = new THREE.EdgesGeometry(box);
    box.dispose();
    return e;
  }, [w, h, d]);

  useEffect(() => () => edges.dispose(), [edges]);
  return edges;
}

interface SlabProps {
  size: Vec3;
  color: number;
  edge?: number;
  opacity?: number;
  transparent?: boolean;
  emissive?: number;
  emissiveIntensity?: number;
  position?: Vec3;
  visible?: boolean;
  meshRef?: RefObject<THREE.Mesh | null>;
  /** The edge lines, for the one scene that recolors them mid-animation. */
  edgeRef?: RefObject<THREE.LineSegments | null>;
}

/** The unit all three scenes are built from: a solid box with its edges drawn.
 *
 * The edges are not decoration. Under this lighting a dark box on dark ground
 * has no silhouette at all, and without them the figures read as clay rather
 * than as diagram. */
function Slab({
  size,
  color,
  edge = GL.rule,
  opacity = 1,
  transparent,
  emissive,
  emissiveIntensity,
  position,
  visible,
  meshRef,
  edgeRef,
}: SlabProps) {
  const edges = useBoxEdges(size[0], size[1], size[2]);
  /* Spread, rather than `emissive={emissive}` with an undefined default.
   * R3F sets a Color-valued prop by calling `.set()` on the instance already
   * there, and `THREE.Color.prototype.set(undefined)` does not mean "leave it
   * alone" — it falls through to `setStyle`, which warns and leaves the color
   * wrong. A prop that is absent should be absent. */
  const glow = emissive === undefined ? {} : { emissive, emissiveIntensity };
  return (
    <mesh ref={meshRef} position={position} visible={visible}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={0.85}
        metalness={0.05}
        transparent={transparent ?? opacity < 1}
        opacity={opacity}
        {...glow}
      />
      <lineSegments ref={edgeRef} geometry={edges}>
        <lineBasicMaterial color={edge} transparent opacity={0.9} />
      </lineSegments>
    </mesh>
  );
}

/** A box that is only its dashed edges — something absent, or somewhere a thing
 *  used to be. The detached buffer in the move row and the emptied <canvas>
 *  element after the handover are both this. */
function WireBox({
  size,
  color,
  position,
  objRef,
  visible = true,
}: {
  size: Vec3;
  color: number;
  position?: Vec3;
  objRef?: RefObject<THREE.LineSegments | null>;
  visible?: boolean;
}) {
  const obj = useMemo(() => {
    const box = new THREE.BoxGeometry(size[0], size[1], size[2]);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineDashedMaterial({ color, dashSize: 0.12, gapSize: 0.08, transparent: true, opacity: 0.8 }),
    );
    // Without this every dash length is zero and the material draws solid.
    line.computeLineDistances();
    return line;
  }, [size, color]);

  useEffect(
    () => () => {
      obj.geometry.dispose();
      (obj.material as THREE.Material).dispose();
    },
    [obj],
  );

  return <primitive object={obj} position={position} visible={visible} ref={objRef} />;
}

/** The thread boundary, and the seams inside a plane.
 *
 * Dashed is load-bearing, the same way it is on the architecture map: this is a
 * line that messages cross, not a wall. The one genuine wall in these figures —
 * WASM memory refusing to detach — is drawn as a chain instead, because it is
 * the only thing here that really does not let anything through. */
function DashedSegment({ from, to, color }: { from: Vec3; to: Vec3; color: number }) {
  const obj = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from[0], from[1], from[2]),
      new THREE.Vector3(to[0], to[1], to[2]),
    ]);
    const line = new THREE.Line(g, new THREE.LineDashedMaterial({ color, dashSize: 0.18, gapSize: 0.12 }));
    line.computeLineDistances();
    return line;
  }, [from, to, color]);

  useEffect(
    () => () => {
      obj.geometry.dispose();
      (obj.material as THREE.Material).dispose();
    },
    [obj],
  );

  return <primitive object={obj} />;
}

/* ── packets ──────────────────────────────────────────────────────────────
 * The moving traffic, and shape is meaning: a cube is a call, a sphere is a
 * reply, a disc is a blit. Consistent across all three scenes, so the blit
 * discs are recognisable as the one kind of traffic that never has a partner
 * coming back.
 */
type PacketShape = "cube" | "sphere" | "disc";

interface StreamProps {
  from: Vec3;
  to: Vec3;
  color: number;
  shape: PacketShape;
  /** Seconds between departures. */
  period: number;
  phase?: number;
  /** Seconds in transit. */
  duration?: number;
  /** How high the arc rises at its midpoint. */
  lift?: number;
  count?: number;
  size?: number;
  /** For streams that only run during part of a scene's cycle. */
  active?: (t: number) => boolean;
}

/** A line of packets crossing the boundary on a shallow arc, `period` apart.
 *
 * One mesh per in-flight packet, not an InstancedMesh: `count` is four to six.
 * Instancing is the right call at a hundred and is more machinery than six
 * earns. */
function PacketStream({
  from,
  to,
  color,
  shape,
  period,
  phase = 0,
  duration = 0.9,
  lift = 0.5,
  count = 4,
  size = 0.14,
  active,
}: StreamProps) {
  const frozen = useFrozen();
  const group = useRef<THREE.Group>(null);

  const a = useMemo(() => new THREE.Vector3(from[0], from[1], from[2]), [from]);
  const b = useMemo(() => new THREE.Vector3(to[0], to[1], to[2]), [to]);

  useFrame(({ clock }) => {
    const packets = group.current?.children;
    if (!packets) return;
    const t = frozen ? FROZEN_T : clock.elapsedTime;
    const running = active ? active(t) : true;
    const span = period * count;

    packets.forEach((p, i) => {
      if (!running) {
        p.visible = false;
        return;
      }
      // Each packet departs one `period` behind the one before it, and the
      // whole line wraps every `span`. The double modulo keeps a negative
      // phase in range.
      const local = (((t - phase + i * period) % span) + span) % span;
      const u = local / duration;
      if (u > 1) {
        p.visible = false;
        return;
      }
      p.visible = true;
      p.position.lerpVectors(a, b, ease(u));
      // The arc. Nothing crosses the seam in a straight line — the lift is what
      // keeps two counter-flowing streams from reading as one.
      p.position.y += Math.sin(u * Math.PI) * lift;
      p.rotation.y = u * Math.PI * 2;
    });
  });

  return (
    <group ref={group}>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} visible={false}>
          {shape === "cube" && <boxGeometry args={[size, size, size]} />}
          {shape === "disc" && <cylinderGeometry args={[size * 0.9, size * 0.9, size * 0.25, 18]} />}
          {shape === "sphere" && <sphereGeometry args={[size * 0.6, 14, 10]} />}
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/* ── lighting ─────────────────────────────────────────────────────────────
 * Warm key from the upper left, a dim amber fill from behind on the worker
 * side, and a hemisphere so the undersides do not go to black. Identical in
 * all three scenes on purpose: they sit one after another down a single page,
 * and a light that moved between them would make the figures read as unrelated.
 */
function Lighting() {
  return (
    <>
      <hemisphereLight args={[0xfff3e6, 0x2a1d17, 1.35]} />
      <directionalLight color={0xffe7cc} intensity={1.6} position={[-4, 8, 6]} />
      <directionalLight color={GL.accent} intensity={0.35} position={[6, 3, -4]} />
    </>
  );
}

/* ═══════════════════ scene 1 · where things live ═══════════════════════════
 * The standing picture the rest of the post refers back to: both planes, what
 * sits on each, and the three kinds of traffic. The blit is drawn on its own
 * lane at the front, away from the call/reply pair, because the argument of the
 * post is that it is not like them — no id, no reply, no queue.
 */

const THREADS_LABELS: LabelSpec[] = [
  { text: "Main thread", anchor: at(-2.9, 0.1, -2.4), color: INK.ink, size: 13, weight: 700, dy: -140, mono: false },
  { text: "React · pointer input · layout", anchor: at(-2.9, 0.1, -2.4), color: INK.ink3, dy: -30 },
  { text: "Engine worker", anchor: at(2.9, 0.1, -2.4), color: INK.accent, size: 13, weight: 700, dy: -140, mono: false },
  { text: "engine · own wasm memory · canvas", anchor: at(2.9, 0.1, -2.4), color: INK.ink3, dy: -30 },
  { text: "postMessage", anchor: at(0, 1.95, -2.6), color: INK.ink3, dy: -110 },
  { text: "UI", anchor: at(-3.6, 0.62, -1.0), color: INK.ink2, size: 11 },
  { text: "input", anchor: at(-1.9, 0.55, -1.0), color: INK.ink2, size: 11 },
  { text: "<canvas> — element stays, surface gone", anchor: at(-2.9, 0.18, 1.0), color: INK.ink3, size: 11, dy: 90 },
  { text: "engine", anchor: at(3.3, 1.08, -1.0), color: INK.ink, size: 11 },
  { text: "linear memory", anchor: at(3.3, 0.1, -1.0), color: INK.ink2, size: 11, dy: 110 },
  { text: "OffscreenCanvas · putImageData here", anchor: at(2.9, 0.22, 1.0), color: INK.accent, size: 11, dy: 90 },
  // The three wire-format labels wait until there is traffic for them to name.
  {
    text: "call { id, method, args } →",
    anchor: at(0, 1.15, -0.55),
    color: INK.accent,
    size: 11,
    dy: -160,
    show: (t) => t > 1.2,
  },
  {
    text: "← reply { id, ok, value }",
    anchor: at(0, 0.9, -0.05),
    color: INK.ink2,
    size: 11,
    dy: 40,
    show: (t) => t > 1.2,
  },
  {
    text: "blit → (no reply, not queued)",
    anchor: at(0, 0.8, 1.05),
    color: INK.accent2,
    size: 11,
    dy: 90,
    show: (t) => t > 1.2,
  },
];

function ThreadsScene() {
  const frozen = useFrozen();
  const surface = useRef<THREE.Mesh>(null);

  useFrame(({ clock, camera }) => {
    const t = frozen ? FROZEN_T : clock.elapsedTime;

    // The painted surface breathes, so the eye settles on the one object doing
    // the work this post is about.
    const material = surface.current?.material as THREE.MeshStandardMaterial | undefined;
    if (material) material.emissiveIntensity = 0.25 + 0.2 * Math.sin(t * 6);

    // A slow drift, not an orbit: enough parallax to read the layout as three
    // dimensions, not enough to make a reader wait for a better angle.
    camera.position.x = 0.3 + Math.sin(t * 0.25) * 0.9;
    camera.position.z = 9.2 + Math.cos(t * 0.25) * 0.3;
    camera.lookAt(0, 0.2, 0);
  });

  return (
    <>
      {/* the two planes, and the seam */}
      <Slab size={[4.2, 0.18, 3.6]} color={GL.paper3} position={[-2.9, 0, 0]} />
      <Slab size={[4.2, 0.18, 3.6]} color={GL.paper4} edge={GL.accent} position={[2.9, 0, 0]} />
      <DashedSegment from={[0, 0.05, -2.6]} to={[0, 0.05, 2.6]} color={GL.ink3} />
      <DashedSegment from={[0, 0.05, -2.6]} to={[0, 1.9, -2.6]} color={GL.ink3} />

      {/* main thread: the UI, the pointer, and the element whose surface left */}
      <Slab size={[1.5, 0.5, 1.0]} color={GL.paper4} position={[-3.6, 0.34, -1.0]} />
      <Slab size={[0.7, 0.42, 0.7]} color={GL.paper4} position={[-1.9, 0.3, -1.0]} />
      <WireBox size={[1.9, 0.08, 1.15]} color={GL.ink3} position={[-2.9, 0.14, 1.0]} />

      {/* worker: the engine over its own memory, and the surface it paints */}
      <Slab size={[1.9, 0.62, 1.1]} color={GL.paper2} edge={GL.accent} position={[3.3, 0.4, -1.0]} />
      <Slab
        size={[1.1, 0.34, 0.7]}
        color={GL.accent}
        edge={GL.accent}
        position={[3.3, 0.88, -1.0]}
        emissive={GL.accent}
        emissiveIntensity={0.25}
      />
      <Slab size={[1.9, 0.08, 1.15]} color={GL.paper3} edge={GL.accent} position={[2.9, 0.14, 1.0]} />
      <Slab
        size={[1.6, 0.02, 0.9]}
        color={GL.accent}
        edge={GL.accent}
        opacity={0.85}
        position={[2.9, 0.2, 1.0]}
        emissive={GL.accent}
        emissiveIntensity={0.25}
        meshRef={surface}
      />
      {/* memory → surface: the path the pixels take, entirely worker-side */}
      <DashedSegment from={[3.3, 0.1, -0.45]} to={[2.9, 0.1, 0.4]} color={GL.accent} />

      {/* calls out, replies back, and blits on their own lane */}
      <PacketStream
        from={[-1.5, 0.55, -0.55]}
        to={[2.0, 0.55, -0.55]}
        color={GL.accent}
        shape="cube"
        period={0.55}
        duration={0.8}
        lift={0.7}
      />
      <PacketStream
        from={[2.0, 0.45, -0.05]}
        to={[-1.5, 0.45, -0.05]}
        color={GL.ink3}
        shape="sphere"
        period={0.55}
        phase={0.75}
        duration={0.8}
        lift={0.35}
      />
      <PacketStream
        from={[-1.6, 0.4, 1.05]}
        to={[2.0, 0.4, 1.05]}
        color={GL.accent2}
        shape="disc"
        period={0.3}
        duration={0.6}
        lift={0.25}
        count={6}
      />
    </>
  );
}

/* ═══════════════════ scene 2 · three doors, one wall ═══════════════════════
 * Four rows, the same journey attempted four ways, all on one six-second cycle
 * so they can be compared at a glance: copy crawls and bills by the byte, move
 * is over before you see it and leaves a husk, share never travels because it
 * was never on one side, and WASM memory strains against a chain and snaps
 * back red.
 */

/** The z of each row, front to back. */
const DOOR_ROWS: number[] = [-2.85, -0.95, 0.95, 2.85];
const DOORS_PERIOD = 6;

const DOORS = [
  { name: "Copy", sub: "structured clone · ∝ payload size", verdict: "two independent values" },
  { name: "Move", sub: "transfer list · O(1), sender detached", verdict: "byteLength → 0 on the sender" },
  { name: "Share", sub: "SharedArrayBuffer · same bytes, both sides", verdict: "needs COOP + COEP · not used" },
  { name: "WASM memory", sub: "[[ArrayBufferDetachKey]] · cannot detach", verdict: "Firefox/Safari throw · Chrome copies" },
];

/** The wall row's throw, as a window on the normalized cycle. Shared by the
 *  material flash and the label so the two cannot disagree. */
const wallFlash = (t: number): number => {
  const c = (t % DOORS_PERIOD) / DOORS_PERIOD;
  return c > 0.36 && c < 0.62 ? 1 - (c - 0.36) / 0.26 : 0;
};

const DOORS_LABELS: LabelSpec[] = [
  { text: "sender", anchor: at(-2.5, 0.06, -3.6), color: INK.ink3, dy: -60 },
  { text: "receiver (worker)", anchor: at(2.5, 0.06, -3.6), color: INK.accent, dy: -60 },
  ...DOORS.flatMap((door, i): LabelSpec[] => {
    // The wall is the row that does not work, and is coloured as such.
    const wall = i === 3;
    return [
      {
        text: door.name,
        anchor: at(-3.85, 0.1, DOOR_ROWS[i]),
        color: wall ? INK.accent2 : INK.ink,
        size: 13,
        weight: 700,
        dx: -100,
        dy: -90,
        mono: false,
      },
      { text: door.sub, anchor: at(-3.85, 0.1, DOOR_ROWS[i]), color: INK.ink3, size: 11, dx: -100, dy: 10 },
      {
        text: door.verdict,
        anchor: at(3.85, 0.1, DOOR_ROWS[i]),
        color: wall ? INK.accent2 : INK.ink2,
        size: 11,
        dx: 0,
        dy: -50,
      },
    ];
  }),
  {
    text: "TypeError",
    anchor: at(0.2, 0.9, DOOR_ROWS[3]),
    color: INK.accent2,
    size: 12,
    weight: 700,
    show: (t) => wallFlash(t) > 0,
  },
];

function DoorsScene() {
  const frozen = useFrozen();

  const clone = useRef<THREE.Mesh>(null);
  const wake = useRef<THREE.Mesh>(null);
  const moved = useRef<THREE.Mesh>(null);
  const ghost = useRef<THREE.LineSegments>(null);
  const shared = useRef<THREE.Mesh>(null);
  const wall = useRef<THREE.Mesh>(null);
  const chain = useRef<THREE.Group>(null);

  // Allocated once. A lerp target rebuilt per frame is sixty Colors a second
  // for a value that only ever runs between the same two ends.
  const palette = useMemo(
    () => ({ red: new THREE.Color(GL.accent2), base: new THREE.Color(GL.paper2), scratch: new THREE.Color() }),
    [],
  );

  useFrame(({ clock }) => {
    const tt = frozen ? FROZEN_T : clock.elapsedTime;
    const t = (tt % DOORS_PERIOD) / DOORS_PERIOD;

    /* copy — the original never moves. The clone crosses slowly, and the wake
       behind it is the bill: it grows with every byte travelled. */
    const cu = seg(t, 0.15, 0.85);
    if (clone.current) {
      const inFlight = t > 0.15 && t < 0.97;
      clone.current.visible = inFlight;
      clone.current.position.x = -2.5 + 5 * cu;
      (clone.current.material as THREE.MeshStandardMaterial).opacity = t < 0.2 ? (t - 0.15) / 0.05 : 1;

      if (wake.current) {
        wake.current.visible = inFlight;
        wake.current.position.x = (-2.5 + clone.current.position.x) / 2;
        wake.current.scale.x = Math.max(0.01, (clone.current.position.x + 2.5) / 0.9);
      }
    }

    /* move — the same distance in a quarter of the time, and what is left
       behind is an outline: the sender still holds a reference, and reading
       through it throws. */
    const mu = seg(t, 0.15, 0.4);
    if (moved.current) moved.current.position.x = t >= 0.97 ? -2.5 : -2.5 + 5 * mu;
    if (ghost.current) ghost.current.visible = t > 0.17 && t < 0.97;

    /* share — nothing travels, because the block was never on one side. The
       pulse runs on absolute time so it plainly is not part of the cycle the
       other three rows are on. */
    const sharedMaterial = shared.current?.material as THREE.MeshStandardMaterial | undefined;
    if (sharedMaterial) sharedMaterial.emissiveIntensity = 0.12 + 0.18 * (0.5 + 0.5 * Math.sin(tt * 4));

    /* the wall — it pulls, it gets nowhere, it comes back red. */
    const pull = t > 0.15 && t < 0.42 ? Math.sin(((t - 0.15) / 0.27) * Math.PI) * 0.55 : 0;
    const flash = wallFlash(tt);
    if (wall.current) {
      wall.current.position.x = -2.5 + pull;
      const material = wall.current.material as THREE.MeshStandardMaterial;
      material.color.copy(palette.scratch.copy(palette.base).lerp(palette.red, flash * 0.7));
      material.emissive = palette.red;
      material.emissiveIntensity = flash * 0.5;

      // The links spread to span whatever gap the strain has opened up.
      const reach = (wall.current.position.x - 0.65 + 3.4) / 4;
      chain.current?.children.forEach((link, i) => {
        link.position.set(-3.35 + (i + 0.5) * reach, 0.5, DOOR_ROWS[3]);
      });
    }
  });

  return (
    <>
      {/* a landing pad each side of every row */}
      {DOOR_ROWS.map((z) => (
        <group key={z}>
          <Slab size={[2.4, 0.12, 1.35]} color={GL.paper3} position={[-2.5, 0, z]} />
          <Slab size={[2.4, 0.12, 1.35]} color={GL.paper4} edge={GL.accent} position={[2.5, 0, z]} />
        </group>
      ))}
      <DashedSegment from={[0, 0.04, -3.7]} to={[0, 0.04, 3.7]} color={GL.ink3} />

      {/* copy: the original stays, the clone crosses, the wake is the cost */}
      <Slab size={[0.9, 0.55, 0.9]} color={GL.paper2} edge={GL.ink2} position={[-2.5, 0.34, DOOR_ROWS[0]]} />
      <Slab
        size={[0.9, 0.55, 0.9]}
        color={GL.paper2}
        edge={GL.ink2}
        transparent
        position={[-2.5, 0.34, DOOR_ROWS[0]]}
        visible={false}
        meshRef={clone}
      />
      <Slab
        size={[0.9, 0.02, 0.9]}
        color={GL.accent}
        edge={GL.accent}
        opacity={0.35}
        position={[-2.5, 0.07, DOOR_ROWS[0]]}
        visible={false}
        meshRef={wake}
      />

      {/* move: one block, and the husk it leaves */}
      <Slab
        size={[0.9, 0.55, 0.9]}
        color={GL.paper2}
        edge={GL.ink2}
        position={[-2.5, 0.34, DOOR_ROWS[1]]}
        meshRef={moved}
      />
      <WireBox
        size={[0.9, 0.55, 0.9]}
        color={GL.ink3}
        position={[-2.5, 0.34, DOOR_ROWS[1]]}
        visible={false}
        objRef={ghost}
      />

      {/* share: one block spanning the seam, a handle on each side */}
      <Slab
        size={[5.4, 0.42, 0.9]}
        color={GL.paper2}
        edge={GL.accent}
        position={[0, 0.27, DOOR_ROWS[2]]}
        emissive={GL.accent}
        emissiveIntensity={0.12}
        meshRef={shared}
      />
      <Slab size={[0.45, 0.275, 0.45]} color={GL.paper4} edge={GL.ink3} position={[-2.5, 0.62, DOOR_ROWS[2]]} />
      <Slab size={[0.45, 0.275, 0.45]} color={GL.paper4} edge={GL.accent} position={[2.5, 0.62, DOOR_ROWS[2]]} />

      {/* the wall: the heap, the post it is chained to, and the chain.
          Solid, not dashed — this is the one boundary here that nothing
          crosses. */}
      <Slab
        size={[1.3, 0.7, 0.9]}
        color={GL.paper2}
        edge={GL.accent2}
        position={[-2.5, 0.41, DOOR_ROWS[3]]}
        meshRef={wall}
      />
      <Slab size={[0.14, 0.9, 0.14]} color={GL.rule} edge={GL.rule} position={[-3.45, 0.5, DOOR_ROWS[3]]} />
      <group ref={chain}>
        {Array.from({ length: 4 }, (_, i) => (
          <mesh key={i} rotation={[Math.PI / 2, 0, i % 2 ? Math.PI / 2 : 0]}>
            <torusGeometry args={[0.075, 0.025, 8, 14]} />
            <meshStandardMaterial color={GL.ink3} roughness={0.4} metalness={0.6} />
          </mesh>
        ))}
      </group>
    </>
  );
}

/* ═══════════════════ scene 3 · the canvas moves instead ════════════════════
 * Four beats on a twelve-second cycle, narrated underneath: before, the
 * handover, the worker-side paint loop, and what is left crossing per frame.
 * The surface arcs across exactly once — which is the point, it is once per
 * element ever — and after that every moving thing is inside the worker.
 */

const CANVAS_PERIOD = 12;
const CANVAS_HOME: Vec3 = [-2.9, 0.14, 1.0];
const CANVAS_AWAY: Vec3 = [2.9, 0.14, 1.0];

const CANVAS_BEATS = [
  "1 · Before. The canvas element lives on the main thread; the engine and its memory now live in the worker. A pointer into the worker's memory means nothing here — the pixels cannot be read across.",
  "2 · canvas.transferControlToOffscreen(). One message carries the OffscreenCanvas across — O(1), once per element, ever. The element stays in the DOM; its surface has left.",
  "3 · Every frame, worker-side: recomposite(), a zero-copy view of linear memory, putImageData onto the OffscreenCanvas. The composite never crosses the boundary.",
  "4 · What still crosses per frame is one blit message with no request id and no reply. Main-thread blocking per heavy operation: 129–137 ms → 0.",
];

/** Which of the four beats absolute time `t` is in. */
const canvasBeat = (t: number): number => {
  const c = (t % CANVAS_PERIOD) / CANVAS_PERIOD;
  return c < 0.2 ? 0 : c < 0.42 ? 1 : c < 0.72 ? 2 : 3;
};

/** How far through the handover arc absolute time `t` is. */
const canvasCrossing = (t: number): number => seg((t % CANVAS_PERIOD) / CANVAS_PERIOD, 0.2, 0.4);

/** The scene's labels, built around the live anchor the surface carries.
 *
 * Declared out here and handed the anchor rather than built inside the scene:
 * the DOM layer lives outside <Canvas> and needs the same list, and passing it
 * back out of the scene would mean either context or state — a re-render per
 * frame, to move text that a projector already moves for free. */
const canvasLabels = (travelling: THREE.Vector3): LabelSpec[] => [
  { text: "<canvas>", anchor: travelling, color: INK.ink, size: 11, show: (t) => canvasCrossing(t) < 0.5 },
  {
    text: "OffscreenCanvas",
    anchor: travelling,
    color: INK.accent,
    size: 11,
    show: (t) => canvasCrossing(t) >= 0.5,
  },
  { text: "Main thread", anchor: at(-2.9, 0.1, -2.4), color: INK.ink, size: 13, weight: 700, dy: -110, mono: false },
  { text: "Engine worker", anchor: at(2.9, 0.1, -2.4), color: INK.accent, size: 13, weight: 700, dy: -110, mono: false },
  { text: "engine · linear memory", anchor: at(3.3, 0.1, -1.0), color: INK.ink2, size: 11, dy: 110 },
  {
    text: "element stays in the DOM · no 2D context here any more",
    anchor: at(-2.9, 0.18, 1.0),
    color: INK.ink3,
    size: 11,
    dy: 90,
    show: (t) => canvasCrossing(t) > 0.9,
  },
  {
    text: "blit → fire-and-forget",
    anchor: at(0, 0.75, 1.05),
    color: INK.accent2,
    size: 11,
    dy: 90,
    show: (t) => canvasBeat(t) >= 3,
  },
];

function CanvasScene({
  travelling,
  beat,
}: {
  travelling: THREE.Vector3;
  beat: RefObject<HTMLParagraphElement | null>;
}) {
  const frozen = useFrozen();

  const frame = useRef<THREE.Mesh>(null);
  const frameEdges = useRef<THREE.LineSegments>(null);
  const surface = useRef<THREE.Mesh>(null);
  const outline = useRef<THREE.LineSegments>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const pixels = useRef<THREE.Group>(null);

  const palette = useMemo(
    () => ({ accent: new THREE.Color(GL.accent), paper4: new THREE.Color(GL.paper4), scratch: new THREE.Color() }),
    [],
  );
  const home = useMemo(() => new THREE.Vector3(...CANVAS_HOME), []);
  const away = useMemo(() => new THREE.Vector3(...CANVAS_AWAY), []);
  const shown = useRef(-1);

  useFrame(({ clock }) => {
    const tt = frozen ? FROZEN_T : clock.elapsedTime;
    const t = (tt % CANVAS_PERIOD) / CANVAS_PERIOD;
    const phase = canvasBeat(tt);

    // Through a ref, not state: this is four strings on a twelve-second cycle,
    // and routing it through a re-render would rebuild the scene's entire
    // element tree to change one line of text.
    if (beat.current && shown.current !== phase) {
      beat.current.textContent = CANVAS_BEATS[phase];
      shown.current = phase;
    }

    /* the handover — one arc, once ever. */
    const u = canvasCrossing(tt);
    if (frame.current) {
      frame.current.position.lerpVectors(home, away, u);
      frame.current.position.y += Math.sin(u * Math.PI) * 1.4;
      frame.current.rotation.z = Math.sin(u * Math.PI) * -0.25;

      if (surface.current) {
        surface.current.position.copy(frame.current.position);
        surface.current.position.y += 0.05;
        surface.current.rotation.z = frame.current.rotation.z;
      }
      travelling.set(frame.current.position.x, frame.current.position.y + 0.15, frame.current.position.z);

      // A shadow only while it is off the ground, so the lift reads as a lift
      // rather than as the object simply growing.
      if (shadow.current) {
        shadow.current.visible = u > 0 && u < 1;
        shadow.current.position.set(frame.current.position.x, 0.1, 1.0);
        shadow.current.scale.setScalar(1 - Math.sin(u * Math.PI) * 0.25);
      }
      // The element left behind in the page.
      if (outline.current) outline.current.visible = u > 0.15;
      // Halfway across it stops being the page's and becomes the worker's.
      const edgeMaterial = frameEdges.current?.material as THREE.LineBasicMaterial | undefined;
      if (edgeMaterial) edgeMaterial.color.set(u > 0.5 ? GL.accent : GL.ink2);
    }

    /* the paint, worker-side. */
    const paint = phase >= 2 ? Math.min(1, (t - 0.42) / 0.14) : 0;
    const surfaceMaterial = surface.current?.material as THREE.MeshStandardMaterial | undefined;
    if (surfaceMaterial) {
      surfaceMaterial.emissiveIntensity = paint * (0.35 + 0.12 * Math.sin(tt * 5));
      surfaceMaterial.color.copy(palette.scratch.copy(palette.paper4).lerp(palette.accent, paint * 0.55));
    }

    /* memory → surface: the only traffic in this scene, and it never reaches
       x = 0. */
    pixels.current?.children.forEach((p, i) => {
      const lt = (tt * 0.9 + i * 0.13) % 1;
      p.visible = phase >= 2;
      p.position.set(3.3 + (2.9 - 3.3) * lt, 0.7 - 0.45 * lt + Math.sin(lt * Math.PI) * 0.5, -1.0 + 2.0 * lt);
      ((p as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 1 - lt * 0.6;
    });
  });

  return (
    <>
      <Slab size={[4.2, 0.18, 3.6]} color={GL.paper3} position={[-2.9, 0, 0]} />
      <Slab size={[4.2, 0.18, 3.6]} color={GL.paper4} edge={GL.accent} position={[2.9, 0, 0]} />
      <DashedSegment from={[0, 0.05, -2.6]} to={[0, 0.05, 2.6]} color={GL.ink3} />

      <Slab size={[1.9, 0.62, 1.1]} color={GL.paper2} edge={GL.accent} position={[3.3, 0.4, -1.0]} />
      <Slab
        size={[1.1, 0.34, 0.7]}
        color={GL.accent}
        edge={GL.accent}
        position={[3.3, 0.88, -1.0]}
        emissive={GL.accent}
        emissiveIntensity={0.25}
      />

      {/* the canvas: a frame, and the surface that leaves it */}
      <Slab size={[2.0, 0.08, 1.2]} color={GL.paper2} edge={GL.ink2} meshRef={frame} edgeRef={frameEdges} />
      <Slab
        size={[1.7, 0.03, 0.95]}
        color={GL.paper4}
        edge={GL.ink3}
        emissive={GL.accent}
        emissiveIntensity={0}
        meshRef={surface}
      />
      <WireBox size={[2.0, 0.08, 1.2]} color={GL.ink3} position={CANVAS_HOME} visible={false} objRef={outline} />
      <Slab
        size={[2.0, 0.01, 1.2]}
        color={GL.paper}
        edge={GL.paper}
        opacity={0.35}
        visible={false}
        meshRef={shadow}
      />

      <group ref={pixels}>
        {Array.from({ length: 14 }, (_, i) => (
          <mesh key={i} visible={false}>
            <boxGeometry args={[0.09, 0.09, 0.09]} />
            <meshStandardMaterial
              color={GL.accent}
              emissive={GL.accent}
              emissiveIntensity={0.55}
              roughness={0.5}
              transparent
            />
          </mesh>
        ))}
      </group>

      <PacketStream
        from={[-1.6, 0.4, 1.05]}
        to={[2.0, 0.4, 1.05]}
        color={GL.accent2}
        shape="disc"
        period={0.3}
        duration={0.6}
        lift={0.25}
        count={6}
        active={(t) => canvasBeat(t) >= 3}
      />
    </>
  );
}

/* ═══════════════════════════════ the shell ═════════════════════════════════ */

const CAMERAS: Record<SceneKind, { position: Vec3; target: Vec3 }> = {
  threads: { position: [0.3, 6.2, 9.2], target: [0, 0.2, 0] },
  doors: { position: [0.6, 7.2, 9.4], target: [0, 0, 0.1] },
  canvas: { position: [0.3, 6.0, 9.4], target: [0, 0.3, 0] },
};

export default function WorkerSceneGL({ kind }: { kind: SceneKind }) {
  const host = useRef<HTMLDivElement>(null);
  const beat = useRef<HTMLParagraphElement>(null);
  const camera = CAMERAS[kind];

  /* prefers-reduced-motion, through the house hook rather than a bare
   * matchMedia — same reason useMediaQuery gives, and the same hook the nav and
   * the features rail use.
   *
   * `serverValue: true` is the conservative end: one still frame is the right
   * thing to show a reader whose preference has not been measured yet. (It is
   * barely reachable here — this component mounts from an effect, well after
   * hydration — but the default should still be the safe one.) */
  const frozen = useMediaQuery("(prefers-reduced-motion: reduce)", true);

  // The live anchor the travelling surface carries its two labels on. Created
  // here because both the scene (which moves it) and the DOM layer (which reads
  // it, outside the Canvas) need the same object.
  const travelling = useMemo(() => new THREE.Vector3(), []);
  const labels = useMemo(() => {
    if (kind === "threads") return THREADS_LABELS;
    if (kind === "doors") return DOORS_LABELS;
    return canvasLabels(travelling);
  }, [kind, travelling]);

  return (
    <>
      <Canvas
        /* No tone mapping. R3F defaults to ACES filmic, which is right for a lit
           3D scene and wrong for a diagram — it desaturates the accent until the
           worker plane stops reading as the same amber as the rest of the site.
           `flat` turns it off and gives the palette back. */
        flat
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ fov: 32, position: camera.position, near: 0.1, far: 100 }}
        /* "demand" renders once on mount and then only when invalidated, which
           is exactly what the reduced-motion still needs. */
        frameloop={frozen ? "demand" : "always"}
        /* Aimed once, here. The threads scene re-aims every frame because its
           camera drifts; the other two never move and need this exactly once. */
        onCreated={({ camera: cam }) => cam.lookAt(camera.target[0], camera.target[1], camera.target[2])}
      >
        <FrozenContext.Provider value={frozen}>
          <Lighting />
          {kind === "threads" && <ThreadsScene />}
          {kind === "doors" && <DoorsScene />}
          {kind === "canvas" && <CanvasScene travelling={travelling} beat={beat} />}
          <LabelProjector labels={labels} host={host} />
        </FrozenContext.Provider>
      </Canvas>

      <LabelLayer labels={labels} host={host} />
      {kind === "canvas" && <p className="fig-scene__beat" ref={beat} />}
    </>
  );
}
