import Footer from "../components/Footer";
import NajiArabic from "../components/NajiArabic";
import { PEOPLE } from "../data/people";
import { EDITOR_URL, external } from "../config";

/* The horse's name in Arabic is an OUTLINED SVG, not text — see
 * components/NajiArabic.tsx for why (no font on this site covers Arabic, and
 * adding one spends a third-party download on a single word).
 *
 * Swapped in by matching the Arabic run, so `data/people.ts` stays plain
 * strings and no author has to remember a markup convention. The range is the
 * Arabic block plus Arabic Supplement / Extended-A.
 */
const ARABIC = /([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+(?:\s+[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+)*)/g;

function withArabic(text: string) {
  return text.split(ARABIC).map((part, i) => {
    ARABIC.lastIndex = 0;
    return ARABIC.test(part) ? <NajiArabic key={i} /> : part;
  });
}

/* /about — who builds this.
 *
 * One row per person, alternating which side the portrait sits on, on the same
 * two-column grid the rest of the site uses. Not a card deck: there are two
 * entries and a deck of two reads as a page that is missing its third card.
 *
 * The rows are generated from `data/people.ts` rather than written out here,
 * so adding somebody is a data edit — and so `seo.ts` can build the page's
 * JSON-LD from the same list instead of a parallel hand-written copy.
 */
export default function About() {
  return (
    <>
      <main id="main">
        <header className="page-head">
          <h1 className="page-head__title">About</h1>
          <p className="lede">
            Image Horse is one person's project. It is named after a horse, and the horse is real.
          </p>
        </header>

        <section className="people" aria-label="The people behind Image Horse">
          {PEOPLE.map((person, i) => (
            <article
              className={`person ${i % 2 === 1 ? "person--flip" : ""}`}
              key={person.id}
              id={person.id}
            >
              <figure className="person__shot shot-frame">
                <img
                  src={person.image}
                  alt={person.imageAlt}
                  width={person.width}
                  height={person.height}
                  /* The first row is the top of the page, so it is not lazy —
                     a lazy image above the fold is a guaranteed layout flash.
                     Everything after it is below the fold and is. */
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                />
              </figure>

              <div className="person__text">
                <h2 className="person__name">{person.name}</h2>
                <p className="person__role">{person.role}</p>

                {person.bio.map((para, j) => (
                  <p key={j}>{withArabic(para)}</p>
                ))}

                {person.links && (
                  /* A list, not a row of loose anchors: a screen reader
                     announces how many there are before reading them. */
                  <ul className="person__links">
                    {person.links.map((link) => (
                      <li key={link.href}>
                        <a href={link.href} {...external}>
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          ))}
        </section>

        <section className="close">
          <div className="close__body">
            <p className="close__line">The editor is free and needs no account.</p>
            <p className="close__sub">
              It runs on your own machine. Nothing you open is uploaded to edit it.
            </p>
            <div className="close__actions">
              <a className="cta cta--fill cta--lg" href={EDITOR_URL} {...external}>
                Open the beta
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer line="The horse came first. The software took the name." />
    </>
  );
}
