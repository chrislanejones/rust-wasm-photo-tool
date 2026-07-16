// Shared nav behaviour for every page.
//
// Two jobs:
//   1. mark the current page in both the pill and the mobile sheet
//   2. drive the N5 mobile collapse (burger → sheet disclosure)
//
// The nav markup itself is duplicated in each HTML file rather than injected
// here on purpose: the links must exist for a reader with JS off and for a
// crawler, so JS only enhances what is already in the document.
(() => {
  const here = location.pathname.replace(/index\.html$/, '');

  // 1. current page
  document.querySelectorAll('.nav-pill__links a, .nav-sheet a').forEach((a) => {
    const target = new URL(a.getAttribute('href'), location.origin).pathname;
    if (target === here) a.setAttribute('aria-current', 'page');
  });

  // 2. the disclosure
  const burger = document.querySelector('.nav-pill__burger');
  const sheet = document.querySelector('.nav-sheet');
  if (!burger || !sheet) return;

  const setOpen = (open) => {
    burger.setAttribute('aria-expanded', String(open));
    sheet.hidden = !open;
  };

  burger.addEventListener('click', () => {
    setOpen(burger.getAttribute('aria-expanded') !== 'true');
  });

  // Escape closes and returns focus to the trigger — a sheet you can open with
  // the keyboard but not close with it is a trap.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      burger.focus();
    }
  });

  // click-away
  document.addEventListener('click', (e) => {
    if (burger.getAttribute('aria-expanded') !== 'true') return;
    if (sheet.contains(e.target) || burger.contains(e.target)) return;
    setOpen(false);
  });

  // Growing back to desktop must not leave a stale open sheet behind the CSS
  // that now hides the burger.
  matchMedia('(min-width: 60.0625rem)').addEventListener('change', (e) => {
    if (e.matches) setOpen(false);
  });

  // 3. the glide — a rule that follows the pointer across the menu.
  const list = document.querySelector('.nav-pill__links');
  const glide = document.querySelector('.nav-pill__glide');
  if (list && glide) {
    const current = () => list.querySelector('a[aria-current="page"]');

    const moveTo = (el) => {
      if (!el) { list.style.setProperty('--go', '0'); return; }
      // offsetLeft is relative to .nav-pill__links (position: relative)
      list.style.setProperty('--gx', `${el.offsetLeft}px`);
      list.style.setProperty('--gw', String(el.offsetWidth));
      list.style.setProperty('--go', '1');
    };

    // rest under the page you're on
    const rest = () => moveTo(current());

    list.querySelectorAll('a').forEach((a) => {
      a.addEventListener('pointerenter', () => moveTo(a));
      a.addEventListener('focus', () => moveTo(a));   // keyboard gets it too
    });
    list.addEventListener('pointerleave', rest);
    list.addEventListener('focusout', (e) => {
      if (!list.contains(e.relatedTarget)) rest();
    });

    // Measure after fonts land — a glide sized against a fallback face is
    // the wrong width the moment Geist swaps in.
    rest();
    if (document.fonts?.ready) document.fonts.ready.then(rest);
    addEventListener('resize', rest);
  }

  // 4. N10 scroll-morph — condense the pill once the top of the page is gone.
  // A sentinel + IntersectionObserver, never a scroll listener (motion.md).
  const nav = document.querySelector('.nav-pill');
  if (nav) {
    const sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText =
      'position:absolute;top:0;left:0;width:1px;height:120px;pointer-events:none;visibility:hidden';
    document.body.prepend(sentinel);

    new IntersectionObserver(
      ([entry]) => {
        const condensed = !entry.isIntersecting;
        nav.classList.toggle('is-condensed', condensed);
        // hidden source links must not stay in the tab order
        const source = nav.querySelector('.nav-pill__source');
        if (source) source.toggleAttribute('inert', condensed);
        // the glide's anchors move when the bar reflows
        requestAnimationFrame(() => {
          const el = list?.querySelector('a[aria-current="page"]');
          if (el && glide) {
            list.style.setProperty('--gx', `${el.offsetLeft}px`);
            list.style.setProperty('--gw', String(el.offsetWidth));
          }
        });
      },
      { threshold: 0 }
    ).observe(sentinel);
  }
})();
