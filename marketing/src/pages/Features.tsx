import { useEffect, useRef, useState } from "react";
import Footer from "../components/Footer";
import { FEATURES } from "../data/features";

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const TOTAL = FEATURES.reduce((n, g) => n + g.items.length, 0);

export default function Features() {
  // Which feature the reader is actually on — the rail marks it.
  const [current, setCurrent] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);

  // The rail follows the reader. IntersectionObserver, never a scroll listener.
  // The top margin clears the fixed nav, so a feature counts as current when
  // it's actually readable rather than while it's still behind the bar.
  //
  // Marking "whatever last fired isIntersecting" is the obvious version and
  // it's wrong: scrolling down, the NEXT item's top edge enters the band while
  // the item you're reading still fills the screen, so the highlight sits one
  // ahead of you the whole way down the page. Track the whole intersecting set
  // instead and mark the TOPMOST member — the one you're actually in.
  useEffect(() => {
    const items = [...(bodyRef.current?.querySelectorAll<HTMLElement>(".fx__item") ?? [])];
    const order = items.map((el) => el.id);
    const visible = new Set<string>();

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        const top = order.find((id) => visible.has(id));
        // Between two sections nothing is in the band. Keep the last mark
        // rather than blanking the rail in the gap.
        if (top) setCurrent(top);
      },
      { rootMargin: "-96px 0px -70% 0px" },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Keep the marked link visible without yanking the whole page: scroll the
  // rail's own box only. (`block: "nearest"` on the link would scroll the
  // window too if the rail weren't its own scroll container.)
  useEffect(() => {
    if (!current) return;
    railRef.current
      ?.querySelector<HTMLElement>(`a[href="#${current}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [current]);

  return (
    <>
      <main id="main">
        {/* A sticky rail beside the scrolling list — the page's own index,
            which never leaves while you read. */}
        <header className="page-head">
          <h1 className="page-head__title">Features</h1>
          <p className="lede">
            The whole list, straight from the repo's own docs — <span className="fig">{TOTAL}</span>{" "}
            of them. The engine ones run on your machine; the interface ones are what you touch. Pick
            a group, or just scroll.
          </p>
        </header>

        <div className="fx">
          <aside className="fx__rail" aria-label="Feature groups">
            <nav ref={railRef}>
              {FEATURES.map((g) => (
                // <details>/<summary> rather than a JS accordion: it opens and
                // closes, is keyboard-operable and announced correctly with no
                // script at all.
                <details className="fx__group" key={g.name} open>
                  <summary className="fx__summary">
                    <span>{g.name}</span>
                    <span className="fx__n">{g.items.length}</span>
                  </summary>
                  <ul className="fx__list">
                    {g.items.map((item) => {
                      const id = slug(item.name);
                      return (
                        <li key={id}>
                          <a
                            className={`fx__link${current === id ? " is-current" : ""}`}
                            href={`#${id}`}
                          >
                            {item.name}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ))}
            </nav>
          </aside>

          <div className="fx__body" ref={bodyRef}>
            {FEATURES.map((g) => (
              <section className="fx__section" key={g.name}>
                <h2 className="fx__grouphead" id={slug(g.name)}>
                  {g.name}
                </h2>
                {g.items.map((item) => (
                  <article className="fx__item" id={slug(item.name)} key={item.name}>
                    <h3 className="fx__title">{item.name}</h3>
                    <p className="fx__text">{item.body}</p>
                  </article>
                ))}
              </section>
            ))}
          </div>
        </div>
      </main>

      <Footer line={`${TOTAL} of them, and the editing ones are all free.`} />
    </>
  );
}
