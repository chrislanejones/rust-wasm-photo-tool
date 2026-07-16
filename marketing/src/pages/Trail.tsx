import { Fragment, useMemo, useState } from "react";
import Footer from "../components/Footer";
import { COMMITS } from "../data/commits";
import { RELEASES, type Tag } from "../data/releases";

// Two datasets, deliberately kept apart:
//   RELEASES — the log itself, and the month counts
//   COMMITS  — from `git log`, the graph in each month's card
// Everything on this page is derived from them at runtime, so no number here
// can drift out of sync with the log beneath it.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "all" means the whole log, so it gets a summary card of its own rather than
 *  being the only view without one. */
function monthStats(key: string) {
  const rs = key === "all" ? RELEASES : RELEASES.filter((r) => r.date.startsWith(key));

  const tags: Partial<Record<Tag, number>> = {};
  for (const r of rs) for (const e of r.entries) tags[e.tag] = (tags[e.tag] ?? 0) + 1;

  const commits = Object.keys(COMMITS)
    .filter((d) => key === "all" || d.startsWith(key))
    .reduce((n, d) => n + COMMITS[d], 0);

  // How many perks a month earns scales with what it actually shipped, rather
  // than a flat top-N: a month carrying 70+ features across 35 releases had
  // more than two lines' worth to say. Quiet months aren't padded to match —
  // they simply have less to show.
  const cap = (tags.feature ?? 0) >= 15 ? 8 : 4;
  const perks = rs
    .map((r) => ({
      h: r.headline,
      v: r.version,
      date: r.date,
      f: r.entries.filter((e) => e.tag === "feature").length,
    }))
    .filter((x) => x.f > 0)
    .sort((a, b) => b.f - a.f || (a.date < b.date ? 1 : -1))
    .slice(0, cap);

  return { rs, tags, commits, perks };
}

/** The month's commit squares — the same visual language as the filter above. */
function CommitGrid({ monthKey }: { monthKey: string }) {
  const cols = useMemo(() => {
    let first: Date;
    let last: Date;
    if (monthKey === "all") {
      // the whole log's span, so the All card carries the year's own graph
      const days = Object.keys(COMMITS).sort();
      first = parse(days[0]);
      last = parse(days[days.length - 1]);
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
      const inRange =
        monthKey === "all" ? iso >= ymd(first) && iso <= ymd(last) : iso.slice(0, 7) === monthKey;
      col.push({ iso, n: inRange ? (COMMITS[iso] ?? 0) : null });
    }
    return out;
  }, [monthKey]);

  return (
    <div className="ach__grid">
      {cols.map((col, i) => (
        <span className="month__col" key={i}>
          {col.map(({ iso, n }) =>
            n === null ? (
              <span className="day day--pad" key={iso} aria-hidden="true" />
            ) : (
              <span
                className="day"
                key={iso}
                aria-hidden="true"
                // 200+ commits, up to 20 in a day — a wider spread than the
                // release counts, so this gets its own thresholds.
                data-level={!n ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 11 ? 3 : 4}
                title={`${plural(n, "commit", "commits")} · ${fmtDate(iso)}`}
              />
            ),
          )}
        </span>
      ))}
    </div>
  );
}

/** What a month actually amounted to. Every number is counted from the data,
 *  and the perks are real release headlines picked by how many features they
 *  carry — nothing here is a written-up summary of the month. */
function Achievement({ monthKey }: { monthKey: string }) {
  const { rs, tags, commits, perks } = monthStats(monthKey);
  const mi = parseInt(monthKey.slice(5, 7), 10) - 1;
  const title = monthKey === "all" ? "All of 2026" : `${FULL[mi]} ${monthKey.slice(0, 4)}`;

  const bits: [number, string, string][] = [
    [tags.feature ?? 0, "feature", "features"],
    [rs.length, "release", "releases"],
    [commits, "commit", "commits"],
    [tags.fix ?? 0, "fix", "fixes"],
  ];

  return (
    <section className="ach" aria-label={`${title} summary`}>
      <div className="ach__body">
        <h2 className="ach__month">{title}</h2>
        <p className="ach__stats">
          {bits.map(([n, one, many], i) => (
            <Fragment key={one}>
              {i > 0 && " · "}
              <span className="fig">{n}</span> {n === 1 ? one : many}
            </Fragment>
          ))}
        </p>
        {perks.length > 0 && (
          <ul className="ach__perks">
            {perks.map((p) => (
              <li key={p.v}>
                <span className="ach__ver">{p.v}</span>
                {p.h}
              </li>
            ))}
          </ul>
        )}
      </div>
      <CommitGrid monthKey={monthKey} />
    </section>
  );
}

export default function Trail() {
  const [active, setActive] = useState("all");

  // Month keys with at least one release, oldest first.
  const months = useMemo(() => {
    const per = new Map<string, number>();
    for (const r of RELEASES) {
      const k = r.date.slice(0, 7);
      per.set(k, (per.get(k) ?? 0) + 1);
    }
    return [...per.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, []);

  const shown = active === "all" ? RELEASES : RELEASES.filter((r) => r.date.startsWith(active));
  const latest = RELEASES.length ? RELEASES[0].version : null;

  // On All, the newest month's card would sit directly beneath the all-time
  // one. Two summary cards back to back say the same thing twice, so the All
  // card heads that first run of releases instead.
  const newest = shown.length ? shown[0].date.slice(0, 7) : null;

  const where =
    active === "all"
      ? "all time"
      : `${FULL[parseInt(active.slice(5, 7), 10) - 1]} ${active.slice(0, 4)}`;

  let lastMonth: string | null = null;

  return (
    <>
      <main id="main">
        {/* The page IS the log — no display hero. */}
        <header className="page-head">
          <h1 className="page-head__title">Trail Log</h1>
          <p className="lede">
            Every release, newest first — features, performance work, and fixes. Press a month to
            narrow the log, or All to see everything. Each month opens with what it amounted to, and
            the commits behind it.
          </p>
        </header>

        <section className="graph" aria-labelledby="graph-h">
          <h2 className="visually-hidden" id="graph-h">
            Filter releases by month
          </h2>
          <p className="graph__year">2026</p>
          <div className="graph__scroll">
            <div className="graph__group" role="group" aria-label="Filter releases by month">
              {/* All carries the total, so it reads as a peer of the months */}
              <button
                className="seg seg--reset"
                type="button"
                aria-pressed={active === "all"}
                onClick={() => setActive("all")}
              >
                <span className="month__label">
                  <span>All</span>
                  <span className="month__count">{RELEASES.length} rel</span>
                </span>
              </button>

              {months.map(([key, total]) => {
                const mi = parseInt(key.slice(5, 7), 10) - 1;
                return (
                  <button
                    key={key}
                    className="seg month seg--month"
                    type="button"
                    aria-pressed={active === key}
                    aria-label={`${FULL[mi]} ${key.slice(0, 4)} — ${plural(total, "release", "releases")}`}
                    // The whole segment is one control, so its title describes
                    // the month — per-day titles taught the wrong target.
                    title={`${plural(total, "release", "releases")} in ${FULL[mi]} ${key.slice(0, 4)}`}
                    onClick={() => setActive(active === key ? "all" : key)}
                  >
                    <span className="month__label">
                      {/* Name and count are stacked, not inline: "Jul 34" on one
                          line reads as a date. */}
                      <span>{MONTHS[mi]}</span>
                      <span className="month__count">{total === 1 ? "1 rel" : `${total} rel`}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="graph__foot">
            <p className="legend">
              <span>Commits per day</span>
              <span>Less</span>
              <span className="legend__scale" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((l) => (
                  <span className="day" key={l} data-level={l} />
                ))}
              </span>
              <span>More</span>
            </p>
          </div>
        </section>

        <section className="log">
          <p className="log__count" role="status">
            {plural(shown.length, "release", "releases")} · {where}
          </p>

          <div className="log__list">
            {!shown.length && <p className="log__empty">No releases in this month.</p>}

            {active === "all" && <Achievement monthKey="all" />}

            {shown.map((r) => {
              const key = r.date.slice(0, 7);
              const openMonth = key !== lastMonth;
              const skip = active === "all" && key === newest;
              lastMonth = key;

              return (
                <Fragment key={r.version}>
                  {openMonth && !skip && <Achievement monthKey={key} />}
                  <article className="release">
                    <div className="release__meta">
                      <span className="release__version">{r.version}</span>
                      <span className="release__date">{fmtDate(r.date)}</span>
                      {r.version === latest && <span className="release__latest">latest</span>}
                    </div>
                    <div>
                      <h2 className="release__headline">{r.headline}</h2>
                      <ul className="entries">
                        {r.entries.map((e, i) => (
                          <li className="entry" key={i}>
                            <span className="tag tag--entry">{e.tag}</span>
                            <p className="entry__body">{e.text}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </article>
                </Fragment>
              );
            })}
          </div>
        </section>
      </main>

      <Footer line="Shipped in the open, one day at a time." />
    </>
  );
}
