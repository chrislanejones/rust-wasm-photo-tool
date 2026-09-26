import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import NextCards from "../components/NextCards";
import { pickNextCards } from "../data/nextCards";
import NajiArabic from "../components/NajiArabic";
import { PEOPLE, type Person } from "../data/people";
import { EDITOR_URL, external } from "../config";

/* /about — who builds this, and the horse it is named after.
 *
 * Both people sit on one cream board, portrait and text side by side, the
 * horse's row mirrored. Two entries, so not a card deck: a deck of two reads
 * as a page that is missing its third card.
 *
 * The rows come from `data/people.ts`, so adding somebody is a data edit.
 *
 * The horse's name in Arabic is an OUTLINED SVG, not text. See
 * components/NajiArabic.tsx for why: no font on this site covers Arabic, and
 * adding one spends a third-party download on a single word.
 */

/** Turn each `inlineLinks` phrase in a paragraph into an off-site anchor. */
function withLinks(text: string, links: Person["inlineLinks"]): ReactNode {
  const link = links?.find((l) => text.includes(l.text));
  if (!link) return text;
  const at = text.indexOf(link.text);
  return (
    <>
      {text.slice(0, at)}
      <a href={link.href} {...external}>
        {link.text}
      </a>
      {text.slice(at + link.text.length)}
    </>
  );
}

export default function About() {
  return (
    <>
      <main id="main">
        <header className="about-head">
          <div className="about-head__lead">
            <p className="about-head__eyebrow">About &middot; one person, one horse</p>
            <h1 className="about-head__title">Named after a horse. The horse is real.</h1>
          </div>
          <p className="about-head__deck">
            Image Horse is one person&rsquo;s project. It started as a way to crop and compress a
            photo without handing it to somebody else&rsquo;s server, and the browser turned out
            to be capable of far more than that.
          </p>
        </header>

        <section className="about-board" aria-label="The people behind Image Horse">
          {PEOPLE.map((person, i) => (
            <article
              className={`about-person${i % 2 === 1 ? " about-person--flip" : ""}`}
              key={person.id}
              id={person.id}
            >
              <figure
                className="about-person__shot"
                style={{ aspectRatio: `${person.width} / ${person.height}` }}
              >
                <img
                  src={person.image}
                  alt={person.imageAlt}
                  width={person.width}
                  height={person.height}
                  /* The first row is above the fold, so it is not lazy: a lazy
                     image there is a guaranteed layout flash. */
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                />
              </figure>

              <div className="about-person__text">
                <p className="about-person__role">{person.role}</p>
                <h2 className="about-person__name">
                  {person.name}
                  {person.nameNative && (
                    <span className="about-person__native">
                      <NajiArabic />
                    </span>
                  )}
                </h2>

                {person.bio.map((para, j) => (
                  <p className="about-person__bio" key={j}>
                    {withLinks(para, person.inlineLinks)}
                  </p>
                ))}

                {person.links && (
                  /* A list, not a row of loose anchors: a screen reader
                     announces how many there are before reading them. */
                  <ul className="about-person__links">
                    {person.links.map((link) => (
                      <li key={link.href}>
                        {link.href.startsWith("/") ? (
                          <Link className="about-pill" to={link.href}>
                            {link.label}
                          </Link>
                        ) : (
                          <a className="about-pill" href={link.href} {...external}>
                            {link.label}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          ))}
        </section>

        <section className="about-close">
          <div className="about-close__text">
            <p className="about-close__line">The editor is free and needs no account.</p>
            <p className="about-close__sub">
              It runs on your own machine. Nothing you open is uploaded to edit it.
            </p>
          </div>
          <a className="about-close__cta" href={EDITOR_URL} {...external}>
            Open the editor
          </a>
        </section>
        <NextCards cards={pickNextCards("/about")} />
      </main>

      <Footer line="The horse came first. The software took the name." />
    </>
  );
}
