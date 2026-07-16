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
        {/* Rust and WASM are marked with a highlighter band rather than a
            gradient or an italic — both are tired tells. The marker is also
            this product's own vocabulary: it's an annotation tool. */}
        <header className="hero" id="hero" onPointerMove={spotlight}>
          <div className="hero__spotlight" aria-hidden="true" />
          <h1 className="hero__display hero__display--long">
            Crop it, compress it, annotate it, gallop. That’s <mark className="mark">Rust</mark>,
            compiled to <mark className="mark">WASM</mark>.
          </h1>
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

        {/* A dense typographic run, deliberately not an icon grid. */}
        <section className="editor" id="editor">
          <h2 className="section__title section__title--sm">In the editor</h2>
          <p className="editor__run">
            Brightness · Contrast · Blur · Crop · Align · Magic-wand select · Live histogram · Stroke
            stabilizer · Rectangles · Ellipses · Arrows · Bézier pen with fill · Callout pins · Text
            with drop shadows · Emoji · Blur, pixelate and black-box redaction · Layer masks ·
            Eraser · Rulers and grids · Batch logo stamping · Grid mosaic gallery · OpenRaster export
            · Light, dark and system themes
          </p>
          <p className="lede editor__lede">
            Everything above is free and local. Sign in only when you want persistence, share links,
            or the AI passes — and the padlock in the UI tells you which is which before you click.
          </p>
        </section>

        <section className="close">
          <p className="close__line">Open an image. No account, no upload.</p>
          <a className="cta cta--fill cta--lg" href={EDITOR_URL} {...external}>
            Open the demo
          </a>
          <a className="cta cta--outline cta--lg" href={GITHUB_URL} {...external}>
            Read the source
          </a>
        </section>
      </main>

      <Footer line="Local is the product. The cloud is the upgrade." />
    </>
  );
}
