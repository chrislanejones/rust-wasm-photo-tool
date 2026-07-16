// Pricing page: focus one tier across the cards and the matrix.
//
// Dims rather than hides. The matrix's whole job is comparison — hiding the
// other two columns would leave you reading a single column and calling it a
// comparison. Dimming keeps them there to be compared against.
(() => {
  const group = document.getElementById('tierfilter');
  const table = document.querySelector('.spec--matrix');
  if (!group || !table) return;

  // which matrix column belongs to which tier (1-indexed; col 1 is Feature)
  const COL = { demo: 2, free: 3, pro: 4 };
  // the cards, in the same order as the columns
  const CARD = { demo: 0, free: 1, pro: 2 };

  const cards = [...document.querySelectorAll('.tier')];
  const rows = [...table.querySelectorAll('tr')];

  const select = (tier) => {
    group.querySelectorAll('.seg').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.tier === tier))
    );

    rows.forEach((row) => {
      // a group header spans all four columns — it has no tier to dim
      if (row.classList.contains('spec__group')) return;
      [...row.children].forEach((cell, i) => {
        const col = i + 1;
        const lit = tier === 'all' || col === 1 || col === COL[tier];
        cell.classList.toggle('is-dim', !lit);
      });
    });

    cards.forEach((card, i) => {
      const lit = tier === 'all' || i === CARD[tier];
      card.classList.toggle('is-dim', !lit);
    });
  };

  group.querySelectorAll('.seg').forEach((b) =>
    b.addEventListener('click', () => select(b.dataset.tier))
  );
  select('all');
})();
