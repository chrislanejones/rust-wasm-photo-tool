/* The questions on the four OpenRaster pages. One list per page, read twice:
 * the page renders it as the visible FAQ, and seo.ts puts the same pairs in
 * the page's JSON-LD. Google only allows FAQPage markup for questions that are
 * actually on the page, and sharing the array is what makes that impossible to
 * get wrong.
 *
 * `links` turns a phrase of the answer into a link on the page. The JSON-LD
 * gets the answer as plain text, so the words must appear in `a` verbatim.
 */
export interface Faq {
  q: string;
  a: string;
  links?: readonly { text: string; to: string }[];
}

export const OPENRASTER_FAQ: readonly Faq[] = [
  {
    q: "Is my .ora file uploaded when I open it on this page?",
    a: "No. The archive is unzipped and drawn by this browser tab. Nothing is sent to a server, and the viewer keeps working with the network switched off.",
  },
  {
    q: "Why is a .ora bigger than a PNG of the same picture?",
    a: "It holds one full PNG per layer, plus a flattened copy of the whole picture and a small thumbnail. Five layers is roughly six PNGs.",
  },
  {
    q: "Can I still edit my text after a round trip?",
    a: "Not as text. Image Horse bakes text and shapes into their layer's pixels on export, so they come back as paint.",
  },
  {
    q: "Does Photoshop open .ora files?",
    a: "Not natively. Use the PSD export on this page — layers, names, opacity, blend modes and offsets carry across — or open the .ora in Krita or GIMP and save a PSD there.",
    links: [{ text: "PSD export", to: "/ora-to-psd" }],
  },
  {
    q: "Is .ora the same as Krita's .kra?",
    a: "No. Both are ZIP archives, but .kra carries Krita-specific data. .ora is the shared format that any editor can read.",
  },
];

export const WHAT_IS_ORA_FAQ: readonly Faq[] = [
  {
    q: "How do I open a .ora file?",
    a: "Drop it on this page to see its layers without installing anything, or open it in Krita, GIMP, MyPaint or Image Horse.",
    links: [{ text: "Image Horse", to: "editor" }],
  },
  {
    q: "How do I convert a .ora file?",
    a: "Open it above and press PNG for a flattened image, or PSD for a layered Photoshop file. Both are made in your browser. There are dedicated pages for .ora to PNG and .ora to PSD.",
    links: [
      { text: ".ora to PNG", to: "/ora-to-png" },
      { text: ".ora to PSD", to: "/ora-to-psd" },
    ],
  },
  {
    q: "Is .ora a Krita file?",
    a: "Krita reads and writes it, but .ora is not Krita's own format — that's .kra. OpenRaster is the shared one any editor can open.",
  },
];

export const ORA_TO_PNG_FAQ: readonly Faq[] = [
  {
    q: "Is the PNG the same as the one already inside the .ora?",
    a: "Not quite. Every .ora carries a flattened mergedimage.png as saved by the last app. The PNG button re-composites from the layers as you see them now, so hidden layers and blend modes are respected. Pick mergedimage.png in the view toggle to see the stored one.",
  },
  {
    q: "What resolution do I get?",
    a: "The canvas size written in the file, pixel for pixel. Nothing is scaled.",
  },
  {
    q: "Can I go the other way, PNG to .ora?",
    a: "Yes — open the PNG in the editor, add your layers, and use Export as .ora.",
    links: [{ text: "the editor", to: "editor" }],
  },
];

export const ORA_TO_PSD_FAQ: readonly Faq[] = [
  {
    q: "Will my text layers be editable in Photoshop?",
    a: "No. OpenRaster has no text layers — whatever app made the file already painted the text into pixels. The PSD keeps those pixels on their own layer.",
  },
  {
    q: "Why is the PSD bigger than the .ora?",
    a: "PNG compresses harder than PSD's run-length encoding. Expect two to four times the size for photographic layers; flat artwork stays close.",
  },
  {
    q: "Can I convert PSD to .ora here?",
    a: "Not yet. Open the PSD in Krita or GIMP and save as .ora — then drop it here to check it.",
  },
];
