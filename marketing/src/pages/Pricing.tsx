import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import { CrownIcon, LayersIcon, UserCheckIcon, UserXIcon } from "../components/Icons";
import { EDITOR_URL, external } from "../config";

type Tier = "all" | "demo" | "free" | "pro";

const FILTERS = [
  { key: "all", label: "All", Icon: LayersIcon },
  { key: "demo", label: "Logged out", Icon: UserXIcon },
  { key: "free", label: "Logged in", Icon: UserCheckIcon },
  { key: "pro", label: "Pro", Icon: CrownIcon },
] as const;

interface Card {
  key: Exclude<Tier, "all">;
  name: string;
  tag: string;
  tagKind: "local" | "server";
  price: string;
  unit: string;
  perks: React.ReactNode[];
  cta: string;
  lead?: boolean;
}

const CARDS: Card[] = [
  {
    key: "demo",
    name: "Demo",
    tag: "anonymous",
    tagKind: "local",
    price: "$0",
    unit: "forever",
    perks: ["All WASM tools", "3 layers per image", "12 image gallery", "Session-only", "No signup"],
    cta: "Try it now",
  },
  {
    key: "free",
    name: "Free",
    tag: "logged in",
    tagKind: "local",
    price: "$0",
    unit: "per month",
    perks: [
      "Edit sync to the cloud",
      "Originals stay on-device",
      "24 images",
      "3 projects",
      "3 layers per image",
    ],
    cta: "Create account",
  },
  {
    key: "pro",
    name: "Pro",
    tag: "$10 / month",
    tagKind: "server",
    price: "$10",
    unit: "per month",
    perks: [
      <>Cloud originals — 5&nbsp;GB, or bring your own S3</>,
      "Unlimited layers",
      "Background and object removal",
      "4× upscale",
      "Unlimited AI passes",
      <>
        100 photos <span className="muted">(coming soon)</span>
      </>,
    ],
    cta: "Start Pro",
    lead: true,
  },
];

type Cell = { kind: "yes" } | { kind: "no" } | { kind: "num"; text: React.ReactNode };
const yes: Cell = { kind: "yes" };
const no: Cell = { kind: "no" };
const num = (text: React.ReactNode): Cell => ({ kind: "num", text });

interface Row {
  feature: React.ReactNode;
  cells: [Cell, Cell, Cell];
}

interface Group {
  name: string;
  rows: Row[];
}

const sub = (label: string, note: string) => (
  <>
    {label} <span className="spec__sub">{note}</span>
  </>
);

const MATRIX: Group[] = [
  {
    name: "Editing tools — WASM, zero server cost",
    rows: [
      { feature: "Clone stamp", cells: [yes, yes, yes] },
      { feature: "Paint / brush", cells: [yes, yes, yes] },
      { feature: "Arrows, shapes, text, emoji", cells: [yes, yes, yes] },
      { feature: "Blur brush", cells: [yes, yes, yes] },
      { feature: "Brightness / contrast", cells: [yes, yes, yes] },
      { feature: "Crop / resize", cells: [yes, yes, yes] },
      {
        feature: sub("Layers", "client-side stack"),
        cells: [num("3 per image"), num("3 per image"), num("unlimited")],
      },
      { feature: "Undo / redo", cells: [yes, yes, yes] },
      { feature: "Export PNG · JPEG · WebP · AVIF", cells: [yes, yes, yes] },
    ],
  },
  {
    name: "Gallery and storage",
    rows: [
      { feature: "Gallery", cells: [num("12 images"), num("24 images"), num("100 images")] },
      { feature: "Auto compress all", cells: [yes, yes, yes] },
      { feature: sub("Edit persistence", "saved across sessions"), cells: [no, yes, yes] },
      {
        feature: "Original files",
        cells: [num("local"), num("on your device"), num("cloud or your S3")],
      },
      { feature: "Cloud storage quota", cells: [no, no, num("5 GB · or BYO S3")] },
    ],
  },
  {
    name: "Projects and data — Convex",
    rows: [
      { feature: "Projects", cells: [no, num("3 projects"), num("unlimited")] },
      { feature: "Persistent history", cells: [no, yes, yes] },
      { feature: "Annotations sync", cells: [no, yes, yes] },
      { feature: "Share links", cells: [no, num("1 active"), num("unlimited")] },
    ],
  },
  {
    name: "AI features — Replicate, billed to us",
    rows: [
      { feature: sub("Background removal", "rembg"), cells: [no, no, num("unlimited")] },
      { feature: sub("Object removal", "LaMa inpainting"), cells: [no, no, num("unlimited")] },
      { feature: sub("Auto alt text", "BLIP"), cells: [no, no, num("unlimited")] },
      { feature: sub("4× upscale", "Real-ESRGAN"), cells: [no, no, num("unlimited")] },
      { feature: sub("Auto-enhance", "histogram, runs in WASM"), cells: [no, yes, yes] },
    ],
  },
];

/** Column index per tier; column 0 is the feature name, which never dims. */
const COL: Record<Exclude<Tier, "all">, number> = { demo: 1, free: 2, pro: 3 };

export default function Pricing() {
  // Dims rather than hides. The matrix's whole job is comparison — hiding the
  // other two columns would leave you reading a single column and calling it a
  // comparison. Dimming keeps them there to be compared against.
  const [tier, setTier] = useState<Tier>("all");
  const dim = (col: number) => (tier !== "all" && col !== 0 && col !== COL[tier] ? " is-dim" : "");

  const cell = (c: Cell, col: number) => {
    const cls = `${c.kind}${dim(col)}`;
    if (c.kind === "yes") return <td className={cls}>yes</td>;
    if (c.kind === "no") return <td className={cls}>—</td>;
    return <td className={cls}>{c.text}</td>;
  };

  return (
    <>
      <main id="main">
        {/* The figure is the argument, paired with a worded headline — a bare
            number as the only hero text says nothing on its own. */}
        <header className="stat-hero">
          <p className="stat-hero__figure tnum">$0</p>
          <h1 className="stat-hero__headline">Every editing tool. Every tier. Forever.</h1>
          <p className="lede">
            Not a trial and not a loss-leader. The editor is Rust compiled to WebAssembly, so it runs
            on your CPU and costs us nothing per user. There is no version of this where we charge
            you for a crop.
          </p>
          <a className="cta cta--fill cta--lg" href={EDITOR_URL} {...external}>
            Open the demo
          </a>
        </header>

        <hr className="rule-thick" />

        <section className="tiers">
          <header className="head-hang">
            <h2 className="section__title">Three tiers</h2>
            <p className="lede">
              The gates are not on the tools. They sit where our own bill lands: Convex writes, cloud
              storage, and Replicate inference.
            </p>
          </header>

          <div className="tier-grid">
            {CARDS.map((c) => (
              <article
                key={c.key}
                className={`tier${c.lead ? " tier--lead" : ""}${
                  tier !== "all" && tier !== c.key ? " is-dim" : ""
                }`}
              >
                <div className="tier__head">
                  <h3 className="tier__name">{c.name}</h3>
                  <span className={`tag tag--${c.tagKind}`}>{c.tag}</span>
                </div>
                <p className="tier__price tnum">
                  {c.price}
                  <span className="tier__unit">{c.unit}</span>
                </p>
                <ul className="tier__list">
                  {c.perks.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
                <a
                  className={`cta ${c.lead ? "cta--fill" : "cta--outline"} tier__cta`}
                  href={EDITOR_URL}
                  {...external}
                >
                  {c.cta}
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="matrix">
          <header className="head-hang">
            <h2 className="section__title section__title--sm">What each tier actually gets</h2>
          </header>

          {/* The same segmented group and the same icons as the Architecture
              tier filter, so the tier vocabulary means one thing site-wide. */}
          <div className="graph__scroll spec__filter">
            <div className="graph__group" role="group" aria-label="Focus one tier in the matrix">
              {FILTERS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  className="seg seg--where"
                  type="button"
                  aria-pressed={tier === key}
                  onClick={() => setTier(key)}
                >
                  <Icon className="seg__icon" />
                  <span className="seg__label">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="matrix__scroll">
            <table className="spec spec--matrix">
              <caption className="spec__caption">
                Editing runs locally on every tier. Only the server-backed rows differ.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Feature</th>
                  <th scope="col" className={dim(1).trim()}>
                    Demo
                  </th>
                  <th scope="col" className={dim(2).trim()}>
                    Free
                  </th>
                  <th scope="col" className={dim(3).trim()}>
                    Pro
                  </th>
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((g) => (
                  <Fragment key={g.name}>
                    {/* a group header spans all four columns — it has no tier to dim */}
                    <tr className="spec__group">
                      <th scope="rowgroup" colSpan={4}>
                        {g.name}
                      </th>
                    </tr>
                    {g.rows.map((r, i) => (
                      <tr key={i}>
                        <th scope="row">{r.feature}</th>
                        {r.cells.map((c, ci) => (
                          <Fragment key={ci}>{cell(c, ci + 1)}</Fragment>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="principle">
          <h2 className="section__title section__title--sm">The principle</h2>
          <p className="principle__body">
            Demo mode costs us nothing, because WASM runs on your device. So there are no artificial
            “sign in to use blur” gates on tools that never touch our servers. The gallery limit is
            the honest nudge: edit a dozen photos, want to keep them, and that's the moment an
            account is worth it. Our bill scales with paying users, not with drive-by traffic.
          </p>
          <Link className="cta cta--outline cta--lg" to="/architecture">
            See where the boundary is
          </Link>
        </section>
      </main>

      <Footer line="We charge for our bills, not for your CPU." />
    </>
  );
}
