import { useEffect, useMemo, useRef, useState } from "react";
import Footer from "../components/Footer";
import { COMMITS } from "../data/commits";
import { RELEASES, type Tag, type Release } from "../data/releases";
import NextCards from "../components/NextCards";
import Pager from "../components/Pager";
import { pickNextCards } from "../data/nextCards";

// Two datasets, deliberately kept apart:
//   RELEASES — the log itself, and the month counts
//   COMMITS  — from `git log`, the graph in the summary card
// Everything on this page is derived from them at runtime, so no number here
// can drift out of sync with the log beneath it.
//
// The v2 design carried a hand-typed copy of the newest releases and a written
// list of month highlights, with a note saying the real page would generate
// them. It does: every release in releases.ts renders here in full, every
// release is in the prerendered HTML, and the highlights are real headlines
// picked by the rule in monthStats below — not a written-up summary.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Entry tags that have a color of their own. Anything else (`mock`) falls back
// to the neutral ink rather than borrowing a hue that means something.
const TINTED = new Set<Tag>(["feature", "fix", "ui", "infra", "perf", "rust"]);

// ── date helpers ─────────────────────────────────────────────
// Parse and format from the string, never through `new Date(iso)`: a bare ISO
// date is parsed as UTC midnight and rendered in the reader's local zone, so
// anyone west of Greenwich sees a release land a day early.
const ymd = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${parseInt(d, 10)} ${FULL[parseInt(m, 10) - 1]} ${y}`;
};
const monthName = (key: string) => `${FULL[parseInt(key.slice(5, 7), 10) - 1]} ${key.slice(0, 4)}`;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const COMMIT_DAYS = Object.keys(COMMITS).sort();

/** Releases per page. 248 of them in one document was thousands of nodes laid
 *  out and painted for a reader who sees fifteen. */
const PER_PAGE = 15;

/** "all" means the whole log, so it gets a summary card of its own rather than
 *  being the only view without one. */
function monthStats(key: string) {
  const inKey = (iso: string) => key === "all" || iso.startsWith(key);
  const rs = RELEASES.filter((r) => inKey(r.date));

  const days = COMMIT_DAYS.filter(inKey);
  const commits = days.reduce((n, d) => n + COMMITS[d], 0);
  const activeDays = days.filter((d) => COMMITS[d] > 0).length;

  // How many highlights a month earns scales with what it actually shipped,
  // rather than a flat top-N: a month carrying 70+ features across 35 releases
  // had more than two lines' worth to say. Quiet months aren't padded to match.
  //
  // ⚠️ A MONTH CAN SHIP A LOT AND SCORE ZERO. Ranking only by `feature`-tagged
  // entries is right for a feature month and wrong for an engineering one.
  // August 2026 shipped dozens of releases and not one entry tagged `feature`,
  // because the whole month went into the engine-worker migration, and the card
  // rendered with an empty list: a busy month looking like a dead one. So the
  // ranking falls back to total entries when a month has no feature work at all.
  let features = 0;
  for (const r of rs) for (const e of r.entries) if (e.tag === "feature") features++;
  const score = (r: Release) =>
    features > 0 ? r.entries.filter((e) => e.tag === "feature").length : r.entries.length;
  const cap = features >= 15 || rs.length >= 20 ? 8 : 4;
  const perks = rs
    .map((r) => ({ h: r.headline, v: r.version, date: r.date, f: score(r) }))
    .filter((x) => x.f > 0)
    .sort((a, b) => b.f - a.f || (a.date < b.date ? 1 : -1))
    .slice(0, cap);

  return { releases: rs.length, commits, activeDays, perks };
}

/** Commit squares for the filter's range — a month shows its days as big
 *  numbered squares, All shows the whole span as a year-style strip. */
function CommitGrid({ monthKey }: { monthKey: string }) {
  const isMonth = monthKey !== "all";
  const cols = useMemo(() => {
    let first: Date;
    let last: Date;
    if (!isMonth) {
      first = parse(COMMIT_DAYS[0]);
      last = parse(COMMIT_DAYS[COMMIT_DAYS.length - 1]);
    } else {
      const y = +monthKey.slice(0, 4);
      const mo = +monthKey.slice(5, 7);
      first = new Date(Date.UTC(y, mo - 1, 1));
      last = new Date(Date.UTC(y, mo, 0));
    }

    // Weeks are columns, starting on the Sunday on or before the first day.
    const start = new Date(first);
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());

    const out: { iso: string; n: number | null }[][] = [];
    let col: { iso: string; n: number | null }[] | null = null;
    for (const d = new Date(start); d <= last; d.setUTCDate(d.getUTCDate() + 1)) {
      if (d.getUTCDay() === 0 || !col) {
        col = [];
        out.push(col);
      }
      const iso = ymd(d);
      const inRange = !isMonth ? iso >= ymd(first) && iso <= ymd(last) : iso.slice(0, 7) === monthKey;
      col.push({ iso, n: inRange ? (COMMITS[iso] ?? 0) : null });
    }
    return out;
  }, [monthKey, isMonth]);

  return (
    <div className={`trail-grid ${isMonth ? "trail-grid--month" : "trail-grid--year"}`}>
      <div className="trail-grid__inner">
        {cols.map((col, i) => (
          <span className="trail-grid__col" key={i}>
            {col.map(({ iso, n }) =>
              n === null ? (
                <span className="trail-day trail-day--pad" key={iso} aria-hidden="true" />
              ) : (
                <span
                  className="trail-day"
                  key={iso}
                  aria-hidden="true"
                  // 200+ commits, up to 20 in a day — a wider spread than the
                  // release counts, so this gets its own thresholds.
                  data-level={!n ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 11 ? 3 : 4}
                  title={`${plural(n, "commit", "commits")} · ${fmtDate(iso)}`}
                >
                  {isMonth && <span className="trail-day__n">{parseInt(iso.slice(8), 10)}</span>}
                </span>
              ),
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The cream card: what the current filter amounted to. Every number is
 *  counted from the data. */
function Summary({ monthKey }: { monthKey: string }) {
  const { releases, commits, activeDays, perks } = monthStats(monthKey);
  const years = [...new Set(RELEASES.map((r) => r.date.slice(0, 4)))];
  const all = years.length === 1 ? `All of ${years[0]}` : "All time";
  const title = monthKey === "all" ? all : monthName(monthKey);

  return (
    <section className="trail-card" aria-label={`${title} summary`}>
      <div className="trail-card__head">
        <h2 className="trail-card__title">{title}</h2>
        <p className="trail-card__stats">
          {plural(releases, "release", "releases")} · {plural(commits, "commit", "commits")} ·{" "}
          {plural(activeDays, "active day", "active days")}
        </p>
      </div>

      <CommitGrid monthKey={monthKey} />
      <p className="trail-legend">
        <span>Commits per day</span>
        <span>Less</span>
        <span className="trail-legend__scale" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((l) => (
            <span className="trail-day" key={l} data-level={l} />
          ))}
        </span>
        <span>More</span>
      </p>

      {perks.length > 0 && (
        <ul className="trail-perks">
          {perks.map((p) => (
            <li key={p.v}>
              <span className="trail-perks__chip">{p.v}</span>
              <span>{p.h}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Trail() {
  const [active, setActive] = useState("all");

  // Month keys with at least one release, oldest first, with their counts.
  const months = useMemo(() => {
    const per = new Map<string, number>();
    for (const r of RELEASES) {
      const k = r.date.slice(0, 7);
      per.set(k, (per.get(k) ?? 0) + 1);
    }
    return [...per.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, []);

  // The design labels the reset tile "2026 · All". That is only true while the
  // log spans one year, so the year is derived, and a second year drops it and
  // puts the year on each month tile instead — a hardcoded "2026" would be
  // quietly wrong every January.
  const years = [...new Set(months.map(([k]) => k.slice(0, 4)))];
  const oneYear = years.length === 1;

  const isMonth = active !== "all";
  const shown = isMonth ? RELEASES.filter((r) => r.date.startsWith(active)) : RELEASES;
  const latest = RELEASES.length ? RELEASES[0].version : null;
  const perMonth = new Map(months);

  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(shown.length / PER_PAGE));

  // Picking a month re-filters under the pager. Without this, choosing a month
  // with two releases while sitting on page 9 leaves the reader on a page that
  // no longer exists, looking at an empty log.
  useEffect(() => setPage(1), [active]);

  // Clamped rather than trusted: `shown` can shrink for reasons other than the
  // month changing, and a first index past the end renders nothing.
  const current = Math.min(page, pageCount);
  const start = (current - 1) * PER_PAGE;
  const pageItems = shown.slice(start, start + PER_PAGE);

  // Paging keeps the scroll position, which on page 2 means landing halfway
  // down a list that starts above you. Move to the head of the log — but not
  // on first render, which would yank a reader arriving at the page.
  const logRef = useRef<HTMLElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    logRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [current]);

  let lastMonth: string | null = null;

  return (
    <>
      <main id="main" className="trail">
        <header className="trail-head">
          <div className="trail-head__lead">
            <p className="trail-head__eyebrow">
              Trail Log · {RELEASES.length} releases, newest first
            </p>
            <h1 className="trail-head__title">Every release, in the open.</h1>
          </div>
          <p className="trail-head__deck">
            What shipped, when, and the commits behind it. Pick a month to narrow the log; the year
            pill brings it all back.
          </p>
        </header>

        <section className="trail-tiles" aria-label="Filter releases by month">
          <div className="trail-tiles__row" role="group">
            <button
              type="button"
              className="trail-tile"
              aria-pressed={!isMonth}
              title={`${plural(RELEASES.length, "release", "releases")}${oneYear ? ` in ${years[0]}` : ""}`}
              onClick={() => setActive("all")}
            >
              <span className="trail-tile__label">{oneYear ? `${years[0]} · All` : "All"}</span>
              <span className="trail-tile__count">{RELEASES.length} rel</span>
            </button>
            {months.map(([key, total]) => {
              const mi = parseInt(key.slice(5, 7), 10) - 1;
              return (
                <button
                  key={key}
                  type="button"
                  className="trail-tile"
                  aria-pressed={active === key}
                  aria-label={`${monthName(key)} — ${plural(total, "release", "releases")}`}
                  title={`${plural(total, "release", "releases")} in ${monthName(key)}`}
                  onClick={() => setActive(active === key ? "all" : key)}
                >
                  <span className="trail-tile__label">
                    {MONTHS[mi]}
                    {!oneYear && ` ’${key.slice(2, 4)}`}
                  </span>
                  <span className="trail-tile__count">{total} rel</span>
                </button>
              );
            })}
          </div>
        </section>

        <Summary monthKey={active} />

        <section className="trail-log" aria-label="Releases" ref={logRef}>
          {/* role="status" so a screen reader hears the new range after a page
              or month change, which is otherwise a silent swap of the list. */}
          <p className="trail-log__count" role="status">
            {shown.length
              ? `${start + 1}–${Math.min(start + PER_PAGE, shown.length)} of ${plural(shown.length, "release", "releases")}`
              : plural(0, "release", "releases")}{" "}
            · {isMonth ? monthName(active) : "all time"}
          </p>

          <div className="trail-log__list">
            {!shown.length && <p className="trail-log__empty">No releases in this month.</p>}

            {pageItems.map((r) => {
              const key = r.date.slice(0, 7);
              const openMonth = !isMonth && key !== lastMonth;
              lastMonth = key;

              return (
                <div key={r.version}>
                  {openMonth && (
                    <h2 className="trail-month">
                      {monthName(key)}
                      <span className="trail-month__count">
                        {plural(perMonth.get(key) ?? 0, "release", "releases")}
                      </span>
                    </h2>
                  )}
                  <article className="trail-rel">
                    <div className="trail-rel__meta">
                      <span className="trail-rel__version">{r.version}</span>
                      <time className="trail-rel__date" dateTime={r.date}>
                        {fmtDate(r.date)}
                      </time>
                      {r.version === latest && <span className="trail-rel__latest">latest</span>}
                    </div>
                    <div className="trail-rel__body">
                      <h3 className="trail-rel__headline">{r.headline}</h3>
                      {r.entries.length > 0 && (
                        <ul className="trail-entries">
                          {r.entries.map((e, i) => (
                            <li className="trail-entry" key={i}>
                              <span
                                className={`trail-entry__tag${TINTED.has(e.tag) ? ` trail-entry__tag--${e.tag}` : ""}`}
                              >
                                {e.tag}
                              </span>
                              <p className="trail-entry__text">{e.text}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </article>
                </div>
              );
            })}
          </div>

          <Pager page={current} pageCount={pageCount} onPage={setPage} label="Release pages" />
        </section>

        <NextCards cards={pickNextCards("/trail-log")} />
      </main>

      <Footer line="Shipped in the open, one day at a time." />
    </>
  );
}
