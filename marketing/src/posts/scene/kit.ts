/* The runtime behind every WebGL figure on the blog: the kit a scene builder
 * draws with (SceneKit, stream, fade, orbit), and the loop that sizes,
 * drives and tears a scene down (createScene). A post supplies only its
 * builders — see engine-in-a-worker.scenes.ts, offline-by-construction.scenes.ts
 * and entropy.scenes.ts — and binds them with a one-line `createScene`.
 *
 * ONE COPY. It was three: the worker post had it, the offline post copied it
 * on 09-22 with a PARKING_LOT note that a third post was the moment to share
 * it, and the entropy post was that third post. The three had drifted by
 * nothing but comments, one optional `stream()` size and a `lookY` default,
 * which is exactly the kind of drift that turns into a fix landing in one
 * copy and not the other two. It is the same point the entropy post makes
 * about a pasted primitive, and it would be a strange post to ship on top of
 * three copies of its own runtime.
 *
 * Imperative on purpose: a scene is a render loop over a few dozen meshes and
 * a handful of absolutely positioned labels that move every frame, and
 * routing that through React state would re-render a component sixty times a
 * second to move a <div>. React owns the frame around it (figure.tsx): the
 * box, the caption, the controls and the fallback. This module owns
 * everything inside the canvas box.
 *
 * Nothing here runs at import time. Every function takes the three.js subset
 * as an argument (`T`) rather than importing it, so this file costs nothing on
 * a page that never scrolls a scene into view — and so it typechecks against
 * three without pulling the runtime into the SSR bundle's evaluated path.
 */

import type * as THREE from "three";

export type ThreeSubset = typeof import("./three");

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

export interface SceneOptions<K extends string = string> {
  T: ThreeSubset;
  /** Which of the post's builders to run — a key of the map passed to
   *  `createScene`, so a misspelled kind is a type error, not a blank box. */
  kind: K;
  colors: GlPalette;
  /** The element the canvas and the label layer are appended to. Sized by CSS. */
  slot: HTMLElement;
  /** A controls scene's step caption, written once per beat. */
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
export const seg = (t: number, a: number, b: number) => ease((t - a) / (b - a));

/** The frame a non-interactive scene shows under reduced motion, and the one
 *  `gen:og --posts` screenshots for a post's social card. The same 4.2 s in all
 *  three posts' designs — packets mid-flight in the worker post's FIG 1, the
 *  cable just parted in the offline post's, the tall tower mid-climb here. */
const FROZEN_AT = 4.2;

type Vec3 = [number, number, number];

export type Slab = THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial> & {
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
   *  scene left as the picture it still reads as.
   *
   *  TRUE BY DEFAULT. It used to be opt-in, and 60 of the blog's 61 labels
   *  opted in — the rule was written out 60 times, and the one post that
   *  forgot it (the entropy post, first draft) put sixteen labels on top of
   *  each other at 320px. Pass `minor: false` only for a label that has to
   *  survive on a phone because nothing else in the frame says what it names;
   *  a scene's side headings belong in `header()`, which is never minor. */
  minor?: boolean;
}

interface LabelRec {
  el: HTMLElement;
  anchor: THREE.Vector3;
}

/* ── the kit a scene builder works with ─────────────────────────────────── */
export class SceneKit {
  readonly T: ThreeSubset;
  readonly C: GlPalette;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly labels: LabelRec[] = [];
  readonly layer: HTMLElement;
  showLabels: boolean;
  /** Set by a controls scene; read by the runtime to build the transport. */
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
    if (opts.minor ?? true) classes.push("scene__label--minor");
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
export function stream(
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
    /** Packet edge length; `packet()`'s own default when left out. */
    size?: number;
  },
) {
  const { phase = 0, duration = 0.9, lift = 0.5, count = 4 } = o;
  const T = sc.T;
  const a = new T.Vector3(...o.from);
  const b = new T.Vector3(...o.to);
  const ps = Array.from({ length: count }, () => sc.packet(o.color, o.shape, o.size));
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

/** Fade a slab and its edge lines together, and hide it once it is gone. A
 *  mesh's face and its edges are two materials that have to move as one —
 *  fading only the face leaves a wireframe box hanging in the air — and
 *  dropping it below the threshold means `fade(x, 0)` no longer costs a draw
 *  call. */
export function fade(mesh: Slab, o: number) {
  mesh.material.transparent = true;
  mesh.material.opacity = o;
  mesh.edges.material.opacity = 0.9 * o;
  mesh.visible = o > 0.01;
}

/** The slow camera drift the scenes share: the amplitude and frequency the
 *  worker post's FIG 1 set, so a reader moving between posts is not re-taught
 *  the motion. `lookY` lifts the aim for a scene whose subject stands taller
 *  than the two-slab staging — the entropy post's towers. */
export function orbit(sc: SceneKit, base: THREE.Vector3, t: number, lookY = -0.25) {
  sc.camera.position.x = base.x + Math.sin(t * 0.25) * 0.9;
  sc.camera.position.z = base.z + Math.cos(t * 0.25) * 0.3;
  sc.camera.position.y = base.y;
  sc.camera.lookAt(0, lookY, 0);
}

/** One frame of a scene, given its clock. What a builder returns. */
export type Ticker = (t: number) => void;

/** A post's scene: builds its meshes and labels into the kit, returns its tick. */
export type Builder = (sc: SceneKit) => Ticker;


/* ── the runtime ────────────────────────────────────────────────────────── */

/** Build the post's `o.kind` scene into `slot` and start its loop. Throws if WebGL is not
 *  available (three's renderer constructor does), which the caller turns into
 *  the static fallback. */
export function createScene<K extends string>(
  builders: Readonly<Record<K, Builder>>,
  o: SceneOptions<K>,
): SceneHandle {
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
  const tick = builders[o.kind](sc);
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
