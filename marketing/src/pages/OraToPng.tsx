import OraSubPage from "../components/OraSubPage";
import { ORA_TO_PNG_FAQ } from "../data/openraster";

/* /ora-to-png — the viewer with PNG lit. Same panel as /openraster; the page
 * exists because "convert ora to png" is what people type. */
export default function OraToPng() {
  return (
    <OraSubPage
      path="/ora-to-png"
      eyebrow="Convert"
      title="Convert .ora to PNG."
      lede="Drop a .ora and get a flattened PNG, or a zip with every layer as its own PNG. It's converted in this tab — the file never leaves your machine."
      mode="png"
      viewerLabel="Converter"
      heading="How it works"
      body={
        <ol className="ora-steps">
          <li>
            <span className="ora-steps__n">1</span>
            <span>
              <strong>Drop the .ora</strong> on the panel above, or press Choose a .ora.
            </span>
          </li>
          <li>
            <span className="ora-steps__n">2</span>
            <span>
              <strong>Hide what you don&rsquo;t want.</strong> The eye on each layer turns it off; hidden layers
              stay out of the PNG.
            </span>
          </li>
          <li>
            <span className="ora-steps__n">3</span>
            <span>
              <strong>Press PNG</strong> for one flattened image with transparency kept, or{" "}
              <strong>Layers as PNGs</strong> for a zip with one file per layer, numbered top to bottom.
            </span>
          </li>
        </ol>
      }
      faq={ORA_TO_PNG_FAQ}
      guide="Everything about .ora →"
      footer="Converted here. Nothing uploaded."
    />
  );
}
