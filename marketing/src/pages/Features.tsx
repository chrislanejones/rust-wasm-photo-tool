import { useState } from "react";
import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import NextCards from "../components/NextCards";
import { pickNextCards } from "../data/nextCards";
import { EDITOR_URL, external } from "../config";
import { CARD_SECTIONS, CARD_TOTAL, type CardGroupKey } from "../data/featureCards";
import { featureSlug, getFeatureIcon } from "../data/featureIcons";

/* /features — everything the editor does, in plain words.
 *
 * Every card is one entry in features.ts, which is generated from
 * docs/Features.md, so the count on this page is the repo's own count and
 * cannot drift. featureCards.ts adds what the docs don't carry: the group a
 * feature belongs to by what you're trying to do, a plain line first, and the
 * engineering line trimmed to fit underneath.
 *
 * The cards sit on a light panel, the same register-of-things surface as
 * /in-the-works. Each keeps the anchor id the ⌘K palette deep-links to.
 */

type Filter = "all" | CardGroupKey;

export default function Features() {
  const [active, setActive] = useState<Filter>("all");
  const shown = CARD_SECTIONS.filter((g) => active === "all" || g.key === active);

  const tiles: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: CARD_TOTAL },
    ...CARD_SECTIONS.map((g) => ({ key: g.key, label: g.short, count: g.items.length })),
  ];

  return (
    <>
      <main id="main">
        <header className="fxv-head">
          <div className="fxv-head__lead">
            <p className="fxv-head__eyebrow">
              Features &middot; {CARD_TOTAL} of them, from the repo&rsquo;s own list
            </p>
            <h1 className="fxv-head__title">Everything the editor does, in plain words.</h1>
          </div>
          <p className="fxv-head__deck">
            Annotate, select, enhance, export &mdash; all of it runs on your own machine, and the
            editing tools are free. Pick a group, or just scroll. Each card has a plain line first
            and the engineering line underneath.
          </p>
        </header>

        <section className="fxv-filter" aria-label="Filter features by group">
          <div role="group" className="fxv-filter__grid">
            {tiles.map((t) => (
              <button
                key={t.key}
                type="button"
                aria-pressed={active === t.key}
                className={`fxv-tile${active === t.key ? " is-on" : ""}`}
                onClick={() => setActive((a) => (a === t.key ? "all" : t.key))}
              >
                <span className="fxv-tile__label">{t.label}</span>
                <span className="fxv-tile__count">{t.count}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="fxv-board" aria-label="Feature list">
          {shown.map((g) => (
            <div className="fxv-group" key={g.key}>
              <div className="fxv-group__head">
                <h2 className="fxv-group__name">
                  {g.name}
                  <span className="fxv-group__count">{g.items.length}</span>
                </h2>
                <p className="fxv-group__blurb">{g.blurb}</p>
              </div>
              <ul className="fxv-cards">
                {g.items.map((f) => {
                  const Icon = getFeatureIcon(f.name);
                  return (
                    <li className="fxv-card" id={featureSlug(f.name)} key={f.name}>
                      <h3 className="fxv-card__name">
                        <span className="fxv-card__chip" aria-hidden="true">
                          <Icon size={18} />
                        </span>
                        {f.title}
                      </h3>
                      <p className="fxv-card__plain">{f.plain}</p>
                      {f.detail && <p className="fxv-card__detail">{f.detail}</p>}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>

        <section className="fxv-close">
          <p className="fxv-close__line">
            {CARD_TOTAL} of them, and the editing ones are all free.
          </p>
          <div className="fxv-close__actions">
            <a className="fxv-btn fxv-btn--fill" href={EDITOR_URL} {...external}>
              Open the editor
            </a>
            <Link className="fxv-btn fxv-btn--line" to="/trail-log">
              See what shipped this month
            </Link>
          </div>
        </section>
        <NextCards cards={pickNextCards("/features")} />
      </main>

      <Footer line={`${CARD_TOTAL} of them, and the editing ones are all free.`} />
    </>
  );
}
