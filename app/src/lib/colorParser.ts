// Thin wrapper around the Rust `parse_color` WASM export. Memoizes the WASM
// init so subsequent parses are sync after the first await.

let parserPromise: Promise<(input: string) => Uint8Array> | null = null;

async function loadParser(): Promise<(input: string) => Uint8Array> {
  const mod = await import("stamp_tool");
  await mod.default();
  return mod.parse_color;
}

function getParser(): Promise<(input: string) => Uint8Array> {
  if (!parserPromise) parserPromise = loadParser();
  return parserPromise;
}

export interface ParsedColor {
  r: number;
  g: number;
  b: number;
  a: number;
  /** Normalized hex form: `#rrggbb` when opaque, `#rrggbbaa` when not. */
  hex: string;
  /** CSS form for `background-color`. */
  css: string;
}

function toHex(n: number): string {
  return n.toString(16).padStart(2, "0");
}

/**
 * Parse a CSS-ish color string via the Rust WASM parser.
 * Returns null on invalid input.
 */
export async function parseColor(input: string): Promise<ParsedColor | null> {
  const parse = await getParser();
  const bytes = parse(input);
  if (bytes.length !== 4) return null;
  const [r, g, b, a] = bytes;
  const hex =
    a === 255
      ? `#${toHex(r)}${toHex(g)}${toHex(b)}`
      : `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(a)}`;
  const css =
    a === 255 ? hex : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
  return { r, g, b, a, hex, css };
}

/** Eagerly warm the parser so the first picker click is instant. */
export function warmColorParser(): void {
  void getParser().catch(() => {});
}
