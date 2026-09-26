import { useCallback, useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
import {
  download,
  drawOra,
  kb,
  makeLayersZip,
  makeOra,
  makePng,
  makePsd,
  makeSample,
  parseOra,
  releaseOra,
  safeName,
  tick,
  type OraDoc,
  type OraLayer,
} from "../lib/ora";

/* The OpenRaster viewer on /openraster, /what-is-ora, /ora-to-png and
 * /ora-to-psd.
 *
 * Opens a .ora in the tab and shows every layer: a composite drawn from the
 * layer PNGs, the file's own mergedimage.png beside it, a layer list, and what
 * the archive got right. Layers can be hidden, reordered and renamed, and the
 * result saved as a PNG, a layered PSD, a zip of layer PNGs or a fresh .ora.
 * Nothing is uploaded — the file never leaves the `File` object it arrived in,
 * and every export is written in the tab.
 *
 * `mode` is which export the page is about. The converter pages pass "png" or
 * "psd", which lights that button and names it in the drop prompt; every
 * export stays available in every mode.
 *
 * The sample loads on mount. It is generated, not fetched (lib/ora.ts,
 * `makeSample`), so the page's first paint costs no extra request. The
 * prerender writes the empty drop state into the HTML; the sample replaces it
 * once the page hydrates.
 */

type View = "composite" | "merged";
export type OraViewerMode = "full" | "png" | "psd";

const EYE_ON = "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z";
const EYE_OFF = "M3 3l18 18";

const DROP_TITLE: Record<OraViewerMode, string> = {
  full: "Drop a .ora file here",
  png: "Drop a .ora to convert it to PNG",
  psd: "Drop a .ora to convert it to PSD",
};

export default function OraViewer({ mode = "full", autoSample = true }: { mode?: OraViewerMode; autoSample?: boolean }) {
  const [doc, setDoc] = useState<OraDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** What the panel is doing right now, as the status line says it. */
  const [busy, setBusy] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [view, setView] = useState<View>("composite");
  const [sampleUrl, setSampleUrl] = useState<string | null>(null);
  /** The layer being renamed, by id, and the name typed so far. */
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  /** Changed since it was opened or last saved as .ora. */
  const [dirty, setDirty] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const docRef = useRef<OraDoc | null>(null);
  const sampleRef = useRef<Blob | null>(null);
  const busyRef = useRef(false);
  /** Bumped per load so a slow file can't land after a faster one. */
  const loadId = useRef(0);

  const load = useCallback(async (blob: Blob, name: string) => {
    const id = ++loadId.current;
    setBusy("Reading…");
    setError(null);
    setDrag(false);
    try {
      const next = await parseOra(await blob.arrayBuffer(), name, blob.size);
      if (id !== loadId.current) {
        releaseOra(next);
        return;
      }
      releaseOra(docRef.current);
      docRef.current = next;
      setDoc(next);
      setView("composite");
      setEditing(null);
      setDirty(false);
    } catch (e) {
      if (id !== loadId.current) return;
      setError(e instanceof Error && e.message ? e.message : "Couldn't open that file.");
    } finally {
      if (id === loadId.current) setBusy(null);
    }
  }, []);

  const openSample = useCallback(async () => {
    if (!sampleRef.current) {
      sampleRef.current = await makeSample();
      setSampleUrl(URL.createObjectURL(sampleRef.current));
    }
    await load(sampleRef.current, "sample.ora");
  }, [load]);

  useEffect(() => {
    if (autoSample) void openSample();
    return () => {
      // Whatever is loaded when the page goes: bitmaps, layer URLs, the sample.
      loadId.current++;
      releaseOra(docRef.current);
      docRef.current = null;
      setSampleUrl((u) => {
        if (u) URL.revokeObjectURL(u);
        return null;
      });
      sampleRef.current = null;
    };
  }, [autoSample, openSample]);

  useEffect(() => {
    if (canvasRef.current && doc) drawOra(canvasRef.current, doc, view);
  }, [doc, view]);

  /** Change the layer list. The bitmaps and URLs are shared with the old
   *  document, so nothing is released here — only on load and unmount. */
  const patch = (fn: (ls: OraLayer[]) => OraLayer[]) => {
    setView("composite");
    setDirty(true);
    setDoc((d) => {
      if (!d) return d;
      const next = { ...d, layers: fn(d.layers.slice()) };
      docRef.current = next;
      return next;
    });
  };
  const toggle = (i: number) =>
    patch((ls) => {
      ls[i] = { ...ls[i], visible: !ls[i].visible };
      return ls;
    });
  const move = (i: number, by: number) => {
    setEditing(null);
    patch((ls) => {
      const j = i + by;
      if (j >= 0 && j < ls.length) [ls[i], ls[j]] = [ls[j], ls[i]];
      return ls;
    });
  };
  const commitRename = () => {
    if (editing === null) return;
    const id = editing;
    const name = draft.trim();
    setEditing(null);
    const old = docRef.current?.layers.find((l) => l.id === id);
    if (!old || !name || name === old.name) return;
    patch((ls) => ls.map((l) => (l.id === id ? { ...l, name } : l)));
  };

  const base = () => (docRef.current?.fileName || "image").replace(/\.ora$/i, "");
  const run = async (label: string, fn: (d: OraDoc) => Promise<void>) => {
    const d = docRef.current;
    if (!d || busyRef.current) return;
    busyRef.current = true;
    setBusy(label);
    setError(null);
    try {
      await tick();
      await fn(d);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Export failed.");
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };
  const exportPng = () => run("Writing PNG…", async (d) => download(await makePng(d), `${base()}.png`));
  const exportPsd = () => run("Writing PSD…", async (d) => download(await makePsd(d), `${base()}.psd`));
  const exportZip = () => run("Zipping layers…", async (d) => download(makeLayersZip(d), `${base()}-layers.zip`));
  const saveOra = () =>
    run("Writing .ora…", async (d) => {
      download(await makeOra(d), `${base()}.ora`);
      setDirty(false);
    });

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) void load(f, f.name);
    else setDrag(false);
  };

  const merged = view === "merged" && !!doc?.merged;
  const n = doc ? doc.layers.length : 0;
  const visibleCount = doc ? doc.layers.filter((l) => l.visible).length : 0;
  const status =
    busy ??
    (doc
      ? `${doc.fileName} · ${kb(doc.size)} · ${dirty ? "edited — save as .ora to keep the changes" : "read in this tab"}`
      : "Drop a .ora anywhere on this panel. It isn't uploaded.");
  /** The export this page is about is filled; so is Save once there are edits. */
  const lit = (k: "png" | "psd" | "ora") => mode === k || (k === "ora" && dirty);

  return (
    <div
      className={`ora${drag ? " is-drag" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!drag) setDrag(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrag(false);
      }}
      onDrop={onDrop}
    >
      <div className="ora__bar">
        <div className="ora__status">
          <span className="ora__local">
            <span aria-hidden="true" className="ora__dot" />
            Runs on your machine
          </span>
          <span className="ora__file" aria-live="polite">{status}</span>
        </div>
        <div className="ora__actions">
          <label className="ora__btn ora__btn--fill">
            Choose a .ora
            <input
              type="file"
              accept=".ora,image/openraster"
              className="ora__input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void load(f, f.name);
                e.target.value = "";
              }}
            />
          </label>
          <button type="button" className="ora__btn ora__btn--line" onClick={() => void openSample()}>
            Open a sample
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="ora__error">
          {error}
        </p>
      )}

      {!doc && (
        <div className="ora__drop">
          <div className="ora__drop-inner">
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m12 2 10 5-10 5L2 7z" />
              <path d="m2 12 10 5 10-5" />
              <path d="m2 17 10 5 10-5" />
            </svg>
            <p className="ora__drop-title">{busy ?? (drag ? "Let go to open it" : DROP_TITLE[mode])}</p>
            <p className="ora__drop-sub">The archive is unzipped here, in this tab. Pull the network cable and it still opens.</p>
            {sampleUrl && (
              <a className="ora__drop-link" href={sampleUrl} download="sample.ora">
                Download sample.ora to try in Krita
              </a>
            )}
          </div>
        </div>
      )}

      {doc && (
        <div className="ora__body">
          <div className="ora__stage">
            <div className="ora__stage-head">
              <div role="group" aria-label="View" className="ora__seg">
                <button type="button" className={`ora__seg-btn${!merged ? " is-on" : ""}`} aria-pressed={!merged} onClick={() => setView("composite")}>
                  Layers
                </button>
                <button
                  type="button"
                  className={`ora__seg-btn${merged ? " is-on" : ""}`}
                  aria-pressed={merged}
                  disabled={!doc.merged}
                  onClick={() => setView("merged")}
                >
                  mergedimage.png
                </button>
              </div>
              <span className="ora__meta">
                {doc.w} × {doc.h} · {n} {n === 1 ? "layer" : "layers"}
              </span>
            </div>
            <div className="ora__canvas-wrap">
              <canvas
                ref={canvasRef}
                className="ora__canvas"
                role="img"
                aria-label={
                  merged
                    ? `The flattened picture inside ${doc.fileName}`
                    : `${doc.fileName}, ${visibleCount} of ${n} layers shown`
                }
              />
            </div>
            <p className="ora__note">
              {merged
                ? "The flattened copy saved inside the file — what a file browser or viewer shows."
                : `Composited here from the layer PNGs — ${visibleCount} of ${n} visible. Hide, reorder or rename layers, then export.`}
            </p>
            <div className="ora__export" role="group" aria-label="Export">
              <span className="ora__export-label" aria-hidden="true">
                Export
              </span>
              <button type="button" className={`ora__xbtn${lit("png") ? " is-lit" : ""}`} disabled={!!busy} onClick={exportPng}>
                PNG
              </button>
              <button type="button" className={`ora__xbtn${lit("psd") ? " is-lit" : ""}`} disabled={!!busy} onClick={exportPsd}>
                PSD, layered
              </button>
              <button type="button" className="ora__xbtn" disabled={!!busy} onClick={exportZip}>
                Layers as PNGs (.zip)
              </button>
              <button type="button" className={`ora__xbtn${lit("ora") ? " is-lit" : ""}`} disabled={!!busy} onClick={saveOra}>
                {dirty ? "Save edited .ora" : "Save as .ora"}
              </button>
            </div>
          </div>

          <aside className="ora__side">
            <div className="ora__block">
              <h2 className="ora__h">
                Layers<span>top first · click to rename</span>
              </h2>
              <ul className="ora__layers">
                {doc.layers.map((l, i) => {
                  const meta = [
                    `${Math.round(l.opacity * 100)}%`,
                    l.op !== "svg:src-over" ? l.op.replace("svg:", "") : null,
                    l.x || l.y ? `at ${l.x}, ${l.y}` : null,
                    l.bytes ? kb(l.bytes) : "missing",
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <li
                      key={l.id}
                      className={`ora__layer${l.selected ? " is-selected" : ""}${l.visible ? "" : " is-hidden"}`}
                      style={{ paddingLeft: 4 + l.depth * 14 }}
                    >
                      <button
                        type="button"
                        className="ora__eye"
                        aria-pressed={l.visible}
                        aria-label={`${l.visible ? "Hide" : "Show"} ${l.name}`}
                        onClick={() => toggle(i)}
                      >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                          <path d={l.visible ? EYE_ON : EYE_OFF} />
                        </svg>
                      </button>
                      <span aria-hidden="true" className="ora__thumb" style={l.url ? ({ "--thumb": `url("${l.url}")` } as CSSProperties) : undefined} />
                      <span className="ora__layer-text">
                        {editing === l.id ? (
                          <input
                            className="ora__rename"
                            value={draft}
                            aria-label="Layer name"
                            autoFocus
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={commitRename}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename();
                              else if (e.key === "Escape") setEditing(null);
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            className="ora__layer-name"
                            title="Rename"
                            aria-label={`Rename ${l.name}`}
                            onClick={() => {
                              setEditing(l.id);
                              setDraft(l.name);
                            }}
                          >
                            {l.name}
                          </button>
                        )}
                        <span className="ora__layer-meta">{meta}</span>
                      </span>
                      <span className="ora__tools">
                        <button type="button" className="ora__tool" disabled={i === 0} aria-label={`Move ${l.name} up`} onClick={() => move(i, -1)}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 19V5" />
                            <path d="m6 11 6-6 6 6" />
                          </svg>
                        </button>
                        <button type="button" className="ora__tool" disabled={i === n - 1} aria-label={`Move ${l.name} down`} onClick={() => move(i, 1)}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 5v14" />
                            <path d="m18 13-6 6-6-6" />
                          </svg>
                        </button>
                        {l.url ? (
                          <a
                            className="ora__tool"
                            href={l.url}
                            download={`${safeName(l.name)}.png`}
                            aria-label={`Save ${l.name} as PNG`}
                            title="Save this layer as PNG"
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M12 4v11" />
                              <path d="m7 10 5 5 5-5" />
                              <path d="M5 20h14" />
                            </svg>
                          </a>
                        ) : (
                          <span className="ora__tool" />
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="ora__block">
              <h2 className="ora__h">Archive</h2>
              <ul className="ora__checks">
                {doc.checks.map((c) => (
                  <li key={c.label} className={c.ok ? "is-ok" : ""}>
                    <span aria-hidden="true">{c.ok ? "✓" : "–"}</span>
                    <span>{c.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            {doc.warnings.length > 0 && (
              <div className="ora__block">
                <h2 className="ora__h">Before you import</h2>
                {doc.warnings.map((w) => (
                  <p key={w} className="ora__warn">
                    {w}
                  </p>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
