import { useEffect, useRef, useState } from "react";
import Footer from "../components/Footer";
import { FEATURES } from "../data/features";
import { getFeatureIcon, getGroupIcon } from "../data/featureIcons";

// Same breakpoint Nav.tsx uses for its own desktop/mobile split.
const DESKTOP_QUERY = "(min-width: 60.0625rem)";

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

  // 40 items open-by-default reads fine as a desktop rail; as an accordion
  // stacked above the content on a 375px phone it's a wall the reader has to
  // scroll past before reaching a single word of the page. Closed on mobile,
  // open on desktop — and re-decided on every resize across the breakpoint,
  // same as Nav's sheet giving up its open state when the window grows back.
  const [desktop, setDesktop] = useState(() => matchMedia(DESKTOP_QUERY).matches);
  useEffect(() => {
    const mq = matchMedia(DESKTOP_QUERY);
    const onChange = (e: MediaQueryListEvent) => setDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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
            <nav className="fx__panel" ref={railRef}>
              {FEATURES.map((g) => {
                const GroupIcon = getGroupIcon(g.name);
                return (
                  // <details>/<summary> rather than a JS accordion: it opens
                  // and closes, is keyboard-operable and announced correctly
                  // with no script at all.
                  <details className="fx__group" key={g.name} open={desktop}>
                    <summary className="fx__summary">
                      <GroupIcon className="fx__summary-icon" size={16} />
                      <span className="fx__summary-label" title={g.name}>
                        {g.name}
                      </span>
                      <span className="fx__n">{g.items.length}</span>
                    </summary>
                    <ul className="fx__list">
                      {g.items.map((item) => {
                        const id = slug(item.name);
                        const ItemIcon = getFeatureIcon(item.name);
                        return (
                          <li key={id}>
                            <a
                              className={`fx__link${current === id ? " is-current" : ""}`}
                              href={`#${id}`}
                              title={item.name}
                            >
                              <ItemIcon className="fx__link-icon" size={16} />
                              <span className="fx__link-label">{item.name}</span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                );
              })}
            </nav>
          </aside>

          <div className="fx__body" ref={bodyRef}>
            {FEATURES.map((g) => (
              <section className="fx__section" key={g.name}>
                <h2 className="fx__grouphead" id={slug(g.name)}>
                  {g.name}
                </h2>
                {g.items.map((item) => {
                  const ItemIcon = getFeatureIcon(item.name);
                  return (
                    <article className="fx__item" id={slug(item.name)} key={item.name}>
                      <h3 className="fx__title">
                        <ItemIcon className="fx__title-icon" size={18} />
                        {item.name}
                      </h3>
                      <p className="fx__text">{item.body}</p>
                    </article>
                  );
                })}
              </section>
            ))}
          </div>
        </div>
      </main>

      <Footer line={`${TOTAL} of them, and the editing ones are all free.`} />
    </>
  );
}
