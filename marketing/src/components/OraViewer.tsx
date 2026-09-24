import { useCallback, useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { drawOra, kb, makeSample, parseOra, releaseOra, type OraDoc } from "../lib/ora";

/* The OpenRaster viewer on /openraster.
 *
 * Opens a .ora in the tab and shows every layer: a composite drawn from the
 * layer PNGs, the file's own mergedimage.png beside it, a layer list with
 * eyes, and what the archive got right. Nothing is uploaded — the file never
 * leaves the `File` object it arrived in.
 *
 * The sample loads on mount. It is generated, not fetched (lib/ora.ts,
 * `makeSample`), so the page's first paint costs no extra request. The
 * prerender writes the empty drop state into the HTML; the sample replaces it
 * once the page hydrates.
 */

type View = "composite" | "merged";

const EYE_ON = "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z";
const EYE_OFF = "M3 3l18 18";

export default function OraViewer({ autoSample = true }: { autoSample?: boolean }) {
  const [doc, setDoc] = useState<OraDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [view, setView] = useState<View>("composite");
  const [sampleUrl, setSampleUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const docRef = useRef<OraDoc | null>(null);
  const sampleRef = useRef<Blob | null>(null);
  /** Bumped per load so a slow file can't land after a faster one. */
  const loadId = useRef(0);

  const load = useCallback(async (blob: Blob, name: string) => {
    const id = ++loadId.current;
    setBusy(true);
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
    } catch (e) {
      if (id !== loadId.current) return;
      setError(e instanceof Error && e.message ? e.message : "Couldn't open that file.");
    } finally {
      if (id === loadId.current) setBusy(false);
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

  const toggle = (i: number) => {
    setView("composite");
    setDoc((d) => {
      if (!d) return d;
      const next = { ...d, layers: d.layers.map((l, j) => (j === i ? { ...l, visible: !l.visible } : l)) };
      docRef.current = next;
      return next;
    });
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) void load(f, f.name);
    else setDrag(false);
  };

  const merged = view === "merged" && !!doc?.merged;
  const visibleCount = doc ? doc.layers.filter((l) => l.visible).length : 0;
  const status = busy
    ? "Reading…"
    : doc
      ? `${doc.fileName} · ${kb(doc.size)} · read in this tab`
      : "Drop a .ora anywhere on this panel. It isn't uploaded.";

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
          {sampleUrl && (
            <a className="ora__btn ora__btn--line" href={sampleUrl} download="sample.ora">
              Download sample.ora
            </a>
          )}
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
            <p className="ora__drop-title">{busy ? "Reading…" : drag ? "Let go to open it" : "Drop a .ora file here"}</p>
            <p className="ora__drop-sub">The archive is unzipped here, in this tab. Pull the network cable and it still opens.</p>
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
                {doc.w} × {doc.h} · {doc.layers.length} {doc.layers.length === 1 ? "layer" : "layers"}
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
                    : `${doc.fileName}, ${visibleCount} of ${doc.layers.length} layers shown`
                }
              />
            </div>
            <p className="ora__note">
              {merged
                ? "The flattened copy saved inside the file — what a file browser or viewer shows."
                : `Composited here from the layer PNGs — ${visibleCount} of ${doc.layers.length} visible. Toggle a layer to see it change.`}
            </p>
          </div>

          <aside className="ora__side">
            <div className="ora__block">
              <h2 className="ora__h">
                Layers<span>top first</span>
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
                      key={`${l.src}-${i}`}
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
                        <span className="ora__layer-name">{l.name}</span>
                        <span className="ora__layer-meta">{meta}</span>
                      </span>
                      {l.url ? (
                        <a
                          className="ora__save"
                          href={l.url}
                          download={`${(l.name || "layer").replace(/[^\w.-]+/g, "-")}.png`}
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
                        <span />
                      )}
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
