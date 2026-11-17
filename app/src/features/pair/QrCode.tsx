// The QR code, drawn as one SVG path from uqr's module grid (ADR-105). uqr
// (MIT, a port of Nayuki's generator, licenses/uqr-LICENSE.txt) only encodes;
// the drawing is ours, so the colors are fixed: black on white in BOTH
// themes, with the standard 4-module quiet zone, because a phone camera reads
// a dark-on-light code best and an inverted one not at all on some phones.
// Loaded lazily with the dialog's QR, so it costs nothing until it is used.
import { encode } from "uqr";

const QUIET = 4;

/** The dark modules as one path: a 1×1 square per module. */
function qrPath(data: readonly (readonly boolean[])[]): string {
  let d = "";
  data.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) d += `M${x + QUIET} ${y + QUIET}h1v1h-1z`;
    }),
  );
  return d;
}

export default function QrCode({ text, size = 224 }: { text: string; size?: number }) {
  // Medium error correction: survives a smudge or glare on a screen.
  const qr = encode(text, { ecc: "M", border: 0 });
  const span = qr.size + QUIET * 2;
  return (
    <svg
      role="img"
      aria-label="QR code for pairing a phone"
      viewBox={`0 0 ${span} ${span}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      data-testid="pair-qr"
      className="rounded-md"
    >
      {/* Fixed colors, not theme tokens, on purpose (see the header). */}
      <rect width={span} height={span} fill="#ffffff" />
      <path d={qrPath(qr.data)} fill="#000000" />
    </svg>
  );
}
