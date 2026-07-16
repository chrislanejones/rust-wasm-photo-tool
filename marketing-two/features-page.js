// Features — 16 · Feature Stack: a sticky rail beside the scrolling list.
//
// The rail is an accordion of the doc's own groups. It's built from
// window.FEATURES, so a feature renamed in docs/Features.md can't leave a dead
// link behind in the rail.
(() => {
  const GROUPS = window.FEATURES || [];
  const nav = document.getElementById('fx-nav');
  const body = document.getElementById('fx-body');
  if (!nav || !body) return;

  const slug = (s) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const total = GROUPS.reduce((n, g) => n + g.items.length, 0);
  const countEl = document.getElementById('fx-count');
  if (countEl) countEl.textContent = String(total);

  // ── the rail ───────────────────────────────────────────────
  // <details>/<summary> rather than a JS accordion: it opens and closes, is
  // keyboard-operable and announced correctly with zero script, and it still
  // works if this file never loads.
  GROUPS.forEach((g, gi) => {
    const d = document.createElement('details');
    d.className = 'fx__group';
    d.open = true;   // the list is the point; nothing is hidden by default

    const s = document.createElement('summary');
    s.className = 'fx__summary';
    const name = document.createElement('span');
    name.textContent = g.name;
    const n = document.createElement('span');
    n.className = 'fx__n';
    n.textContent = String(g.items.length);
    s.append(name, n);
    d.appendChild(s);

    const ul = document.createElement('ul');
    ul.className = 'fx__list';
    g.items.forEach((item) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.className = 'fx__link';
      a.href = '#' + slug(item.name);
      a.textContent = item.name;
      li.appendChild(a);
      ul.appendChild(li);
    });
    d.appendChild(ul);
    nav.appendChild(d);
  });

  // ── the list ───────────────────────────────────────────────
  const frag = document.createDocumentFragment();
  GROUPS.forEach((g) => {
    const sec = document.createElement('section');
    sec.className = 'fx__section';

    const h = document.createElement('h2');
    h.className = 'fx__grouphead';
    h.id = slug(g.name);
    h.textContent = g.name;
    sec.appendChild(h);

    g.items.forEach((item) => {
      const art = document.createElement('article');
      art.className = 'fx__item';
      art.id = slug(item.name);

      const t = document.createElement('h3');
      t.className = 'fx__title';
      t.textContent = item.name;

      const p = document.createElement('p');
      p.className = 'fx__body';
      p.textContent = item.body;

      art.append(t, p);
      sec.appendChild(art);
    });
    frag.appendChild(sec);
  });
  body.appendChild(frag);

  // ── the rail follows the reader ────────────────────────────
  // IntersectionObserver, never a scroll listener (motion.md). The top margin
  // clears the fixed nav so a feature is "current" when it's actually readable,
  // not when it's still behind the bar.
  const links = new Map(
    [...nav.querySelectorAll('.fx__link')].map((a) => [a.getAttribute('href').slice(1), a])
  );
  let current = null;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const a = links.get(e.target.id);
        if (!a || a === current) return;
        if (current) current.classList.remove('is-current');
        a.classList.add('is-current');
        a.scrollIntoView({ block: 'nearest' });
        current = a;
      });
    },
    { rootMargin: '-96px 0px -70% 0px' }
  );
  body.querySelectorAll('.fx__item').forEach((el) => io.observe(el));
})();
