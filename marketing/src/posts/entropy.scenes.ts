/* The animated figures of "We spent a month taking the file apart".
 *
 *   <Scene kind="giants" />           FIG 1 — the five pinned files against 900
 *   <Scene kind="drift" controls />   FIG 2 — one primitive, nine renderings
 *   <Scene kind="ratchet" controls /> FIG 3 — refactoring under a ratchet
 *   <Scene kind="giants" backdrop />  the header banner behind the headline
 *
 * Only the three builders are this post's. The kit they draw with and the
 * loop that runs them are the blog's one runtime (scene/kit.ts), which this
 * post is the reason for: it arrived as the third copy, and PARKING_LOT.md had
 * already named that as the moment to share it.
 *
 * The cost of sharing is real and worth saying: a change to the kit reaches
 * figures in posts that are already published. That is why a builder never
 * reaches into the kit for a one-figure tweak — it composes what the kit
 * already offers — and why the lift itself was checked as 28 stills of all
 * three posts against the pre-refactor build, 0 pixels different.
 *
 * Every number a scene prints is in the repository and is measured, not
 * rounded to make a point. Where a figure animates a change over time, the
 * start and end values are both real; see the comments on each builder.
 *
 * Prerender-safe: this module is only ever reached from an effect
 * (scene/figure.tsx loads it with a dynamic import), so Node never evaluates it.
 */

import type * as THREE from "three";

import { createScene as mount, fade, orbit, seg, stream, type Builder, type SceneHandle, type SceneKit, type SceneOptions, type Ticker } from "./scene/kit";

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
  // Short enough for two lines at 320px. The longer "the five pinned in
  // eslint.config.mjs · ui/ for scale" took a third line there, and this
  // scene's tallest tower reaches up into the heading row — the other posts'
  // scenes sit low enough to give a third line room, this one does not. The
  // post's source note names eslint.config.mjs; the frame does not need to.
  sc.header("Lines per file", "the five pinned caps · ui/ for scale", "900", "the max-lines ceiling");

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
    sc.label(n, [x, 0.1, z], { tone: "ink3", size: 10, dy: 100 });
    return { s, b, p, i, to: new T.Vector3(x, 0.7, z), tint: new T.Color(tints[i]) };
  });

  const drifted = [
    sc.label("24px · .btn-icon", [sites[0].to.x, 0.95, sites[0].to.z], { tone: "ink2", size: 10, dy: -60 }),
    sc.label("30px · IconButton", [sites[1].to.x, 0.95, sites[1].to.z], { tone: "accent", size: 10, dy: -60 }),
    sc.label("36px · until 2026-08-20", [sites[2].to.x, 0.95, sites[2].to.z], { tone: "ink3", size: 10, dy: -60 }),
    sc.label("title= instead of the shared tooltip", [sites[6].to.x, 0.95, sites[6].to.z], { tone: "ink3", size: 10, dy: -60, wrap: true }),
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
    const note = sc.label(f.note, [x, TOP, 0.55], { tone: "ink3", size: 10, dy: 120, wrap: true });
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

const BUILDERS = {
  giants: buildGiants,
  drift: buildDrift,
  ratchet: buildRatchet,
} satisfies Record<string, Builder>;

export type SceneKind = keyof typeof BUILDERS;

/** This post's scenes, bound to the shared runtime. scene/figure.tsx loads
 *  this module on demand, so the builders are a chunk of their own. */
export function createScene(o: SceneOptions<SceneKind>): SceneHandle {
  return mount(BUILDERS, o);
}
