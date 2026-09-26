import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import OraFaq from "../components/OraFaq";
import OraViewer from "../components/OraViewer";
import NextCards from "../components/NextCards";
import { pickNextCards } from "../data/nextCards";
import { EDITOR_URL, external } from "../config";
import { OPENRASTER_FAQ } from "../data/openraster";

/* /openraster — Learn · File formats.
 *
 * Two jobs on one page. The viewer at the top opens any .ora in the tab and
 * saves it back out as PNG, a layered PSD or a fresh .ora, which no other site
 * does; the article under it says what a .ora is, who reads what, and where
 * the format came from. The layout is the tool page's (tp-*), because it is
 * the same shape: head, a cream board of reasoning, next, close.
 *
 * Copy is the design's, with one correction: the editor's tab is labeled
 * "Import / Export" (SETTINGS_TAB_LABELS in the app), not "Export".
 */

/* The other three .ora pages are pinned for this path in data/nextCards.ts,
 * so they are always the first three cards; only the fourth is the seeded
 * pick. This is the guide the other three point back to, and a guide whose
 * own links move around is one you cannot give directions with. */

/** ✓ with a note, or just a note. One row per thing that can go wrong between apps. */
type Cell = { ok?: boolean; note?: string };
const APPS = ["Krita", "GIMP", "MyPaint", "Image Horse"] as const;
const COMPAT: { row: string; cells: [Cell, Cell, Cell, Cell] }[] = [
  { row: "Opens .ora", cells: [{ ok: true }, { ok: true, note: "since 2.8" }, { ok: true, note: "native format" }, { ok: true, note: "as a new photo" }] },
  { row: "Saves .ora", cells: [{ ok: true }, { ok: true }, { ok: true }, { ok: true }] },
  { row: "Layer names, order, opacity, hidden layers", cells: [{ ok: true }, { ok: true }, { ok: true }, { ok: true }] },
  { row: "Layer groups", cells: [{ ok: true }, { ok: true }, { ok: true }, { note: "Flattened to one stack" }] },
  { row: "Blend modes", cells: [{ ok: true }, { ok: true, note: "its own modes use a gimp: prefix" }, { ok: true }, { note: "Read as normal" }] },
  {
    row: "Layers offset or smaller than the canvas",
    cells: [{ ok: true }, { ok: true }, { ok: true, note: "writes them by default" }, { note: "Placed at 0,0 — may import blank" }],
  },
];

export default function OpenRaster() {
  return (
    <>
      <main id="main">
        <header className="tp-head">
          <div className="tp-head__lead">
            <p className="tp-head__eyebrow">Learn · File formats</p>
            <h1 className="tp-head__title">Open a .ora file in your browser.</h1>
          </div>
          <div className="tp-head__side">
            <p className="tp-head__lede">
              OpenRaster is the open layered format Krita, GIMP and MyPaint share. Drop a .ora below to see
              every layer, hide or reorder them, and save the result as PNG, a layered PSD or a fresh .ora
              &mdash; all in this tab, nothing uploaded.
            </p>
            <div className="tp-actions">
              <a className="tp-btn tp-btn--fill" href="#viewer">
                Open a .ora
              </a>
              <a className="tp-btn tp-btn--line" href="#compatibility">
                Which apps open it
              </a>
            </div>
          </div>
        </header>

        <section id="viewer" className="ora-wrap" aria-label="OpenRaster viewer">
          <OraViewer />
        </section>

        <article className="tp-board">
          <section className="ora-what">
            <h2 className="tp-board__h2">What is an .ora file?</h2>
            <div className="ora-what__text">
              <p className="tp-split__p">
                OpenRaster is an open file format for layered images. A .ora file is a ZIP archive: one PNG
                for each layer, a short XML file that lists them in order with their names, opacity,
                visibility and position, and a flattened copy of the whole picture for anything that just
                wants to show it.
              </p>
              <p className="tp-split__p">
                No company owns it. That is the point: it is the format to reach for when a layered image has
                to leave one editor and arrive in another with its layers still apart. A flattened PNG or
                JPEG can&rsquo;t do that.
              </p>
            </div>
          </section>

          <section className="tp-split">
            <div className="ora-col">
              <h2 className="tp-split__h2">What&rsquo;s inside</h2>
              <p className="tp-split__p">
                Rename any .ora to .zip and you can open it. The one rule that trips people up:{" "}
                <code className="ora-code">mimetype</code> has to be the first file in the archive, stored
                without compression, or some editors refuse it.
              </p>
            </div>
            <div className="ora-col">
              <pre className="ora-pre">
                {"mimetype                  "}<span>image/openraster — first, stored</span>
                {"\nstack.xml                 "}<span>the layer list, top layer first</span>
                {"\ndata/layer0.png           "}<span>one PNG per layer</span>
                {"\ndata/layer1.png\ndata/layer2.png\nmergedimage.png           "}<span>the whole picture, flattened</span>
                {"\nThumbnails/thumbnail.png  "}<span>≤ 256 px preview</span>
              </pre>
              <pre className="ora-pre">
                {`<image w="1920" h="1080" version="0.0.3">
  <stack>
    <layer name="Logo" src="data/layer1.png"
           opacity="0.8" visibility="visible"/>
    <layer name="Background" src="data/layer0.png"
           opacity="1.0" visibility="visible"/>
  </stack>
</image>`}
              </pre>
            </div>
          </section>

          <section id="compatibility" className="ora-trip">
            <div className="ora-trip__head">
              <h2 className="tp-board__h2">Who reads and writes what</h2>
              <p className="tp-split__p">
                The format is simple; the apps aren&rsquo;t identical. This is what to expect when a file moves
                between them.
              </p>
            </div>
            <div className="ora-table-wrap">
              <table className="ora-table">
                <thead>
                  <tr>
                    <td />
                    {APPS.map((a) => (
                      <th scope="col" key={a} className={a === "Image Horse" ? "is-us" : undefined}>
                        {a}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPAT.map(({ row, cells }) => (
                    <tr key={row}>
                      <th scope="row">{row}</th>
                      {cells.map((c, i) => (
                        <td key={APPS[i]}>
                          {c.ok && <span className="ora-mark">✓</span>}
                          {c.ok && c.note && " "}
                          {c.note}
                          {c.ok && !c.note && <span className="visually-hidden">Yes</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">Text, shapes, masks</th>
                    <td colSpan={4}>
                      Not in the baseline format. Every app writes them as pixels, so none of them survive a round
                      trip as editable objects.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="ora-source">
              Based on the OpenRaster baseline spec and each app&rsquo;s current release. Found a cell that&rsquo;s
              wrong? <Link to="/contact">Tell us</Link>.
            </p>
          </section>

          <section className="tp-split">
            <div className="ora-col">
              <h2 className="tp-split__h2">Export a .ora from Image Horse</h2>
              <ol className="ora-steps">
                <li>
                  <span className="ora-steps__n">1</span>
                  <span>
                    <strong>Open Settings &rarr; Import / Export.</strong> It sits beside the other export
                    formats in the top bar.
                  </span>
                </li>
                <li>
                  <span className="ora-steps__n">2</span>
                  <span>
                    <strong>Press Export as .ora.</strong> Every layer is written out as a PNG by the
                    engine&rsquo;s own encoder, alongside the flattened picture and a thumbnail.
                  </span>
                </li>
                <li>
                  <span className="ora-steps__n">3</span>
                  <span>
                    <strong>Open it in Krita or GIMP.</strong> The file takes your photo&rsquo;s name. Text and
                    shapes arrive painted into their layers.
                  </span>
                </li>
              </ol>
            </div>
            <div className="ora-col">
              <h2 className="tp-split__h2">Import one back</h2>
              <p className="tp-split__p">
                <strong>Import .ora</strong>, on the same tab, opens the file as a new photo in your gallery.
                It never replaces the one you are working on. Image Horse checks the mimetype and the layer
                list, decodes each PNG with the same Rust decoder that wrote it, and rebuilds the stack with
                names, opacity, visibility and the active layer intact.
              </p>
              <p className="tp-split__p">
                Like everything else in the editor, both directions run on your machine. The viewer at the
                top of this page does the same thing, without the editing. If a file came from another app, its{" "}
                <em>Before you import</em> notes tell you what to fix first.
              </p>
            </div>
          </section>

          <section className="tp-split">
            <div className="ora-col">
              <h2 className="tp-board__h2">Twenty years of .ora</h2>
              <p className="tp-split__p">
                The format exists because the alternative was licensed. It has stayed small on purpose.
              </p>
            </div>
            <ol className="ora-years">
              <li>
                <span className="ora-years__y">2006</span>
                <span>
                  Adobe narrows the license on the PSD specification. At the first Libre Graphics Meeting in
                  Lyon, Krita developers Boudewijn Rempt and Cyrille Berger propose an open layered format,
                  modeled on OpenDocument: a ZIP of PNGs described by one XML file.
                </span>
              </li>
              <li>
                <span className="ora-years__y">2009</span>
                <span>
                  MyPaint adopts .ora as its native save format &mdash; the first app to live in it day to day,
                  and the reason layer offsets became part of the spec.
                </span>
              </li>
              <li>
                <span className="ora-years__y">2010</span>
                <span>Pinta 0.4 ships support. By now Krita reads and writes it too.</span>
              </li>
              <li>
                <span className="ora-years__y">2012</span>
                <span>
                  GIMP 2.8 includes an OpenRaster plug-in out of the box. With Krita 2.4 the same year, all three
                  major free editors speak the format.
                </span>
              </li>
              <li>
                <span className="ora-years__y">2013 &rarr;</span>
                <span>
                  The baseline spec is versioned, 0.0.1 through today&rsquo;s 0.0.5, picking up the flattened{" "}
                  <code>mergedimage.png</code>, blend modes via <code>composite-op</code>, per-layer x/y and the{" "}
                  <code>selected</code> flag. Drawpile and others join.
                </span>
              </li>
              <li>
                <span className="ora-years__y">2026</span>
                <span>
                  Image Horse reads and writes .ora entirely in the browser, with a Rust engine in a worker.
                  This page is the first place you can open one without installing anything.
                </span>
              </li>
            </ol>
          </section>

          <section className="tp-split">
            <h2 className="tp-board__h2">Questions</h2>
            <OraFaq faq={OPENRASTER_FAQ} />
          </section>
        </article>

        <NextCards cards={pickNextCards("/openraster")} />

        <section className="tp-close">
          <div className="tp-close__text">
            <p className="tp-close__line">Layers in, layers out.</p>
            <p className="tp-close__sub">Import .ora and Export as .ora are in Settings &rarr; Import / Export.</p>
          </div>
          <a className="tp-btn tp-btn--fill" href={EDITOR_URL} {...external}>
            Open the editor
          </a>
        </section>
      </main>

      <Footer line="Every layer you make can leave in a format nobody owns." />
    </>
  );
}
