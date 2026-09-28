/* The animated figures of "We spent a month taking the file apart".
 *
 *   <Scene kind="giants" />           FIG 1 — the five pinned files against 900
 *   <Scene kind="drift" controls />   FIG 2 — one primitive, nine renderings
 *   <Scene kind="ratchet" controls /> FIG 3 — refactoring under a ratchet
 *   <Scene kind="giants" backdrop />  the header banner behind the headline
 *
 * The runtime below — SceneKit, `stream`, `createScene` and the frame loop —
 * is the worker post's (engine-in-a-worker.scenes.ts), reused as-is. Only the
 * three builders at the bottom are this post's. Keeping the two copies apart
 * rather than sharing a module is deliberate: each post's scenes are edited
 * against that post's prose, and a shared runtime would make a tweak for one
 * figure a change to figures in a published post.
 *
 * Every number a scene prints is in the repository and is measured, not
 * rounded to make a point. Where a figure animates a change over time, the
 * start and end values are both real; see the comments on each builder.
 *
 * Prerender-safe: this module is only ever reached from an effect (figures.tsx
 * loads it with a dynamic import), so Node never evaluates it.
 */

import type * as THREE from "three";

export type ThreeSubset = typeof import("./entropy.three");

export type SceneKind = "giants" | "drift" | "ratchet";

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
  /** A header banner rather than a figure: the box fills the header, so it is
   *  framed to cover rather than to show the whole diagram. See `size()`. */
  backdrop?: boolean;
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

  /** The two side headings, as a fixed row at the top of the frame rather than
   *  labels pinned into the scene.
   *
   *  They were projected labels, anchored behind each slab. That works until
   *  the camera drifts or the frame narrows, and then the heading and its
   *  subtitle slide toward the packets they are meant to be naming. A heading
   *  is not part of the diagram's geometry — it names a side — so it belongs in
   *  the frame, not in the scene.
   *
   *  Not marked `minor`, so it survives the narrow-width rule that hides the
   *  annotation labels: at 390px the headings are the only thing telling you
   *  which slab is which. */
  header(leftTitle: string, leftSub: string, rightTitle: string, rightSub: string) {
    const row = document.createElement("div");
    row.className = "scene__header";
    row.style.display = this.showLabels ? "grid" : "none";
    const col = (title: string, sub: string, tone: "ink" | "accent") => {
      const d = document.createElement("div");
      d.className = "scene__header-col";
      const t = document.createElement("span");
      t.className = `scene__header-title scene__label--${tone}`;
      t.textContent = title;
      const u = document.createElement("span");
      u.className = "scene__header-sub scene__label--ink3";
      u.textContent = sub;
      d.append(t, u);
      return d;
    };
    row.append(col(leftTitle, leftSub, "ink"), col(rightTitle, rightSub, "accent"));
    this.layer.appendChild(row);
    return row;
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
/* ── two helpers these three scenes share ────────────────────────────────── */

/** Fade a slab and its edge lines together, and hide it once it is invisible.
 *  Separate from `show` (which is for DOM labels) because a mesh's opacity and
 *  its edges' opacity are two materials that must move as one — fading only
 *  the face leaves a wireframe box hanging in the air. */
function fade(mesh: Slab, o: number) {
  mesh.material.transparent = true;
  mesh.material.opacity = o;
  mesh.edges.material.opacity = 0.9 * o;
  mesh.visible = o > 0.01;
}

/** The slow camera drift every scene here uses. Same shape as the worker
 *  post's, which inlines it per scene; three scenes made it worth naming. */
function orbit(sc: SceneKit, base: THREE.Vector3, t: number, lookY = -0.25) {
  sc.camera.position.x = base.x + Math.sin(t * 0.25) * 0.9;
  sc.camera.position.z = base.z + Math.cos(t * 0.25) * 0.3;
  sc.camera.position.y = base.y;
  sc.camera.lookAt(0, lookY, 0);
}

/* ── FIG 1 · the giants against the 900-line ceiling ─────────────────────── *
 * Five towers, one per file pinned in eslint.config.mjs, plus the 31 files of
 * components/ui/ for scale — none of which has ever crossed 900.
 *
 * The AppShell tower is the one that moves. It grows to July's 3,250, keeps
 * growing to 3,806 THROUGH the month it was being taken apart (the packets
 * flying off it are the extractions, and they do not stop the growth), then
 * comes down to today's 3,564 when the cap turns into an error. Those three
 * numbers are measured, and the two endpoints are a month apart to the day:
 * 3,250 at d3366c33 (27 July), 3,806 at eac21532 (27 August, the commit that
 * pinned the caps), 3,564 on master today.
 */
const FILES: { name: string; lines: number; x: number; live?: boolean; low?: boolean }[] = [
  { name: "src/lib.rs", lines: 4670, x: -4.5 },
  { name: "AppShell.tsx", lines: 3564, x: -2.9, live: true },
  { name: "CanvasArea.tsx", lines: 2823, x: -1.35 },
  { name: "BatchSettings.tsx", lines: 1428, x: 0.15 },
  { name: "useDrawingTools.ts", lines: 991, x: 1.75, low: true },
];
/** Scene units per 1,000 lines. */
const K = 0.72;
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

function buildGiants(sc: SceneKit): Ticker {
  const T = sc.T;
  sc.camera.position.set(0.3, 7.6, 12.2);
  sc.camera.lookAt(0, 1.3, 0);
  sc.slab(11.2, 0.18, 3.8, sc.C.paper3).position.set(0, 0, 0);
  const TOP = 0.09;

  const towers = FILES.map((f) => {
    const h = (f.lines / 1000) * K;
    const m = sc.slab(0.95, h, 0.95, sc.C.paper4, f.live ? sc.C.accent : sc.C.ink2);
    m.position.set(f.x, TOP + h / 2, 0);
    m.scale.y = 0.001;
    sc.label(f.name, [f.x, TOP + h + 0.1, 0], {
      tone: f.live ? "accent" : "ink",
      size: 11,
      weight: 700,
      dy: f.low ? -40 : -150,
    });
    const cnt = sc.label(fmt(f.lines), [f.x, TOP + h + 0.1, 0], {
      tone: "ink2",
      size: 11,
      dy: f.low ? 70 : -40,
      minor: true,
    });
    return { m, h, cnt, f };
  });

  // components/ui/ — 31 primitives, none over 900, drawn as a low field so the
  // eye reads "many small" against "five tall" without needing a number each.
  const smalls = Array.from({ length: 12 }, (_, i) => {
    const h = 0.06 + (i % 5) * 0.012;
    const m = sc.slab(0.42, h, 0.42, sc.C.paper2, sc.C.accent);
    m.position.set(3.2 + (i % 4) * 0.6, TOP + h / 2, -0.9 + Math.floor(i / 4) * 0.9);
    m.userData.h = h;
    m.scale.y = 0.001;
    return m;
  });
  sc.label("components/ui/ · 31 files · none over 900", [4.1, TOP, 1.15], {
    tone: "accent",
    size: 11,
    dy: 110,
    minor: true,
    wrap: true,
  });

  const ceilY = TOP + 0.9 * K;
  const ceil = sc.slab(10.8, 0.02, 3.6, sc.C.accent, sc.C.accent, 0.16);
  ceil.position.set(0, ceilY, 0);
  fade(ceil, 0);
  const ceilLbl = sc.label("900 · max-lines · the five caps are errors since 09-26", [-0.6, ceilY, 1.75], {
    tone: "accent",
    size: 11,
    weight: 700,
    dx: 0,
    dy: 60,
    wrap: "wide",
  });
  // The two callouts sit on the FRONT EDGE of the staging, clear of every
  // tower's own name and count. Anchored over the towers they collided with
  // CanvasArea's label, which is the sort of thing only a render shows.
  const grow = sc.label("3,250 → 3,806 while it was being dismantled", [-3.4, TOP, 2.25], {
    tone: "accent2",
    size: 12,
    weight: 700,
    dx: 0,
    dy: 40,
    wrap: "wide",
  });
  const pin = sc.label("cap 3,564 — an error now, not a warning", [-3.4, TOP, 2.25], {
    tone: "accent",
    size: 11,
    dx: 0,
    dy: 40,
    wrap: "wide",
  });
  sc.show(grow, false);
  sc.show(pin, false);
  sc.show(ceilLbl, false);
  sc.header("Lines per file", "the five pinned in eslint.config.mjs · ui/ for scale", "900", "the max-lines ceiling");

  const dismantle = stream(sc, {
    from: [-2.9, TOP + 2.6, 0.2],
    to: [3.9, TOP + 0.3, 0.4],
    color: sc.C.ink2,
    shape: "cube",
    period: 0.5,
    duration: 1.1,
    lift: 1.2,
    count: 5,
  });
  const camBase = sc.camera.position.clone();
  const red = new T.Color(sc.C.accent2);
  const PERIOD = 12;

  return (tt: number) => {
    const t = ((((tt % PERIOD) + PERIOD) % PERIOD) / PERIOD);
    orbit(sc, camBase, tt, 1.3);
    towers.forEach(({ m, h, cnt, f }, i) => {
      let g = seg(t, 0.02 + i * 0.04, 0.24 + i * 0.04);
      let lines = f.lines * g;
      if (f.live) {
        // Measured: 3,250 (27 Jul) → 3,806 (27 Aug, the pin) → 3,564 (today).
        lines = 3250 * g + (3806 - 3250) * seg(t, 0.32, 0.56) - (3806 - 3564) * seg(t, 0.62, 0.72);
        g = lines / f.lines;
      }
      const s = Math.max(0.001, g);
      m.scale.y = s;
      m.position.y = TOP + (h * s) / 2;
      cnt.el.textContent = fmt(lines);
      const over = h * s > ceilY - TOP;
      const hot = t > 0.62 && over ? 0.5 + 0.5 * Math.sin(tt * 3 + i) : 0;
      m.edges.material.color.set(f.live ? sc.C.accent : sc.C.ink2).lerp(red, hot * 0.7);
    });
    smalls.forEach((m, i) => {
      const s = Math.max(0.001, seg(t, 0.2 + i * 0.01, 0.3 + i * 0.01));
      m.scale.y = s;
      m.position.y = TOP + ((m.userData.h as number) * s) / 2;
    });
    if (t > 0.32 && t < 0.58) dismantle.tick(tt);
    else dismantle.hide();
    fade(ceil, 0.16 * seg(t, 0.6, 0.66));
    sc.show(grow, t > 0.32 && t < 0.58);
    sc.show(pin, t > 0.7);
    sc.show(ceilLbl, t > 0.62);
  };
}

/* ── FIG 2 · how drift happens — one primitive, nine renderings ──────────── *
 * Schematic, and labelled as such in the caption: the nine surfaces are real
 * surfaces of this app, but "nine" is the shape of the problem rather than a
 * census. The three sizes on the drifted copies — 24, 30 and 36 px — are the
 * real ones the UI inventory found before the icon buttons were unified, and
 * `title=` instead of the shared tooltip is the real substitution.
 */
function buildDrift(sc: SceneKit): Ticker {
  const T = sc.T;
  sc.camera.position.set(0.3, 6.2, 9.6);
  sc.camera.lookAt(0, -0.25, 0);
  sc.slab(10.4, 0.18, 3.6, sc.C.paper3).position.set(0, 0, 0);
  sc.dashed([-2.3, 0.1, -1.8], [-2.3, 0.1, 1.8], sc.C.ink3);

  const src = sc.slab(1.6, 0.5, 1.1, sc.C.paper2, sc.C.accent);
  src.position.set(-3.9, 0.34, 0.2);
  src.material.emissive = new T.Color(sc.C.accent);
  src.material.emissiveIntensity = 0.1;
  const srcBtn = sc.slab(0.3, 0.3, 0.3, sc.C.accent, sc.C.accent);
  srcBtn.position.set(-3.9, 0.74, 0.2);
  srcBtn.material.emissive = new T.Color(sc.C.accent);
  srcBtn.material.emissiveIntensity = 0.35;
  sc.label("ui/ · the one definition", [-3.9, 0.1, 0.2], { tone: "accent", size: 11, weight: 700, dy: 110, wrap: true });

  const names = ["TopBar", "MasterBar", "Review panel", "Layers list", "Settings sheet", "New dialog", "Gallery bar", "Tool rail", "Export pane"];
  const px = [24, 30, 36, 30, 24, 30, 36, 24, 30];
  const tints = [sc.C.ink2, sc.C.accent, sc.C.ink3, sc.C.accent, sc.C.ink2, sc.C.accent, sc.C.ink3, sc.C.ink2, sc.C.accent];
  /** The three that IMPORT the primitive. They are the ones a later fix reaches. */
  const imports = new Set([1, 3, 5]);
  const base = new T.Color(sc.C.accent);
  const from = new T.Vector3(-3.9, 0.9, 0.2);

  const sites = names.map((n, i) => {
    const x = -0.9 + (i % 3) * 1.95;
    const z = -1.15 + Math.floor(i / 3) * 1.15;
    const s = sc.slab(1.3, 0.34, 0.8, sc.C.paper4, sc.C.ink3);
    s.position.set(x, 0.26, z);
    const b = sc.slab(0.3, 0.3, 0.3, sc.C.accent, sc.C.accent);
    b.position.set(x, 0.58, z);
    b.scale.setScalar(0.001);
    b.material.emissive = new T.Color(sc.C.accent);
    b.material.emissiveIntensity = 0.3;
    const p = sc.packet(sc.C.accent, "cube", 0.14);
    sc.label(n, [x, 0.1, z], { tone: "ink3", size: 10, dy: 100, minor: true });
    return { s, b, p, i, to: new T.Vector3(x, 0.7, z), tint: new T.Color(tints[i]) };
  });

  const drifted = [
    sc.label("24px · .btn-icon", [sites[0].to.x, 0.95, sites[0].to.z], { tone: "ink2", size: 10, dy: -60, minor: true }),
    sc.label("30px · IconButton", [sites[1].to.x, 0.95, sites[1].to.z], { tone: "accent", size: 10, dy: -60, minor: true }),
    sc.label("36px · until 2026-08-20", [sites[2].to.x, 0.95, sites[2].to.z], { tone: "ink3", size: 10, dy: -60, minor: true }),
    sc.label("title= instead of the shared tooltip", [sites[6].to.x, 0.95, sites[6].to.z], { tone: "ink3", size: 10, dy: -60, minor: true, wrap: true }),
  ];
  const fixLbl = sc.label("a fix lands in the primitive", [-3.9, 1.4, 0.2], { tone: "accent", size: 11, weight: 700, dy: -50, wrap: true });
  const missLbl = sc.label("six pasted copies never get it", [1.05, 1.55, 0], { tone: "accent2", size: 12, weight: 700, dy: -50, wrap: "wide" });
  for (const l of [...drifted, fixLbl, missLbl]) sc.show(l, false);
  sc.header("components/ui/", "one primitive, one set of states", "call sites · schematic", "nine surfaces rendering the same control");

  const fix = stream(sc, { from: [-4.6, 1.6, -1.4], to: [-3.9, 0.9, 0.2], color: sc.C.ink, shape: "sphere", period: 9, duration: 0.9, lift: 0.5, count: 1 });
  sc.period = 12;
  sc.chapters = [
    { at: 0, label: "The primitive gets copied, not imported" },
    { at: 0.3, label: "The copies drift" },
    { at: 0.62, label: "A fix lands — and reaches three of nine" },
  ];
  const steps = [
    "1 · A button exists in ui/. Nine surfaces need one. Three import it; six paste the markup, because that was faster on the day.",
    "2 · Nothing changes on purpose. One copy inherits 24px from the zoom controls, another gets 36px to match the tool rail, one swaps the shared tooltip for a title= attribute. Three vocabularies within about 200px of each other.",
    "3 · Someone fixes the disabled state in ui/. The three importers pick it up. The six copies do not. That is entropy: not one bad commit, just copies nobody re-synced.",
  ];

  const camBase = sc.camera.position.clone();
  const PERIOD = 12;
  const red = new T.Color(sc.C.accent2);
  const edgeCol = new T.Color(sc.C.ink3);

  return (tt: number) => {
    const t = ((((tt % PERIOD) + PERIOD) % PERIOD) / PERIOD);
    const phase = t < 0.3 ? 0 : t < 0.62 ? 1 : 2;
    sc.setStep(steps[phase]);
    orbit(sc, camBase, tt);
    const d = seg(t, 0.32, 0.56);
    for (const { s, b, p, i, to, tint } of sites) {
      const u = seg(t, 0.02 + i * 0.022, 0.12 + i * 0.022);
      if (u > 0 && u < 1) {
        p.visible = true;
        p.position.lerpVectors(from, to, u);
        p.position.y += Math.sin(u * Math.PI) * 0.9;
        p.rotation.y = u * 6;
      } else p.visible = false;
      const arrived = seg(t, 0.12 + i * 0.022, 0.18 + i * 0.022);
      const healed = imports.has(i) ? seg(t, 0.74 + (i % 3) * 0.02, 0.8 + (i % 3) * 0.02) : 0;
      const k = d * (1 - healed);
      const size = 0.3 + (px[i] / 100 - 0.3) * k;
      b.scale.setScalar(Math.max(0.001, arrived) * (size / 0.3));
      b.position.y = 0.43 + (size / 2) * arrived;
      b.material.color.copy(base).lerp(tint, k);
      b.material.emissive.copy(base).lerp(tint, k);
      b.rotation.y = 0.35 * k * (i % 2 ? 1 : -1);
      const miss = phase === 2 && !imports.has(i) && t > 0.82 ? 0.5 + 0.5 * Math.sin(tt * 4 + i) : 0;
      s.edges.material.color.copy(edgeCol).lerp(red, miss * 0.8);
      b.material.emissiveIntensity = 0.3 + 0.5 * healed * (0.5 + 0.5 * Math.sin(tt * 5));
    }
    const fixStart = Math.floor(tt / PERIOD) * PERIOD + 0.62 * PERIOD;
    if (phase === 2) fix.tick(tt - fixStart);
    else fix.hide();
    src.material.emissiveIntensity = phase === 2 && t > 0.7 ? 0.25 + 0.1 * Math.sin(tt * 5) : 0.1;
    for (const l of drifted) sc.show(l, phase === 1 && t > 0.5);
    sc.show(fixLbl, phase === 2 && t > 0.7);
    sc.show(missLbl, phase === 2 && t > 0.82);
  };
}

/* ── FIG 3 · the ratchet, and the place it was not worth keeping ─────────── *
 * REWRITTEN against the repository rather than ported from the design, which
 * animated the `librs-lines` ratchet on src/lib.rs. That ratchet no longer
 * exists: Chris retired it on 09-25-2026, and scripts/guardrails.sh says why
 * in its own words — "lib.rs is refactored often enough that a blocking line
 * count cost more than it caught."
 *
 * So the figure shows the ratchet that DID hold, file by file, from the sizes
 * pinned on 27 August (commit eac21532) to today's. Four came down. One went
 * up, and it is drawn going up: the async contract test is 1,015 → 1,027,
 * because a branch that lowered caps met a master that had added Refine and
 * two UI nights to the same files. Its cap is still below what master alone
 * permitted, which is the arithmetic, not an exemption.
 */
const PINNED: { name: string; from: number; to: number; note: string }[] = [
  { name: "AppShell.tsx", from: 3806, to: 3564, note: "session hooks + a pure function" },
  { name: "CanvasArea.tsx", from: 2959, to: 2823, note: "cursor glyphs, arrow geometry" },
  { name: "useDrawingTools.ts", from: 1173, to: 991, note: "shared types, rubber-band previews" },
  { name: "BatchSettings.tsx", from: 1428, to: 1428, note: "at its cap, left alone" },
  { name: "contract test", from: 1015, to: 1027, note: "merge arithmetic — up, and said so" },
];

function buildRatchet(sc: SceneKit): Ticker {
  const T = sc.T;
  sc.camera.position.set(0.3, 7.4, 11.8);
  sc.camera.lookAt(0, 1.1, 0);
  sc.slab(10.4, 0.18, 3.6, sc.C.paper3).position.set(0, 0, 0);
  const TOP = 0.09;
  const KR = 0.62;
  const H = (n: number) => (n / 1000) * KR;

  const bars = PINNED.map((f, i) => {
    const x = -4.0 + i * 2.0;
    const up = f.to > f.from;
    const flat = f.to === f.from;
    const edge = up ? sc.C.accent2 : flat ? sc.C.ink3 : sc.C.accent;
    const m = sc.slab(1.15, 1, 1.0, sc.C.paper4, edge);
    m.position.set(x, TOP, 0);
    // The cap sits ON the file: the rule is that an extraction lowers the cap
    // in the same commit, so the two are never apart for long.
    const cap = sc.slab(1.45, 0.02, 1.3, edge, edge, 0.24);
    cap.position.set(x, TOP + H(f.from), 0);
    sc.label(f.name, [x, TOP + H(f.from) + 0.1, 0.55], { tone: "ink", size: 11, weight: 700, dy: -150, wrap: true });
    const cnt = sc.label(fmt(f.from), [x, TOP + H(f.from) + 0.1, 0.55], { tone: up ? "accent2" : "ink2", size: 11, dy: -55 });
    const note = sc.label(f.note, [x, TOP, 0.55], { tone: "ink3", size: 10, dy: 120, minor: true, wrap: true });
    return { m, cap, cnt, note, f, edge };
  });

  const total = sc.label("", [0, TOP + H(4200), 1.9], { tone: "accent", size: 12, weight: 700, dx: 0, dy: 0, wrap: "wide" });
  const retired = sc.label(
    "src/lib.rs had one too. Retired 09-25 — refactored often enough that a blocking count cost more than it caught.",
    [0, TOP + H(3200), 1.9],
    { tone: "ink2", size: 11, dx: 0, dy: 60, wrap: "wide" },
  );
  sc.show(retired, false);
  sc.header("max-lines", "pinned 27 Aug · errors since 26 Sep", "the rule", "an extraction lowers the cap in the same commit");

  sc.period = 12;
  sc.chapters = [
    { at: 0, label: "Pinned at the sizes they were" },
    { at: 0.34, label: "Four come down, one goes up" },
    { at: 0.72, label: "Where a ratchet was not worth keeping" },
  ];
  const steps = [
    "1 · On 27 August each of the five files past 900 lines was pinned at its exact size that day — not a round number, its measured size. The rule: this number only goes down, and an extraction lowers it in the same commit.",
    "2 · A month later, four are smaller and their caps came down with them. One is larger: the async contract test went 1,015 → 1,027 when a branch that lowered caps met a master that had grown the same files. It is written into eslint.config.mjs as merge arithmetic, because a cap that moves up quietly is the ratchet being unbolted.",
    "3 · The same idea on the Rust side did not survive. src/lib.rs is refactored often enough that a blocking line count cost more than it caught, so it was retired on 25 September. A ratchet is worth it where a file only ever accretes — not where it is genuinely being worked.",
  ];

  const camBase = sc.camera.position.clone();
  const PERIOD = 12;
  const red = new T.Color(sc.C.accent2);

  return (tt: number) => {
    const t = ((((tt % PERIOD) + PERIOD) % PERIOD) / PERIOD);
    const phase = t < 0.34 ? 0 : t < 0.72 ? 1 : 2;
    sc.setStep(steps[phase]);
    orbit(sc, camBase, tt, 1.1);

    let sum = 0;
    for (const { m, cap, cnt, f } of bars) {
      const grow = seg(t, 0.04, 0.24);
      const move = seg(t, 0.38, 0.62);
      const lines = (f.from + (f.to - f.from) * move) * grow;
      sum += lines;
      const h = Math.max(0.001, H(lines));
      m.scale.y = h;
      m.position.y = TOP + h / 2;
      cap.position.y = TOP + h;
      cnt.el.textContent = fmt(lines);
      const up = f.to > f.from;
      const hot = up && phase >= 1 && move > 0.6 ? 0.5 + 0.5 * Math.sin(tt * 4) : 0;
      cap.material.color.set(up ? sc.C.accent2 : sc.C.accent).lerp(red, hot * 0.5);
    }
    total.el.textContent = `${fmt(sum)} lines across the five`;
    sc.show(total, t > 0.24);
    sc.show(retired, phase === 2);
  };
}

const BUILDERS: Record<SceneKind, (sc: SceneKit) => Ticker> = {
  giants: buildGiants,
  drift: buildDrift,
  ratchet: buildRatchet,
};

/* ── the runtime ────────────────────────────────────────────────────────── */

/** Build a scene into `slot` and start its loop. Throws if WebGL is not
 *  available (three's renderer constructor does), which the caller turns into
 *  the static fallback. */
export function createScene(o: SceneOptions): SceneHandle {
  const { T, slot, controls, animate, backdrop = false } = o;
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  // A figure is at most ~1,100 CSS px wide. A backdrop is the whole header,
  // which at 2× on a laptop is over four million pixels a frame for a picture
  // that sits under a scrim at 85% opacity. 1.5× is sharp enough for that.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, backdrop ? 1.5 : 2));
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
    //
    // A backdrop wants the opposite. It is a picture behind a headline, not a
    // diagram anyone reads, and holding the width on a phone-shaped header
    // shrinks the whole scene to a thumbnail floating in the middle of the
    // text. So it keeps the vertical field and lets a tall box crop the sides,
    // which leaves the packets crossing the seam in the middle of the frame.
    // Below 560px it widens the field by 1.35×. The design pulled the camera
    // back by that factor instead, but the threads scene rewrites the camera's
    // position every frame, and a wider field gives nearly the same picture
    // without reaching into a builder. The two slab edges stay in view.
    const FOV_16_9 = 32;
    const REF = 16 / 9;
    const widen = backdrop ? (w < 560 ? 1.35 : 1) : Math.max(1, REF / aspect);
    sc.camera.fov =
      widen === 1
        ? FOV_16_9
        : (2 * Math.atan(Math.tan((FOV_16_9 * Math.PI) / 360) * widen) * 180) / Math.PI;
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
