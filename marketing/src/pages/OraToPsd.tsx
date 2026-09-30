import OraSubPage from "../components/OraSubPage";
import { ORA_TO_PSD_FAQ } from "../data/openraster";

/* /ora-to-psd — the viewer with PSD lit. The PSD writer is lib/ora.ts,
 * `makePsd`: 8-bit RGB, one layer record per .ora layer, RLE channels. */
export default function OraToPsd() {
  return (
    <OraSubPage
      path="/ora-to-psd"
      eyebrow="Convert"
      title="Convert .ora to PSD, layers intact."
      lede="Photoshop doesn't open OpenRaster. Drop a .ora here and get a real layered PSD — names, order, opacity, hidden layers, blend modes and positions kept — written in this tab, never uploaded."
      mode="psd"
      viewerLabel="Converter"
      heading="What carries across"
      body={
        <div className="ora-what__text">
          <p className="tp-split__p">
            Each .ora layer becomes a PSD layer with the same name, in the same order, at the same opacity and
            position, hidden if it was hidden. The sixteen standard blend modes map to their Photoshop
            equivalents; anything else falls back to Normal. Layer groups are flattened into one stack.
          </p>
          <p className="tp-split__p">
            The result is an 8-bit RGB PSD with RLE-compressed channels, the same shape Photoshop writes itself.
            Affinity, Krita, GIMP and Photopea open it too.
          </p>
        </div>
      }
      faq={ORA_TO_PSD_FAQ}
      guide="Everything about .ora →"
      footer="Converted here. Nothing uploaded."
    />
  );
}
