// N13 · the ⌘K palette.
//
// The archetype's condition: "if you ship the pill you ship the keyboard model."
// So this is the whole model — ⌘K/Ctrl-K toggles, Esc closes, backdrop closes,
// ↑/↓ move, Enter opens, focus goes to the input and comes back to the trigger,
// focus is trapped while open, and the body stops scrolling behind it.
//
// The index is the site's own destinations. It is written here rather than
// scraped so a section that gets renamed doesn't silently become a dead result.
(() => {
  const ITEMS = [
    { group: 'Pages', label: 'Home', hint: 'The engine, and what runs where', href: '/' },
    { group: 'Pages', label: 'Architecture', hint: 'The two planes, and the seam between them', href: '/architecture/' },
    { group: 'Pages', label: 'Features', hint: '40 of them — 25 in the engine, 15 in the UI', href: '/features/' },
    { group: 'Pages', label: 'Pricing', hint: 'Three tiers, and the access matrix', href: '/pricing/' },
    { group: 'Pages', label: 'Trail Log', hint: '82 releases · 211 commits', href: '/trail-log/' },

    { group: 'On this site', label: 'What runs where', hint: 'Every operation, and the machine it runs on', href: '/#runs' },
    { group: 'On this site', label: 'In the editor', hint: 'The whole tool list', href: '/#editor' },
    { group: 'On this site', label: 'The Convex schema', hint: '6 tables, 58 fields', href: '/architecture/#main' },
    { group: 'On this site', label: 'Download the .mermaid source', hint: 'The system flowchart, 79 lines', href: '/system-architecture.mermaid' },

    { group: 'Open', label: 'Open the demo', hint: 'No account, no upload', href: 'https://rust-wasm-photo-tool.netlify.app' },
    { group: 'Open', label: 'Source on GitHub', hint: 'chrislanejones/rust-wasm-photo-tool', href: 'https://github.com/chrislanejones/rust-wasm-photo-tool' },
    { group: 'Open', label: 'Source on Codeberg', hint: 'chrislanejones/rust-wasm-photo-tool', href: 'https://codeberg.org/chrislanejones/rust-wasm-photo-tool' },
  ];

  const trigger = document.getElementById('cmdk-trigger');
  const root = document.getElementById('cmdk');
  if (!trigger || !root) return;

  const input = root.querySelector('#cmdk-input');
  const results = root.querySelector('#cmdk-results');
  let active = 0;
  let shown = [];
  let lastFocused = null;

  const render = (q) => {
    const needle = q.trim().toLowerCase();
    shown = needle
      ? ITEMS.filter((i) => (i.label + ' ' + i.hint).toLowerCase().includes(needle))
      : ITEMS;
    active = 0;
    results.textContent = '';

    if (!shown.length) {
      const p = document.createElement('p');
      p.className = 'cmdk__empty';
      p.textContent = `Nothing matches “${q.trim()}”.`;
      results.appendChild(p);
      return;
    }

    let group = null;
    shown.forEach((item, i) => {
      if (item.group !== group) {
        group = item.group;
        const h = document.createElement('p');
        h.className = 'cmdk__group';
        h.textContent = group;
        results.appendChild(h);
      }
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cmdk__item' + (i === 0 ? ' is-active' : '');
      b.dataset.i = String(i);
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', String(i === 0));
      const l = document.createElement('span');
      l.className = 'cmdk__label';
      l.textContent = item.label;
      const h = document.createElement('span');
      h.className = 'cmdk__hint';
      h.textContent = item.hint;
      b.append(l, h);
      b.addEventListener('click', () => go(i));
      b.addEventListener('pointerenter', () => setActive(i));
      results.appendChild(b);
    });
  };

  const setActive = (i) => {
    active = i;
    results.querySelectorAll('.cmdk__item').forEach((el) => {
      const on = Number(el.dataset.i) === i;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-selected', String(on));
      if (on) el.scrollIntoView({ block: 'nearest' });
    });
  };

  const go = (i) => {
    const item = shown[i];
    if (!item) return;
    close();
    if (item.href.startsWith('http')) window.open(item.href, '_blank', 'noopener');
    else window.location.href = item.href;
  };

  const open = () => {
    lastFocused = document.activeElement;
    root.classList.add('is-open');
    root.removeAttribute('aria-hidden');
    trigger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';   // no scrolling behind the modal
    input.value = '';
    render('');
    // The panel is visibility:hidden until the class lands, and .focus() on a
    // hidden element silently does nothing — so wait for the style to apply.
    // Without this the palette opens with focus still on the page behind it.
    requestAnimationFrame(() => input.focus());
  };

  const close = () => {
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    // Focus goes back where it came from — but only if that was a real control.
    // Opening via ⌘K from nowhere leaves lastFocused as <body>, and body.focus()
    // is a no-op, so fall back to the trigger rather than stranding focus.
    const back = lastFocused && lastFocused !== document.body ? lastFocused : trigger;
    if (back && back.focus) back.focus();
  };

  const isOpen = () => root.classList.contains('is-open');

  trigger.addEventListener('click', () => (isOpen() ? close() : open()));
  root.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));
  input.addEventListener('input', () => render(input.value));

  document.addEventListener('keydown', (e) => {
    // ⌘K on mac, Ctrl-K elsewhere
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      isOpen() ? close() : open();
      return;
    }
    if (!isOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((active + 1) % shown.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((active - 1 + shown.length) % shown.length); }
    else if (e.key === 'Enter') { e.preventDefault(); go(active); }
    else if (e.key === 'Tab') {
      // a modal that lets you tab out into the page behind it isn't modal
      e.preventDefault();
      input.focus();
    }
  });
})();
