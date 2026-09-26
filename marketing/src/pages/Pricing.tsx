import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import { EDITOR_URL, external } from "../config";

/* /pricing — ported from the Pricing v2 design.
 *
 * The tier limits below are the ones app/src/lib/tiers.ts enforces. The design
 * file was written from this page and that file, so a number that changes there
 * has to change here too; nothing reads it automatically.
 */

type TierKey = "demo" | "free" | "pro";
type Tier = "all" | TierKey;

interface Card {
  key: TierKey;
  name: string;
  tag: string;
  /** The tag says whether this tier costs us a server. */
  server: boolean;
  price: string;
  unit: string;
  perks: string[];
  cta: string;
  lead?: boolean;
}

const CARDS: Card[] = [
  {
    key: "demo",
    name: "Demo",
    tag: "no account",
    server: false,
    price: "$0",
    unit: "forever",
    perks: [
      "Every editing tool",
      "8 layers per image",
      "12-photo gallery",
      "Edits kept in this browser",
      "No signup",
    ],
    cta: "Try it now",
  },
  {
    key: "free",
    name: "Free",
    tag: "signed in",
    server: false,
    price: "$0",
    unit: "per month",
    perks: [
      "A copy of your edits in the cloud",
      "Originals stay on your device",
      "24-photo gallery",
      "100 MB of cloud storage",
      "8 layers per image",
    ],
    cta: "Create account",
  },
  {
    key: "pro",
    name: "Pro",
    tag: "$10 / month",
    server: true,
    price: "$10",
    unit: "per month",
    perks: [
      "5 GB of cloud storage",
      "16 layers per image",
      "Background and object removal",
      "Read text out of an image",
      "50 AI passes a day, 300 a month",
      "100-photo gallery",
    ],
    cta: "Start Pro",
    lead: true,
  },
];

const Y = "yes";
const N = "—";

interface Row {
  feature: string;
  sub?: string;
  cells: [string, string, string];
}

const row = (feature: string, cells: [string, string, string], sub?: string): Row => ({
  feature,
  cells,
  sub,
});

const MATRIX: { name: string; rows: Row[] }[] = [
  {
    name: "Editing tools — on your machine, free on every tier",
    rows: [
      row("Clone stamp", [Y, Y, Y]),
      row("Paint / brush", [Y, Y, Y]),
      row("Stroke stabilizer", [Y, Y, Y], "paint, eraser, blur, redact"),
      row("Arrows, shapes, text, emoji", [Y, Y, Y]),
      row("Bézier pen", [Y, Y, Y], "re-editable paths"),
      row("Selection", [Y, Y, Y], "wand, lasso, color range, edge-aware"),
      row("Perspective, distort, skew", [Y, Y, Y], "shapes, text and paths"),
      row("Blur, pixelate and black-box redaction", [Y, Y, Y]),
      row("Magic eraser", [Y, Y, Y], "PatchMatch, on your machine"),
      row("Brightness / contrast", [Y, Y, Y]),
      row("Levels", [Y, Y, Y], "against a live histogram"),
      row("Color presets", [Y, Y, Y], "one click, one undo step"),
      row("Crop / resize", [Y, Y, Y]),
      row("Layers", ["8 per image", "8 per image", "16 per image"], "client-side stack"),
      row("Undo / redo", [Y, Y, Y]),
      row("Export PNG · JPEG · WebP · AVIF", [Y, Y, Y]),
      row("OpenRaster export and import", [Y, Y, Y], "layers intact, opens in Krita"),
      row("Batch", [Y, Y, Y], "logo, text, rename, AI rename — all local"),
    ],
  },
  {
    name: "Gallery and storage",
    rows: [
      row("Gallery", ["12 images", "24 images", "100 images"]),
      row("Auto compress all", [Y, Y, Y]),
      row("Edit persistence", [Y, Y, Y], "kept in this browser between visits"),
      row("Off-device copy of your edits", [N, Y, Y], "once you sign in"),
      row("Original files", ["on your device", "on your device", "on your device"]),
      row("Cloud storage quota", [N, "100 MB", "5 GB"]),
    ],
  },
  {
    name: "Your data in the cloud",
    rows: [
      row("Persistent history", [N, Y, Y]),
      row("Annotations sync", [N, Y, Y]),
      row("Share links", [N, Y, Y]),
    ],
  },
  {
    name: "AI features — run on a server, billed to us",
    rows: [
      row("Background removal", [N, N, Y], "rembg"),
      row("Object removal", [N, N, Y], "LaMa"),
      row("Read text out of an image", [N, N, Y], "OCR"),
      row("Daily AI passes", [N, N, "50 a day"], "resets every 24 hours"),
      row("Monthly AI passes", [N, N, "300 a month"], "resets every 30 days"),
    ],
  },
];

const TILES: { key: Tier; label: string; count: string }[] = [
  { key: "all", label: "All", count: "3 tiers" },
  { key: "demo", label: "Logged out", count: "Demo" },
  { key: "free", label: "Logged in", count: "Free" },
  { key: "pro", label: "Pro", count: "$10 / month" },
];

const HEADS: { key: TierKey; label: string }[] = [
  { key: "demo", label: "Demo" },
  { key: "free", label: "Free" },
  { key: "pro", label: "Pro" },
];

const cellKind = (t: string) => (t === Y ? "yes" : t === N ? "no" : "val");

export default function Pricing() {
  // Dims rather than hides. The matrix is a comparison, and hiding the other
  // two columns would leave one column to compare against nothing.
  const [tier, setTier] = useState<Tier>("all");
  const dimCol = (k: TierKey) => (tier !== "all" && tier !== k ? " is-dim" : "");

  return (
    <>
      <main id="main" className="pricing">
        <header className="pr-hero">
          <div className="pr-hero__lead">
            <p className="pr-hero__eyebrow">Pricing · three tiers, one price</p>
            <p className="pr-hero__figure">$0</p>
            <h1 className="pr-hero__title">Every editing tool. Every tier. Forever.</h1>
          </div>
          <div className="pr-hero__aside">
            <p className="pr-hero__deck">
              Not a trial and not a loss-leader. The editor runs on your own computer, so it costs us
              nothing per person. There is no version of this where we charge you for a crop.
            </p>
            <div className="pr-hero__actions">
              <a className="cta cta--fill pr-btn" href={EDITOR_URL} {...external}>
                Open the editor
              </a>
              <a className="cta cta--outline pr-btn" href="#matrix">
                Compare the tiers
              </a>
            </div>
          </div>
        </header>

        <section className="pr-tiers" aria-label="Tiers">
          <p className="pr-tiers__intro">
            The gates are not on the tools. They sit where our own bill lands: keeping a copy of your
            edits, cloud storage, and the AI jobs we pay a server to run.
          </p>
          <div className="pr-tiers__grid">
            {CARDS.map((c) => (
              <article
                key={c.key}
                className={`pr-card${c.lead ? " pr-card--lead" : ""}${
                  tier !== "all" && tier !== c.key ? " is-dim" : ""
                }`}
              >
                <div className="pr-card__head">
                  <h2 className="pr-card__name">{c.name}</h2>
                  <span className={`pr-card__tag${c.server ? " pr-card__tag--server" : ""}`}>
                    {c.tag}
                  </span>
                </div>
                <p className="pr-card__price">
                  <span className="pr-card__amount">{c.price}</span>
                  <span className="pr-card__unit">{c.unit}</span>
                </p>
                <ul className="pr-card__perks">
                  {c.perks.map((p) => (
                    <li key={p}>
                      <span className="pr-card__dot" aria-hidden="true" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
                <a
                  className={`cta ${c.lead ? "cta--fill" : "cta--outline"} pr-btn pr-card__cta`}
                  href={EDITOR_URL}
                  {...external}
                >
                  {c.cta}
                </a>
              </article>
            ))}
          </div>
        </section>

        <section id="matrix" className="pr-matrix" aria-label="What each tier gets">
          <div className="pr-matrix__head">
            <h2 className="pr-matrix__title">What each tier actually gets</h2>
            <p className="pr-matrix__deck">
              Editing runs on your machine on every tier. Only the server-backed rows differ. Pick a
              tier to bring its column forward.
            </p>
          </div>

          <div role="group" aria-label="Focus one tier" className="pr-matrix__tiles">
            {TILES.map((t) => (
              <button
                key={t.key}
                type="button"
                aria-pressed={tier === t.key}
                className={`pr-tile${tier === t.key ? " is-on" : ""}`}
                onClick={() => setTier(t.key)}
              >
                <span className="pr-tile__label">{t.label}</span>
                <span className="pr-tile__count">{t.count}</span>
              </button>
            ))}
          </div>

          <div className="pr-matrix__scroll">
            <table className="pr-table">
              <thead>
                <tr>
                  <th scope="col" className="pr-table__feature-head">
                    Feature
                  </th>
                  {HEADS.map((h) => (
                    <th key={h.key} scope="col" className={`pr-table__tier${dimCol(h.key)}`}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((g) => (
                  <Fragment key={g.name}>
                    <tr>
                      <th scope="rowgroup" colSpan={4} className="pr-table__group">
                        {g.name}
                      </th>
                    </tr>
                    {g.rows.map((r) => (
                      <tr key={r.feature} className="pr-table__row">
                        <th scope="row" className="pr-table__feature">
                          {r.feature}
                          {r.sub && <span className="pr-table__sub">{r.sub}</span>}
                        </th>
                        {r.cells.map((c, i) => (
                          <td
                            key={HEADS[i].key}
                            className={`pr-table__cell pr-table__cell--${cellKind(c)}${dimCol(HEADS[i].key)}`}
                          >
                            {c}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="pr-why">
          <h2 className="pr-why__title">Why the free tier is really free</h2>
          <div className="pr-why__body">
            <p className="pr-why__text">
              The editor runs on your device, so a signed-out visitor costs us nothing. That is why
              there are no &ldquo;sign in to use blur&rdquo; gates on tools that never touch a server.
              The gallery limit is the honest nudge: edit a dozen photos, want to keep them, and that
              is the moment an account is worth having. Our bill scales with paying users, not with
              drive-by traffic.
            </p>
            <Link className="cta cta--outline pr-btn pr-why__link" to="/architecture">
              See where the boundary is
            </Link>
          </div>
        </section>
      </main>

      <Footer line="Free where it runs on your machine. Paid where it runs on ours." />
    </>
  );
}
