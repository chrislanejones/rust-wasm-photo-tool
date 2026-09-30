/* Page-at-a-time navigation for a long list.
 *
 * Built for the Trail Log, which put all 248 releases in one document: every
 * entry of every release, thousands of nodes, laid out and painted whether or
 * not anyone scrolled to them. Fifteen at a time is the whole change.
 *
 * Client state, not a URL parameter. The Trail Log's month filter is already
 * component state, and putting only the page number in the URL would make a
 * shareable link that restores the page but not the filter it belongs to —
 * "page 4" of a month nobody selected. Both stay in the component.
 *
 * Numbers are windowed so the row cannot outgrow a phone: first and last are
 * always reachable, the current page sits in a run of neighbours, and the gaps
 * collapse to an ellipsis.
 */

/** Page numbers to show, with `null` for a collapsed run. 1-indexed. */
export function pageWindow(current: number, total: number, edge = 1, around = 1): (number | null)[] {
  const keep = new Set<number>();
  for (let i = 1; i <= edge; i++) {
    keep.add(i);
    keep.add(total - i + 1);
  }
  for (let i = current - around; i <= current + around; i++) keep.add(i);

  const pages = [...keep].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);

  const out: (number | null)[] = [];
  let prev = 0;
  for (const n of pages) {
    // A single skipped page becomes that page, not an ellipsis standing in for
    // one number — "1 … 3" is longer than "1 2 3" and tells the reader less.
    if (n - prev === 2) out.push(prev + 1);
    else if (n - prev > 2) out.push(null);
    out.push(n);
    prev = n;
  }
  return out;
}

export default function Pager({
  page,
  pageCount,
  onPage,
  label = "Pages",
}: {
  /** 1-indexed. */
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
  label?: string;
}) {
  if (pageCount <= 1) return null;

  const go = (n: number) => onPage(Math.min(pageCount, Math.max(1, n)));

  return (
    <nav className="pager" aria-label={label}>
      <button
        type="button"
        className="pager__step"
        onClick={() => go(page - 1)}
        disabled={page === 1}
      >
        <span aria-hidden="true">&larr;</span> Previous
      </button>

      <ol className="pager__list">
        {pageWindow(page, pageCount).map((n, i) =>
          n === null ? (
            <li className="pager__gap" key={`gap-${i}`} aria-hidden="true">
              &hellip;
            </li>
          ) : (
            <li key={n}>
              <button
                type="button"
                className="pager__n"
                // aria-current is what tells a screen reader which page it is
                // on; the amber fill only says it to people who can see it.
                aria-current={n === page ? "page" : undefined}
                aria-label={`Page ${n} of ${pageCount}`}
                onClick={() => go(n)}
              >
                {n}
              </button>
            </li>
          ),
        )}
      </ol>

      <button
        type="button"
        className="pager__step"
        onClick={() => go(page + 1)}
        disabled={page === pageCount}
      >
        Next <span aria-hidden="true">&rarr;</span>
      </button>
    </nav>
  );
}
