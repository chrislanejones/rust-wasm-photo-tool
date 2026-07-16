import { Fragment, useState } from "react";
import Footer from "../components/Footer";
import { CrownIcon, DownloadIcon, LayersIcon, UserCheckIcon, UserXIcon } from "../components/Icons";
import { GITHUB_URL, external } from "../config";
import { KEY_LABEL, TABLES } from "../data/schema";

type Tier = "all" | "demo" | "free" | "pro";

const FILTERS = [
  { key: "all", label: "Full architecture", Icon: LayersIcon },
  { key: "demo", label: "Logged out", Icon: UserXIcon },
  { key: "free", label: "Logged in", Icon: UserCheckIcon },
  { key: "pro", label: "Paid users", Icon: CrownIcon },
] as const;

const NOTES: Record<Tier, string> = {
  all: "Everything, including the parts that aren’t built yet.",
  demo: "No account, no network. The dashed plane is never opened — this is the demo everyone gets, and it is the whole editor.",
  free: "Signing in adds sync, history and one share link. The AI proxy stays dark: nothing is sent to Replicate on this tier.",
  pro: "Everything that ships today. Pro is the only tier where a photo of yours reaches an inference server.",
};

export default function Architecture() {
  // Dims every node a given kind of user never touches — the page's argument,
  // made pressable.
  const [tier, setTier] = useState<Tier>("all");

  /** `tiers` is the space-separated list of tiers a node belongs to. */
  const dim = (tiers: string) =>
    tier !== "all" && !tiers.split(/\s+/).includes(tier) ? " is-dim" : "";

  const node = (tiers: string, extra = "") => `node${extra}${dim(tiers)}`;

  return (
    <>
      <main id="main">
        {/* The map IS the page: an orientation phrase, then the map. */}
        <header className="page-head">
          <h1 className="page-head__title">One plane is the editor. The other is optional.</h1>
          <p className="lede">
            Everything inside the solid boundary runs in your tab. Cut the dashed plane off entirely
            and what's left is still a complete, working image editor — that isn't a fallback mode,
            it's the demo everyone gets.
          </p>
        </header>

        <section className="tiers-filter" aria-labelledby="tf-h">
          <h2 className="visually-hidden" id="tf-h">
            Show the architecture for one kind of user
          </h2>
          <div className="graph__scroll">
            <div
              className="graph__group"
              role="group"
              aria-label="Show the architecture for one kind of user"
            >
              {FILTERS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  className="seg seg--tier"
                  type="button"
                  aria-pressed={tier === key}
                  onClick={() => setTier(key)}
                >
                  <Icon size={22} className="seg__icon" />
                  <span className="seg__label">{label}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="tiers-filter__note" role="status">
            {NOTES[tier]}
          </p>
        </section>

        <section className="map" aria-labelledby="map-h">
          <h2 className="visually-hidden" id="map-h">
            System map
          </h2>

          <div className={`map__plane map__plane--client${dim("demo free pro")}`}>
            <div className="plane__head">
              <span className="plane__name">Browser</span>
              <span className="plane__note">fully functional offline</span>
            </div>

            <div className="map__row">
              <article className="node">
                <h3 className="node__title">UI plane</h3>
                <p className="node__sub">React 18 · TypeScript · Vite</p>
                <ul className="node__list">
                  <li>AppShell — composition and layout only</li>
                  <li>Tool registry — ~10 tool modules</li>
                  <li>Session hooks — image · selection · canvas · mask</li>
                  <li>Zustand stores — UI · tool · gallery · annotation · guides</li>
                </ul>
              </article>

              <article className={node("demo free pro", " node--accent")}>
                <h3 className="node__title">Compute plane</h3>
                <p className="node__sub">where the pixels are touched</p>
                <ul className="node__list">
                  <li>
                    <strong>WASM engine — stamp_tool</strong>: kernels, TileBuffer, OpLog
                  </li>
                  <li>Codec worker — encode · thumbnail · OffscreenCanvas</li>
                  <li className={`node__planned${dim("planned")}`}>
                    rayon worker pool — planned, gated on COOP/COEP
                  </li>
                  <li className={`node__planned${dim("planned")}`}>WebGPU backend — far off</li>
                </ul>
              </article>

              <article className="node">
                <h3 className="node__title">Persistence plane</h3>
                <p className="node__sub">IndexedDB · Dexie</p>
                <ul className="node__list">
                  <li>originals — content-addressed, immutable</li>
                  <li>opLogs + keyframes</li>
                  <li>gallery manifest</li>
                  <li>renderCache — disposable</li>
                </ul>
              </article>
            </div>

            <p className="plane__foot">
              Plus <code>localStorage</code> for lightweight prefs, and a service worker that
              precaches the shell and the WASM binary.
            </p>
          </div>

          <div className="map__seam" aria-hidden="true">
            <span className="map__seam-label">sever here — the editor still works</span>
          </div>

          <div className={`map__plane map__plane--edge${dim("free pro")}`}>
            <div className="plane__head">
              <span className="plane__name">Network</span>
              <span className="plane__note">optional, additive only</span>
            </div>

            <div className="map__row map__row--4">
              <article className={node("free pro", " node--quiet")}>
                <h3 className="node__title">Clerk</h3>
                <p className="node__sub">identity</p>
              </article>
              <article className={node("free pro", " node--quiet")}>
                <h3 className="node__title">Convex</h3>
                <p className="node__sub">prefs sync · entitlements · gallery</p>
              </article>
              <article className={node("pro", " node--quiet")}>
                <h3 className="node__title">AI proxy → Replicate</h3>
                <p className="node__sub">the server holds the provider key</p>
              </article>
              <article className={node("free pro", " node--quiet")}>
                <h3 className="node__title">Share delivery</h3>
                <p className="node__sub">ShareViewer</p>
              </article>
            </div>
          </div>
        </section>

        <section className="stack">
          <header className="head-hang">
            <h2 className="section__title section__title--sm">What's in each plane</h2>
          </header>

          <h3 className="stack__label">
            Client layer <span className="muted">— runs entirely in the browser</span>
          </h3>
          <div className="stack__grid">
            <article className={node("demo free pro")}>
              <h4 className="node__title">React App</h4>
              <p className="node__sub">Vite + React 19 · Netlify static SPA</p>
            </article>
            <article className={node("demo free pro")}>
              <h4 className="node__title">Canvas Engine</h4>
              <p className="node__sub">JS ↔ WASM bridge · zero-copy blit</p>
            </article>
            <article className={node("demo free pro")}>
              <h4 className="node__title">Zustand State</h4>
              <p className="node__sub">5 stores · atomic selectors</p>
            </article>
          </div>

          <h3 className="stack__label">
            WASM processing layer <span className="muted">— client-side Rust, one binary</span>
          </h3>
          <div className="stack__grid stack__grid--3">
            {[
              ["core · layer", "ImageBuffer · layer stack · composite / mask"],
              ["paint · effects", "Brush / eraser / mask · blur / pixelate / redact"],
              ["annotations · selection", "Live text & shape overlays · magic-wand"],
              ["stamp · transform", "Clone brush · flip / rotate / resize / crop"],
              ["filters", "Brightness · contrast · gaussian blur"],
              ["drawing · text", "Arrows / shapes / bézier · embedded fonts"],
              ["codec · history", "PNG encode (Rust) · undo snapshots"],
              ["simd", "v128/f32x4 kernels · scalar fallback"],
              ["utils", "json · point math · shared helpers"],
            ].map(([title, sub]) => (
              <article key={title} className={node("demo free pro", " node--accent")}>
                <h4 className="node__title">{title}</h4>
                <p className="node__sub">{sub}</p>
              </article>
            ))}
          </div>

          <h3 className="stack__label">
            Identity <span className="muted">— Clerk</span>
          </h3>
          <div className="stack__grid stack__grid--4">
            <article className={node("free pro", " node--quiet")}>
              <h4 className="node__title">Clerk Auth</h4>
              <p className="node__sub">identity provider</p>
            </article>
            <article className={node("demo", " node--quiet")}>
              <h4 className="node__title">Demo</h4>
              <p className="node__sub">anonymous · 12 photos</p>
            </article>
            <article className={node("free", " node--quiet")}>
              <h4 className="node__title">Free</h4>
              <p className="node__sub">signed in · 24 photos</p>
            </article>
            <article className={node("pro", " node--quiet")}>
              <h4 className="node__title">Pro</h4>
              <p className="node__sub">100 photos · coming soon</p>
            </article>
          </div>

          <h3 className="stack__label">
            Convex functions <span className="muted">— signed-in only</span>
          </h3>
          <div className="stack__grid stack__grid--3">
            {[
              ["photoEdits.ts", "save / getEdit", "free pro"],
              ["ai.ts", "dispatch to Replicate", "pro"],
              ["aiJobs.ts", "job status (useQuery)", "pro"],
              ["shares.ts", "public share links", "free pro"],
              ["textHistory.ts", "recent texts", "free pro"],
              ["stripe.ts", "checkout / portal", "free pro"],
            ].map(([title, sub, tiers]) => (
              <article key={title} className={node(tiers, " node--quiet")}>
                <h4 className="node__title mono">{title}</h4>
                <p className="node__sub">{sub}</p>
              </article>
            ))}
          </div>

          <h3 className="stack__label">Storage</h3>
          <div className="stack__grid">
            <article className={node("demo free pro", " node--accent")}>
              <h4 className="node__title">IndexedDB (Dexie)</h4>
              <p className="node__sub">Originals · SHA-256 content-addressed · your machine</p>
            </article>
            <article className={node("free pro", " node--quiet")}>
              <h4 className="node__title">Convex File Storage</h4>
              <p className="node__sub">Edit archives · shares · AI frames · a server</p>
            </article>
          </div>

          <h3 className="stack__label">
            AI <span className="muted">— Replicate, Pro only</span>
          </h3>
          <div className="stack__grid stack__grid--4">
            <article className={node("pro", " node--quiet")}>
              <h4 className="node__title mono">cjwbw/rembg</h4>
              <p className="node__sub">background removal</p>
            </article>
            <article className={node("pro", " node--quiet")}>
              <h4 className="node__title mono">abiruyt/text-extract-ocr</h4>
              <p className="node__sub">text extract</p>
            </article>
            <article className={node("pro", " node--quiet")}>
              <h4 className="node__title mono">zylim0702/remove-object</h4>
              <p className="node__sub">object removal (masked)</p>
            </article>
            <article className={node("planned", " node--quiet")}>
              <h4 className="node__title mono">Real-ESRGAN</h4>
              <p className="node__sub">4× upscale</p>
              <span className="tag tag--local">soon</span>
            </article>
          </div>

          <h3 className="stack__label">
            Event handlers <span className="muted">— webhooks</span>
          </h3>
          <div className="stack__grid">
            <article className={node("pro", " node--quiet")}>
              <h4 className="node__title">Stripe webhook</h4>
              <p className="node__sub">
                subscription changes → <span className="mono">subscriptions</span>
              </p>
            </article>
            <article className={node("pro", " node--quiet")}>
              <h4 className="node__title">Replicate webhook</h4>
              <p className="node__sub">
                AI complete → <span className="mono">ai_jobs.status</span>
              </p>
            </article>
          </div>
          <p className="stack__note muted">
            Clerk sign-in isn't a webhook here — the client calls <code>users.upsert</code> once
            Convex's own auth bridge comes up, and that is what actually creates the{" "}
            <code>users</code> row.
          </p>
        </section>

        <section className="schema" id="schema">
          <header className="head-hang">
            <h2 className="section__title section__title--sm">Convex database schema</h2>
            <p className="lede">
              Every table, its fields and its indexes. Flatter than a typical projects → images tree:
              each row hangs straight off <code>users</code>, keyed by the client's own{" "}
              <code>photoKey</code> string rather than a server-side image id.
            </p>
          </header>

          <div className="schema__grid">
            {TABLES.map((t) => (
              <article key={t.name} className={`tbl${dim(t.tiers)}`}>
                <h3 className="tbl__name mono">{t.name}</h3>
                <dl className="tbl__fields">
                  {t.fields.map((f) => (
                    <Fragment key={f.name}>
                      <dt className="tbl__field">
                        {f.key && <span className="tbl__key">{KEY_LABEL[f.key]}</span>}
                        <span className="tbl__fname">{f.name}</span>
                        {f.indexed && <span className="tbl__idx">idx</span>}
                      </dt>
                      <dd className="tbl__type">
                        {f.type}
                        {f.comment && <span className="tbl__comment">{f.comment}</span>}
                      </dd>
                    </Fragment>
                  ))}
                </dl>
                {t.indexes.length > 0 && (
                  <p className="tbl__indexes">
                    {t.indexes.map((i) => (
                      <span key={i} className="tbl__idxname">
                        {i}
                      </span>
                    ))}
                  </p>
                )}
                {t.note && <p className="tbl__note">{t.note}</p>}
              </article>
            ))}
          </div>

          <div className="rels">
            <h3 className="stack__label">Entity relationships</h3>
            <ul className="rels__list">
              {[
                ["users", "1 ─ 1", "subscriptions"],
                ["users", "1 ─ ∞", "photo_edits"],
                ["users", "1 ─ ∞", "recent_texts"],
                ["users", "1 ─ ∞", "shares"],
                ["users", "1 ─ ∞", "ai_jobs"],
              ].map(([a, card, b]) => (
                <li key={b}>
                  <span className="mono">{a}</span> <span className="rels__card">{card}</span>{" "}
                  <span className="mono">{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="stack__grid stack__grid--4 schema__notes">
            <article className="node node--quiet">
              <h4 className="node__title">Real-time</h4>
              <p className="node__sub">
                <span className="mono">useQuery</span> hooks auto-update when data changes. No
                polling.
              </p>
            </article>
            <article className="node node--quiet">
              <h4 className="node__title">Row-level auth</h4>
              <p className="node__sub">
                <span className="mono">ctx.auth</span> in mutations, plus query filters for
                user-scoped data.
              </p>
            </article>
            <article className="node node--quiet">
              <h4 className="node__title">File storage</h4>
              <p className="node__sub">
                Integrated blob storage for images via <span className="mono">storage.getUrl()</span>
                .
              </p>
            </article>
            <article className="node node--quiet">
              <h4 className="node__title">Webhooks</h4>
              <p className="node__sub">
                Replicate + Stripe post back to <span className="mono">convex/http.ts</span>,
                HMAC-verified.
              </p>
            </article>
          </div>
        </section>

        {/* The argument, then the source that backs it, then both ways out. */}
        <section className="why">
          <h2 className="section__title section__title--sm">Why draw it this way</h2>
          <p className="lede">
            Because the boundary is the product. An editor that needs a server is an editor that can
            be switched off, rate-limited, or quietly trained on. The dashed plane buys you sync,
            sharing, and the AI passes — and it is the only place a photo of yours can travel. Demo
            mode never crosses it.
          </p>
          <p className="lede">
            The map above is drawn by hand from <code>system-architecture.mermaid</code>, the
            flowchart the repo ships. Take the original and render it wherever you like — Mermaid
            Live, a VS&nbsp;Code preview, your own docs.
          </p>
          <div className="why__actions">
            {/* A download rather than a live render: mermaid's colour parser
                rejects OKLCH outright, so theming it from these tokens would
                mean a second hex palette plus ~1MB of CDN to draw what the
                hand-built map above already says. */}
            <a
              className="cta cta--outline cta--lg"
              href="/system-architecture.mermaid"
              download="system-architecture.mermaid"
              type="text/vnd.mermaid"
            >
              <DownloadIcon />
              Download the source
            </a>
            <a
              className="cta cta--outline cta--lg"
              href={`${GITHUB_URL}/blob/master/docs/Architecture.md`}
              {...external}
            >
              Read the full architecture doc
            </a>
          </div>
          <p className="diagram__foot muted">
            <span className="mono">system-architecture.mermaid</span> · Mermaid{" "}
            <span className="mono">flowchart TB</span> · <span className="fig">79</span> lines · the
            dashed subgraph is the plane you can cut.
          </p>
        </section>
      </main>

      <Footer line="Sever the network plane. It still works." />
    </>
  );
}
