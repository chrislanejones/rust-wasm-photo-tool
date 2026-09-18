/* The three WebGL scenes behind FIG 1, FIG 2 and FIG 4 of "The engine left
 * the main thread", and the loop that drives them.
 *
 * Ported from Chris's Claude Design export (an <ih-scene> custom element),
 * with the same geometry, timing, labels and camera. Imperative on purpose: a
 * scene is a render loop over a few dozen meshes and a handful of absolutely
 * positioned labels that move every frame, and routing that through React
 * state would re-render a component sixty times a second to move a <div>.
 * React owns the frame around it (engine-in-a-worker.figures.tsx): the figure,
 * the caption, the controls and the fallback. This module owns everything
 * inside the canvas box.
 *
 * Nothing here runs at import time. Every function takes the three.js subset
 * as an argument (`T`) rather than importing it, so this file costs nothing on
 * a page that never scrolls a scene into view — and so it typechecks against
 * three without pulling the runtime into the SSR bundle's evaluated path.
 */

import type * as THREE from "three";

export type ThreeSubset = typeof import("./engine-in-a-worker.three");

export type SceneKind = "threads" | "doors" | "canvas";

/** WebGL-side colors, as 0xRRGGBB. Resolved from the site tokens at mount by
 *  figures.tsx (the DOM labels use the tokens directly, through CSS). */
export interface GlPalette {
  accent: number;
  accent2: number;
  paper: number;
  paper2: number;
  paper3: number;
  paper4: number;
  rule: number;
  ink: number;
  ink2: number;
  ink3: number;
}

/** A label's ink, mapped to a CSS class so the DOM side stays on the tokens. */
export type Tone = "ink" | "ink2" | "ink3" | "accent" | "accent2";

export interface Chapter {
  /** Where the beat starts, as a fraction of the period. */
  at: number;
  label: string;
}

export interface SyncState {
  /** Position in the loop, 0–1. */
  frac: number;
  seconds: number;
  period: number;
  playing: boolean;
  /** Index into `chapters` of the beat in progress, or -1. */
  active: number;
}

/** What the React controls get to hold. */
export interface SceneHandle {
  readonly period: number;
  readonly chapters: Chapter[];
  readonly playing: boolean;
  play(): void;
  pause(): void;
  toggle(): void;
  /** Scrub to a fraction of the period. Pauses. */
  seek(frac: number): void;
  /** Jump to the start of a chapter. Pauses. */
  jump(index: number): void;
  subscribe(cb: (s: SyncState) => void): () => void;
  setVisible(visible: boolean): void;
  dispose(): void;
}

export interface SceneOptions {
  T: ThreeSubset;
  kind: SceneKind;
  colors: GlPalette;
  /** The element the canvas and the label layer are appended to. Sized by CSS. */
  slot: HTMLElement;
  /** FIG 4's step caption, written once per beat. */
  stepEl?: HTMLElement | null;
  /** False under prefers-reduced-motion: the scene renders one frame and stops. */
  animate: boolean;
  showLabels: boolean;
  controls: boolean;
}

/* ── easing ─────────────────────────────────────────────────────────────── */
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const seg = (t: number, a: number, b: number) => ease((t - a) / (b - a));

/** The frame a non-interactive scene shows under reduced motion. Chosen in the
 *  design: packets mid-flight in FIG 1, the copy still sliding and the move
 *  already landed in FIG 2. */
const FROZEN_AT = 4.2;

type Vec3 = [number, number, number];

type Slab = THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial> & {
  edges: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
};
type Packet = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

interface LabelOpts {
  tone?: Tone;
  size?: number;
  weight?: number;
  dx?: number;
  dy?: number;
  mono?: boolean;
  bare?: boolean;
  /** Let a long label wrap inside a capped width instead of running off the
   *  frame. `true` is the narrow cap, for labels that hang OUTSIDE the staging
   *  (FIG 2's rows) with only the camera's gutter to live in; "wide" is for one
   *  sitting over the middle of a slab, which has room for a longer line. */
  wrap?: boolean | "wide";
  /** An annotation rather than a heading: dropped on a phone, where the frame
   *  is a third of the width and they pile on top of each other. The figcaption
   *  carries the same information at every size, so nothing is lost with the
   *  scene left as the picture it still reads as. */
  minor?: boolean;
}

interface LabelRec {
  el: HTMLElement;
  anchor: THREE.Vector3;
}

/* ── the kit a scene builder works with ─────────────────────────────────── */
class SceneKit {
  readonly T: ThreeSubset;
  readonly C: GlPalette;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly labels: LabelRec[] = [];
  readonly layer: HTMLElement;
  showLabels: boolean;
  /** Set by the canvas scene; read by the runtime to build the controls. */
  period = 12;
  chapters: Chapter[] = [];
  setStep: (text: string) => void = () => {};

  constructor(T: ThreeSubset, C: GlPalette, layer: HTMLElement, showLabels: boolean) {
    this.T = T;
    this.C = C;
    this.layer = layer;
    this.showLabels = showLabels;
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(32, 16 / 9, 0.1, 100);
    // Warm key light from the top left, a faint accent fill from behind. The
    // light colors are lighting, not palette — they are the same in the design.
    this.scene.add(new T.HemisphereLight(0xfff3e6, 0x2a1d17, 1.35));
    const key = new T.DirectionalLight(0xffe7cc, 1.6);
    key.position.set(-4, 8, 6);
    this.scene.add(key);
    const fill = new T.DirectionalLight(C.accent, 0.35);
    fill.position.set(6, 3, -4);
    this.scene.add(fill);
  }

  slab(w: number, h: number, d: number, color: number, edge = this.C.rule, opacity = 1): Slab {
    const T = this.T;
    const g = new T.BoxGeometry(w, h, d);
    const m = new T.MeshStandardMaterial({
      color,
      roughness: 0.85,
      metalness: 0.05,
      transparent: opacity < 1,
      opacity,
    });
    const mesh = new T.Mesh(g, m);
    const edges = new T.LineSegments(
      new T.EdgesGeometry(g),
      new T.LineBasicMaterial({ color: edge, transparent: true, opacity: 0.9 }),
    );
    mesh.add(edges);
    this.scene.add(mesh);
    return Object.assign(mesh, { edges });
  }

  wire(w: number, h: number, d: number, color: number) {
    const T = this.T;
    const g = new T.BoxGeometry(w, h, d);
    const l = new T.LineSegments(
      new T.EdgesGeometry(g),
      new T.LineDashedMaterial({ color, dashSize: 0.12, gapSize: 0.08, transparent: true, opacity: 0.8 }),
    );
    l.computeLineDistances();
    this.scene.add(l);
    return l;
  }

  dashed(a: Vec3, b: Vec3, color = this.C.rule) {
    const T = this.T;
    const g = new T.BufferGeometry().setFromPoints([new T.Vector3(...a), new T.Vector3(...b)]);
    const l = new T.Line(g, new T.LineDashedMaterial({ color, dashSize: 0.18, gapSize: 0.12 }));
    l.computeLineDistances();
    this.scene.add(l);
    return l;
  }

  /** A DOM label pinned to a point in the scene. Placed every frame by
   *  `placeLabels`; hidden until the first placement so it never flashes at
   *  (0, 0). Colors and faces come from CSS classes, so they are the tokens. */
  label(text: string, anchor: Vec3, opts: LabelOpts = {}): LabelRec {
    const el = document.createElement("div");
    const classes = ["scene__label", `scene__label--${opts.tone ?? "ink2"}`];
    if (opts.mono === false) classes.push("scene__label--sans");
    if (opts.bare) classes.push("scene__label--bare");
    if (opts.wrap) classes.push("scene__label--wrap");
    if (opts.wrap === "wide") classes.push("scene__label--wrap-wide");
    if (opts.minor) classes.push("scene__label--minor");
    // A label pinned by its right edge grows leftward, so its text has to be
    // ragged-left or a wrapped second line drifts away from the anchor.
    if ((opts.dx ?? -50) <= -100) classes.push("scene__label--end");
    el.className = classes.join(" ");
    el.style.transform = `translate(${opts.dx ?? -50}%, ${opts.dy ?? -50}%)`;
    el.style.fontSize = `${opts.size ?? 12}px`;
    el.style.fontWeight = String(opts.weight ?? 500);
    el.style.display = this.showLabels ? "block" : "none";
    el.textContent = text;
    this.layer.appendChild(el);
    const rec = { el, anchor: new this.T.Vector3(...anchor) };
    this.labels.push(rec);
    return rec;
  }

  /** Show or hide a label, honoring the scene-wide switch. */
  show(rec: LabelRec, on: boolean) {
    rec.el.style.display = on && this.showLabels ? "block" : "none";
  }

  placeLabels(w: number, h: number) {
    const v = new this.T.Vector3();
    for (const { el, anchor } of this.labels) {
      v.copy(anchor).project(this.camera);
      el.style.left = `${((v.x + 1) / 2) * w}px`;
      el.style.top = `${((1 - v.y) / 2) * h}px`;
      el.style.visibility = "visible";
    }
  }

  packet(color: number, shape: "cube" | "disc" | "sphere" = "cube", s = 0.14): Packet {
    const T = this.T;
    const g =
      shape === "cube"
        ? new T.BoxGeometry(s, s, s)
        : shape === "disc"
          ? new T.CylinderGeometry(s * 0.9, s * 0.9, s * 0.25, 18)
          : new T.SphereGeometry(s * 0.6, 14, 10);
    const m = new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.5 });
    const mesh = new T.Mesh(g, m);
    mesh.visible = false;
    this.scene.add(mesh);
    return mesh;
  }
}

/** A stream of packets travelling a→b along a shallow arc, `period` seconds
 *  apart. Returns a ticker and a way to hide the lot. */
function stream(
  sc: SceneKit,
  o: {
    from: Vec3;
    to: Vec3;
    color: number;
    shape: "cube" | "disc" | "sphere";
    period: number;
    phase?: number;
    duration?: number;
    lift?: number;
    count?: number;
  },
) {
  const { phase = 0, duration = 0.9, lift = 0.5, count = 4 } = o;
  const T = sc.T;
  const a = new T.Vector3(...o.from);
  const b = new T.Vector3(...o.to);
  const ps = Array.from({ length: count }, () => sc.packet(o.color, o.shape));
  const span = o.period * count;
  return {
    tick(t: number) {
      ps.forEach((p, i) => {
        const local = ((((t - phase + i * o.period) % span) + span) % span);
        const u = local / duration;
        if (u < 0 || u > 1) {
          p.visible = false;
          return;
        }
        p.visible = true;
        const e = ease(u);
        p.position.lerpVectors(a, b, e);
        p.position.y += Math.sin(u * Math.PI) * lift;
        p.rotation.y = u * Math.PI * 2;
      });
    },
    hide() {
      for (const p of ps) p.visible = false;
    },
  };
}

type Ticker = (t: number) => void;

/* ── FIG 1: where things live ───────────────────────────────────────────── */
function buildThreads(sc: SceneKit): Ticker {
  const { T, C } = sc;
  sc.camera.position.set(0.3, 6.2, 9.2);
  sc.camera.lookAt(0, 0.2, 0);
  const main = sc.slab(4.2, 0.18, 3.6, C.paper3);
  main.position.set(-2.9, 0, 0);
  const work = sc.slab(4.2, 0.18, 3.6, C.paper4, C.accent);
  work.position.set(2.9, 0, 0);
  sc.dashed([0, 0.05, -2.6], [0, 0.05, 2.6], C.ink3);
  sc.dashed([0, 0.05, -2.6], [0, 1.9, -2.6], C.ink3);
  // main thread: React, pointer input, the transferred element
  const react = sc.slab(1.5, 0.5, 1.0, C.paper4);
  react.position.set(-3.6, 0.34, -1.0);
  const ptr = sc.slab(0.7, 0.42, 0.7, C.paper4);
  ptr.position.set(-1.9, 0.3, -1.0);
  sc.wire(1.9, 0.08, 1.15, C.ink3).position.set(-2.9, 0.14, 1.0);
  // worker: the engine over its own linear memory, and the OffscreenCanvas
  const mem = sc.slab(1.9, 0.62, 1.1, C.paper2, C.accent);
  mem.position.set(3.3, 0.4, -1.0);
  const eng = sc.slab(1.1, 0.34, 0.7, C.accent, C.accent);
  eng.position.set(3.3, 0.88, -1.0);
  eng.material.emissive = new T.Color(C.accent);
  eng.material.emissiveIntensity = 0.25;
  const off = sc.slab(1.9, 0.08, 1.15, C.paper3, C.accent);
  off.position.set(2.9, 0.14, 1.0);
  const ctx = sc.slab(1.6, 0.02, 0.9, C.accent, C.accent, 0.85);
  ctx.position.set(2.9, 0.2, 1.0);
  ctx.material.emissive = new T.Color(C.accent);
  sc.dashed([3.3, 0.1, -0.45], [2.9, 0.1, 0.4], C.accent);

  sc.label("Main thread", [-2.9, 0.1, -2.4], { tone: "ink", size: 13, weight: 700, dy: -140, mono: false });
  sc.label("React · pointer input · layout", [-2.9, 0.1, -2.4], { tone: "ink3", dy: -30, minor: true });
  sc.label("Engine worker", [2.9, 0.1, -2.4], { tone: "accent", size: 13, weight: 700, dy: -140, mono: false });
  sc.label("engine · own wasm memory · canvas", [2.9, 0.1, -2.4], { tone: "ink3", dy: -30, minor: true });
  sc.label("postMessage", [0, 1.95, -2.6], { tone: "ink3", dy: -110, minor: true });
  sc.label("UI", [-3.6, 0.62, -1.0], { tone: "ink2", size: 11, minor: true });
  sc.label("input", [-1.9, 0.55, -1.0], { tone: "ink2", size: 11, minor: true });
  sc.label("<canvas> — element stays, surface gone", [-2.9, 0.18, 1.0], { tone: "ink3", size: 11, dy: 90, minor: true });
  sc.label("engine", [3.3, 1.08, -1.0], { tone: "ink", size: 11, minor: true });
  sc.label("linear memory", [3.3, 0.1, -1.0], { tone: "ink2", size: 11, dy: 110, minor: true });
  sc.label("OffscreenCanvas · putImageData here", [2.9, 0.22, 1.0], { tone: "accent", size: 11, dy: 90, minor: true });
  const l1 = sc.label("call { id, method, args } →", [0, 1.15, -0.55], { tone: "accent", size: 11, dy: -160, minor: true });
  const l2 = sc.label("← reply { id, ok, value }", [0, 0.9, -0.05], { tone: "ink2", size: 11, dy: 40, minor: true });
  const l3 = sc.label("blit → (no reply, not queued)", [0, 0.8, 1.05], { tone: "accent2", size: 11, dy: 90, minor: true });
  for (const l of [l1, l2, l3]) sc.show(l, false);

  const calls = stream(sc, { from: [-1.5, 0.55, -0.55], to: [2.0, 0.55, -0.55], color: C.accent, shape: "cube", period: 0.55, duration: 0.8, lift: 0.7 });
  const replies = stream(sc, { from: [2.0, 0.45, -0.05], to: [-1.5, 0.45, -0.05], color: C.ink3, shape: "sphere", period: 0.55, phase: 0.75, duration: 0.8, lift: 0.35 });
  const blits = stream(sc, { from: [-1.6, 0.4, 1.05], to: [2.0, 0.4, 1.05], color: C.accent2, shape: "disc", period: 0.3, duration: 0.6, lift: 0.25, count: 6 });
  const camBase = sc.camera.position.clone();
  return (t) => {
    calls.tick(t);
    replies.tick(t);
    blits.tick(t);
    ctx.material.emissiveIntensity = 0.25 + 0.2 * Math.sin(t * 6);
    sc.camera.position.x = camBase.x + Math.sin(t * 0.25) * 0.9;
    sc.camera.position.z = camBase.z + Math.cos(t * 0.25) * 0.3;
    sc.camera.lookAt(0, 0.2, 0);
    const late = t > 1.2;
    for (const l of [l1, l2, l3]) sc.show(l, late);
  };
}

/* ── FIG 2: the three doors, and the wall ───────────────────────────────── */
function buildDoors(sc: SceneKit): Ticker {
  const { T, C } = sc;
  // Pulled back from the design's z=9.4. This is the one scene whose labels sit
  // OUTSIDE the staging — a row name and its mechanism hang off the left edge,
  // the verdict off the right — and at 9.4 the pads fill the frame edge to edge,
  // so "transfer list · O(1), sender detached" lost its first word to the clip
  // and two verdicts lost their last. Backing the camera off shrinks the pads
  // and buys the gutters the text needs; nothing else about the framing moves.
  sc.camera.position.set(0.6, 8.3, 10.9);
  sc.camera.lookAt(0, 0, 0.1);
  const rows = [-2.85, -0.95, 0.95, 2.85];
  for (const z of rows) {
    sc.slab(2.4, 0.12, 1.35, C.paper3).position.set(-2.5, 0, z);
    sc.slab(2.4, 0.12, 1.35, C.paper4, C.accent).position.set(2.5, 0, z);
  }
  sc.dashed([0, 0.04, -3.7], [0, 0.04, 3.7], C.ink3);
  sc.label("sender", [-2.5, 0.06, -3.6], { tone: "ink3", dy: -60, minor: true });
  sc.label("receiver (worker)", [2.5, 0.06, -3.6], { tone: "accent", dy: -60, minor: true });

  const names = ["Copy", "Move", "Share", "WASM memory"];
  const subs = [
    "structured clone · ∝ payload size",
    "transfer list · O(1), sender detached",
    "SharedArrayBuffer · same bytes, both sides",
    "[[ArrayBufferDetachKey]] · cannot detach",
  ];
  const verdict = [
    "two independent values",
    "byteLength → 0 on the sender",
    "needs COOP + COEP · not used",
    "Firefox/Safari throw · Chrome copies",
  ];
  rows.forEach((z, i) => {
    const wall = i === 3;
    sc.label(names[i], [-3.85, 0.1, z], { tone: wall ? "accent2" : "ink", size: 13, weight: 700, dx: -100, dy: -90, mono: false });
    // 10px, a rung under the verdicts opposite: the mechanism line carries the
    // longest string in the figure — `[[ArrayBufferDetachKey]]` is one
    // unbreakable 24-character token — and at 11px it does not fit the gutter
    // the nearest row leaves, so it lost its tail to an ellipsis.
    sc.label(subs[i], [-3.85, 0.1, z], { tone: "ink3", size: 10, dx: -100, dy: 10, wrap: true, minor: true });
    sc.label(verdict[i], [3.85, 0.1, z], { tone: wall ? "accent2" : "ink2", size: 11, dx: 0, dy: -50, wrap: true, minor: true });
  });

  const blk = (color: number, edge: number) => sc.slab(0.9, 0.55, 0.9, color, edge);
  // Copy: the clone appears beside the original and slides across, slowly.
  const c0 = blk(C.paper2, C.ink2);
  c0.position.set(-2.5, 0.34, rows[0]);
  const c1 = blk(C.paper2, C.ink2);
  c1.position.copy(c0.position);
  c1.material.transparent = true;
  const wake = sc.slab(0.9, 0.02, 0.9, C.accent, C.accent, 0.35);
  wake.position.set(-2.5, 0.07, rows[0]);
  wake.visible = false;
  // Move: fast, and the original is left detached.
  const m0 = blk(C.paper2, C.ink2);
  m0.position.set(-2.5, 0.34, rows[1]);
  const ghost = sc.wire(0.9, 0.55, 0.9, C.ink3);
  ghost.position.copy(m0.position);
  ghost.visible = false;
  // Share: one block spanning both sides, a pulse running along it.
  const sh = sc.slab(5.4, 0.42, 0.9, C.paper2, C.accent);
  sh.position.set(0, 0.27, rows[2]);
  sh.material.emissive = new T.Color(C.accent);
  const hl = blk(C.paper4, C.ink3);
  hl.scale.set(0.5, 0.5, 0.5);
  hl.position.set(-2.5, 0.62, rows[2]);
  const hr = blk(C.paper4, C.accent);
  hr.scale.set(0.5, 0.5, 0.5);
  hr.position.set(2.5, 0.62, rows[2]);
  // The wall: chained to a post, it strains toward the seam and snaps back.
  const w0 = sc.slab(1.3, 0.7, 0.9, C.paper2, C.accent2);
  w0.position.set(-2.5, 0.41, rows[3]);
  const post = sc.slab(0.14, 0.9, 0.14, C.rule, C.rule);
  post.position.set(-3.45, 0.5, rows[3]);
  const links = Array.from({ length: 4 }, (_, i) => {
    const r = new T.Mesh(
      new T.TorusGeometry(0.075, 0.025, 8, 14),
      new T.MeshStandardMaterial({ color: C.ink3, roughness: 0.4, metalness: 0.6 }),
    );
    r.rotation.x = Math.PI / 2;
    r.rotation.z = i % 2 ? Math.PI / 2 : 0;
    sc.scene.add(r);
    return r;
  });
  const bang = sc.label("TypeError", [0.2, 0.9, rows[3]], { tone: "accent2", size: 12, weight: 700, minor: true });
  sc.show(bang, false);
  const red = new T.Color(C.accent2);
  const base = new T.Color(C.paper2);

  const PERIOD = 6;
  return (tt) => {
    const t = (tt % PERIOD) / PERIOD;
    // copy: the clone slides the whole way; the cost is the whole payload
    const cu = seg(t, 0.15, 0.85);
    c1.visible = t > 0.15 && t < 0.97;
    c1.position.x = -2.5 + 5 * cu;
    c1.material.opacity = t < 0.2 ? (t - 0.15) / 0.05 : 1;
    wake.visible = c1.visible;
    wake.position.x = (-2.5 + c1.position.x) / 2;
    wake.scale.x = Math.max(0.01, (c1.position.x + 2.5) / 0.9);
    // move: over in a quarter of the loop, and the original is left detached
    const mu = seg(t, 0.15, 0.4);
    m0.position.x = -2.5 + 5 * mu;
    ghost.visible = t > 0.17 && t < 0.97;
    if (t >= 0.97) m0.position.x = -2.5;
    // share: one block, a pulse running along it
    sh.material.emissiveIntensity = 0.12 + 0.18 * (0.5 + 0.5 * Math.sin(tt * 4));
    // wall: strains, then flashes red and snaps back
    const pull = t > 0.15 && t < 0.42 ? Math.sin(((t - 0.15) / 0.27) * Math.PI) * 0.55 : 0;
    w0.position.x = -2.5 + pull;
    const flash = t > 0.36 && t < 0.62 ? 1 - (t - 0.36) / 0.26 : 0;
    w0.material.color.copy(base).lerp(red, flash * 0.7);
    w0.material.emissive = red;
    w0.material.emissiveIntensity = flash * 0.5;
    sc.show(bang, flash > 0);
    links.forEach((r, i) => {
      r.position.set(-3.35 + (i + 0.5) * ((w0.position.x - 0.65 + 3.4) / 4), 0.5, rows[3]);
    });
  };
}

/* ── FIG 4: the canvas moves instead of the pixels ──────────────────────── */
const CANVAS_STEPS = [
  "1 · Before. The canvas element lives on the main thread; the engine and its memory now live in the worker. A pointer into the worker's memory means nothing here — the pixels cannot be read across.",
  "2 · canvas.transferControlToOffscreen(). One message carries the OffscreenCanvas across — O(1), once per element, ever. The element stays in the DOM; its surface has left.",
  "3 · Every frame, worker-side: recomposite(), a zero-copy view of linear memory, putImageData onto the OffscreenCanvas. The composite never crosses the boundary.",
  "4 · What still crosses per frame is one blit message with no request id and no reply. Main-thread blocking per heavy operation: 129–137 ms → 0.",
];

const CANVAS_CHAPTERS: Chapter[] = [
  { at: 0, label: "Before — engine and canvas on opposite threads" },
  { at: 0.2, label: "transferControlToOffscreen()" },
  { at: 0.42, label: "Pixels flow memory → canvas, worker-side" },
  { at: 0.72, label: "One fire-and-forget blit per frame" },
];

function buildCanvas(sc: SceneKit): Ticker {
  const { T, C } = sc;
  sc.camera.position.set(0.3, 6.0, 9.4);
  sc.camera.lookAt(0, 0.3, 0);
  const main = sc.slab(4.2, 0.18, 3.6, C.paper3);
  main.position.set(-2.9, 0, 0);
  const work = sc.slab(4.2, 0.18, 3.6, C.paper4, C.accent);
  work.position.set(2.9, 0, 0);
  sc.dashed([0, 0.05, -2.6], [0, 0.05, 2.6], C.ink3);
  sc.label("Main thread", [-2.9, 0.1, -2.4], { tone: "ink", size: 13, weight: 700, dy: -110, mono: false });
  sc.label("Engine worker", [2.9, 0.1, -2.4], { tone: "accent", size: 13, weight: 700, dy: -110, mono: false });
  const mem = sc.slab(1.9, 0.62, 1.1, C.paper2, C.accent);
  mem.position.set(3.3, 0.4, -1.0);
  const eng = sc.slab(1.1, 0.34, 0.7, C.accent, C.accent);
  eng.position.set(3.3, 0.88, -1.0);
  eng.material.emissive = new T.Color(C.accent);
  eng.material.emissiveIntensity = 0.25;
  sc.label("engine · linear memory", [3.3, 0.1, -1.0], { tone: "ink2", size: 11, dy: 110, minor: true });
  // the canvas: a frame plus a "surface" plane that gets painted
  const frame = sc.slab(2.0, 0.08, 1.2, C.paper2, C.ink2);
  const surf = sc.slab(1.7, 0.03, 0.95, C.paper4, C.ink3);
  surf.material.emissive = new T.Color(C.accent);
  const outline = sc.wire(2.0, 0.08, 1.2, C.ink3);
  outline.position.set(-2.9, 0.14, 1.0);
  outline.visible = false;
  const shadow = sc.slab(2.0, 0.01, 1.2, C.paper, C.paper, 0.35);
  shadow.visible = false;
  const home = new T.Vector3(-2.9, 0.14, 1.0);
  const away = new T.Vector3(2.9, 0.14, 1.0);
  // pixels streaming from memory into the surface, worker side
  const pix = Array.from({ length: 14 }, () => sc.packet(C.accent, "cube", 0.09));
  for (const p of pix) p.material.transparent = true;
  const blits = stream(sc, { from: [-1.6, 0.4, 1.05], to: [2.0, 0.4, 1.05], color: C.accent2, shape: "disc", period: 0.3, duration: 0.6, lift: 0.25, count: 6 });
  const lblCanvas = sc.label("<canvas>", [0, 0, 0], { tone: "ink", size: 11, minor: true });
  const lblOff = sc.label("OffscreenCanvas", [0, 0, 0], { tone: "accent", size: 11, minor: true });
  // Wrapped: this is the longest label in the figure and the only one that
  // overran the 46% cap the rest sit comfortably inside.
  const lblEl = sc.label("element stays in the DOM · no 2D context here any more", [-2.9, 0.18, 1.0], { tone: "ink3", size: 11, dy: 90, wrap: "wide", minor: true });
  const lblBlit = sc.label("blit → fire-and-forget", [0, 0.75, 1.05], { tone: "accent2", size: 11, dy: 90, minor: true });
  sc.period = 12;
  sc.chapters = CANVAS_CHAPTERS;
  const accent = new T.Color(C.accent);
  const paper4 = new T.Color(C.paper4);
  let shownStep = -1;

  const PERIOD = sc.period;
  return (tt) => {
    const t = (((tt % PERIOD) + PERIOD) % PERIOD) / PERIOD;
    const phase = t < 0.2 ? 0 : t < 0.42 ? 1 : t < 0.72 ? 2 : 3;
    if (phase !== shownStep) {
      shownStep = phase;
      sc.setStep(CANVAS_STEPS[phase]);
    }
    const u = seg(t, 0.2, 0.4);
    frame.position.lerpVectors(home, away, u);
    frame.position.y += Math.sin(u * Math.PI) * 1.4;
    surf.position.copy(frame.position);
    surf.position.y += 0.05;
    frame.rotation.z = Math.sin(u * Math.PI) * -0.25;
    surf.rotation.z = frame.rotation.z;
    shadow.visible = u > 0 && u < 1;
    shadow.position.set(frame.position.x, 0.1, 1.0);
    shadow.scale.setScalar(1 - Math.sin(u * Math.PI) * 0.25);
    outline.visible = u > 0.15;
    frame.edges.material.color.set(u > 0.5 ? C.accent : C.ink2);
    // paint arrives in beat 3
    const paint = phase >= 2 ? Math.min(1, (t - 0.42) / 0.14) : 0;
    surf.material.emissiveIntensity = paint * (0.35 + 0.12 * Math.sin(tt * 5));
    surf.material.color.copy(paper4).lerp(accent, paint * 0.55);
    pix.forEach((p, i) => {
      const lt = (tt * 0.9 + i * 0.13) % 1;
      p.visible = phase >= 2;
      p.position.set(3.3 + (2.9 - 3.3) * lt, 0.7 - 0.45 * lt + Math.sin(lt * Math.PI) * 0.5, -1.0 + 2.0 * lt);
      p.material.opacity = 1 - lt * 0.6;
    });
    if (phase >= 3) blits.tick(tt);
    else blits.hide();
    lblCanvas.anchor.set(frame.position.x, frame.position.y + 0.15, frame.position.z);
    lblOff.anchor.copy(lblCanvas.anchor);
    sc.show(lblCanvas, u < 0.5);
    sc.show(lblOff, u >= 0.5);
    sc.show(lblEl, u > 0.9);
    sc.show(lblBlit, phase >= 3);
  };
}

const BUILDERS: Record<SceneKind, (sc: SceneKit) => Ticker> = {
  threads: buildThreads,
  doors: buildDoors,
  canvas: buildCanvas,
};

/* ── the runtime ────────────────────────────────────────────────────────── */

/** Build a scene into `slot` and start its loop. Throws if WebGL is not
 *  available (three's renderer constructor does), which the caller turns into
 *  the static fallback. */
export function createScene(o: SceneOptions): SceneHandle {
  const { T, slot, controls, animate } = o;
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = "scene__canvas";
  const layer = document.createElement("div");
  layer.className = "scene__labels";
  slot.append(renderer.domElement, layer);

  const sc = new SceneKit(T, o.colors, layer, o.showLabels);
  if (o.stepEl) {
    const stepEl = o.stepEl;
    sc.setStep = (text) => {
      stepEl.textContent = text;
    };
  }
  const tick = BUILDERS[o.kind](sc);
  const period = sc.period;
  const chapters = sc.chapters;

  let w = 0;
  let h = 0;
  const size = () => {
    w = slot.clientWidth || 640;
    h = Math.max(120, slot.clientHeight || (w * 9) / 16);
    renderer.setSize(w, h, false);
    const aspect = w / h;
    sc.camera.aspect = aspect;
    // Hold the HORIZONTAL field fixed instead of the vertical one.
    //
    // Every scene here is a wide composition — two thread slabs side by side,
    // or four rows spanning left to right — and three's PerspectiveCamera keeps
    // `fov` vertical. So a box narrower than the 16:9 it was framed for crops
    // the sides, which is exactly the part that carries the meaning: on a phone
    // (4:3) the worker slab ran off the right edge. Widening the vertical fov by
    // the aspect ratio keeps the left-to-right extent identical at every size
    // and spends the phone's extra height on empty air above and below, which
    // is the half nobody is reading.
    const FOV_16_9 = 32;
    const REF = 16 / 9;
    sc.camera.fov =
      aspect >= REF
        ? FOV_16_9
        : (2 * Math.atan(Math.tan((FOV_16_9 * Math.PI) / 360) * (REF / aspect)) * 180) / Math.PI;
    sc.camera.updateProjectionMatrix();
    dirty = true;
  };

  // Where the loop is. A scene with controls starts at 0 and plays; under
  // reduced motion it sits on the last beat, paused, and the controls still
  // drive it. A scene without controls runs on its own clock, or shows the
  // design's chosen frame and stops.
  let t = controls && !animate ? period * 0.9 : 0;
  let playing = controls ? animate : false;
  let visible = true;
  let dirty = true;
  let renderedOnce = false;
  let stopped = false;
  let last = 0;
  let raf = 0;
  const subs = new Set<(s: SyncState) => void>();

  const state = (): SyncState => {
    const frac = (((t % period) + period) % period) / period;
    let active = -1;
    chapters.forEach((ch, i) => {
      if (frac >= ch.at) active = i;
    });
    return { frac, seconds: frac * period, period, playing, active };
  };
  const sync = () => {
    if (subs.size === 0) return;
    const s = state();
    for (const cb of subs) cb(s);
  };
  const draw = (at: number) => {
    tick(at);
    renderer.render(sc.scene, sc.camera);
    sc.placeLabels(w, h);
    renderedOnce = true;
  };

  const frame = (now: number) => {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    // Clamped so a tab coming back from the background steps, not jumps.
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    const live = visible && !document.hidden;

    if (controls) {
      if (playing && live) {
        t += dt;
        dirty = true;
      }
      if (!dirty) return;
      draw(t);
      sync();
      dirty = playing && live;
      return;
    }

    if (!animate) {
      // One frame, when first on screen; again only if the box was resized.
      if (!visible || (renderedOnce && !dirty)) return;
      draw(FROZEN_AT);
      dirty = false;
      return;
    }

    if (!live && renderedOnce && !dirty) return;
    if (live) t += dt;
    draw(t);
    dirty = false;
  };

  size();
  const ro = new ResizeObserver(size);
  ro.observe(slot);
  raf = requestAnimationFrame(frame);

  const setPlaying = (p: boolean) => {
    playing = p;
    dirty = true;
    sync();
  };
  const seekTo = (frac: number) => {
    playing = false;
    t = Math.floor(t / period) * period + frac * period;
    dirty = true;
    sync();
  };

  return {
    period,
    chapters,
    get playing() {
      return playing;
    },
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    toggle: () => setPlaying(!playing),
    seek: seekTo,
    // A hair past the boundary, so the beat's own caption is the one shown.
    jump: (i) => seekTo(chapters[i].at + 0.001 / period),
    subscribe(cb) {
      subs.add(cb);
      cb(state());
      return () => {
        subs.delete(cb);
      };
    },
    setVisible(v) {
      if (v && !visible) last = 0;
      visible = v;
    },
    dispose() {
      stopped = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      subs.clear();
      sc.scene.traverse((obj) => {
        const m = obj as Partial<THREE.Mesh>;
        m.geometry?.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
      layer.remove();
    },
  };
}
