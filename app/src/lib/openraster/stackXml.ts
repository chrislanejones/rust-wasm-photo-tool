// Build + parse OpenRaster's stack.xml — the layer manifest. See
// docs/OpenRaster-Export-Import.md for the format and the "order gotcha":
// the engine's own layer order is bottom-first, but the real OpenRaster
// convention (and what Krita/GIMP/MyPaint expect) is <stack> children listed
// TOP-FIRST. `OraStack.layers` is always top-first — export.ts/import.ts each
// do one reversal against the engine's bottom-first order.
import type { OraLayerMeta, OraStack } from "./types";

/** Non-standard extension namespace for the "active layer" marker — real
 *  OpenRaster readers ignore unrecognized namespaced attributes entirely. */
const IH_NS = "https://image-horse.app/ns/ora";

function escapeXmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildStackXml(stack: OraStack): string {
  const layerLines = stack.layers.map((l, i) => {
    const activeAttr =
      i === stack.activeIndex ? ` imagehorse:active="true"` : "";
    return (
      `    <layer name="${escapeXmlAttr(l.name)}" src="${escapeXmlAttr(l.src)}" ` +
      `x="0" y="0" opacity="${l.opacity.toFixed(3)}" ` +
      `visibility="${l.visible ? "visible" : "hidden"}"${activeAttr}/>`
    );
  });

  return (
    `<?xml version='1.0' encoding='UTF-8'?>\n` +
    `<image w="${stack.width}" h="${stack.height}" version="0.0.3" xmlns:imagehorse="${IH_NS}">\n` +
    `  <stack>\n` +
    layerLines.join("\n") +
    `\n  </stack>\n` +
    `</image>\n`
  );
}

export function parseStackXml(xml: string): OraStack {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Invalid .ora file: stack.xml is not well-formed XML.");
  }
  const imageEl = doc.querySelector("image");
  if (!imageEl) {
    throw new Error("Invalid .ora file: stack.xml has no <image> root.");
  }
  const width = parseInt(imageEl.getAttribute("w") ?? "0", 10);
  const height = parseInt(imageEl.getAttribute("h") ?? "0", 10);

  // First <stack> in document order is the top-level one (our own exports —
  // and the vast majority of real .ora files — never nest groups).
  const stackEl = imageEl.querySelector("stack");
  if (!stackEl) {
    throw new Error("Invalid .ora file: stack.xml has no <stack>.");
  }

  const children = Array.from(stackEl.children);
  const layerEls = children.filter((el) => el.tagName === "layer");
  const nestedGroups = children.filter((el) => el.tagName === "stack");
  if (nestedGroups.length > 0) {
    console.info(
      `[openraster] stack.xml has ${nestedGroups.length} nested layer group(s) — ` +
        `not supported in this version, ignoring their contents.`,
    );
  }

  const KNOWN_ATTRS = new Set([
    "name",
    "src",
    "x",
    "y",
    "opacity",
    "visibility",
    "imagehorse:active",
  ]);

  let activeIndex: number | null = null;
  const layers: OraLayerMeta[] = layerEls.map((el, i) => {
    for (const attr of Array.from(el.attributes)) {
      if (!KNOWN_ATTRS.has(attr.name)) {
        console.info(
          `[openraster] Ignoring unknown layer attribute "${attr.name}" ` +
            `(layer "${el.getAttribute("name") ?? i}").`,
        );
      }
    }
    const x = el.getAttribute("x");
    const y = el.getAttribute("y");
    if ((x && x !== "0") || (y && y !== "0")) {
      console.info(
        `[openraster] Layer "${el.getAttribute("name") ?? i}" has a non-zero ` +
          `offset (x="${x}" y="${y}") — layer offsets aren't supported in this ` +
          `version; it will be placed at (0, 0).`,
      );
    }
    if (el.getAttribute("imagehorse:active") === "true") activeIndex = i;
    const opacityAttr = el.getAttribute("opacity");
    return {
      name: el.getAttribute("name") ?? `Layer ${i}`,
      opacity: opacityAttr ? parseFloat(opacityAttr) : 1,
      visible: el.getAttribute("visibility") !== "hidden",
      src: el.getAttribute("src") ?? "",
    };
  });

  return { width, height, layers, activeIndex };
}
