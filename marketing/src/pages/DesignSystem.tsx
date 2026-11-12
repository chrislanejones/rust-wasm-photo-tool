import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Check, CircleX, Cloud, Dot, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import Footer from "../components/Footer";
import NextCards from "../components/NextCards";
import { external } from "../config";
import { pickNextCards } from "../data/nextCards";
import { EDITOR_TOKENS } from "../data/editorTokens";
import { SITE_TOKENS } from "../data/siteTokens";
import { oklchContrast } from "../lib/oklch";
import {
  A11Y_RULES, ASYNC_STATES, COLOR_GROUPS, COMPONENTS, DOCS, FIGMA_FILES, PRINCIPLES, RADII, REPO_BLOB,
  SECTIONS, SITE_A11Y_RULES, SITE_COLOR_GROUPS, SITE_COMPONENTS, SITE_DOCS, SITE_LAYOUT, SITE_MOTION,
  SITE_PRINCIPLES, SITE_RADII, SITE_SECTIONS, SITE_SPACING, SITE_TYPE_SCALE, SPACING, SURFACES, TYPE_SCALE,
  type ComponentCategory,
} from "../data/designSystem";

/* /design-system — two design systems, one per tab.
 *
 * Image Horse Editor: how the app looks and behaves. Its specimens are STATIC:
 * plain markup styled from the editor's real color tokens (data/editorTokens.ts,
 * generated from app/src/styles.css and checked in CI). They are pictures of
 * components, not a second component library, so they are hidden from
 * assistive tech and described in words beside them.
 *
 * Image Horse Marketing: this site. Its specimens are the REAL classes, because
 * this page is built from them; the values are read from tokens.css
 * (data/siteTokens.ts, generated and checked the same way).
 *
 * The page's own chrome is borrowed, not invented: the header and the tab tiles
 * are the Trail Log's (.trail-head, .trail-tile), and the closing row of each
 * tab is the Architecture page's (.arch-coda, .arch-btn). */

type Theme = "light" | "dark";
type Preview = Theme | "both";
type TabId = "editor" | "marketing";

const TABS: readonly { id: TabId; label: string; sub: string }[] = [
  { id: "editor", label: "Image Horse Editor", sub: `the app · ${SECTIONS.length} sections` },
  { id: "marketing", label: "Image Horse Marketing", sub: `this site · ${SITE_SECTIONS.length} sections` },
];

/** Which tab a URL hash belongs to, or null when it names neither. */
function tabForHash(hash: string): TabId | null {
  const h = hash.replace(/^#/, "");
  if (!h) return null;
  if (h === "marketing" || h.startsWith("m-")) return "marketing";
  if (h === "editor" || SECTIONS.some((s) => s.id === h)) return "editor";
  return null;
}

/** The editor tokens as `--e-*` custom properties for one theme. */
function themeVars(theme: Theme): CSSProperties {
  const t = EDITOR_TOKENS[theme] as Record<string, string>;
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(t)) vars[`--e-${k}`] = v;
  vars["--e-radius-sm"] = EDITOR_TOKENS.radius.sm;
  vars["--e-radius-md"] = EDITOR_TOKENS.radius.md;
  vars["--e-radius-lg"] = EDITOR_TOKENS.radius.lg;
  return vars as CSSProperties;
}

function source(path: string) {
  return `${REPO_BLOB}${path}`;
}

/** One editor-themed specimen, once per theme the preview shows. */
function Specimen({ preview, children, label }: { preview: Preview; children: ReactNode; label: string }) {
  const themes: Theme[] = preview === "both" ? ["light", "dark"] : [preview];
  return (
    <div className={`ds-spec${themes.length > 1 ? " ds-spec--pair" : ""}`}>
      {themes.map((t) => (
        <figure key={t} className="ds-ed" data-theme={t} style={themeVars(t)}>
          <div className="ds-ed__body" aria-hidden="true">{children}</div>
          <figcaption className="ds-ed__cap">{label} · {t}</figcaption>
        </figure>
      ))}
    </div>
  );
}

function SectionHead({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <header className="ds-sec__head">
      <p className="ds-sec__eyebrow">{eyebrow}</p>
      <h2 className="ds-sec__title" id={`${id}-h`}>{title}</h2>
      {children && <p className="ds-sec__deck">{children}</p>}
    </header>
  );
}

function ThemePreview({ value, onChange }: { value: Preview; onChange: (v: Preview) => void }) {
  const options: { id: Preview; label: string }[] = [
    { id: "both", label: "Both" },
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
  ];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + options.length) % options.length;
    onChange(options[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div className="ds-preview">
      <span className="ds-preview__label" id="ds-preview-label">Editor theme in the examples</span>
      <div role="radiogroup" aria-labelledby="ds-preview-label" className="ds-seg">
        {options.map((o, i) => (
          <button
            key={o.id}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            tabIndex={value === o.id ? 0 : -1}
            className="ds-seg__opt"
            onClick={() => onChange(o.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── sections ─────────────────────────────────────────────────────────────

function Principles() {
  return (
    <section className="ds-sec" id="principles" aria-labelledby="principles-h">
      <SectionHead id="principles" eyebrow="01" title="Principles">
        Seven rules every panel in the editor is held to. The UI was counted before any of them was decided, so each rule describes what most of the editor already did.
      </SectionHead>
      <ol className="ds-principles">
        {PRINCIPLES.map((p) => (
          <li key={p.title} className="ds-card">
            <h3 className="ds-card__title">{p.title}</h3>
            <p className="ds-card__body">{p.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Colors({ preview }: { preview: Preview }) {
  const themes: Theme[] = preview === "both" ? ["light", "dark"] : [preview];
  return (
    <section className="ds-sec" id="color" aria-labelledby="color-h">
      <SectionHead id="color" eyebrow="02" title="Colors and themes">
        The editor has two themes, a warm-paper light and an earth-tone dark. Every color is a token: no hex in the
        components. The values below are read from the editor's own stylesheet at build time.
      </SectionHead>
      {COLOR_GROUPS.map((g) => (
        <div key={g.title} className="ds-group">
          <h3 className="ds-h3">{g.title}</h3>
          {g.note && <p className="ds-note">{g.note}</p>}
          <ul className="ds-swatches">
            {g.tokens.map((tok) => (
              <li key={tok} className="ds-swatch">
                <div className="ds-swatch__chips">
                  {themes.map((t) => {
                    const v = (EDITOR_TOKENS[t] as Record<string, string>)[tok];
                    return (
                      <span key={t} className="ds-swatch__chip" style={{ background: v }} title={`${t}: ${v}`} aria-hidden="true" />
                    );
                  })}
                </div>
                <code className="ds-swatch__name">--{tok}</code>
                <dl className="ds-swatch__vals">
                  {themes.map((t) => (
                    <div key={t}>
                      <dt>{t}</dt>
                      <dd><code>{(EDITOR_TOKENS[t] as Record<string, string>)[tok]}</code></dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="ds-group">
        <h3 className="ds-h3">Disabled</h3>
        <p className="ds-note">
          Disabled is not its own color. A disabled button keeps its shape and drops to the tertiary surface with muted
          text; a disabled tool tile also fades to 40% and goes gray.
        </p>
        <Specimen preview={preview} label="Enabled and disabled">
          <div className="ds-row">
            <span className="ds-btn">Apply</span>
            <span className="ds-btn is-disabled">Apply</span>
            <span className="ds-tile">Crop</span>
            <span className="ds-tile is-disabled">Crop</span>
          </div>
        </Specimen>
      </div>
    </section>
  );
}

function Typography({ preview }: { preview: Preview }) {
  return (
    <section className="ds-sec" id="type" aria-labelledby="type-h">
      <SectionHead id="type" eyebrow="03" title="Typography">
        DM Sans for the interface, JetBrains Mono for numbers and anything code-like. Three sizes carry almost the
        whole app, and the scale is closed: no one-off sizes.
      </SectionHead>
      <p className="ds-note">
        This page doesn't ship the editor's DM Sans files, so the specimens use it if your system has it and a plain
        sans-serif otherwise. JetBrains Mono is shared with this site.
      </p>
      <table className="ds-table">
        <caption className="visually-hidden">The editor's interface type scale</caption>
        <thead><tr><th scope="col">Class</th><th scope="col">Size</th><th scope="col">Used for</th></tr></thead>
        <tbody>
          {TYPE_SCALE.map((r) => (
            <tr key={r.cls}><td><code>{r.cls}</code></td><td><code>{r.px}</code></td><td>{r.use}</td></tr>
          ))}
        </tbody>
      </table>
      <Specimen preview={preview} label="Type in a panel">
        <div className="ds-typespec">
          <p className="ds-t-heading">Resize &amp; Compress</p>
          <p className="ds-t-sm">Shrinks the photo and re-encodes it, on your machine.</p>
          <p className="ds-t-label">Width <span className="ds-t-mono">1,200 px</span></p>
          <p className="ds-t-help">The height follows the aspect ratio.</p>
          <p className="ds-t-2xs">Undo <kbd className="ds-kbd">Ctrl</kbd> <kbd className="ds-kbd">Z</kbd></p>
          <div className="ds-t-nums">
            <span className="ds-t-mono">  98.4 KB</span>
            <span className="ds-t-mono">1,204.7 KB</span>
          </div>
        </div>
      </Specimen>
      <p className="ds-note">
        Numbers in readouts are monospaced so a changing value doesn't make its neighbors jump, and they line up in a
        column.
      </p>
    </section>
  );
}

function Spacing({ preview }: { preview: Preview }) {
  return (
    <section className="ds-sec" id="space" aria-labelledby="space-h">
      <SectionHead id="space" eyebrow="04" title="Spacing, layout and radii">
        Eight spacing steps, in Tailwind units, carry almost every gap in the editor. Anything off the scale needs a
        written exception.
      </SectionHead>
      <h3 className="ds-h3">Spacing scale</h3>
      <ul className="ds-scale">
        {SPACING.map((s) => (
          <li key={s.unit}>
            <span className="ds-scale__bar" style={{ width: `${s.px * 3}px` }} aria-hidden="true" />
            <code>{s.unit}</code>
            <span className="ds-scale__px">{s.px}px</span>
          </li>
        ))}
      </ul>
      <p className="ds-note">
        Inside a panel, controls sit 16px apart (a tool panel's own rhythm) and a control's label sits 8px above it.
        Panels keep a 16px edge.
      </p>
      <h3 className="ds-h3">Radii</h3>
      <Specimen preview={preview} label="Radius tokens">
        <div className="ds-row">
          {RADII.map((r) => (
            <span key={r.cls} className="ds-radius" style={{ borderRadius: r.px === "pill" ? 999 : r.px }}>{r.cls}</span>
          ))}
        </div>
      </Specimen>
      <table className="ds-table">
        <caption className="visually-hidden">Radius classes</caption>
        <thead><tr><th scope="col">Class</th><th scope="col">Radius</th><th scope="col">Used for</th></tr></thead>
        <tbody>{RADII.map((r) => <tr key={r.cls}><td><code>{r.cls}</code></td><td><code>{r.px}</code></td><td>{r.use}</td></tr>)}</tbody>
      </table>
      <h3 className="ds-h3">Panels and dialogs</h3>
      <Specimen preview={preview} label="A tool panel">
        <div className="ds-panel">
          <p className="ds-t-heading">Crop</p>
          <div className="ds-ctl">
            <div className="ds-ctl__top"><span className="ds-t-label">Ratio</span><span className="ds-t-mono">3:2</span></div>
            <div className="ds-seg-e"><span>Free</span><span className="is-on">3:2</span><span>1:1</span></div>
          </div>
          <div className="ds-ctl">
            <div className="ds-ctl__top"><span className="ds-t-label">Straighten</span><span className="ds-t-mono">0°</span></div>
            <span className="ds-track"><span className="ds-track__fill" style={{ width: "50%" }} /><span className="ds-track__thumb" style={{ left: "50%" }} /></span>
          </div>
          <div className="ds-actions"><span className="ds-btn is-ghost">Cancel</span><span className="ds-btn">Apply Crop</span></div>
        </div>
      </Specimen>
      <h3 className="ds-h3">Three surfaces</h3>
      <ul className="ds-surfaces">
        {SURFACES.map((s) => (
          <li key={s.name} className="ds-card">
            <h4 className="ds-card__title">{s.name} <span className="ds-card__meta">{s.width}</span></h4>
            <p className="ds-card__body">{s.what}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ComponentSpecimen({ name }: { name: string }) {
  switch (name) {
    case "Button":
      return (<div className="ds-row"><span className="ds-btn">Export</span><span className="ds-btn is-secondary">Reset</span><span className="ds-btn is-ghost">Cancel</span><span className="ds-btn is-focus">Focused</span><span className="ds-btn is-disabled">Disabled</span></div>);
    case "IconButton":
      return (<div className="ds-row"><span className="ds-ibtn">↶</span><span className="ds-ibtn">↷</span><span className="ds-ibtn is-focus">⚙</span></div>);
    case "ToolButton":
      return (<div className="ds-row"><span className="ds-tile">Crop</span><span className="ds-tile is-on">Select</span><span className="ds-tile is-focus">Text</span><span className="ds-tile is-disabled">Batch</span></div>);
    case "ToggleButtonGroup":
      return (<div className="ds-seg-e"><span>Left</span><span className="is-on">Center</span><span>Right</span></div>);
    case "ToolButtonGroup":
      return (<div className="ds-grid3"><span className="ds-tile is-sm is-on">Box</span><span className="ds-tile is-sm">Text</span><span className="ds-tile is-sm">Both</span></div>);
    case "NumberField":
      return (<label className="ds-field"><span className="ds-t-label">Width</span><span className="ds-input"><span className="ds-t-mono">1200</span><span className="ds-t-help">px</span></span></label>);
    case "SizeSlider":
      return (<div className="ds-ctl"><div className="ds-ctl__top"><span className="ds-t-label">Brush Size</span><span className="ds-t-mono">24 px</span></div><span className="ds-track"><span className="ds-track__fill" style={{ width: "30%" }} /><span className="ds-track__thumb" style={{ left: "30%" }} /></span></div>);
    case "ControlRow":
      return (<div className="ds-ctl"><div className="ds-ctl__top"><span className="ds-t-label">Feather</span><span className="ds-t-mono">—</span></div><span className="ds-track is-off"><span className="ds-track__thumb" style={{ left: "0%" }} /></span><span className="ds-t-help">Make a selection first.</span></div>);
    case "Skeleton":
      return (<div className="ds-row"><span className="ds-skel" style={{ width: 56, height: 56 }} /><span className="ds-skel" style={{ width: 56, height: 56 }} /><span className="ds-skel" style={{ width: 96, height: 12 }} /></div>);
    case "Spinner":
      return (<span className="ds-btn"><LoaderCircle className="ds-spin" size={14} /> Exporting…</span>);
    case "StatusMark":
      return (<div className="ds-marks"><span className="ds-mark is-ok"><Check size={14} />Saved</span><span className="ds-mark"><RefreshCw size={14} />Syncing</span><span className="ds-mark is-warn"><TriangleAlert size={14} />Attention</span><span className="ds-mark is-bad"><CircleX size={14} />Failed</span><span className="ds-mark"><Cloud size={14} />Backed up</span><span className="ds-mark"><Dot size={14} />On this device</span></div>);
    case "AsyncStatus":
      return (<div className="ds-stack"><span className="ds-mark"><RefreshCw size={14} />Importing layers… 3 of 7</span><span className="ds-progress"><span style={{ width: "43%" }} /></span><span className="ds-mark is-bad"><CircleX size={14} />Couldn't read layer 4.</span><span className="ds-btn is-secondary is-sm">Try again</span></div>);
    case "ReasonNote":
      return (<p className="ds-t-help">Drag a crop box on the canvas first.</p>);
    case "ToolPanel":
      return (<div className="ds-panel is-mini"><p className="ds-t-heading">Text</p><span className="ds-skel" style={{ width: "100%", height: 10 }} /><span className="ds-skel" style={{ width: "70%", height: 10 }} /></div>);
    case "Dialog":
      return (<div className="ds-dialog"><p className="ds-t-heading">Delete 3 photos?</p><p className="ds-t-sm">They leave this device. This can't be undone.</p><div className="ds-actions"><span className="ds-btn is-ghost">Cancel</span><span className="ds-btn is-danger">Delete</span></div></div>);
    case "Tooltip":
      return (<div className="ds-tipwrap"><span className="ds-ibtn">↶</span><span className="ds-tip">Undo <kbd className="ds-kbd">Ctrl Z</kbd></span></div>);
    case "PanelActionBar":
      return (<div className="ds-actions is-wide"><span className="ds-btn is-secondary">Reset</span><span className="ds-btn">Apply</span></div>);
    default:
      return null;
  }
}

function Components({ preview }: { preview: Preview }) {
  const categories: ComponentCategory[] = ["Actions", "Controls", "Feedback", "Surfaces"];
  return (
    <section className="ds-sec" id="components" aria-labelledby="components-h">
      <SectionHead id="components" eyebrow="05" title="Components">
        The shared primitives in <code>app/src/components/ui</code>. Each card is a static picture drawn from the
        editor's tokens, with a link to the real component.
      </SectionHead>
      {categories.map((cat) => (
        <div key={cat} className="ds-group">
          <h3 className="ds-h3">{cat}</h3>
          <ul className="ds-comps" style={{ "--ds-rows": (preview === "both" ? 2 : 1) + 3 } as CSSProperties}>
            {COMPONENTS.filter((c) => c.category === cat).map((c) => (
              <li key={c.name} className="ds-comp">
                <Specimen preview={preview} label={c.name}>
                  <ComponentSpecimen name={c.name} />
                </Specimen>
                <h4 className="ds-comp__name"><code>{c.name}</code></h4>
                <p className="ds-comp__what">{c.what}</p>
                <a className="ds-comp__src" href={source(c.source)} target="_blank" rel="noopener noreferrer">
                  {c.source.replace("app/src/", "")}<span className="visually-hidden"> (source on GitHub, opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/** A load that finishes in `ms`. The skeleton only appears past 300 ms, the
 *  editor's grace period (GalleryLoadingRegion), so a fast load never flashes. */
function LoadDemo({ preview }: { preview: Preview }) {
  const [phase, setPhase] = useState<"idle" | "waiting" | "skeleton" | "done">("idle");
  const [took, setTook] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const run = (ms: number) => {
    timers.current.forEach(clearTimeout);
    setTook(ms);
    setPhase("waiting");
    timers.current = [
      window.setTimeout(() => setPhase((p) => (p === "waiting" ? "skeleton" : p)), 300),
      window.setTimeout(() => setPhase("done"), ms),
    ];
  };
  return (
    <div className="ds-demo">
      <div className="ds-demo__ctl">
        <button type="button" className="ds-btn-m" onClick={() => run(150)}>Load in 150 ms</button>
        <button type="button" className="ds-btn-m" onClick={() => run(1500)}>Load in 1.5 s</button>
        <span className="ds-note">
          {phase === "idle" ? "Press one." : phase === "done" ? `Loaded in ${took} ms. ${took! < 300 ? "No skeleton was shown." : "The skeleton appeared at 300 ms."}` : "Loading…"}
        </span>
      </div>
      <Specimen preview={preview} label="Gallery thumbnails">
        <div className="ds-thumbs">
          {[0, 1, 2, 3].map((i) =>
            phase === "skeleton" ? (
              <span key={i} className="ds-skel ds-thumb" />
            ) : phase === "done" ? (
              <span key={i} className="ds-thumb ds-thumb--photo" style={{ filter: `hue-rotate(${i * 40}deg)` }} />
            ) : (
              <span key={i} className="ds-thumb ds-thumb--empty" />
            ),
          )}
        </div>
      </Specimen>
    </div>
  );
}

function States({ preview }: { preview: Preview }) {
  return (
    <section className="ds-sec" id="states" aria-labelledby="states-h">
      <SectionHead id="states" eyebrow="06" title="Loading and interaction states">
        Everything that waits is in one of five states, and none of them invents its own spinner or toast.
      </SectionHead>
      <table className="ds-table">
        <caption className="visually-hidden">The five async states</caption>
        <thead><tr><th scope="col">State</th><th scope="col">Means</th><th scope="col">Shows</th></tr></thead>
        <tbody>{ASYNC_STATES.map((s) => <tr key={s.state}><th scope="row">{s.state}</th><td>{s.means}</td><td>{s.shows}</td></tr>)}</tbody>
      </table>
      <div className="ds-three">
        <div><h3 className="ds-h3">Skeleton</h3><p className="ds-note">Something that exists hasn't arrived yet. A thumbnail is either a skeleton or the real photo, never a gray half-loaded one.</p></div>
        <div><h3 className="ds-h3">Progress</h3><p className="ds-note">Something new is being made. The source stays visible and can't be touched until it's done.</p></div>
        <div><h3 className="ds-h3">Failure</h3><p className="ds-note">It didn't work. The error replaces the progress, says what failed, and offers Try again.</p></div>
      </div>
      <h3 className="ds-h3">A fast load doesn't flash</h3>
      <p className="ds-note">
        Skeletons wait 300 ms before they appear, so a load that finishes sooner shows nothing in between. Under Reduce
        Motion the shimmer stops and the placeholder stays still.
      </p>
      <LoadDemo preview={preview} />
      <h3 className="ds-h3">Switching photos</h3>
      <p className="ds-note">
        While the next photo loads, the footer and canvas say "Loading" and the panels that describe the document go to
        skeletons, inert, until the new photo is really in. They never show the old photo's numbers under the new
        photo's name. A request the switch made pointless is dropped quietly, not shown as an error.
      </p>
      <Specimen preview={preview} label="A document-dependent panel mid-switch">
        <div className="ds-panel is-mini">
          <div className="ds-ctl__top"><span className="ds-t-label">Image weight</span><span className="ds-skel" style={{ width: 54, height: 10 }} /></div>
          <span className="ds-skel" style={{ width: "100%", height: 8 }} />
          <p className="ds-t-help"><RefreshCw size={12} /> Loading photo 4 of 12…</p>
        </div>
      </Specimen>
    </section>
  );
}

function Accessibility() {
  return (
    <section className="ds-sec" id="a11y" aria-labelledby="a11y-h">
      <SectionHead id="a11y" eyebrow="07" title="Accessibility and consistency">
        The editor's UI constitution, in short. The full rules, the counts behind them and the reasons live in the repo.
      </SectionHead>
      <ul className="ds-principles">
        {A11Y_RULES.map((r) => (
          <li key={r.title} className="ds-card">
            <h3 className="ds-card__title">{r.title}</h3>
            <p className="ds-card__body">{r.body}</p>
          </li>
        ))}
      </ul>
      <h3 className="ds-h3">Exceptions are decisions</h3>
      <p className="ds-note">
        Some places break a rule on purpose: the white badges and labels drawn on top of a photo, which have to stay
        white in both themes, or the stacking order inside a single gallery thumbnail. Each one is written down with its
        reason in the exceptions registry. An entry there is a decision someone made and recorded, not a bug waiting for
        a fix.
      </p>
      <h3 className="ds-h3">Read the source</h3>
      <ul className="ds-docs">
        {DOCS.map((d) => (
          <li key={d.path}>
            <a href={source(d.path)} target="_blank" rel="noopener noreferrer">
              {d.label}<span className="visually-hidden"> (on GitHub, opens in a new tab)</span>
            </a>
            <span className="ds-docs__what">{d.what}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── the marketing site's sections ────────────────────────────────────────

const tok = (name: string) => SITE_TOKENS[name] ?? "";
/** `0.75rem` → 12. Only for the plain rem values the spacing scale uses. */
const remToPx = (v: string) => Math.round(parseFloat(v) * 16);

function SitePrinciples() {
  return (
    <section className="ds-sec" id="m-principles" aria-labelledby="m-principles-h">
      <SectionHead id="m-principles" eyebrow="01" title="Principles">
        The rules this site is built on. Each one is written in the stylesheet it governs, next to the value it
        explains.
      </SectionHead>
      <ol className="ds-principles">
        {SITE_PRINCIPLES.map((p) => (
          <li key={p.title} className="ds-card">
            <h3 className="ds-card__title">{p.title}</h3>
            <p className="ds-card__body">{p.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SiteColors() {
  const paper = tok("color-paper");
  return (
    <section className="ds-sec" id="m-color" aria-labelledby="m-color-h">
      <SectionHead id="m-color" eyebrow="02" title="Colors">
        One dark theme, written in OKLCH. The swatches below are painted by the tokens themselves, and the values are
        read from <code>tokens.css</code> at build time.
      </SectionHead>
      {SITE_COLOR_GROUPS.map((g) => (
        <div key={g.title} className="ds-group">
          <h3 className="ds-h3">{g.title}</h3>
          {g.note && <p className="ds-note">{g.note}</p>}
          <ul className="ds-swatches">
            {g.tokens.map((t) => {
              const ratio = g.title === "Ink" ? oklchContrast(tok(t), paper) : null;
              return (
                <li key={t} className="ds-swatch">
                  <div className="ds-swatch__chips">
                    <span className="ds-swatch__chip" style={{ background: `var(--${t})` }} aria-hidden="true" />
                  </div>
                  <code className="ds-swatch__name">--{t}</code>
                  <p className="ds-swatch__vals">
                    <code>{tok(t)}</code>
                    {ratio && <span>{ratio.toFixed(1)}:1 on paper</span>}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

function SiteTypography() {
  return (
    <section className="ds-sec" id="m-type" aria-labelledby="m-type-h">
      <SectionHead id="m-type" eyebrow="03" title="Typography">
        Geist for headings and body, JetBrains Mono for figures, labels and code. Both are variable fonts served from
        this site, one file per subset for every weight.
      </SectionHead>
      <div className="ds-live" aria-hidden="true">
        <div className="ds-live__body ds-typeset">
          <p style={{ fontSize: "var(--text-hero)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1 }}>Shrink it.</p>
          <p style={{ fontSize: "var(--text-section)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.05 }}>A section heading</p>
          <p style={{ fontSize: "var(--text-lg)", color: "var(--color-ink-2)" }}>The deck under a page title says what the page is for.</p>
          <p style={{ fontSize: "var(--text-base)", color: "var(--color-ink-2)" }}>Body copy sits beside controls and gets scanned, so it stays at 16px.</p>
          <p style={{ fontFamily: "var(--font-outlier)", fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-accent)" }}>A mono label · 12px</p>
        </div>
        <p className="ds-live__cap">Geist and JetBrains Mono, at their real sizes</p>
      </div>
      <table className="ds-table">
        <caption className="visually-hidden">This site's type scale</caption>
        <thead><tr><th scope="col">Token</th><th scope="col">Size</th><th scope="col">Used for</th></tr></thead>
        <tbody>
          {SITE_TYPE_SCALE.map((r) => (
            <tr key={r.token}><td><code>--{r.token}</code></td><td><code>{tok(r.token)}</code></td><td>{r.use}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="ds-note">
        The big sizes are fluid: each one names its smallest size, how fast it grows with the screen, and where it
        stops.
      </p>
    </section>
  );
}

function SiteSpacing() {
  return (
    <section className="ds-sec" id="m-space" aria-labelledby="m-space-h">
      <SectionHead id="m-space" eyebrow="04" title="Spacing, layout and radii">
        Nine spacing steps on a 4px grid, one column width, and one gutter that also does the centering.
      </SectionHead>
      <h3 className="ds-h3">Spacing scale</h3>
      <ul className="ds-scale ds-scale--wide">
        {SITE_SPACING.map((t) => (
          <li key={t}>
            <span className="ds-scale__bar" style={{ width: `var(--${t})` }} aria-hidden="true" />
            <code>--{t}</code>
            <span className="ds-scale__px">{remToPx(tok(t))}px</span>
          </li>
        ))}
      </ul>
      <h3 className="ds-h3">Layout</h3>
      <table className="ds-table">
        <caption className="visually-hidden">Layout tokens</caption>
        <thead><tr><th scope="col">Token</th><th scope="col">Value</th><th scope="col">Used for</th></tr></thead>
        <tbody>
          {SITE_LAYOUT.map((r) => (
            <tr key={r.token}><td><code>--{r.token}</code></td><td><code>{tok(r.token)}</code></td><td>{r.use}</td></tr>
          ))}
        </tbody>
      </table>
      <h3 className="ds-h3">Radii</h3>
      <div className="ds-live" aria-hidden="true">
        <div className="ds-live__body ds-row">
          {SITE_RADII.map((r) => (
            <span key={r.token} className="ds-radius-m" style={{ borderRadius: `var(--${r.token})` }}>{r.token.replace("radius-", "")}</span>
          ))}
        </div>
        <p className="ds-live__cap">The five radius tokens</p>
      </div>
      <table className="ds-table">
        <caption className="visually-hidden">Radius tokens</caption>
        <thead><tr><th scope="col">Token</th><th scope="col">Value</th><th scope="col">Used for</th></tr></thead>
        <tbody>
          {SITE_RADII.map((r) => (
            <tr key={r.token}><td><code>--{r.token}</code></td><td><code>{tok(r.token)}</code></td><td>{r.use}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SiteSpecimen({ name }: { name: string }) {
  switch (name) {
    case "CTA":
      return (<div className="ds-row"><span className="cta cta--fill">Open the editor</span><span className="cta cta--outline">Read the docs</span><span className="cta cta--outline" aria-disabled="true">Disabled</span></div>);
    case "Tag":
      return (<div className="ds-row"><span className="tag tag--local">browser</span><span className="tag tag--server">server</span><span className="tag tag--latest">latest</span></div>);
    case "Tile":
      return (<div className="ds-row"><span className="trail-tile" aria-pressed="true"><span className="trail-tile__label">Oct</span><span className="trail-tile__count">42 rel</span></span><span className="trail-tile"><span className="trail-tile__label">Nov</span><span className="trail-tile__count">13 rel</span></span></div>);
    case "Action button":
      return (<span className="arch-btn">Read the full doc</span>);
    case "Next cards":
      return (<span className="tp-next__card"><span className="tp-next__group">Learn</span><span className="tp-next__label">Trail Log</span><span className="tp-next__blurb">Every release, in the open.</span><span className="tp-next__slug">/trail-log &rarr;</span></span>);
    case "Skip link":
      return (<span className="skip ds-skip-shown">Skip to content</span>);
    default:
      return null;
  }
}

function SiteComponents() {
  return (
    <section className="ds-sec" id="m-components" aria-labelledby="m-components-h">
      <SectionHead id="m-components" eyebrow="05" title="Components">
        The classes the pages are built from. These are the real thing, not pictures: this page uses the same ones.
      </SectionHead>
      <ul className="ds-comps" style={{ "--ds-rows": 4 } as CSSProperties}>
        {SITE_COMPONENTS.map((c) => (
          <li key={c.name} className="ds-comp">
            <div className="ds-live" aria-hidden="true">
              <div className="ds-live__body"><SiteSpecimen name={c.name} /></div>
              <p className="ds-live__cap">{c.cls}</p>
            </div>
            <h3 className="ds-comp__name">{c.name}</h3>
            <p className="ds-comp__what">{c.what}</p>
            <a className="ds-comp__src" href={source(c.source)} {...external}>
              {c.source.replace("marketing/src/", "")}<span className="visually-hidden"> (source on GitHub, opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SiteMotion() {
  const [run, setRun] = useState(0);
  const dots = ["dur-micro", "dur-short", "dur-long", "dur-morph"];
  return (
    <section className="ds-sec" id="m-motion" aria-labelledby="m-motion-h">
      <SectionHead id="m-motion" eyebrow="06" title="Motion">
        Six named durations and three curves, so a hover on one page feels like a hover on every other.
      </SectionHead>
      <div className="ds-demo">
        <div className="ds-demo__ctl">
          <button type="button" className="ds-btn-m" onClick={() => setRun((n) => n + 1)}>Play</button>
          <span className="ds-note">Each dot crosses in its own duration. Under Reduce Motion they all take 150ms.</span>
        </div>
        <div className="ds-live" aria-hidden="true">
          <div className="ds-live__body ds-motion">
            {dots.map((d) => (
              <div key={d} className="ds-motion__lane">
                <code>--{d}</code>
                <span className="ds-motion__track">
                  <span className={`ds-motion__dot${run % 2 ? " is-end" : ""}`} style={{ transitionDuration: `var(--${d})` }} />
                </span>
                <span className="ds-scale__px">{tok(d)}</span>
              </div>
            ))}
          </div>
          <p className="ds-live__cap">Four of the six durations, on the ease-out curve</p>
        </div>
      </div>
      <table className="ds-table">
        <caption className="visually-hidden">Motion tokens</caption>
        <thead><tr><th scope="col">Token</th><th scope="col">Value</th><th scope="col">Used for</th></tr></thead>
        <tbody>
          {SITE_MOTION.map((r) => (
            <tr key={r.token}><td><code>--{r.token}</code></td><td><code>{tok(r.token)}</code></td><td>{r.use}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SiteAccessibility() {
  return (
    <section className="ds-sec" id="m-a11y" aria-labelledby="m-a11y-h">
      <SectionHead id="m-a11y" eyebrow="07" title="Accessibility">
        What every page on the site does, whatever it is about.
      </SectionHead>
      <ul className="ds-principles">
        {SITE_A11Y_RULES.map((r) => (
          <li key={r.title} className="ds-card">
            <h3 className="ds-card__title">{r.title}</h3>
            <p className="ds-card__body">{r.body}</p>
          </li>
        ))}
      </ul>
      <h3 className="ds-h3">Read the source</h3>
      <ul className="ds-docs">
        {SITE_DOCS.map((d) => (
          <li key={d.path}>
            <a href={source(d.path)} {...external}>
              {d.label}<span className="visually-hidden"> (on GitHub, opens in a new tab)</span>
            </a>
            <span className="ds-docs__what">{d.what}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The closing row of a tab: the argument, where it comes from, and two ways
 *  out. The Architecture page's coda, reused as it stands. */
function Coda({ id, title, lede, origin, figma, doc, foot }: {
  id: string; title: string; lede: string; origin: ReactNode;
  figma: string | null; doc: { label: string; path: string }; foot: ReactNode;
}) {
  return (
    <section className="arch-coda ds-coda" aria-labelledby={`${id}-h`}>
      <div className="arch-coda__text">
        <h2 className="arch-big-title arch-big-title--wide" id={`${id}-h`}>{title}</h2>
        <p className="arch-coda__lede">{lede}</p>
        <p className="arch-coda__source">{origin}</p>
      </div>
      <div className="arch-coda__actions">
        {figma && (
          <a className="arch-btn" href={figma} {...external}>
            Open the Figma file<span className="visually-hidden"> (opens in a new tab)</span>
          </a>
        )}
        <a className="arch-btn" href={source(doc.path)} {...external}>
          {doc.label}<span className="visually-hidden"> (on GitHub, opens in a new tab)</span>
        </a>
        <p className="arch-coda__foot">{foot}</p>
      </div>
    </section>
  );
}

const num = (n: number) => <span className="arch-coda__num">{n}</span>;

// ── page ─────────────────────────────────────────────────────────────────

export default function DesignSystem() {
  const [preview, setPreview] = useState<Preview>("both");
  const [tab, setTab] = useState<TabId>("editor");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // A link to #marketing, or to a section on either tab, opens the right tab.
  // The section may sit in a panel that is still hidden, where a scroll does
  // nothing, so the hash is held and the scroll runs after the tab has rendered.
  const [jump, setJump] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => {
      const want = tabForHash(window.location.hash);
      if (!want) return;
      setTab(want);
      setJump(window.location.hash.slice(1));
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    if (!jump) return;
    document.getElementById(jump)?.scrollIntoView({ block: "start" });
    setJump(null);
  }, [jump, tab]);

  const select = (id: TabId) => {
    setTab(id);
    // replaceState, not location.hash: the tab is shareable, but picking one
    // shouldn't scroll the page or add a history entry per click.
    window.history.replaceState(null, "", `#${id}`);
  };
  const onTabKey = (e: KeyboardEvent, i: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    select(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <>
      <main id="main" className="design-system">
        <header className="trail-head">
          <div className="trail-head__lead">
            <p className="trail-head__eyebrow">Design System · the editor and this site</p>
            <h1 className="trail-head__title">Design System</h1>
          </div>
          <p className="trail-head__deck">
            The foundations, components, interaction patterns, and accessibility rules behind Image Horse. Pick the
            editor or this site.
          </p>
        </header>

        <div className="trail-tiles ds-tabs">
          <div role="tablist" aria-label="Which design system" className="trail-tiles__row">
            {TABS.map((t, i) => (
              <button
                key={t.id}
                ref={(el) => { tabRefs.current[i] = el; }}
                type="button"
                role="tab"
                id={`ds-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`ds-panel-${t.id}`}
                tabIndex={tab === t.id ? 0 : -1}
                className="trail-tile"
                onClick={() => select(t.id)}
                onKeyDown={(e) => onTabKey(e, i)}
              >
                <span className="trail-tile__label">{t.label}</span>
                <span className="trail-tile__count">{t.sub}</span>
              </button>
            ))}
          </div>
        </div>

        <div role="tabpanel" id="ds-panel-editor" aria-labelledby="ds-tab-editor" className="ds-panel-tab" hidden={tab !== "editor"}>
          <div className="ds-topbar">
            <nav aria-label="On this page" className="ds-index">
              <ul>
                {SECTIONS.map((s) => <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>)}
              </ul>
            </nav>
            <ThemePreview value={preview} onChange={setPreview} />
          </div>
          <Principles />
          <Colors preview={preview} />
          <Typography preview={preview} />
          <Spacing preview={preview} />
          <Components preview={preview} />
          <States preview={preview} />
          <Accessibility />
          <Coda
            id="editor-coda"
            title="Why write it down"
            lede="Because consistency is the feature. An editor where every slider, tile and dialog works the same way is one you stop thinking about, and that only lasts if the rules live somewhere a person can read them."
            origin={<>Everything above is drawn from <span className="arch-mono arch-coda__file">docs/UI_CONSISTENCY.md</span> and the editor's own stylesheet. The Figma file is the same page as layers you can pull apart.</>}
            figma={FIGMA_FILES.editor}
            doc={{ label: "Read the UI consistency doc", path: "docs/UI_CONSISTENCY.md" }}
            foot={<>{num(Object.keys(EDITOR_TOKENS.light).length)} color tokens · {num(COMPONENTS.length)} components · {num(2)} themes</>}
          />
        </div>

        <div role="tabpanel" id="ds-panel-marketing" aria-labelledby="ds-tab-marketing" className="ds-panel-tab" hidden={tab !== "marketing"}>
          <div className="ds-topbar">
            <nav aria-label="On this page" className="ds-index">
              <ul>
                {SITE_SECTIONS.map((s) => <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>)}
              </ul>
            </nav>
          </div>
          <SitePrinciples />
          <SiteColors />
          <SiteTypography />
          <SiteSpacing />
          <SiteComponents />
          <SiteMotion />
          <SiteAccessibility />
          <Coda
            id="marketing-coda"
            title="Why the site has its own"
            lede="Because the two do different jobs. The editor is a tool you sit in for an hour, so it stays quiet and gets out of the way. This site is a page you read for a minute, so it gets the big type and the amber. One set of tokens couldn't do both."
            origin={<>Everything above is read from <span className="arch-mono arch-coda__file">tokens.css</span> when the site is built. The Figma file is the same page as layers you can pull apart.</>}
            figma={FIGMA_FILES.marketing}
            doc={{ label: "Read tokens.css", path: "marketing/src/tokens.css" }}
            foot={<>{num(Object.keys(SITE_TOKENS).length)} tokens · {num(2)} font families · {num(1)} theme</>}
          />
        </div>

        <NextCards cards={pickNextCards("/design-system")} />
      </main>
      <Footer line="One primitive per pattern, and every exception written down." />
    </>
  );
}
