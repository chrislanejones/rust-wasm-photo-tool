/* The /openraster page's questions. One list, read twice: the page renders it
 * as the visible FAQ, and seo.ts puts the same pairs in the page's JSON-LD.
 * Google only allows FAQPage markup for questions that are actually on the
 * page, and sharing the array is what makes that impossible to get wrong. */
export interface Faq {
  q: string;
  a: string;
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
    a: "Not natively. Open the .ora in Krita or GIMP and save it as a PSD from there; the layers carry across.",
  },
  {
    q: "Is .ora the same as Krita's .kra?",
    a: "No. Both are ZIP archives, but .kra carries Krita-specific data. .ora is the shared format that any editor can read.",
  },
];
