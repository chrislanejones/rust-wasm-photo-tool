// Architecture page: renders the Convex schema tables.
//
// The schema is data rather than markup so the six tables can't drift into six
// different shapes.
//
// The mermaid diagram is a download rather than a live render: mermaid's colour
// parser rejects OKLCH outright ("Unsupported color format"), so theming it from
// these tokens would mean maintaining a second hex palette purely for it — and it
// costs ~1MB from a CDN to draw what the hand-built map already says. Field types are copied verbatim from convex/schema.ts
// via the old marketing page — this is documentation, so a wrong type is a lie.
(() => {
  const TABLES = [
    {
      name: 'users',
      fields: [
        ['_id', "Id<'users'>", 'pk'],
        ['clerkId', 'string', 'unique', true],
        ['email', 'string?', null, true],
        ['name', 'string?'],
        ['avatarUrl', 'string?'],
        ['tier', "'free' | 'pro' | 'team'"],
        ['dailyUsage', 'number'],
        ['usageResetAt', 'number'],
        ['settings', 'string?', null, false, 'JSON blob, app prefs'],
        ['settingsHash', 'string?', null, false, 'SHA-256, skips redundant writes'],
        ['createdAt', 'number'],
        ['updatedAt', 'number'],
      ],
      indexes: ['by_clerkId', 'by_email'],
    },
    {
      name: 'subscriptions',
      fields: [
        ['_id', "Id<'subscriptions'>", 'pk'],
        ['userId', "Id<'users'>", 'fk', true],
        ['stripeCustomerId', 'string', null, true],
        ['stripeSubId', 'string', 'unique'],
        ['plan', "'pro' | 'team'"],
        ['status', "'active' | 'canceled' | 'past_due'"],
        ['currentPeriodEnd', 'number'],
        ['cancelAtPeriodEnd', 'boolean'],
      ],
      indexes: ['by_userId', 'by_stripeCustomerId', 'by_stripeSubId'],
    },
    {
      name: 'photo_edits',
      fields: [
        ['_id', "Id<'photo_edits'>", 'pk'],
        ['userId', "Id<'users'>", 'fk'],
        ['photoKey', 'string', null, false, "the editor's own photo id"],
        ['storageId', "Id<'_storage'>", 'fk', false, 'binary canvas archive'],
        ['canvasW', 'number'],
        ['canvasH', 'number'],
        ['updatedAt', 'number'],
      ],
      indexes: ['by_userId_photoKey'],
      note: 'Real per-photo edit persistence path (useEditPersistence.ts)',
    },
    {
      name: 'recent_texts',
      fields: [
        ['_id', "Id<'recent_texts'>", 'pk'],
        ['userId', "Id<'users'>", 'fk'],
        ['text', 'string'],
        ['fontSize', 'number'],
        ['fontFamily', 'string?'],
        ['fontWeight', "'normal' | 'bold'"],
        ['textColor', 'string'],
        ['usedAt', 'number'],
      ],
      indexes: ['by_userId', 'by_userId_usedAt'],
      note: 'Text-tool history, per signed-in user',
    },
    {
      name: 'shares',
      fields: [
        ['_id', "Id<'shares'>", 'pk'],
        ['token', 'string', null, true, 'unguessable, public lookup key'],
        ['userId', "Id<'users'>", 'fk', true],
        ['storageId', "Id<'_storage'>", 'fk', false, 'flattened canvas PNG'],
        ['canvasW', 'number'],
        ['canvasH', 'number'],
        ['title', 'string?'],
        ['views', 'number'],
        ['createdAt', 'number'],
      ],
      indexes: ['by_token', 'by_userId'],
      note: 'Public, no-auth read — anyone with the link can view or download',
    },
    {
      name: 'ai_jobs',
      fields: [
        ['_id', "Id<'ai_jobs'>", 'pk'],
        ['userId', "Id<'users'>", 'fk', true],
        ['photoKey', 'string', null, true],
        ['type', "'rembg' | 'upscale' | 'inpaint' | 'ocr' | 'alt'"],
        ['status', "'pending' | 'running' | 'done' | 'failed'"],
        ['replicateId', 'string?', null, true],
        ['inputStorageId', "Id<'_storage'>?"],
        ['maskStorageId', "Id<'_storage'>?", null, false, 'inpaint mask'],
        ['outputStorageId', "Id<'_storage'>?"],
        ['output', 'JsonValue?', null, false, 'non-image result, e.g. OCR text'],
        ['error', 'string?'],
        ['startedAt', 'number?'],
        ['completedAt', 'number?'],
        ['createdAt', 'number'],
      ],
      indexes: ['by_userId', 'by_userId_photoKey', 'by_replicateId', 'by_status'],
      note: 'Keyed by photoKey, not an images row — the Replicate webhook updates status',
    },
  ];

  // The key marker is a letter, not an emoji: 🔑/🔗 as a field icon is an
  // AI-default tell, and emoji render differently on every OS.
  const KEY_LABEL = { pk: 'PK', fk: 'FK', unique: 'UQ' };

  const host = document.getElementById('schema');
  if (host) {
    const frag = document.createDocumentFragment();
    TABLES.forEach((t) => {
      const card = document.createElement('article');
      card.className = 'tbl';

      const head = document.createElement('h3');
      head.className = 'tbl__name mono';
      head.textContent = t.name;
      card.appendChild(head);

      const dl = document.createElement('dl');
      dl.className = 'tbl__fields';
      t.fields.forEach(([name, type, key, indexed, comment]) => {
        const dt = document.createElement('dt');
        dt.className = 'tbl__field';
        if (key) {
          const k = document.createElement('span');
          k.className = 'tbl__key';
          k.textContent = KEY_LABEL[key];
          dt.appendChild(k);
        }
        const n = document.createElement('span');
        n.className = 'tbl__fname';
        n.textContent = name;
        dt.appendChild(n);
        if (indexed) {
          const i = document.createElement('span');
          i.className = 'tbl__idx';
          i.textContent = 'idx';
          dt.appendChild(i);
        }

        const dd = document.createElement('dd');
        dd.className = 'tbl__type';
        dd.textContent = type;
        if (comment) {
          const c = document.createElement('span');
          c.className = 'tbl__comment';
          c.textContent = comment;
          dd.appendChild(c);
        }
        dl.append(dt, dd);
      });
      card.appendChild(dl);

      if (t.indexes?.length) {
        const idx = document.createElement('p');
        idx.className = 'tbl__indexes';
        t.indexes.forEach((name) => {
          const s = document.createElement('span');
          s.className = 'tbl__idxname';
          s.textContent = name;
          idx.appendChild(s);
        });
        card.appendChild(idx);
      }
      if (t.note) {
        const n = document.createElement('p');
        n.className = 'tbl__note';
        n.textContent = t.note;
        card.appendChild(n);
      }
      frag.appendChild(card);
    });
    host.appendChild(frag);
  }

  // ── tier filter ────────────────────────────────────────────
  // Dims every node a given kind of user never touches. The schema tables get
  // tagged here rather than in the markup, since they're rendered above.
  const SCHEMA_TIERS = {
    users: 'free pro',
    subscriptions: 'pro',
    photo_edits: 'free pro',
    recent_texts: 'free pro',
    shares: 'free pro',
    ai_jobs: 'pro',
  };
  document.querySelectorAll('.tbl').forEach((card) => {
    const name = card.querySelector('.tbl__name')?.textContent;
    if (SCHEMA_TIERS[name]) card.dataset.tier = SCHEMA_TIERS[name];
  });

  const group = document.getElementById('tierfilter');
  const note = document.getElementById('tier-note');
  if (!group) return;

  const NOTES = {
    all: 'Everything, including the parts that aren’t built yet.',
    demo: 'No account, no network. The dashed plane is never opened — this is the demo everyone gets, and it is the whole editor.',
    free: 'Signing in adds sync, history and one share link. The AI proxy stays dark: nothing is sent to Replicate on this tier.',
    pro: 'Everything that ships today. Pro is the only tier where a photo of yours reaches an inference server.',
  };

  const buttons = [...group.querySelectorAll('.seg')];
  // scoped to <main>, and excluding the filter's own buttons — they carry a
  // data-tier of their own and must never dim themselves
  const nodes = [...document.querySelectorAll('main [data-tier]')].filter(
    (n) => !n.classList.contains('seg')
  );

  const select = (tier) => {
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tier === tier)));
    nodes.forEach((n) => {
      const tiers = (n.dataset.tier || '').split(/\s+/);
      // "all" dims nothing; otherwise a node stays lit only if it lists this tier
      const lit = tier === 'all' || tiers.includes(tier);
      n.classList.toggle('is-dim', !lit);
    });
    if (note) note.textContent = NOTES[tier] || '';
  };

  buttons.forEach((b) => b.addEventListener('click', () => select(b.dataset.tier)));
  select('all');
})();
