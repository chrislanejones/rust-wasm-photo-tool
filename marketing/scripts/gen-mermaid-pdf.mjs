#!/usr/bin/env node
// Renders public/system-architecture.mermaid to public/system-architecture.pdf,
// the "PDF" button beside "Download the .mermaid source" on /architecture.
//
//   node marketing/scripts/gen-mermaid-pdf.mjs           (needs playwright, see gen-og-images)
//   node marketing/scripts/gen-mermaid-pdf.mjs --check   run the checks, write nothing
//
// Committed, not built, for the reason gen-og-images.mjs gives: a production
// deploy should not download a ~150 MB browser to redraw one file that changes
// a few times a year. Re-run it whenever the .mermaid file changes. The two are
// hand-kept together like the page and the .mermaid already are.
//
// ── nothing may overlap ──────────────────────────────────────────────────
// Mermaid sizes every box from the text it measures in the browser, so a box
// is only as right as that measurement. Measure with one font and draw with
// another (a webfont that arrives after the layout) and every label spills out
// of its box. So the site's own DM Sans is embedded as a data URL and LOADED
// before mermaid runs, and the PDF is printed from the same page, the same
// browser, the same font. Then the script checks the drawing it produced, and
// exits non-zero rather than write a PDF where:
//   • a label sticks out of its own box,
//   • two boxes overlap,
//   • an edge label sits on a box,
//   • a box crosses its group's title,
//   • any words overlap any other words,
//   • a line runs through a box that isn't one of its two ends, through a
//     group title, or through another line's label.
//
// ── the page ─────────────────────────────────────────────────────────────
// Sized to the drawing at 1:1, plus a half-inch margin and a title line, so a
// 14px label is ~10pt at 100% zoom. NOT Letter: the flowchart lays out at about
// 2900×3200px, and fitting that on Letter landscape scales it to 0.21 — 3px
// text, nothing overlapping and nothing readable (measured 11-23-2026; flowchart
// LR is no better, a 5466×1295 strip at 0.18). It's a vector, so it zooms
// clean, and a print dialog's "fit to page" still works for anyone who wants
// paper. The title names the version from the file's own header.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const marketing = resolve(here, "..");
const repo = resolve(marketing, "..");
const SRC = join(marketing, "public", "system-architecture.mermaid");
const OUT = join(marketing, "public", "system-architecture.pdf");

let chromium;
try {
  ({ chromium } = await import("@playwright/test"));
} catch {
  console.error("gen-mermaid-pdf needs the repo's dev dependencies: pnpm install at the root.");
  process.exit(1);
}
const require = createRequire(join(marketing, "package.json"));
const MERMAID_JS = join(dirname(require.resolve("mermaid/package.json")), "dist", "mermaid.min.js");

const source = readFileSync(SRC, "utf8");
// "%%-- Image Horse — whole-app system architecture (AS SHIPPED, v9.70, 11-23-2026)"
const header = source.split("\n")[0].replace(/^%%-*\s*/, "").trim();
const paren = header.match(/\(([^)]*)\)\s*$/);
const titleText = `Image Horse: ${header.replace(/\(([^)]*)\)\s*$/, "").replace(/^Image Horse\s*[—-]\s*/, "").trim()}`;
// "AS SHIPPED, v9.70, 11-23-2026" → "As shipped · v9.70 · 11-23-2026"
const subText = paren
  ? paren[1].split(/\s*,\s*/).map((t, i) => (i === 0 ? t.charAt(0) + t.slice(1).toLowerCase() : t)).join(" · ")
  : "";

const font = (file) =>
  `data:font/woff2;base64,${readFileSync(join(repo, "app", "public", "fonts", file)).toString("base64")}`;

// The margin and the title band are part of the page, not the drawing, so the
// drawing can never grow into them.
const MARGIN = 0.5 * 96; // CSS px at 96/in
const TITLE_H = 34;
const TITLE_GAP = 14;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "DM Sans"; src: url(${font("dm-sans-latin.woff2")}) format("woff2"); font-weight: 100 1000; unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2190-2199, U+2212, U+2215, U+FEFF, U+FFFD; }
@font-face { font-family: "DM Sans"; src: url(${font("dm-sans-latin-ext.woff2")}) format("woff2"); font-weight: 100 1000; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: "DM Sans", sans-serif; color: #1a1a1a; }
#sheet { box-sizing: border-box; padding: ${MARGIN}px; display: flex; flex-direction: column; width: max-content; }
#title { height: ${TITLE_H}px; flex: none; display: flex; align-items: baseline; justify-content: space-between; gap: 16px; font-size: 13px; color: #555; border-bottom: 1px solid #ddd; margin-bottom: ${TITLE_GAP}px; }
#title b { font-size: 15px; color: #1a1a1a; font-weight: 600; }
#fit { flex: none; }
#fit svg { display: block; }
</style></head><body><div id="sheet"><div id="title"><b id="ttl"></b><span id="sub"></span></div><div id="fit"></div></div></body></html>`;

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  await page.setContent(html);
  await page.addScriptTag({ path: MERMAID_JS });

  const result = await page.evaluate(
    async ({ source, titleText, subText }) => {
      // The font must be in before mermaid measures a single label.
      await document.fonts.load('14px "DM Sans"');
      await document.fonts.load('600 14px "DM Sans"');
      await document.fonts.ready;
      document.getElementById("ttl").textContent = titleText;
      document.getElementById("sub").textContent = subText;

      const mermaid = window.mermaid;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "neutral",
        fontFamily: '"DM Sans", sans-serif',
        themeVariables: { fontFamily: '"DM Sans", sans-serif', fontSize: "14px" },
        flowchart: {
          htmlLabels: true,
          useMaxWidth: false,
          // Room inside each box and between them, so text never touches a
          // border and edges have space to route.
          padding: 18,
          nodeSpacing: 46,
          rankSpacing: 64,
          diagramPadding: 24,
          wrappingWidth: 260,
        },
      });
      const { svg } = await mermaid.render("arch", source);
      const fit = document.getElementById("fit");
      fit.innerHTML = svg;
      const el = fit.querySelector("svg");
      el.removeAttribute("style");
      const vb = el.viewBox.baseVal;

      // 1:1 — the size it is checked at is the size it prints at.
      el.setAttribute("width", String(vb.width));
      el.setAttribute("height", String(vb.height));

      const box = (e) => {
        const r = e.getBoundingClientRect();
        return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
      };
      const hit = (a, b, slack = 0.5) =>
        a.x < b.r - slack && b.x < a.r - slack && a.y < b.b - slack && b.y < a.b - slack;
      const inside = (inner, outer, slack = 0.5) =>
        inner.x >= outer.x - slack && inner.r <= outer.r + slack && inner.y >= outer.y - slack && inner.b <= outer.b + slack;
      const within = (pt, b, inset) =>
        pt.x > b.x + inset && pt.x < b.r - inset && pt.y > b.y + inset && pt.y < b.b - inset;

      // ── group titles: top-left, painted last, on their group's fill ────
      // Mermaid centers a group's title on its top edge, which is exactly
      // where an edge into the group's middle box comes in, and it paints
      // titles BEFORE the edges, so a line drew straight through
      // "THE DEFAULT" and "TypeScript" (seen on the first render). Moved to
      // the corner, most lines miss it; painted last on an opaque chip, a line
      // that still passes goes under the words, not over them.
      const top = el.querySelector(":scope > g");
      const links = [...el.querySelectorAll("path.flowchart-link")];
      for (const g of el.querySelectorAll("g.cluster")) {
        const rect = g.querySelector(":scope > rect");
        const label = g.querySelector(":scope > g.cluster-label");
        if (!rect || !label) continue;
        const rx = rect.x.baseVal.value;
        const ry = rect.y.baseVal.value;
        const rw = rect.width.baseVal.value;
        // A title wider than its group (Engine worker's, by 4px) is set a
        // little smaller to fit on its one line. Wrapping it was tried: two
        // lines ran into the box below (the check caught it).
        const fo = label.querySelector("foreignObject");
        const div = fo?.firstElementChild;
        const room = rw - 12 - 2 * 10;
        if (fo && div && fo.width.baseVal.value > room) {
          const size = parseFloat(getComputedStyle(div).fontSize) || 14;
          const next = Math.max(11, Math.floor(size * (room / fo.width.baseVal.value) * 10) / 10);
          div.style.fontSize = `${next}px`;
          const nb = div.getBoundingClientRect();
          fo.setAttribute("width", String(Math.ceil(nb.width)));
          fo.setAttribute("height", String(Math.ceil(nb.height)));
        }
        const lb = label.getBBox();
        const tw = lb.width + 12; // with its chip
        const th = lb.height + 4;
        // Where does any line pass through the band the title will sit in?
        // Same coordinates as the rect: the cluster's parent space.
        const toRect = g.getScreenCTM().inverse();
        const blocked = [];
        for (const path of links) {
          const ctm = toRect.multiply(path.getScreenCTM());
          const len = path.getTotalLength();
          for (let d = 0; d <= len; d += 2) {
            const q = path.getPointAtLength(d).matrixTransform(ctm);
            if (q.y >= ry && q.y <= ry + 8 + th + 4 && q.x >= rx && q.x <= rx + rw) blocked.push(q.x);
          }
        }
        // The leftmost clear stretch wide enough for the chip, 8px clear of
        // any line; centered when the group is barely wider than its title.
        const pad = Math.max(0, Math.min(12, (rw - tw) / 2));
        // No clear stretch (lines enter some groups every ~200px, and their
        // titles are wider than that): the spot with the FEWEST lines. Those
        // pass under the chip, never over the words.
        let x = rx + pad;
        let fewest = Infinity;
        for (let cand = rx + pad; cand + tw <= rx + rw - pad + 0.01; cand += 2) {
          const n = new Set(
            blocked.filter((bx) => bx > cand - 8 && bx < cand + tw + 8).map((bx) => Math.round(bx)),
          ).size;
          if (n < fewest) {
            fewest = n;
            x = cand;
            if (n === 0) break;
          }
        }
        label.setAttribute("transform", `translate(${x + 6 - lb.x}, ${ry + 8 - lb.y})`);
        const fill = getComputedStyle(rect).fill;
        const toTop = top.getScreenCTM().inverse().multiply(label.getScreenCTM());
        const chip = document.createElementNS("http://www.w3.org/2000/svg", "g");
        chip.setAttribute("class", "moved-cluster-label");
        chip.setAttribute("data-cluster", g.id);
        chip.setAttribute(
          "transform",
          `matrix(${toTop.a} ${toTop.b} ${toTop.c} ${toTop.d} ${toTop.e} ${toTop.f})`,
        );
        const bb = label.getBBox();
        const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        bg.setAttribute("x", String(bb.x - 6));
        bg.setAttribute("y", String(bb.y - 2));
        bg.setAttribute("width", String(bb.width + 12));
        bg.setAttribute("height", String(bb.height + 4));
        bg.setAttribute("rx", "3");
        bg.setAttribute("fill", fill && fill !== "none" ? fill : "#ffffff");
        chip.appendChild(bg);
        label.removeAttribute("transform");
        chip.appendChild(label);
        top.appendChild(chip);
      }

      // ── what is on the page ────────────────────────────────────────────
      const problems = [];
      // "arch-flowchart-SHELL-3" → "SHELL"
      const nodeName = (id) => id.replace(/^arch-flowchart-/, "").replace(/-\d+$/, "");
      const nodes = [...el.querySelectorAll("g.node")].map((g) => {
        const shape = g.querySelector("rect, polygon, circle, ellipse, path");
        const label = g.querySelector(".nodeLabel, foreignObject div, text");
        return { id: nodeName(g.id), shape: box(shape), label: label ? box(label) : null };
      });
      const edgeLabels = [...el.querySelectorAll("g.edgeLabel")]
        .map((g) => ({
          owner: g.querySelector("[data-id]")?.getAttribute("data-id") ?? "",
          text: g.textContent.trim(),
          b: box(g.querySelector("foreignObject div, .label") ?? g),
        }))
        .filter((e) => e.b.w > 0 && e.b.h > 0 && e.text);
      const clusters = [...el.querySelectorAll("g.cluster")].map((g) => ({
        id: g.id.replace(/^arch-/, ""),
        area: box(g.querySelector(":scope > rect")),
        title: box(
          el.querySelector(`g.moved-cluster-label[data-cluster="${g.id}"] foreignObject div`) ??
            el.querySelector(`g.moved-cluster-label[data-cluster="${g.id}"]`),
        ),
        chip: box(el.querySelector(`g.moved-cluster-label[data-cluster="${g.id}"] > rect`)),
      }));
      const texts = [
        ...nodes.filter((n) => n.label).map((n) => ({ who: `box ${n.id}`, b: n.label })),
        ...edgeLabels.map((e) => ({ who: `edge label "${e.text}"`, b: e.b })),
        ...clusters.map((c) => ({ who: `group title ${c.id}`, b: c.title })),
      ];

      // ── the checks ─────────────────────────────────────────────────────
      for (const n of nodes)
        if (n.label && !inside(n.label, n.shape)) problems.push(`label sticks out of box ${n.id}`);
      for (let i = 0; i < nodes.length; i++)
        for (let j = i + 1; j < nodes.length; j++)
          if (hit(nodes[i].shape, nodes[j].shape)) problems.push(`boxes overlap: ${nodes[i].id} × ${nodes[j].id}`);
      // No words on top of other words, anywhere.
      for (let i = 0; i < texts.length; i++)
        for (let j = i + 1; j < texts.length; j++)
          if (hit(texts[i].b, texts[j].b)) problems.push(`text overlaps: ${texts[i].who} × ${texts[j].who}`);
      for (const e of edgeLabels)
        for (const n of nodes)
          if (hit(e.b, n.shape)) problems.push(`edge label "${e.text}" sits on box ${n.id}`);
      for (const c of clusters) {
        if (!inside(c.title, c.area)) problems.push(`group title ${c.id} sticks out of its group`);
        // The chip too, with room to spare: padding, not just containment.
        const pad = 4;
        const room = { x: c.area.x + pad, y: c.area.y + pad, r: c.area.r - pad, b: c.area.b - pad };
        if (!inside(c.chip, room, 0)) problems.push(`group title ${c.id}'s chip is within ${pad}px of its group's edge`);
        for (const n of nodes)
          if (hit(c.title, n.shape)) problems.push(`box ${n.id} crosses group title ${c.id}`);
      }
      // Every line, walked every 3px: it may touch its own two ends and its
      // own label, and nothing else that carries words.
      let crossings = 0;
      // Lines that pass under a group title's chip. Allowed only because the
      // chip is opaque and painted after every line, which is checked here
      // rather than assumed.
      const under = new Set();
      const lastLink = [...el.querySelectorAll("path.flowchart-link")].pop();
      for (const chip of el.querySelectorAll("g.moved-cluster-label")) {
        if (lastLink && !(lastLink.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING))
          problems.push(`group title ${chip.getAttribute("data-cluster")} is painted under the lines`);
        const bg = chip.querySelector(":scope > rect");
        if (!bg || /none|transparent|rgba\(.*,\s*0\)/.test(bg.getAttribute("fill") ?? "none"))
          problems.push(`group title ${chip.getAttribute("data-cluster")} has no opaque chip`);
      }
      for (const path of el.querySelectorAll("path.flowchart-link")) {
        const owner = path.getAttribute("data-id") ?? path.id.replace(/^arch-/, "");
        const m = owner.match(/^L_(.+?)_(.+?)_\d+$/);
        const ends = m ? [m[1], m[2]] : [];
        const ctm = path.getScreenCTM();
        const len = path.getTotalLength();
        const seen = new Set();
        for (let d = 0; d <= len; d += 3) {
          const q = path.getPointAtLength(d).matrixTransform(ctm);
          for (const n of nodes) {
            if (ends.includes(n.id) || !within(q, n.shape, 3)) continue;
            seen.add(`line ${owner} crosses box ${n.id}`);
          }
          for (const c of clusters)
            if (within(q, c.title, 1)) under.add(`${owner} under ${c.id}`);
          for (const e of edgeLabels)
            if (e.owner !== owner && within(q, e.b, 1)) seen.add(`line ${owner} crosses edge label "${e.text}"`);
        }
        crossings += seen.size;
        problems.push(...seen);
      }

      // ── the page: the drawing at 1:1, inside the margin ───────────────
      const placed = box(el);
      const sheet = box(document.getElementById("sheet"));
      const title = box(document.getElementById("title"));
      if (title.r > sheet.r - 0.5) problems.push("the title is wider than the page");

      return {
        problems,
        counts: {
          nodes: nodes.length,
          edgeLabels: edgeLabels.length,
          clusters: clusters.length,
          lines: el.querySelectorAll("path.flowchart-link").length,
          crossings,
          under: under.size,
        },
        drawing: { w: Math.round(vb.width), h: Math.round(vb.height) },
        placed,
        sheet,
      };
    },
    { source, titleText, subText },
  );

  // The drawing must sit inside the margins after scaling, too.
  const m = MARGIN - 0.5;
  const p = result.placed;
  if (p.x < m || p.y < m || p.r > result.sheet.r - m || p.b > result.sheet.b - m) {
    result.problems.push("the drawing crosses the page margin");
  }

  console.log(
    `drawing ${result.drawing.w}×${result.drawing.h}px · ${result.counts.nodes} boxes · ` +
      `${result.counts.clusters} groups · ${result.counts.edgeLabels} edge labels · ${result.counts.lines} lines checked · ` +
      `${result.counts.under} pass under a group title`,
  );
  if (result.problems.length) {
    console.error(`\n${result.problems.length} layout problem(s), no PDF written:`);
    for (const x of result.problems) console.error(`  - ${x}`);
    process.exit(1);
  }

  if (process.argv.includes("--check")) {
    console.log("check only: no overlaps, nothing written");
    process.exit(0);
  }
  const W = Math.ceil(result.sheet.w);
  const H = Math.ceil(result.sheet.h);
  const pdf = await page.pdf({
    width: `${W}px`,
    height: `${H}px`,
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    pageRanges: "1",
  });
  writeFileSync(OUT, pdf);
  console.log(
    `wrote ${OUT.replace(repo + "/", "")}: ${(W / 96).toFixed(1)} × ${(H / 96).toFixed(1)} in, ` +
      `${W > H ? "landscape" : "portrait"}, ${pdf.length.toLocaleString()} bytes`,
  );
} finally {
  await browser.close();
}
