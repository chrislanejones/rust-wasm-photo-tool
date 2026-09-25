import { Fragment, useState, type CSSProperties } from "react";
import Footer from "../components/Footer";
import { CrownIcon, DownloadIcon, LayersIcon, UserCheckIcon, UserXIcon } from "../components/Icons";
import { GITHUB_URL, external } from "../config";
import { KEY_LABEL, TABLES } from "../data/schema";

type Tier = "all" | "demo" | "free" | "pro";

const FILTERS = [
  { key: "all", label: "Full architecture", count: "every plane", Icon: LayersIcon },
  { key: "demo", label: "Logged out", count: "browser only", Icon: UserXIcon },
  { key: "free", label: "Logged in", count: "+ sync & shares", Icon: UserCheckIcon },
  { key: "pro", label: "Paid", count: "+ AI passes", Icon: CrownIcon },
] as const;

/* ⚠️ THE DEMO NOTE IS A FACTUAL CLAIM. Measure it before changing it.
 *
 * It said "No account, no network" for months while it was false, for two
 * reasons: `app/index.html` linked fonts.googleapis.com (fixed in v8.72, faces
 * are self-hosted now), and Clerk's SDK initializes on load even signed out
 * (still true — measured on production 2026-09-11: 7 requests to the Clerk
 * instance and 2 to clerk-telemetry.com before any interaction). What IS true,
 * and worth claiming, is that no PHOTO leaves the browser.
 *
 * To re-measure: load the app logged out and read
 * `performance.getEntriesByType("resource")` for origins that are not ours. */
const NOTES: Record<Tier, string> = {
  all: "Everything, including the parts that aren’t built yet.",
  demo: "No account, and no photo ever leaves your browser — every edit runs on your machine. Clerk's SDK still calls its own servers on load, so it isn't a zero-network page. The dashed plane is never opened: this is the editor everyone gets, and it is the whole editor.",
  free: "Signing in adds sync, history and share links. The AI proxy stays dark: nothing is sent to Replicate on this tier.",
  pro: "Everything that ships today. Paid is the only entitlement where a photo of yours reaches an inference server. An admin is entitled to all of this by role, not by purchase.",
};

/** [title, sub, tiers] — tiers is a space-separated list of who ever touches it. */
type Node = [string, string, string];

const EDGE: Node[] = [
  ["Clerk", "identity", "free pro"],
  ["Convex", "settings across devices · entitlements · gallery", "free pro"],
  ["AI proxy → Replicate", "the server holds the provider key", "pro"],
  ["Share delivery", "ShareViewer · view counts, timestamps only", "free pro"],
];

interface Group {
  label: string;
  muted: string;
  /** narrowest a card may get before the grid wraps */
  min: string;
  /** card surface: `ui` = paper-3, `wasm` = paper-4, `net` = paper-2 */
  surface: "ui" | "wasm" | "net";
  mono?: boolean;
  items: (Node | [string, string, string, "soon"])[];
}

const GROUPS: Group[] = [
  {
    label: "Client layer",
    muted: "— runs entirely in the browser",
    min: "16rem",
    surface: "ui",
    items: [
      ["React App", "Vite + React 19 · Vercel static SPA", "demo free pro"],
      ["Canvas Engine", "Engine worker · zero-copy blit to an OffscreenCanvas", "demo free pro"],
      ["Zustand State", "7 stores · atomic selectors · prefs persisted to IndexedDB", "demo free pro"],
    ],
  },
  {
    label: "WASM processing layer",
    muted: "— client-side Rust, one binary",
    min: "14rem",
    surface: "wasm",
    items: [
      ["core · layer", "ImageBuffer · layer stack · composite / mask", "demo free pro"],
      ["paint · effects", "Brush / eraser / mask · blur / pixelate / redact", "demo free pro"],
      ["annotations · selection", "Live text & shape overlays · magic-wand, edge-aware and lasso selection", "demo free pro"],
      ["stamp · transform", "Clone brush · flip / rotate / resize / crop", "demo free pro"],
      ["filters", "Brightness · contrast · saturation · shadows / highlights · sharpen · gaussian blur", "demo free pro"],
      ["levels · presets", "Black / white / midtones · a preset is a stack of filters · one shared preview slot", "demo free pro"],
      ["perspective", "Four-corner warp for shapes, text and pixels · homography solved in Rust", "demo free pro"],
      ["drawing · text · fonts", "Arrows / shapes / bézier · 3 typefaces, registered at runtime, rasterized in Rust", "demo free pro"],
      ["describe", "Local image description — names a photo from its content, no account", "demo free pro"],
      // The design said "format v6". OP_FORMAT_VERSION in src/ops.rs is 8.
      ["codec · history", "PNG encode (Rust) · undo snapshots · op log at format v8", "demo free pro"],
      ["ops · tiles · patchmatch", "Op log · tile buffer · Magic Eraser fill", "demo free pro"],
      ["simd", "v128/f32x4 kernels · scalar fallback", "demo free pro"],
    ],
  },
  {
    label: "Identity & entitlement",
    muted: "— Clerk decides who; the server decides what",
    min: "12rem",
    surface: "net",
    items: [
      ["Clerk Auth", "identity provider", "free pro"],
      ["Logged out", "entitlement: none · anonymous · 12 photos", "demo"],
      ["Logged in", "entitlement: free · 24 photos", "free"],
      ["Paid", "entitlement: paid · pro or team tier · Stripe", "pro"],
      ["Admin", "a role, not a tier — entitled to paid, from ADMIN_EMAILS on the server", "pro"],
    ],
  },
  {
    label: "Convex functions",
    muted: "— signed-in only",
    min: "12rem",
    surface: "net",
    mono: true,
    items: [
      ["users.ts", "account row · me() with tier, role and entitlement", "free pro"],
      ["entitlement.ts", "the one ladder: none → free → paid · a preview may only take away", "free pro"],
      ["photoEdits.ts", "save / getEdit", "free pro"],
      ["ai.ts", "dispatch to Replicate · 3 models wired", "pro"],
      ["aiJobs.ts", "job status (useQuery) · daily and monthly caps", "pro"],
      ["shares.ts", "public share links · pause, view cap, expiry", "free pro"],
      ["textHistory.ts", "recent texts", "free pro"],
      ["sync.ts", "settings across devices · compare-and-set on rev", "free pro"],
      ["userColors.ts", "saved color palette · 32 per user", "free pro"],
      ["stripe.ts · subscriptions.ts", "checkout / portal · plan status", "free pro"],
      ["http.ts", "webhook router · Replicate + Stripe, HMAC-verified", "pro"],
    ],
  },
  {
    label: "Storage",
    muted: "",
    min: "16rem",
    surface: "wasm",
    items: [
      ["IndexedDB (Dexie)", "Originals · SHA-256 content-addressed · your machine", "demo free pro"],
      ["Convex File Storage", "Edit archives · shares · AI frames · a server", "free pro"],
    ],
  },
  {
    label: "AI",
    muted: "— Replicate, paid only",
    min: "12rem",
    surface: "net",
    mono: true,
    items: [
      ["cjwbw/rembg", "background removal", "pro"],
      ["text-extract-ocr", "text extract", "pro"],
      ["remove-object", "object removal (masked, LaMa)", "pro"],
      ["Real-ESRGAN", "4× upscale", "planned", "soon"],
    ],
  },
  {
    label: "Event handlers",
    muted: "— webhooks",
    min: "16rem",
    surface: "net",
    items: [
      ["Stripe webhook", "subscription changes → subscriptions", "pro"],
      ["Replicate webhook", "AI complete → ai_jobs.status", "pro"],
    ],
  },
];

/* Presentation only — which outside system a table belongs to. The fields,
 * types and indexes all come from data/schema.ts. */
const TABLE_BADGE: Record<string, string> = {
  users: "Clerk-synced",
  subscriptions: "Stripe",
  shares: "public read",
  share_views: "new · timestamps only",
  ai_jobs: "Replicate",
};

const RELS: [string, string, string][] = [
  ["users", "1 ─ 1", "subscriptions"],
  ["users", "1 ─ ∞", "photo_edits"],
  ["users", "1 ─ ∞", "recent_texts"],
  ["users", "1 ─ ∞", "sync_docs"],
  ["users", "1 ─ ∞", "user_colors"],
  ["users", "1 ─ ∞", "shares"],
  ["shares", "1 ─ ∞", "share_views"],
  ["users", "1 ─ ∞", "ai_jobs"],
];

// A relationship is only drawn when both ends are tables the schema actually
// documents, so the list can never point at a table the grid above lacks.
const KNOWN = new Set(TABLES.map((t) => t.name));
const SHOWN_RELS = RELS.filter(([a, , b]) => KNOWN.has(a) && KNOWN.has(b));

export default function Architecture() {
  // Dims every node a given kind of user never touches — the page's argument,
  // made pressable.
  const [tier, setTier] = useState<Tier>("all");

  const dim = (tiers: string) =>
    tier !== "all" && !tiers.split(/\s+/).includes(tier) ? " is-dim" : "";

  return (
    <>
      <main id="main" className="architecture">
        <header className="arch-head">
          <div className="arch-head__lead">
            <p className="arch-head__eyebrow">Architecture · as of v8.90, 09-22-2026</p>
            <h1 className="arch-head__title">One half is the editor. The other half is optional.</h1>
          </div>
          <p className="arch-head__deck">
            Everything inside the solid box runs in your tab. Cut the dashed box off entirely and
            what&rsquo;s left is still a complete image editor &mdash; that isn&rsquo;t a fallback
            mode, it&rsquo;s the free editor everyone gets.
          </p>
        </header>

        <section className="arch-filter" aria-labelledby="tf-h">
          <h2 className="visually-hidden" id="tf-h">
            Show the architecture for one kind of user
          </h2>
          <div
            className="arch-filter__grid"
            role="group"
            aria-label="Show the architecture for one kind of user"
          >
            {FILTERS.map(({ key, label, count, Icon }) => (
              <button
                key={key}
                type="button"
                className="arch-tile"
                aria-pressed={tier === key}
                onClick={() => setTier(key)}
              >
                <span className="arch-tile__icon">
                  <Icon size={22} />
                </span>
                <span className="arch-tile__label">{label}</span>
                <span className="arch-tile__count">{count}</span>
              </button>
            ))}
          </div>
          <p className="arch-filter__note" role="status">
            {NOTES[tier]}
          </p>
        </section>

        <section className="arch-map" aria-labelledby="map-h">
          <h2 className="visually-hidden" id="map-h">
            System map
          </h2>

          {/* NOT "fully functional offline". A precache service worker is
              written and ships dark (ADR-049), so a cold load with no network
              still fails. Restore an offline claim only when the SW ships. */}
          <div className="arch-plane arch-plane--browser">
            <div className="arch-plane__head">
              <span className="arch-plane__name">Browser</span>
              <span className="arch-plane__note">
                no server in the edit path · one 814 KB engine
              </span>
            </div>

            <div className="arch-plane__row">
              <article className="arch-node arch-node--ui">
                <h3 className="arch-node__title">UI plane</h3>
                <p className="arch-node__sub">React 19 · TypeScript · Vite · Tailwind v4</p>
                <ul className="arch-node__list">
                  <li>AppShell — composition and layout only</li>
                  <li>Tool registry — 5 modules registered; routing still hand-wired in AppShell</li>
                  <li>Session hooks — image · selection · canvas · mask</li>
                  <li>
                    7 Zustand stores — UI · tool · gallery · annotation · guides · perspective ·
                    text box
                  </li>
                </ul>
              </article>

              <article className={`arch-node arch-node--compute${dim("demo free pro")}`}>
                <h3 className="arch-node__title">Compute plane</h3>
                <p className="arch-node__sub">where the pixels are touched</p>
                <ul className="arch-node__list">
                  <li>
                    <strong>Engine worker</strong> — the engine and the canvas both live here, off
                    the main thread. Main-thread blocking per heavy op: 129–137 ms → 0.
                  </li>
                  <li>
                    <strong>WASM engine — stamp_tool</strong>: kernels, TileBuffer, OpLog,
                    PatchMatch
                  </li>
                  <li>
                    <strong>Local describer</strong> — names a photo from what&rsquo;s in it,
                    inside the engine. No account, no per-image cost.
                  </li>
                  <li>Codec worker — WebP/JPEG encode · gallery thumbnails</li>
                  <li>
                    Fonts — three families served as static files, registered with the engine at
                    runtime
                  </li>
                  <li className={`arch-node__planned${dim("planned")}`}>
                    rayon worker pool — tried and dropped: 8–31× slower than the single-threaded
                    kernel
                  </li>
                  <li className={`arch-node__planned${dim("planned")}`}>
                    WebGPU backend — one blur kernel and a self-test; nothing on the pixel path
                  </li>
                </ul>
              </article>

              <article className="arch-node arch-node--ui">
                <h3 className="arch-node__title">Persistence plane</h3>
                <p className="arch-node__sub">IndexedDB · Dexie</p>
                <ul className="arch-node__list">
                  <li>originals — content-addressed (SHA-256), immutable</li>
                  <li>opLogs + keyframes — the op format is at v8</li>
                  <li>gallery manifest</li>
                  <li>renderCache — disposable</li>
                </ul>
              </article>
            </div>

            <p className="arch-plane__foot">
              Plus <code>localStorage</code> for lightweight prefs, and a sync layer over both: a{" "}
              <code>BroadcastChannel</code> keeps every tab on this device in step, and — only when
              signed in — Convex carries the same three documents to your other devices. Your
              photos are not in it. A precache-only service worker is written and tested and still
              ships dark: it is blocked on eviction reach, not on the precache (ADR-049).
            </p>
          </div>

          <div className="arch-seam" aria-hidden="true">
            <span className="arch-seam__rule" />
            <span className="arch-seam__label">sever here — the editor still works</span>
            <span className="arch-seam__rule" />
          </div>

          <div className={`arch-plane arch-plane--edge${dim("free pro")}`}>
            <div className="arch-plane__head">
              <span className="arch-plane__name">Network</span>
              <span className="arch-plane__note">
                optional, additive only · the only place a photo of yours can travel
              </span>
            </div>
            <div className="arch-plane__row arch-plane__row--edge">
              {EDGE.map(([title, sub, tiers]) => (
                <article key={title} className={`arch-node arch-node--net${dim(tiers)}`}>
                  <h3 className="arch-node__title">{title}</h3>
                  <p className="arch-node__sub">{sub}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="arch-stack">
          <header className="arch-stack__head">
            <h2 className="arch-section-title">What&rsquo;s in each plane</h2>
            <p className="arch-stack__deck">
              Three words, kept apart since v8.90: a <strong>tier</strong> is what an account paid
              for, a <strong>role</strong> is what a person is trusted to do, and an{" "}
              <strong>entitlement</strong> is what this session may use. The server decides all
              three.
            </p>
          </header>

          {GROUPS.map((g) => (
            <div key={g.label}>
              <h3 className="arch-stack__label">
                {g.label} {g.muted && <span className="arch-stack__muted">{g.muted}</span>}
              </h3>
              <div className="arch-stack__grid" style={{ "--min": g.min } as CSSProperties}>
                {g.items.map(([title, sub, tiers, soon]) => (
                  <article key={title} className={`arch-node arch-node--${g.surface}${dim(tiers)}`}>
                    <h4 className={`arch-node__title${g.mono ? " arch-node__title--mono" : ""}`}>
                      {title}
                    </h4>
                    <p className="arch-node__sub">{sub}</p>
                    {soon && <span className="arch-node__soon">soon</span>}
                  </article>
                ))}
              </div>
            </div>
          ))}

          <p className="arch-stack__note">
            Clerk sign-in isn&rsquo;t a webhook here — the client calls <code>users.upsert</code>{" "}
            once Convex&rsquo;s own auth bridge comes up, and that is what actually creates the{" "}
            <code>users</code> row. Who is an admin is read from <code>ADMIN_EMAILS</code> on the
            deployment — never from the browser.
          </p>
        </section>

        <section className="arch-schema" id="schema">
          <header className="arch-schema__head">
            <h2 className="arch-big-title">What the server keeps, table by table.</h2>
            <p className="arch-schema__deck">
              Every table the app reads or writes, with its fields and indexes. Each row hangs
              straight off <code>users</code>, keyed by the editor&rsquo;s own <code>photoKey</code>.
              Never a pixel: edited images stay in the browser that made them.
            </p>
          </header>

          <div className="arch-schema__grid">
            {TABLES.map((t) => (
              <article key={t.name} className={`arch-tbl${dim(t.tiers)}`}>
                <h3 className="arch-tbl__name">
                  <span>{t.name}</span>
                  {TABLE_BADGE[t.name] && (
                    <span className="arch-tbl__badge">{TABLE_BADGE[t.name]}</span>
                  )}
                </h3>
                <dl className="arch-tbl__fields">
                  {t.fields.map((f) => (
                    <Fragment key={f.name}>
                      <dt className="arch-tbl__field">
                        {f.key && <span className="arch-tbl__key">{KEY_LABEL[f.key]}</span>}
                        <span className="arch-tbl__fname">{f.name}</span>
                        {f.indexed && <span className="arch-tbl__idx">idx</span>}
                      </dt>
                      <dd className="arch-tbl__type">
                        {f.type}
                        {f.comment && <span className="arch-tbl__comment">{f.comment}</span>}
                      </dd>
                    </Fragment>
                  ))}
                </dl>
                {t.indexes.length > 0 && (
                  <p className="arch-tbl__indexes">
                    {t.indexes.map((i) => (
                      <span key={i} className="arch-tbl__idxname">
                        {i}
                      </span>
                    ))}
                  </p>
                )}
                {t.note && <p className="arch-tbl__note">{t.note}</p>}
              </article>
            ))}
          </div>

          <div className="arch-rels">
            <h3 className="arch-rels__label">Entity relationships</h3>
            <ul className="arch-rels__list">
              {SHOWN_RELS.map(([a, card, b]) => (
                <li key={`${a}-${b}`}>
                  <span className="arch-rels__name">{a}</span>{" "}
                  <span className="arch-rels__card">{card}</span>{" "}
                  <span className="arch-rels__name">{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="arch-schema__notes">
            <article className="arch-note">
              <h4 className="arch-note__title">Real-time</h4>
              <p className="arch-note__body">
                <span className="arch-mono">useQuery</span> hooks update when data changes. No
                polling — it is what carries a setting from a phone to a laptop.
              </p>
            </article>
            <article className="arch-note">
              <h4 className="arch-note__title">Row-level auth</h4>
              <p className="arch-note__body">
                <span className="arch-mono">ctx.auth</span> in mutations, plus query filters for
                user-scoped data. Entitlement is computed server-side from tier + role.
              </p>
            </article>
            <article className="arch-note">
              <h4 className="arch-note__title">File storage</h4>
              <p className="arch-note__body">
                Blob storage for edit archives, share snapshots and AI frames via{" "}
                <span className="arch-mono">storage.getUrl()</span>.
              </p>
            </article>
            <article className="arch-note">
              <h4 className="arch-note__title">Webhooks</h4>
              <p className="arch-note__body">
                Replicate and Stripe post back to <span className="arch-mono">convex/http.ts</span>,
                HMAC-verified. A scheduled <span className="arch-mono">shares.expire</span> stops a
                link at its end date.
              </p>
            </article>
          </div>
        </section>

        {/* The argument, then the source that backs it, then both ways out. */}
        <section className="arch-coda">
          <div className="arch-coda__text">
            <h2 className="arch-big-title arch-big-title--wide">Why draw it this way</h2>
            <p className="arch-coda__lede">
              Because the boundary is the product. An editor that needs a server is an editor that
              can be switched off, rate-limited, or quietly trained on. The dashed box buys you
              sync, sharing and the AI passes — and it is the only place a photo of yours can
              travel. Signed out, you never cross it.
            </p>
            <p className="arch-coda__source">
              The map above is drawn by hand from{" "}
              <span className="arch-mono arch-coda__file">system-architecture.mermaid</span>, the
              flowchart the repo ships. Render the original wherever you like.
            </p>
          </div>
          <div className="arch-coda__actions">
            {/* A download rather than a live render: mermaid's color parser
                rejects OKLCH outright, so theming it from these tokens would
                mean a second hex palette plus ~1MB of CDN to draw what the
                hand-built map above already says. */}
            <a
              className="arch-btn"
              href="/system-architecture.mermaid"
              download="system-architecture.mermaid"
              type="text/vnd.mermaid"
            >
              <DownloadIcon />
              Download the .mermaid source
            </a>
            <a
              className="arch-btn"
              href={`${GITHUB_URL}/blob/master/docs/Architecture.md`}
              {...external}
            >
              Read the full architecture doc
            </a>
            <p className="arch-coda__foot">
              flowchart TB · <span className="arch-coda__num">121</span> lines · the dashed
              subgraph is the plane you can cut
            </p>
          </div>
        </section>
      </main>

      <Footer line="One plane is the editor. The other is optional." />
    </>
  );
}
