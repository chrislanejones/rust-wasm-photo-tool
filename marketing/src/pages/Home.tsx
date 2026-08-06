import { useState } from "react";
import Footer from "../components/Footer";
import { CpuIcon, ListIcon, ServerIcon } from "../components/Icons";
import { EDITOR_URL, GITHUB_URL, external } from "../config";

type Where = "all" | "local" | "server";

interface Op {
  op: React.ReactNode;
  where: Exclude<Where, "all">;
  detail: React.ReactNode;
}

const OPS: Op[] = [
  { op: "Crop, filters, transforms", where: "local", detail: "Rust → WASM, SIMD128 kernels" },
  { op: "Layers, annotations, Bézier pen", where: "local", detail: "Real layer stacks, per-layer opacity" },
  { op: "Encode PNG · JPEG · WebP · AVIF", where: "local", detail: "Resize and re-compress in one round-trip" },
  {
    op: "Originals and edit history",
    where: "local",
    detail: (
      <>
        IndexedDB, undo to <span className="fig">1000</span> steps
      </>
    ),
  },
  { op: "Camera metadata", where: "local", detail: "Keep it, strip it, or drop GPS only" },
  {
    op: "Background removal, object removal, OCR",
    where: "server",
    detail: "rembg · LaMa · Convex → Replicate",
  },
  { op: "Cloud sync and share links", where: "server", detail: "Optional — the demo never uploads" },
];

const FILTERS = [
  { key: "all", label: "All operations", Icon: ListIcon },
  { key: "local", label: "Your machine", Icon: CpuIcon },
  { key: "server", label: "Server, signed in", Icon: ServerIcon },
] as const;

const CAPTION_BASE = "Every operation, and the machine it runs on.";

export default function Home() {
  const [where, setWhere] = useState<Where>("all");

  // The caption's tally is counted off the table, never typed. A caption that
  // says "5" over four rows is worse than no caption at all.
  const shown = OPS.filter((o) => where === "all" || o.where === where);
  const caption =
    where === "all"
      ? CAPTION_BASE
      : where === "local"
        ? `${shown.length} of ${OPS.length} operations run on your own machine.`
        : `${shown.length} of ${OPS.length} operations reach a server, and only once you sign in.`;

  // Cursor spotlight — scoped to the hero, never page-wide, and only where
  // there's a real pointer to follow.
  const spotlight = (e: React.PointerEvent<HTMLElement>) => {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <>
      <main id="main">
        {/* The price and the friction are marked with a highlighter band rather
            than a gradient or an italic — both are tired tells. The marker is
            also this product's own vocabulary: it's an annotation tool.
            The headline sells price, place and friction, not the engine: Rust
            and WASM mean nothing to anyone outside this trade, and "runs on your
            machine" is a precision claim rather than a selling one — a reader
            who has never heard of local-first doesn't know the alternative is
            uploading their photos, so it reads as a shrug. That claim stays
            below, beside the table that proves it row by row. Every word here
            is copy this site already ships: the Demo tier is $0 / forever with
            no signup, and the closing CTA says "No account, no upload." */}
        <header className="hero" id="hero" onPointerMove={spotlight}>
          <div className="hero__spotlight" aria-hidden="true" />
          <h1 className="hero__display hero__display--long">
            Crop it, compress it, annotate it, gallop. <mark className="mark">Free</mark> in your
            browser. <mark className="mark">No account</mark>.
          </h1>

          {/* A real browser capture, not a redrawn frame — and it happens to show
              the "annotate it" beat in the headline actually happening: a photo
              marked up in the tab, nothing uploaded. It's the LCP, so it loads
              eagerly and carries its own dimensions to hold layout. */}
          <figure className="hero__shot shot-frame">
            <img
              src="/IH-Hero-Image-August-2026.webp"
              width={2048}
              height={1219}
              fetchPriority="high"
              decoding="async"
              alt="The Image Horse editor open on a photo of a white Mercedes SUV, a magic-wand selection marching around the bonnet, with the Wand and Selection panels on the left and History and Layers on the right — five photos in the gallery strip below, all held in the browser."
            />
          </figure>
        </header>

        <hr className="rule-thick" />

        <section className="runs" id="runs">
          <header className="head-hang">
            {/* The claim sits here rather than in the hero so it lands with its
                receipts attached: the lede qualifies it in the next breath and
                the table proves it line by line. */}
            <h2 className="section__title">Nothing leaves your tab by accident.</h2>
            <p className="lede">
              Image Horse is a Rust engine compiled to WebAssembly. Editing happens on your own CPU,
              in the page, on every tier — including the free demo. Some things do reach a server.
              This table is where we say exactly which, so the choice is yours to make rather than
              ours to bury.
            </p>
          </header>

          {/* Filters the table rather than dimming it: this is a lookup, not an
              argument about what's still there. */}
          <div className="graph__scroll spec__filter">
            <div className="graph__group" role="group" aria-label="Filter operations by where they run">
              {FILTERS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  className="seg seg--where"
                  type="button"
                  aria-pressed={where === key}
                  onClick={() => setWhere(key)}
                >
                  <Icon className="seg__icon" />
                  <span className="seg__label">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <table className="spec">
            <caption className="spec__caption">{caption}</caption>
            <thead>
              <tr>
                <th scope="col">Operation</th>
                <th scope="col">Runs on</th>
                <th scope="col">Detail</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o, i) => (
                <tr key={i}>
                  <th scope="row">{o.op}</th>
                  <td>
                    <span className={`tag tag--${o.where}`}>
                      {o.where === "local" ? "Your machine" : "Server, signed in"}
                    </span>
                  </td>
                  <td className="muted">{o.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="runs__note">
            The engine is roughly <span className="fig">310&nbsp;KB</span> gzipped. That is the whole
            download, and after it lands the tab does the work.
          </p>
        </section>

        {/* The tool run, deliberately a dense typographic list not an icon grid —
            with the button set beside it, so the words have faces. The shot is
            rendered from the app's own stylesheet, not redrawn. */}
        <section className="editor" id="editor">
          <figure className="editor__shot shot-frame">
            <img
              src="/button-set.webp"
              width={832}
              height={1106}
              loading="lazy"
              decoding="async"
              alt="Image Horse's button set — Paint, Magic Wand, Crop, Resize, Download, Text, Eraser, Clone, Pen, Move, Color and Adjust, shown in their idle and selected states."
            />
          </figure>
          <div className="editor__text">
            <h2 className="section__title section__title--sm">In the editor</h2>
            <p className="editor__run">
              Brightness · Contrast · Blur · Crop · Align · Magic-wand select · Live histogram ·
              Stroke stabilizer · Rectangles · Ellipses · Arrows · Bézier pen with fill · Callout
              pins · Text with drop shadows · Emoji · Blur, pixelate and black-box redaction · Layer
              masks · Eraser · Rulers and grids · Batch logo stamping · Grid mosaic gallery ·
              OpenRaster export · Light, dark and system themes
            </p>
            <p className="lede editor__lede">
              Everything above is free and local. Sign in only when you want persistence, share
              links, or the AI passes — and the padlock in the UI tells you which is which before you
              click.
            </p>
          </div>
        </section>

        {/* Two columns: the mark alone on the left, everything that can be read
            or clicked on the right. The mark is decorative — the sentence beside
            it carries the meaning — so it is aria-hidden and never focusable. */}
        <section className="close">
          <svg className="close__mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/></svg>
          <div className="close__body">
            <p className="close__line">Open an image. No account, no upload.</p>
            <p className="close__sub">
              Once it loads, the network is optional. Drop your connection mid-edit and nothing
              stops — none of the work was leaving this machine anyway. The editing happens in
              this tab, not on a server, so there is nothing to be slow and nothing to go down.
            </p>
            <div className="close__actions">
              <a className="cta cta--fill cta--lg" href={EDITOR_URL} {...external}>
                Open the demo
              </a>
              <a className="cta cta--outline cta--lg" href={GITHUB_URL} {...external}>
                Read the source
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer line="Local is the product. The cloud is the upgrade." />
    </>
  );
}
