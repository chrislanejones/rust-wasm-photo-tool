/* The three WebGL scenes of "The hotel Wi-Fi died. The editor kept running." —
 * FIG 1 (the header banner too), FIG 2 and FIG 3.
 *
 * Ported from Chris's Claude Design export (an <ih-offline-scene> custom
 * element backed by offline-diagrams.js), with the same geometry, timing,
 * labels and camera. Only the builders live here. The kit and the loop were a
 * second copy of the worker post's until the entropy post made it three; they
 * are one module now (scene/kit.ts), as PARKING_LOT.md had planned for.
 */

import { createScene as mount, fade, orbit, seg, stream, type Builder, type Chapter, type SceneHandle, type SceneKit, type SceneOptions, type Ticker } from "./scene/kit";

/* ── FIG 1: the cable is cut mid-edit ───────────────────────────────────── */
function buildCut(sc: SceneKit): Ticker {
  const { T, C } = sc;
  sc.camera.position.set(0.3, 6.2, 9.6);
  sc.camera.lookAt(0, -0.25, 0);
  const net = sc.slab(4.2, 0.18, 3.6, C.paper3);
  net.position.set(-2.9, 0, 0);
  const tab = sc.slab(4.2, 0.18, 3.6, C.paper4, C.accent);
  tab.position.set(2.9, 0, 0);
  sc.dashed([0, 0.05, -2.6], [0, 0.05, 2.6], C.ink3);

  // The far side: everything that needs a wire.
  const CLOUD: [number, number, string, number][] = [
    [-3.8, -1.0, "Convex · sync", -60],
    [-2.0, -1.0, "Clerk · sign-in", 95],
    [-3.8, 1.0, "Replicate · AI", -60],
    [-2.0, 1.0, "ufs.sh · sample images", 95],
  ];
  const cloud = CLOUD.map(([x, z, name, dy]) => {
    const s = sc.slab(1.3, 0.4, 0.9, C.paper4, C.ink3);
    s.position.set(x, 0.29, z);
    sc.label(name, [x, dy > 0 ? 0.1 : 0.55, z], { tone: "ink3", size: 11, dy, minor: true });
    return s;
  });

  // The tab: UI, engine over its own memory, the canvas, IndexedDB.
  const ui = sc.slab(1.3, 0.45, 0.9, C.paper4);
  ui.position.set(1.8, 0.32, -1.1);
  const mem = sc.slab(1.6, 0.55, 1.0, C.paper2, C.accent);
  mem.position.set(3.9, 0.37, -1.1);
  const eng = sc.slab(1.0, 0.32, 0.65, C.accent, C.accent);
  eng.position.set(3.9, 0.8, -1.1);
  eng.material.emissive = new T.Color(C.accent);
  eng.material.emissiveIntensity = 0.25;
  const cv = sc.slab(1.3, 0.06, 0.8, C.paper3, C.accent);
  cv.position.set(1.8, 0.13, 0.3);
  const ctx = sc.slab(1.1, 0.02, 0.6, C.accent, C.accent, 0.85);
  ctx.position.set(1.8, 0.18, 0.3);
  ctx.material.emissive = new T.Color(C.accent);
  const idb = sc.slab(3.4, 0.28, 0.9, C.paper2, C.ink2);
  idb.position.set(2.9, 0.23, 1.3);
  void cv;
  void idb;

  // The cable, in two halves so it can snap.
  const cabL = sc.slab(1.4, 0.07, 0.07, C.ink2, C.ink2);
  cabL.position.set(-0.7, 0.35, -0.3);
  const cabR = sc.slab(1.4, 0.07, 0.07, C.ink2, C.ink2);
  cabR.position.set(0.7, 0.35, -0.3);
  const queue = Array.from({ length: 5 }, () => sc.packet(C.accent, "cube", 0.13));

  sc.header("Network", "Convex · Clerk · Replicate · sample images", "Browser tab", "UI · engine worker · IndexedDB");
  sc.label("UI · pointer", [1.8, 0.1, -1.1], { tone: "ink2", size: 11, dy: 95, minor: true });
  sc.label("engine · own wasm memory", [3.9, 1.0, -1.1], { tone: "ink", size: 11, dy: -20, minor: true });
  sc.label("<canvas>", [1.8, 0.2, 0.3], { tone: "accent", size: 11, dy: 90, minor: true });
  sc.label("IndexedDB · originals · op log · keyframes", [2.9, 0.3, 1.3], { tone: "ink2", size: 11, dy: 110, minor: true });
  const wire = sc.label("sync · sign-in · AI over the wire", [0, 1.5, -0.3], { tone: "ink3", size: 11, dy: -50, minor: true });
  const off = sc.label("offline — no wire needed here", [0, 1.5, -0.3], { tone: "accent2", size: 12, weight: 700, dy: -50, minor: true });
  const held = sc.label("held · replays on reconnect", [0.9, 0.3, 0.9], { tone: "accent", size: 11, dy: 90, minor: true });
  sc.show(off, false);
  sc.show(held, false);

  const strokes = stream(sc, { from: [1.8, 0.6, -1.1], to: [3.9, 0.95, -1.1], color: C.ink3, shape: "sphere", period: 0.5, duration: 0.7, lift: 0.4 });
  const blits = stream(sc, { from: [3.9, 0.5, -0.9], to: [1.8, 0.3, 0.3], color: C.accent2, shape: "disc", period: 0.3, duration: 0.6, lift: 0.3, count: 6, size: 0.12 });
  const saves = stream(sc, { from: [3.9, 0.4, -0.6], to: [3.4, 0.4, 1.3], color: C.ink2, shape: "cube", period: 1.7, duration: 0.9, lift: 0.5, count: 2, size: 0.12 });
  const sync = stream(sc, { from: [1.0, 0.5, -0.3], to: [-3.8, 0.5, -1.0], color: C.accent, shape: "cube", period: 0.8, duration: 1.1, lift: 0.6 });
  const auth = stream(sc, { from: [-2.0, 0.5, -1.0], to: [1.0, 0.5, -0.3], color: C.ink3, shape: "sphere", period: 1.1, phase: 0.4, duration: 1.0, lift: 0.4, count: 3 });
  const camBase = sc.camera.position.clone();
  const red = new T.Color(C.accent2);
  const grey = new T.Color(C.ink2);
  const dim = new T.Color(C.paper3);
  const paper4 = new T.Color(C.paper4);
  const PERIOD = 10;
  return (tt) => {
    const t = (((tt % PERIOD) + PERIOD) % PERIOD) / PERIOD;
    orbit(sc, camBase, tt);
    strokes.tick(tt);
    blits.tick(tt);
    saves.tick(tt);
    ctx.material.emissiveIntensity = 0.25 + 0.2 * Math.sin(tt * 6);
    const snap = seg(t, 0.33, 0.37) - seg(t, 0.93, 0.97); // 0 joined → 1 cut → 0 joined
    const connected = snap < 0.5;
    cabL.position.x = -0.7 - 0.18 * snap;
    cabL.rotation.z = -0.4 * snap;
    cabR.position.x = 0.7 + 0.18 * snap;
    cabR.rotation.z = 0.4 * snap;
    const flash = t > 0.33 && t < 0.5 ? 1 - (t - 0.33) / 0.17 : 0;
    for (const c of [cabL, cabR]) {
      c.material.color.copy(grey).lerp(red, snap * 0.8);
      c.material.emissive = red;
      c.material.emissiveIntensity = flash * 0.6;
    }
    cloud.forEach((s) => {
      s.material.color.copy(paper4).lerp(dim, snap * 0.8);
      fade(s, 1 - 0.55 * snap);
    });
    if (connected) {
      sync.tick(tt);
      auth.tick(tt);
    } else {
      sync.hide();
      auth.hide();
    }
    const nq = connected ? 0 : Math.min(5, Math.floor((t - 0.37) / 0.1));
    queue.forEach((q, i) => {
      q.visible = i < nq;
      q.position.set(1.0 - i * 0.02, 0.42 + i * 0.16, 0.35);
      q.rotation.y = tt * 0.8;
    });
    sc.show(wire, connected);
    sc.show(off, !connected);
    sc.show(held, nq > 0);
  };
}

/* ── FIG 2: the IndexedDB round trip ────────────────────────────────────── */
const IDB_STEPS = [
  "1 · Every committed edit appends an op to the engine's log, in arrival order. It lives in the worker's own memory — nothing has touched disk yet.",
  "2 · oplogPersistence.ts debounces ~2 s after the last change (or fires at 25 unpersisted ops), encodes outside the transaction, then commits op chunks, a PNG keyframe and the manifest in one Dexie transaction. No network anywhere in this path.",
  "3 · The tab closes, the battery dies, the browser crashes. The worker and its memory are gone. The three stores are not — IndexedDB is on the device's disk.",
  "4 · Next open: the base keyframe and the op frames come back out, oplog_restore() replays them and seeks the persisted cursor. Undo history included. The working copy is the fallback if anything fails validation.",
];

const IDB_CHAPTERS: Chapter[] = [
  { at: 0, label: "Edits land in the worker's op log" },
  { at: 0.25, label: "~2 s later: one transaction into IndexedDB" },
  { at: 0.5, label: "The tab closes" },
  { at: 0.7, label: "Restore replays the log" },
];

function buildIdb(sc: SceneKit): Ticker {
  const { T, C } = sc;
  sc.camera.position.set(0.3, 6.0, 9.6);
  sc.camera.lookAt(0, -0.25, 0);
  const wk = sc.slab(4.2, 0.18, 3.6, C.paper3);
  wk.position.set(-2.9, 0, 0);
  const db = sc.slab(4.2, 0.18, 3.6, C.paper4, C.accent);
  db.position.set(2.9, 0, 0);
  sc.dashed([0, 0.05, -2.6], [0, 0.05, 2.6], C.ink3);
  sc.header("Engine worker", "engine · linear memory · live op log", "IndexedDB · Dexie", "opLogs · keyframes · oplogManifests");
  void wk;
  void db;

  const ui = sc.slab(0.7, 0.4, 0.7, C.paper4);
  ui.position.set(-4.5, 0.29, -0.6);
  const mem = sc.slab(2.0, 0.62, 1.1, C.paper2, C.accent);
  mem.position.set(-2.5, 0.4, -0.6);
  const eng = sc.slab(1.1, 0.34, 0.7, C.accent, C.accent);
  eng.position.set(-2.5, 0.88, -0.6);
  eng.material.emissive = new T.Color(C.accent);
  eng.material.emissiveIntensity = 0.25;
  const ghost = sc.wire(2.0, 0.62, 1.1, C.ink3);
  ghost.position.copy(mem.position);
  ghost.visible = false;
  const tray = sc.slab(2.6, 0.06, 0.5, C.paper2, C.accent);
  tray.position.set(-2.9, 0.12, 1.0);

  const N = 8;
  const ops = Array.from({ length: N }, (_, i) => {
    const p = sc.packet(C.accent, "cube", 0.18);
    p.position.set(-4.05 + i * 0.33, 0.25, 1.0);
    return p;
  });

  const STORES: [number, number, string, number][] = [
    [2.0, -1.1, "opLogs · chunks", -60],
    [3.8, -1.1, "keyframes · PNG", 95],
    [2.9, 0.9, "oplogManifests · counts · cursor", 100],
  ];
  const stores = STORES.map(([x, z, name, dy]) => {
    const s = sc.slab(1.3, 0.4, 0.9, C.paper2, C.ink2);
    s.position.set(x, 0.29, z);
    s.material.emissive = new T.Color(C.accent);
    sc.label(name, [x, dy > 0 ? 0.1 : 0.55, z], { tone: "ink2", size: 11, dy, minor: true });
    return s;
  });

  sc.label("input", [-4.5, 0.5, -0.6], { tone: "ink2", size: 11, minor: true });
  const opsLbl = sc.label("op log · 0 ops", [-2.9, 0.15, 1.0], { tone: "accent", size: 11, dy: 90, minor: true });
  const gone = sc.label("tab closed — engine and memory gone", [-2.5, 1.6, -0.6], { tone: "accent2", size: 12, weight: 700, dy: -50, minor: true });
  const txn = sc.label("one readwrite transaction", [0, 1.6, -0.2], { tone: "accent", size: 11, dy: -50, minor: true });
  const back = sc.label("oplog_restore() replays", [0, 1.6, -0.2], { tone: "ink", size: 11, dy: -50, minor: true });
  sc.show(gone, false);
  sc.show(txn, false);
  sc.show(back, false);

  const strokes = stream(sc, { from: [-4.5, 0.55, -0.6], to: [-2.5, 1.0, -0.6], color: C.ink3, shape: "sphere", period: 0.45, duration: 0.6, lift: 0.4 });
  const outChunk = stream(sc, { from: [-1.7, 0.3, 1.0], to: [2.0, 0.5, -1.1], color: C.accent, shape: "cube", period: 9, duration: 1.1, lift: 0.9, count: 1 });
  const outKey = stream(sc, { from: [-1.5, 0.5, -0.6], to: [3.8, 0.5, -1.1], color: C.ink2, shape: "disc", period: 9, phase: 0.25, duration: 1.1, lift: 0.9, count: 1 });
  const outMan = stream(sc, { from: [-1.5, 0.5, -0.3], to: [2.9, 0.5, 0.9], color: C.ink3, shape: "sphere", period: 9, phase: 0.5, duration: 1.1, lift: 0.9, count: 1 });
  const inKey = stream(sc, { from: [3.8, 0.5, -1.1], to: [-2.5, 0.6, -0.6], color: C.ink2, shape: "disc", period: 9, duration: 1.1, lift: 0.9, count: 1 });
  const inChunk = stream(sc, { from: [2.0, 0.5, -1.1], to: [-2.9, 0.3, 1.0], color: C.accent, shape: "cube", period: 9, phase: 0.3, duration: 1.1, lift: 0.9, count: 1 });
  const inMan = stream(sc, { from: [2.9, 0.5, 0.9], to: [-2.5, 1.0, -0.6], color: C.ink3, shape: "sphere", period: 9, phase: 0.55, duration: 1.1, lift: 0.9, count: 1 });

  sc.period = 12;
  sc.chapters = IDB_CHAPTERS;
  let shownStep = -1;
  const camBase = sc.camera.position.clone();
  const PERIOD = sc.period;
  return (tt) => {
    const t = (((tt % PERIOD) + PERIOD) % PERIOD) / PERIOD;
    const phase = t < 0.25 ? 0 : t < 0.5 ? 1 : t < 0.7 ? 2 : 3;
    if (phase !== shownStep) {
      shownStep = phase;
      sc.setStep(IDB_STEPS[phase]);
    }
    orbit(sc, camBase, tt);
    let n =
      phase === 0
        ? Math.min(N, Math.floor((t / 0.25) * (N + 1)))
        : phase < 3
          ? N
          : Math.min(N, Math.floor(seg(t, 0.78, 0.98) * (N + 1)));
    if (phase === 2) n = Math.round(N * (1 - seg(t, 0.5, 0.6)));
    ops.forEach((p, i) => {
      p.visible = i < n;
      p.rotation.y = tt * 0.6;
    });
    opsLbl.el.textContent =
      phase === 3 ? `op log · ${n} ops · cursor ${n} — restored` : `op log · ${n} ops · cursor ${n}`;
    if (phase === 0) strokes.tick(tt);
    else strokes.hide();
    const wStart = Math.floor(tt / PERIOD) * PERIOD + 0.25 * PERIOD;
    if (phase === 1) {
      outChunk.tick(tt - wStart);
      outKey.tick(tt - wStart);
      outMan.tick(tt - wStart);
    } else {
      outChunk.hide();
      outKey.hide();
      outMan.hide();
    }
    const lit = phase === 1 ? seg(t, 0.33, 0.4) : phase >= 2 ? 1 : 0;
    stores.forEach((s, i) => {
      s.material.emissiveIntensity = lit * (0.18 + 0.08 * Math.sin(tt * 4 + i));
      s.edges.material.color.set(lit > 0.5 ? C.accent : C.ink2);
    });
    const alive = phase < 2 ? 1 : phase === 2 ? 1 - seg(t, 0.5, 0.6) : seg(t, 0.72, 0.8);
    fade(eng, Math.max(0.06, alive));
    fade(mem, Math.max(0.06, alive));
    fade(ui, Math.max(0.2, alive));
    fade(tray, Math.max(0.3, alive));
    ghost.visible = alive < 0.5;
    const rStart = Math.floor(tt / PERIOD) * PERIOD + 0.7 * PERIOD;
    if (phase === 3) {
      inKey.tick(tt - rStart);
      inChunk.tick(tt - rStart);
      inMan.tick(tt - rStart);
    } else {
      inKey.hide();
      inChunk.hide();
      inMan.hide();
    }
    sc.show(gone, phase === 2);
    sc.show(txn, phase === 1);
    sc.show(back, phase === 3);
  };
}

/* ── FIG 3: the precache — shell and engine from Cache Storage ─────────── */
const CACHE_STEPS = [
  "1 · First visit. The shell, styles, fonts and the 817 KB engine come down from the origin — and the service worker's install step writes the same nine build-hashed files into Cache Storage.",
  "2 · Repeat load. Every precached asset is served from Cache Storage; the network is asked for exactly one thing, version.json, fetched no-store and never cached, so a stale shell can be caught by the skew guard.",
  "3 · Offline. The origin is unreachable. The shell and engine load from cache; the editor boots to the same UI, minus the sign-in button. Sign-in, sync and sample images are the only absentees.",
];

const CACHE_CHAPTERS: Chapter[] = [
  { at: 0, label: "First visit — everything from the network" },
  { at: 0.34, label: "Repeat load — shell and engine from Cache Storage" },
  { at: 0.67, label: "Offline — the tab boots anyway" },
];

function buildCache(sc: SceneKit): Ticker {
  const { T, C } = sc;
  sc.camera.position.set(0.3, 6.0, 9.6);
  sc.camera.lookAt(0, -0.25, 0);
  const net = sc.slab(4.2, 0.18, 3.6, C.paper3);
  net.position.set(-2.9, 0, 0);
  const br = sc.slab(4.2, 0.18, 3.6, C.paper4, C.accent);
  br.position.set(2.9, 0, 0);
  sc.dashed([0, 0.05, -2.6], [0, 0.05, 2.6], C.ink3);
  sc.header("Network", "imagehorse.app origin · version.json", "Browser", "the tab · Cache Storage: js · css · html · wasm · woff2");
  void net;
  void br;

  const origin = sc.slab(1.4, 1.1, 1.0, C.paper4, C.ink2);
  origin.position.set(-2.9, 0.64, -0.7);
  const vj = sc.slab(0.9, 0.28, 0.6, C.paper4, C.ink3);
  vj.position.set(-2.9, 0.23, 1.2);
  const page = sc.slab(1.7, 0.5, 1.1, C.paper2, C.accent);
  page.position.set(3.7, 0.34, -1.0);
  page.material.emissive = new T.Color(C.accent);
  const tray = sc.slab(3.2, 0.1, 1.0, C.paper2, C.accent);
  tray.position.set(2.9, 0.14, 1.0);

  const N = 9;
  const assets = Array.from({ length: N }, (_, i) => {
    const p = sc.packet(i === 4 ? C.accent : C.ink2, "cube", 0.22);
    p.position.set(1.6 + i * 0.32, 0.31, 1.0);
    p.material.emissiveIntensity = 0.3;
    return p;
  });

  sc.label("origin · 9 hashed assets · ~3.6 MB", [-2.9, 1.2, -0.7], { tone: "ink2", size: 11, dy: -20, minor: true });
  sc.label("version.json · never precached · no-store", [-2.9, 0.4, 1.2], { tone: "ink3", size: 11, dy: 80, minor: true });
  sc.label("the tab · index.html", [3.7, 0.6, -1.0], { tone: "ink", size: 11, minor: true });
  sc.label("Cache Storage · precache", [2.9, 0.2, 1.0], { tone: "accent", size: 11, dy: 110, minor: true });
  const eng = sc.label("stamp_tool.wasm · 817 KB", [1.6 + 4 * 0.32, 0.42, 1.0], { tone: "accent", size: 10, dy: -80, minor: true });
  const dead = sc.label("no network", [-2.9, 1.4, -0.7], { tone: "accent2", size: 12, weight: 700, dy: -140, minor: true });
  const skew = sc.label("build hash → skew guard", [0.4, 1.4, 0.2], { tone: "ink3", size: 11, dy: -50, minor: true });
  sc.show(dead, false);
  sc.show(skew, false);
  sc.show(eng, false);

  const dl = stream(sc, { from: [-2.9, 1.0, -0.7], to: [3.7, 0.6, -1.0], color: C.ink2, shape: "cube", period: 0.45, duration: 1.0, lift: 0.9, count: 5, size: 0.13 });
  const fill = stream(sc, { from: [-2.9, 0.9, -0.5], to: [2.9, 0.3, 1.0], color: C.accent, shape: "cube", period: 0.45, phase: 0.2, duration: 1.0, lift: 0.7, count: 5, size: 0.13 });
  const hit = stream(sc, { from: [2.9, 0.3, 0.9], to: [3.7, 0.6, -1.0], color: C.accent, shape: "cube", period: 0.35, duration: 0.6, lift: 0.7, count: 5, size: 0.13 });
  const ver = stream(sc, { from: [-2.9, 0.4, 1.2], to: [3.7, 0.6, -1.0], color: C.ink3, shape: "sphere", period: 4, duration: 1.3, lift: 1.0, count: 1 });

  sc.period = 12;
  sc.chapters = CACHE_CHAPTERS;
  let shownStep = -1;
  const camBase = sc.camera.position.clone();
  const red = new T.Color(C.accent2);
  const base = new T.Color(C.paper4);
  const PERIOD = sc.period;
  return (tt) => {
    const t = (((tt % PERIOD) + PERIOD) % PERIOD) / PERIOD;
    const phase = t < 0.34 ? 0 : t < 0.67 ? 1 : 2;
    if (phase !== shownStep) {
      shownStep = phase;
      sc.setStep(CACHE_STEPS[phase]);
    }
    orbit(sc, camBase, tt);
    const n = phase === 0 ? Math.min(N, Math.floor(seg(t, 0.04, 0.32) * (N + 1))) : N;
    assets.forEach((p, i) => {
      p.visible = i < n;
      p.material.emissiveIntensity = phase >= 1 ? 0.45 + 0.15 * Math.sin(tt * 4 + i) : 0.3;
    });
    if (phase === 0) {
      dl.tick(tt);
      fill.tick(tt);
    } else {
      dl.hide();
      fill.hide();
    }
    if (phase >= 1) hit.tick(tt);
    else hit.hide();
    const vStart = Math.floor(tt / PERIOD) * PERIOD + 0.34 * PERIOD;
    if (phase === 1) ver.tick(tt - vStart);
    else ver.hide();
    const offline = phase === 2 ? seg(t, 0.67, 0.72) : 0;
    fade(origin, 1 - 0.75 * offline);
    fade(vj, 1 - 0.75 * offline);
    origin.material.color.copy(base).lerp(red, offline * 0.35);
    page.material.emissiveIntensity = (phase >= 1 ? 0.2 : 0.05) + 0.08 * Math.sin(tt * 5);
    tray.edges.material.color.set(n === N ? C.accent : C.ink3);
    sc.show(dead, offline > 0.5);
    sc.show(skew, phase === 1 && t > 0.38 && t < 0.5);
    sc.show(eng, n > 4);
  };
}

const BUILDERS = {
  cut: buildCut,
  idb: buildIdb,
  cache: buildCache,
} satisfies Record<string, Builder>;

export type SceneKind = keyof typeof BUILDERS;

/** This post's scenes, bound to the shared runtime. scene/figure.tsx loads
 *  this module on demand, so the builders are a chunk of their own. */
export function createScene(o: SceneOptions<SceneKind>): SceneHandle {
  return mount(BUILDERS, o);
}
