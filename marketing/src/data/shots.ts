/* The hero's time machine — one capture per stop, oldest first.
 *
 * Every frame is a real screenshot recovered from GitHub, and `href` points at
 * the commit it came out of, so each claim on this page is checkable in one
 * click. Six stops come out of this repo's own history (three of the files were
 * deleted along the way — v8.55 swept ~1.8 MB of superseded heroes — which is
 * why they are addressed by commit rather than by tag), and the two oldest come
 * from the apps this one grew out of: the same project, two names ago.
 *
 * ── why the files are re-served from /shots rather than hot-linked ──────────
 * Three reasons, all load-bearing. The site's CSP is `img-src 'self' data:`
 * (vercel.json), so a raw.githubusercontent URL would be a policy violation the
 * day the report-only header is enforced. A second host in the middle of the
 * hero is a second connection and a second thing that can be down. And GitHub's
 * raw URLs are not a contract — a moved tag or a repo turned private breaks
 * every frame at once. The pictures are ours; the provenance is the link.
 *
 * ── the size budget ────────────────────────────────────────────────────────
 * ~600 KB for the seven historical frames, and the page downloads NONE of it
 * until someone reaches for the rail (see ShotTimeline). Already-WebP captures
 * were copied byte-for-byte rather than re-encoded — a round trip through a
 * second encoder cost quality and ADDED ~15% to every one of them. Only the two
 * that weren't WebP were converted, and only the two over 1600px were scaled.
 *
 * Hand-maintained, and deliberately not generated: only a person can say which
 * frame is worth a stop and what actually changed between two of them.
 */

export interface Shot {
  /** Served from /public/shots. */
  src: string;
  /** The file's own pixels — not the box it's drawn in, which is fixed in CSS. */
  width: number;
  height: number;
  /** ISO, so the run can't be re-ordered by accident. */
  date: string;
  /** How the stamp reads: "18 Mar 2026". */
  dateLabel: string;
  /** What this stop shows — one sentence, present tense. */
  note: string;
  /** The commit on GitHub this capture came out of. */
  href: string;
  /** What that link says. A tag when the stop has one, else the short SHA. */
  sourceLabel: string;
  /** Spoken only while this frame is the current one. */
  alt: string;
  /** Smaller encodes of the same capture, for the frame that loads first.
   *  Only today's frame has them: it is the LCP image on every screen size,
   *  and a phone was downloading all 2000px of it to draw about 400. The
   *  older frames load only when someone drags the rail, so they stay one
   *  file each. `src` remains the largest size and the fallback. */
  srcSet?: string;
}

const REPO = "https://github.com/chrislanejones/rust-wasm-photo-tool/commit";

export const SHOTS: Shot[] = [
  {
    src: "/shots/2025-08-tanstack.webp",
    width: 1491,
    height: 1056,
    date: "2025-08-29",
    dateLabel: "29 Aug 2025",
    note: "Before there was an engine, and back when it was blue. A batch compressor on TanStack Start whose whole argument was the Core Web Vitals meter grading what came out.",
    href: "https://github.com/chrislanejones/multi-image-compress-and-edit/commit/28088f6ec093794be2b6064e936f6ed4a42415d3",
    sourceLabel: "multi-image-compress-and-edit",
    alt: "The 2025 app in a navy-blue theme: twelve photo thumbnails across the top, each badged with a compression percentage, a photo of a city at sunset on the canvas, and a Resize & Optimize panel on the right with width and height sliders, an Aggressive compression level, a Core Web Vitals meter reading “Needs Improvement”, and a bulk zip download.",
  },
  {
    src: "/shots/2026-01-yet-another.webp",
    width: 1461,
    height: 1106,
    date: "2026-01-28",
    dateLabel: "28 Jan 2026",
    note: "The rewrite that still called itself Yet Another Image App: ten color-coded tool squares, a text tool with three recent-text slots, and everything in JavaScript.",
    href: "https://github.com/chrislanejones/yet-another-image-app/commit/bbf175815e6cdcd56e58a194922aab12e271c480",
    sourceLabel: "yet-another-image-app",
    alt: "An early browser editor: a Tools panel of bright colored squares on the left over Font Size, Font Weight and Text Color controls, a photo captioned “The 90s” on the canvas, and a nine-photo gallery along the bottom.",
  },
  {
    src: "/shots/2026-03-rust-wasm.webp",
    width: 900,
    height: 646,
    date: "2026-03-18",
    dateLabel: "18 Mar 2026",
    note: "Three weeks into the Rust engine, on a Netlify subdomain and under the working title Clone Stamp Tool. The tool squares survived the rewrite; almost nothing else did.",
    href: `${REPO}/c3c4b5ca0b820b24702475b7da6ec29656e0c74e`,
    sourceLabel: "c3c4b5c",
    alt: "A browser window at rust-wasm-photo-tool.netlify.app: a Tools panel of colored squares with an Arrow & Pointer section — stroke width, arrow style, a ten-swatch color grid — a street photo on the canvas, and a gallery of twelve.",
  },
  {
    src: "/shots/2026-06-clone-review.webp",
    width: 860,
    height: 515,
    date: "2026-06-16",
    dateLabel: "16 Jun 2026",
    note: "The Review rail arrives on the right: History lists every step you took, and Layers is still a panel that says “Coming soon”.",
    href: `${REPO}/78af2e6cbfa609cb56a975f7f0762b7fc5da0ea6`,
    sourceLabel: "78af2e6",
    alt: "The editor with a Clone, Stamps and Emojis panel on the left — brush size, hardness and opacity — a photo annotated with a drawn heart and a “Touching Grass” speech bubble, and a Review rail on the right listing History entries.",
  },
  {
    src: "/shots/2026-06-text-bubble.webp",
    width: 900,
    height: 540,
    date: "2026-06-23",
    dateLabel: "23 Jun 2026",
    note: "A week later the text tool grows speech bubbles — style, padding, corners, tail direction — and the layer stack goes behind a sign-in.",
    href: `${REPO}/bc50e80e6c9b06611baff5f8b415c3717becb88c`,
    sourceLabel: "bc50e80",
    alt: "The editor's Text panel open on Background settings — bubble style, color swatches, padding, corners and tail direction — beside a Tokyo street photo carrying two speech-bubble captions.",
  },
  {
    src: "/shots/2026-07-ai-tools.webp",
    width: 1600,
    height: 955,
    date: "2026-07-17",
    dateLabel: "17 Jul 2026",
    note: "The server-side work gets a panel of its own — background removal, text extraction, object removal — and it is the only panel that reaches a server.",
    href: `${REPO}/035db9e7875e01d3dc3ed6adfd7e395c2af353c0`,
    sourceLabel: "v7.36",
    alt: "The editor with an AI Tools panel on the left — Remove Background, Extract Text, Remove Object, and a grayed-out 4× Upscale marked Coming Soon — a white Fiat 500 ringed in red and labeled “Window Repair” on the canvas, with History and Layers on the right.",
  },
  {
    src: "/shots/2026-07-paint-stabilizer.webp",
    width: 1600,
    height: 992,
    date: "2026-07-27",
    dateLabel: "27 Jul 2026",
    note: "The toolbar settles into five groups and stops being a color chart. Paint gains the Stroke Stabilizer; the whole interface goes quiet so the photo can be loud.",
    href: `${REPO}/767d42af15d9f3d7a5517af54fcea04adf0f435c`,
    sourceLabel: "v7.54",
    alt: "The editor in its quiet dark palette: a monochrome tool rail, a Paint panel with brush size, opacity, hardness, a color row and Stroke Stabilizer set to Off, a Tokyo crossing on the canvas, and twelve photos in the gallery strip.",
  },
  {
    src: "/IH-Hero-Image-August-2026.webp",
    width: 2048,
    height: 1219,
    date: "2026-08-06",
    dateLabel: "6 Aug 2026",
    note: "Today: magic-wand select, real layer stacks, undo to a thousand steps — and a 310 KB engine doing all of it inside the tab.",
    href: `${REPO}/4cd90e1bc9fe95375625580af0ff386954a75c2a`,
    sourceLabel: "4cd90e1",
    alt: "The Image Horse editor open on a photo of a white Mercedes SUV, a magic-wand selection marching around the bonnet, with the Wand and Selection panels on the left and History and Layers on the right — five photos in the gallery strip below, all held in the browser.",
  },
  {
    src: "/IH-Hero-Image-September-2026.webp",
    srcSet:
      "/IH-Hero-Image-September-2026-800w.webp 800w, /IH-Hero-Image-September-2026-1200w.webp 1200w, /IH-Hero-Image-September-2026.webp 2000w",
    width: 2000,
    height: 1198,
    date: "2026-09-17",
    dateLabel: "17 Sep 2026",
    note: "Today: presets you preview on the photo before you keep them, an Original / Edited split to see what changed, and a Viper shrunk 92% without leaving the tab.",
    href: `${REPO}/cb614652ff77ab3e7a49d51b13455709540da7d3`,
    sourceLabel: "v8.79",
    alt: "The Image Horse editor open on a photo of a red Viper parked by the ocean, split down the middle between Original and Edited, with the Presets panel on the left previewing Enhance and History, Layers and a histogram on the right — eight cars in the gallery strip below, the Viper tagged −92%.",
  },
];
