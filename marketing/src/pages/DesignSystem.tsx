import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Check, CircleX, Cloud, Dot, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import Footer from "../components/Footer";
import NextCards from "../components/NextCards";
import { pickNextCards } from "../data/nextCards";
import { EDITOR_TOKENS } from "../data/editorTokens";
import {
  A11Y_RULES, ASYNC_STATES, COLOR_GROUPS, COMPONENTS, DOCS, PRINCIPLES, RADII, REPO_BLOB,
  SECTIONS, SPACING, SURFACES, TYPE_SCALE, type ComponentCategory,
} from "../data/designSystem";

/* /design-system — the editor's design system, for developers and visitors.
 *
 * Two tabs: Image Horse Editor (this content) and Image Horse Marketing, which
 * is visible but disabled until it has real documentation. Adding it later is a
 * second entry in TABS and a panel, nothing else.
 *
 * The specimens are STATIC: plain markup styled from the editor's real color
 * tokens (data/editorTokens.ts, generated from app/src/styles.css and checked
 * in CI). They are pictures of components, not a second component library, so
 * they are hidden from assistive tech and described in words beside them. */

type Theme = "light" | "dark";
type Preview = Theme | "both";

const TABS = [
  { id: "editor", label: "Image Horse Editor", enabled: true },
  { id: "marketing", label: "Image Horse Marketing", enabled: false },
] as const;

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
          <ul className="ds-comps">
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

// ── page ─────────────────────────────────────────────────────────────────

export default function DesignSystem() {
  const [preview, setPreview] = useState<Preview>("both");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = TABS.map((t, i) => (t.enabled ? i : -1)).filter((i) => i >= 0);
  const onTabKey = (e: KeyboardEvent, i: number) => {
    const at = enabled.indexOf(i);
    let next = -1;
    if (e.key === "ArrowRight") next = enabled[(at + 1) % enabled.length];
    else if (e.key === "ArrowLeft") next = enabled[(at - 1 + enabled.length) % enabled.length];
    else if (e.key === "Home") next = enabled[0];
    else if (e.key === "End") next = enabled[enabled.length - 1];
    if (next < 0) return;
    e.preventDefault();
    tabRefs.current[next]?.focus();
  };

  return (
    <>
      <main id="main" className="design-system">
        <header className="ds-head">
          <p className="ds-head__eyebrow">Design System · the editor</p>
          <h1 className="ds-head__title">Design System</h1>
          <p className="ds-head__deck">
            The foundations, components, interaction patterns, and accessibility rules behind Image Horse.
          </p>
        </header>

        <div className="ds-tabs">
          <div role="tablist" aria-label="Which design system" className="ds-tabs__list">
            {TABS.map((t, i) => (
              <button
                key={t.id}
                ref={(el) => { tabRefs.current[i] = el; }}
                type="button"
                role="tab"
                id={`ds-tab-${t.id}`}
                aria-selected={t.id === "editor"}
                aria-controls={t.enabled ? `ds-panel-${t.id}` : undefined}
                aria-disabled={t.enabled ? undefined : true}
                aria-describedby={t.enabled ? undefined : `ds-tab-${t.id}-soon`}
                tabIndex={t.id === "editor" ? 0 : -1}
                className="ds-tabs__tab"
                onKeyDown={(e) => onTabKey(e, i)}
              >
                {t.label}
                {!t.enabled && <span className="ds-tabs__soon" id={`ds-tab-${t.id}-soon`}>Coming soon</span>}
              </button>
            ))}
          </div>
        </div>

        <div role="tabpanel" id="ds-panel-editor" aria-labelledby="ds-tab-editor" className="ds-panel-tab">
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
        </div>

        <NextCards cards={pickNextCards("/design-system")} />
      </main>
      <Footer line="One primitive per pattern, and every exception written down." />
    </>
  );
}
