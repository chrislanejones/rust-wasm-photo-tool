// Trail Log — the month filter and the per-month achievement rows.
//
// The old page filtered with a row of month pills plus an All reset. This keeps
// that exact model: the clickable unit is still a month, All still resets.
//
// Two datasets, deliberately kept apart:
//   window.RELEASES — 82 releases, the log itself and the segment counts
//   window.COMMITS  — 211 commits from `git log`, the graph in each month's row
// Both are derived at runtime, so neither can drift out of sync with the page.
(() => {
  const RELEASES = window.RELEASES || [];
  const graphEl = document.getElementById('graph');
  const listEl = document.getElementById('list');
  const countEl = document.getElementById('count');
  const resetEl = document.getElementById('reset');
  if (!graphEl || !listEl) return;

  // All carries the total, so it reads as a peer of the month segments
  const resetCount = document.getElementById('reset-count');
  if (resetCount) resetCount.textContent = `${RELEASES.length} rel`;

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const FULL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // ── date helpers ───────────────────────────────────────────
  // Parse and format from the string, never through `new Date(iso)`: a bare ISO
  // date is parsed as UTC midnight and rendered in the reader's local zone, so
  // anyone west of Greenwich sees a release land a day early.
  const ymd = (d) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  const parse = (iso) => new Date(iso + 'T00:00:00Z');
  const fmtDate = (iso) => {
    const [y, m, d] = iso.split('-');
    return `${parseInt(d, 10)} ${FULL_MONTHS[parseInt(m, 10) - 1]} ${y}`;
  };

  // ── shape the data ─────────────────────────────────────────
  // The segments are now text only, so all the filter needs is the month keys
  // and their release counts. The day-by-day week-column walk that used to
  // build squares in here is gone with them — the only grid left on the page is
  // the commit graph in each achievement row, which builds its own.
  const perMonth = new Map();
  RELEASES.forEach((r) => {
    const k = r.date.slice(0, 7);
    perMonth.set(k, (perMonth.get(k) || 0) + 1);
  });

  const months = [...perMonth.keys()].sort().map((key) => ({ key }));

  // ── render the graph ───────────────────────────────────────
  let active = 'all';

  months.forEach((m) => {
    const total = perMonth.get(m.key) || 0;
    const mi = parseInt(m.key.slice(5, 7), 10) - 1;
    const label = MONTH_NAMES[mi];

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'seg month seg--month';
    btn.dataset.month = m.key;
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label',
      `${FULL_MONTHS[mi]} ${m.key.slice(0, 4)} — ${total} ${total === 1 ? 'release' : 'releases'}`);
    // the whole segment is one control, so its title describes the month —
    // per-day titles taught the wrong target
    btn.title = `${total} ${total === 1 ? 'release' : 'releases'} in ${FULL_MONTHS[mi]} ${m.key.slice(0, 4)}`;
    if (!total) btn.disabled = true;   // a month with nothing to show isn't a filter

    // The label names the segment AND its count. Name and count are separate
    // stacked elements: "Jul 34" on one line reads as a date.
    const lab = document.createElement('span');
    lab.className = 'month__label';
    const name = document.createElement('span');
    name.textContent = label;
    const cnt = document.createElement('span');
    cnt.className = 'month__count';
    cnt.textContent = total === 1 ? '1 rel' : `${total} rel`;
    lab.append(name, cnt);

    btn.appendChild(lab);
    btn.addEventListener('click', () => select(active === m.key ? 'all' : m.key));
    graphEl.appendChild(btn);
  });

  // ── the achievement row ────────────────────────────────────
  // What a month actually amounted to. Every number is counted from the data,
  // and the "perks" are real release headlines picked by how many feature
  // entries they carry — nothing here is a written-up summary of the month,
  // because that would be me inventing a story about someone else's work.
  const COMMITS = window.COMMITS || {};

  // key === 'all' means the whole log, not one month — so All gets a summary
  // card of its own rather than being the only view without one.
  const monthStats = (key) => {
    const rs = key === 'all' ? RELEASES.slice() : RELEASES.filter((r) => r.date.startsWith(key));
    const tags = {};
    rs.forEach((r) => r.entries.forEach((e) => { tags[e.tag] = (tags[e.tag] || 0) + 1; }));
    const commits = Object.keys(COMMITS)
      .filter((d) => key === 'all' || d.startsWith(key))
      .reduce((n, d) => n + COMMITS[d], 0);
    // How many perks a month earns scales with what it actually shipped, rather
    // than a flat top-N: June and July carried 74 and 19 features across 34–36
    // releases, and two lines each was a thin account of them. Quiet months
    // don't get padded out to match — they simply have less to show.
    const cap = (tags.feature || 0) >= 15 ? 8 : 4;
    const perks = rs
      .map((r) => ({ h: r.headline, v: r.version, f: r.entries.filter((e) => e.tag === 'feature').length }))
      .sort((a, b) => b.f - a.f || (a.date < b.date ? 1 : -1))
      .filter((x) => x.f > 0)
      .slice(0, cap);
    return { rs, tags, commits, perks };
  };

  // the month's commit squares, same visual language as the filter above
  const commitGrid = (key) => {
    const wrap = document.createElement('div');
    wrap.className = 'ach__grid';
    let first, last;
    if (key === 'all') {
      // the whole log's span, so the All card carries the year's own graph
      const days = Object.keys(COMMITS).sort();
      first = parse(days[0]);
      last = parse(days[days.length - 1]);
    } else {
      const y = +key.slice(0, 4), mo = +key.slice(5, 7);
      first = new Date(Date.UTC(y, mo - 1, 1));
      last = new Date(Date.UTC(y, mo, 0));
    }
    const start = new Date(first);
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());
    let col = null;
    for (let d = new Date(start); d <= last; d.setUTCDate(d.getUTCDate() + 1)) {
      if (d.getUTCDay() === 0 || !col) {
        col = document.createElement('span');
        col.className = 'month__col';
        wrap.appendChild(col);
      }
      const iso = ymd(d);
      const inMonth = key === 'all' ? (iso >= ymd(first) && iso <= ymd(last)) : iso.slice(0, 7) === key;
      const n = inMonth ? (COMMITS[iso] || 0) : null;
      const sq = document.createElement('span');
      sq.className = n === null ? 'day day--pad' : 'day';
      if (n !== null) {
        // commit levels: 211 commits, up to 20 in a day — a wider spread than
        // the release grid, so it gets its own thresholds
        sq.dataset.level = String(!n ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 11 ? 3 : 4);
        sq.title = `${n} ${n === 1 ? 'commit' : 'commits'} · ${fmtDate(iso)}`;
      }
      sq.setAttribute('aria-hidden', 'true');
      col.appendChild(sq);
    }
    return wrap;
  };

  const achRow = (key) => {
    const { rs, tags, commits, perks } = monthStats(key);
    const mi = parseInt(key.slice(5, 7), 10) - 1;
    const title = key === 'all' ? 'All of 2026' : `${FULL_MONTHS[mi]} ${key.slice(0, 4)}`;

    const row = document.createElement('section');
    row.className = 'ach';
    row.setAttribute('aria-label', title + ' summary');

    const body = document.createElement('div');
    body.className = 'ach__body';

    const h = document.createElement('h2');
    h.className = 'ach__month';
    h.textContent = title;
    body.appendChild(h);

    const stats = document.createElement('p');
    stats.className = 'ach__stats';
    const bits = [
      [tags.feature || 0, 'feature', 'features'],
      [rs.length, 'release', 'releases'],
      [commits, 'commit', 'commits'],
      [tags.fix || 0, 'fix', 'fixes'],
    ];
    bits.forEach(([n, one, many], i) => {
      if (i) stats.appendChild(document.createTextNode(' · '));
      const fig = document.createElement('span');
      fig.className = 'fig';
      fig.textContent = String(n);
      stats.append(fig, document.createTextNode(' ' + (n === 1 ? one : many)));
    });
    body.appendChild(stats);

    if (perks.length) {
      const ul = document.createElement('ul');
      ul.className = 'ach__perks';
      perks.forEach((p) => {
        const li = document.createElement('li');
        const v = document.createElement('span');
        v.className = 'ach__ver';
        v.textContent = p.v;
        li.append(v, document.createTextNode(p.h));
        ul.appendChild(li);
      });
      body.appendChild(ul);
    }

    row.append(body, commitGrid(key));
    return row;
  };

  // ── render the log ─────────────────────────────────────────
  const latest = RELEASES.length ? RELEASES[0].version : null;

  function render() {
    const shown = active === 'all'
      ? RELEASES
      : RELEASES.filter((r) => r.date.startsWith(active));

    listEl.textContent = '';

    if (!shown.length) {
      const p = document.createElement('p');
      p.className = 'log__empty';
      p.textContent = 'No releases in this month.';
      listEl.appendChild(p);
    }

    const frag = document.createDocumentFragment();
    // All opens with its own summary; a month view opens with that month's
    const newest = shown.length ? shown[0].date.slice(0, 7) : null;
    if (active === 'all') frag.appendChild(achRow('all'));
    let lastMonth = null;
    shown.forEach((r) => {
      // A month's achievement row opens that month's releases — except the
      // newest month on All, whose card would sit directly beneath the all-time
      // one. Two summary cards stacked back to back say the same thing twice;
      // the All card heads that first run of releases instead.
      const key = r.date.slice(0, 7);
      const skip = active === 'all' && key === newest;
      if (key !== lastMonth) { if (!skip) frag.appendChild(achRow(key)); lastMonth = key; }
      const art = document.createElement('article');
      art.className = 'release';

      const meta = document.createElement('div');
      meta.className = 'release__meta';
      const ver = document.createElement('span');
      ver.className = 'release__version';
      ver.textContent = r.version;
      const date = document.createElement('span');
      date.className = 'release__date';
      date.textContent = fmtDate(r.date);
      meta.append(ver, date);
      if (r.version === latest) {
        const badge = document.createElement('span');
        badge.className = 'release__latest';
        badge.textContent = 'latest';
        meta.appendChild(badge);
      }

      const body = document.createElement('div');
      const h = document.createElement('h2');
      h.className = 'release__headline';
      h.textContent = r.headline;
      body.appendChild(h);

      const ul = document.createElement('ul');
      ul.className = 'entries';
      r.entries.forEach((e) => {
        const li = document.createElement('li');
        li.className = 'entry';
        const tag = document.createElement('span');
        tag.className = 'tag tag--entry';
        tag.textContent = e.tag;
        const txt = document.createElement('p');
        txt.className = 'entry__body';
        txt.textContent = e.text;
        li.append(tag, txt);
        ul.appendChild(li);
      });
      body.appendChild(ul);

      art.append(meta, body);
      frag.appendChild(art);
    });
    listEl.appendChild(frag);

    const n = shown.length;
    const where = active === 'all'
      ? 'all time'
      : `${FULL_MONTHS[parseInt(active.slice(5, 7), 10) - 1]} ${active.slice(0, 4)}`;
    countEl.textContent = `${n} ${n === 1 ? 'release' : 'releases'} · ${where}`;
  }

  function select(key) {
    active = key;
    graphEl.querySelectorAll('.month').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.month === key));
    });
    resetEl.setAttribute('aria-pressed', String(key === 'all'));
    render();
  }

  resetEl.addEventListener('click', () => select('all'));
  select('all');
})();
