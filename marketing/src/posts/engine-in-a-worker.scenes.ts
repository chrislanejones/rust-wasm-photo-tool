/* The three WebGL scenes behind FIG 1, FIG 2 and FIG 4 of "The engine left
 * the main thread". FIG 1's scene also runs, unlabeled, as the post's header
 * banner (`backdrop`).
 *
 * Ported from Chris's Claude Design export (an <ih-scene> custom element),
 * with the same geometry, timing, labels and camera. Only the builders live
 * here; the kit they draw with and the loop that drives them are shared by
 * every post (scene/kit.ts), and so is the frame they render into
 * (scene/figure.tsx).
 */

import { createScene as mount, seg, stream, type Builder, type Chapter, type SceneHandle, type SceneKit, type SceneOptions, type Ticker } from "./scene/kit";

/* ── FIG 1: where things live ───────────────────────────────────────────── */
function buildThreads(sc: SceneKit): Ticker {
  const { T, C } = sc;
  sc.camera.position.set(0.3, 6.2, 9.6);
  sc.camera.lookAt(0, -0.25, 0);
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

  sc.header("Main thread", "React · pointer input · layout", "Engine worker", "engine · own wasm memory · canvas");
  sc.label("postMessage", [0, 0.9, -2.6], { tone: "ink3", size: 11 });
  sc.label("UI", [-3.6, 0.62, -1.0], { tone: "ink2", size: 11 });
  sc.label("input", [-1.9, 0.55, -1.0], { tone: "ink2", size: 11 });
  sc.label("<canvas> — element stays, surface gone", [-2.9, 0.18, 1.0], { tone: "ink3", size: 11, dy: 90 });
  sc.label("engine", [3.3, 1.08, -1.0], { tone: "ink", size: 11 });
  sc.label("linear memory", [3.3, 0.1, -1.0], { tone: "ink2", size: 11, dy: 110 });
  sc.label("OffscreenCanvas · putImageData here", [2.9, 0.22, 1.0], { tone: "accent", size: 11, dy: 90 });
  const l1 = sc.label("call { id, method, args } →", [0.35, 0.55, -0.55], { tone: "accent", size: 11, dy: -150 });
  const l2 = sc.label("← reply { id, ok, value }", [0, 0.9, -0.05], { tone: "ink2", size: 11, dy: 40 });
  const l3 = sc.label("blit → (no reply, not queued)", [0, 0.8, 1.05], { tone: "accent2", size: 11, dy: 90 });
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
    sc.camera.lookAt(0, -0.25, 0);
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
  sc.label("sender", [-2.5, 0.06, -3.6], { tone: "ink3", dy: -60 });
  sc.label("receiver (worker)", [2.5, 0.06, -3.6], { tone: "accent", dy: -60 });

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
    sc.label(names[i], [-3.85, 0.1, z], { tone: wall ? "accent2" : "ink", size: 13, weight: 700, dx: -100, dy: -90, mono: false, minor: false });
    // 10px, a rung under the verdicts opposite: the mechanism line carries the
    // longest string in the figure — `[[ArrayBufferDetachKey]]` is one
    // unbreakable 24-character token — and at 11px it does not fit the gutter
    // the nearest row leaves, so it lost its tail to an ellipsis.
    sc.label(subs[i], [-3.85, 0.1, z], { tone: "ink3", size: 10, dx: -100, dy: 10, wrap: true });
    sc.label(verdict[i], [3.85, 0.1, z], { tone: wall ? "accent2" : "ink2", size: 11, dx: 0, dy: -50, wrap: true });
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
  const bang = sc.label("TypeError", [0.2, 0.9, rows[3]], { tone: "accent2", size: 12, weight: 700 });
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
  sc.camera.position.set(0.3, 6.0, 9.6);
  sc.camera.lookAt(0, -0.25, 0);
  const main = sc.slab(4.2, 0.18, 3.6, C.paper3);
  main.position.set(-2.9, 0, 0);
  const work = sc.slab(4.2, 0.18, 3.6, C.paper4, C.accent);
  work.position.set(2.9, 0, 0);
  sc.dashed([0, 0.05, -2.6], [0, 0.05, 2.6], C.ink3);
  sc.header("Main thread", "DOM · the <canvas> element", "Engine worker", "engine · linear memory · OffscreenCanvas");
  const mem = sc.slab(1.9, 0.62, 1.1, C.paper2, C.accent);
  mem.position.set(3.3, 0.4, -1.0);
  const eng = sc.slab(1.1, 0.34, 0.7, C.accent, C.accent);
  eng.position.set(3.3, 0.88, -1.0);
  eng.material.emissive = new T.Color(C.accent);
  eng.material.emissiveIntensity = 0.25;
  sc.label("engine · linear memory", [3.3, 0.1, -1.0], { tone: "ink2", size: 11, dy: 110 });
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
  const lblCanvas = sc.label("<canvas>", [0, 0, 0], { tone: "ink", size: 11 });
  const lblOff = sc.label("OffscreenCanvas", [0, 0, 0], { tone: "accent", size: 11 });
  // Wrapped: this is the longest label in the figure and the only one that
  // overran the 46% cap the rest sit comfortably inside.
  const lblEl = sc.label("element stays in the DOM · no 2D context here any more", [-2.9, 0.18, 1.0], { tone: "ink3", size: 11, dy: 90, wrap: "wide" });
  const lblBlit = sc.label("blit → fire-and-forget", [0, 0.75, 1.05], { tone: "accent2", size: 11, dy: 90 });
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

const BUILDERS = {
  threads: buildThreads,
  doors: buildDoors,
  canvas: buildCanvas,
} satisfies Record<string, Builder>;

export type SceneKind = keyof typeof BUILDERS;

/** This post's scenes, bound to the shared runtime. scene/figure.tsx loads
 *  this module on demand, so the builders are a chunk of their own. */
export function createScene(o: SceneOptions<SceneKind>): SceneHandle {
  return mount(BUILDERS, o);
}
