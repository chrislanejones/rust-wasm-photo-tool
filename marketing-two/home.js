// Home page: the "what runs where" filter, and the hero spotlight.
(() => {
  // ── the where filter ───────────────────────────────────────
  // The segments carry Lucide icons rather than counts now, but the caption
  // still states the tally — and it's counted off the table, never typed. A
  // caption that says "5" over four rows is worse than no caption at all.
  const group = document.getElementById('wherefilter');
  const table = document.querySelector('.spec');
  if (group && table) {
    const rows = [...table.querySelectorAll('tbody tr[data-where]')];
    const caption = table.querySelector('.spec__caption');
    const captionBase = caption ? caption.textContent : '';

    const tally = (where) =>
      where === 'all' ? rows.length : rows.filter((r) => r.dataset.where === where).length;

    const select = (where) => {
      group.querySelectorAll('.seg').forEach((b) =>
        b.setAttribute('aria-pressed', String(b.dataset.where === where))
      );
      rows.forEach((r) => {
        r.hidden = !(where === 'all' || r.dataset.where === where);
      });
      if (caption) {
        const n = tally(where);
        caption.textContent =
          where === 'all'
            ? captionBase
            : where === 'local'
              ? `${n} of ${rows.length} operations run on your own machine.`
              : `${n} of ${rows.length} operations reach a server, and only once you sign in.`;
      }
    };

    group.querySelectorAll('.seg').forEach((b) =>
      b.addEventListener('click', () => select(b.dataset.where))
    );
    select('all');
  }

  // ── HP3 · Cursor-spotlight — scoped to the hero, never page-wide ──
  const hero = document.querySelector('.hero');
  if (hero && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--mx', `${e.clientX - r.left}px`);
      hero.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  }
})();
