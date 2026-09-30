import { Fragment, type ReactElement, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { EDITOR_URL, external } from "../config";
import type { Faq } from "../data/openraster";

/* The question list on the four OpenRaster pages. The answers are plain text
 * (seo.ts puts the same strings in the JSON-LD); `links` marks the phrases
 * that are links on the page. "editor" means the editor, off-site. */

function answer(f: Faq): ReactNode {
  let parts: (string | ReactElement)[] = [f.a];
  for (const { text, to } of f.links ?? []) {
    parts = parts.flatMap((p): (string | ReactElement)[] => {
      if (typeof p !== "string" || !p.includes(text)) return [p];
      const [before, ...rest] = p.split(text);
      const link =
        to === "editor" ? (
          <a href={EDITOR_URL} {...external}>
            {text}
          </a>
        ) : (
          <Link to={to}>{text}</Link>
        );
      return [before, link, rest.join(text)];
    });
  }
  return parts.map((p, i) => <Fragment key={i}>{p}</Fragment>);
}

export default function OraFaq({ faq }: { faq: readonly Faq[] }) {
  return (
    <div className="ora-faq">
      {faq.map((f) => (
        <div className="ora-faq__item" key={f.q}>
          <h3>{f.q}</h3>
          <p>{answer(f)}</p>
        </div>
      ))}
    </div>
  );
}
