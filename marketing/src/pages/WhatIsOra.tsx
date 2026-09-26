import OraSubPage from "../components/OraSubPage";
import { WHAT_IS_ORA_FAQ } from "../data/openraster";

/* /what-is-ora — the two-minute answer, with a .ora open to click through.
 * The long version, with the compatibility table and the history, is
 * /openraster. */
export default function WhatIsOra() {
  return (
    <OraSubPage
      path="/what-is-ora"
      eyebrow="Learn"
      title="What is a .ora file?"
      lede="A .ora file is an OpenRaster image: a layered picture saved as a ZIP of PNGs with one XML file describing the stack. Krita, GIMP, MyPaint and Image Horse all read and write it. There's one open below — click its layers."
      mode="full"
      viewerLabel="OpenRaster viewer"
      heading="In two minutes"
      body={
        <div className="ora-what__text">
          <p className="tp-split__p">
            <strong>It&rsquo;s a ZIP.</strong> Rename any .ora to .zip and look inside: a <code>mimetype</code>{" "}
            file, a <code>stack.xml</code> listing the layers top to bottom, one PNG per layer, a flattened{" "}
            <code>mergedimage.png</code>, and a thumbnail.
          </p>
          <p className="tp-split__p">
            <strong>It&rsquo;s open.</strong> The spec was proposed at the first Libre Graphics Meeting in 2006
            as an alternative to PSD, and nobody owns it. That&rsquo;s why the free editors agreed on it as the
            way to hand layered work to each other.
          </p>
          <p className="tp-split__p">
            <strong>It&rsquo;s pixels only.</strong> Names, order, opacity, visibility, position and blend mode
            travel. Text, shapes and masks don&rsquo;t &mdash; every app writes them as paint.
          </p>
        </div>
      }
      faq={WHAT_IS_ORA_FAQ}
      guide="The full guide: history, compatibility, round-trips →"
      footer="A format nobody owns, opened in a tab."
    />
  );
}
