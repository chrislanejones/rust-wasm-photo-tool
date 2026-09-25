import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import OraViewer from "../components/OraViewer";
import { EDITOR_URL, external } from "../config";
import { OPENRASTER_FAQ } from "../data/openraster";

/* /openraster — Learn · File formats.
 *
 * Two jobs on one page. The viewer at the top opens any .ora in the tab, which
 * no other site does; the article under it says what a .ora is and what
 * survives a trip through Image Horse. The layout is the tool page's (tp-*),
 * because it is the same shape: head, a cream board of reasoning, next, close.
 *
 * Copy is the design's, with one correction: the editor's tab is labeled
 * "Import / Export" (SETTINGS_TAB_LABELS in the app), not "Export".
 */

const NEXT = [
  { to: "/photo-editor", group: "Enhance", label: "Photo editor", blurb: "Layers and masks — 8 per image, 16 on Pro — saved with the edit." },
  { to: "/features", group: "Learn", label: "Features", blurb: "Every export format, and the other 55 features, grouped by task." },
  { to: "/architecture", group: "Learn", label: "Architecture", blurb: "Why the layer engine is Rust in your tab, and what the server never sees." },
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
              every layer &mdash; it&rsquo;s read in this tab, not uploaded &mdash; or export one from Image
              Horse and take your layers with you.
            </p>
            <div className="tp-actions">
              <a className="tp-btn tp-btn--fill" href="#viewer">
                Open a .ora
              </a>
              <a className="tp-btn tp-btn--line" href="#round-trip">
                What survives a round trip
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
                top of this page does the same thing, without the editing.
              </p>
            </div>
          </section>

          <section id="round-trip" className="ora-trip">
            <h2 className="tp-board__h2">What survives a round trip</h2>
            <div className="ora-table-wrap">
              <table className="ora-table">
                <thead>
                  <tr>
                    <th scope="col">In your project</th>
                    <th scope="col">Out and back</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Layer order, names, opacity, visibility</th>
                    <td>
                      <span className="ora-mark">✓</span> Kept, both ways
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">The layer you had selected</th>
                    <td>
                      <span className="ora-mark">✓</span> Restored on import; otherwise the top layer
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Text and shapes</th>
                    <td>Painted into their layer on export. They come back as pixels, not editable objects.</td>
                  </tr>
                  <tr>
                    <th scope="row">Layer masks</th>
                    <td>Not written yet. It&rsquo;s on the list.</td>
                  </tr>
                  <tr>
                    <th scope="row">Layers from another app that are offset or smaller than the canvas</th>
                    <td>
                      Import places every layer at the top-left, full size, so these may come in blank. The
                      viewer above shows where they should sit.
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Layer groups and blend modes from another app</th>
                    <td>Image Horse has no layer groups yet, and imports every layer as normal blending.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="ora-trip">
            <h2 className="tp-split__h2">Where else a .ora opens</h2>
            <ul className="ora-apps">
              <li>
                <strong>Krita</strong>
                <span>Opens and saves .ora directly. The usual next stop for painting.</span>
              </li>
              <li>
                <strong>GIMP</strong>
                <span>Opens .ora and exports it back. Also the easy way to turn one into a PSD.</span>
              </li>
              <li>
                <strong>MyPaint</strong>
                <span>Uses .ora as its own save format.</span>
              </li>
            </ul>
          </section>

          <section className="tp-split">
            <h2 className="tp-board__h2">Questions</h2>
            <div className="ora-faq">
              {OPENRASTER_FAQ.map((f) => (
                <div className="ora-faq__item" key={f.q}>
                  <h3>{f.q}</h3>
                  <p>{f.a}</p>
                </div>
              ))}
            </div>
          </section>
        </article>

        <nav className="tp-next" aria-label="Related pages">
          <h2 className="tp-next__h2">Next</h2>
          <ul className="tp-next__list">
            {NEXT.map((r) => (
              <li className="tp-next__li" key={r.to}>
                <Link className="tp-next__card" to={r.to}>
                  <span className="tp-next__group">{r.group}</span>
                  <span className="tp-next__label">{r.label}</span>
                  <span className="tp-next__blurb">{r.blurb}</span>
                  <span className="tp-next__slug">{r.to} &rarr;</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

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
