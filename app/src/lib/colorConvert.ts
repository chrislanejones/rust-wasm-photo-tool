// Pure colour-space maths for the colour picker dialog. Everything here is
// synchronous and allocation-light because the wheel / rectangle call it on
// every pointer-move frame — round-tripping through the Rust `parse_color`
// WASM export for that would mean an `await` per drag sample.
//
// Conventions (match what the fields in the dialog display):
//   r, g, b  0–255 integers      a  0–1 float
//   h        0–360 degrees       s, v, l  0–100 percent
//
// Hex output is `#rrggbb` when opaque and `#rrggbbaa` otherwise — the same
// shape `lib/colorParser.ts` emits, so a colour picked here de-dups against
// one typed as text.

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSV {
  h: number;
  s: number;
  v: number;
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

export const clamp = (n: number, lo: number, hi: number): number =>
  n < lo ? lo : n > hi ? hi : n;

/** Wrap a hue into [0, 360). `-30` → 330, `390` → 30. */
export const wrapHue = (h: number): number => ((h % 360) + 360) % 360;

const toHex2 = (n: number): string =>
  clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");

/** The shared tail of the HSV→RGB and HSL→RGB formulas: pick the sextant of
 *  the hue (`hh` is hue / 60), spread chroma `c` across it, lift by `m`. */
function sextantToRgb(hh: number, c: number, m: number): RGB {
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const [rn, gn, bn] =
    hh < 1 ? [c, x, 0]
    : hh < 2 ? [x, c, 0]
    : hh < 3 ? [0, c, x]
    : hh < 4 ? [0, x, c]
    : hh < 5 ? [x, 0, c]
    : [c, 0, x];
  return {
    r: Math.round((rn + m) * 255),
    g: Math.round((gn + m) * 255),
    b: Math.round((bn + m) * 255),
  };
}

export function rgbToHsv({ r, g, b }: RGB): HSV {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  return {
    h: wrapHue(h),
    s: max === 0 ? 0 : (d / max) * 100,
    v: max * 100,
  };
}

export function hsvToRgb({ h, s, v }: HSV): RGB {
  const hh = wrapHue(h) / 60;
  const sn = clamp(s, 0, 100) / 100;
  const vn = clamp(v, 0, 100) / 100;
  const c = vn * sn;
  return sextantToRgb(hh, c, vn - c);
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  return { h: wrapHue(h), s: s * 100, l: l * 100 };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const hh = wrapHue(h) / 60;
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  return sextantToRgb(hh, c, ln - c / 2);
}

/** HSV → HSL without going through RGB (keeps the hue exact at s = 0). */
export function hsvToHsl({ h, s, v }: HSV): HSL {
  const sn = clamp(s, 0, 100) / 100;
  const vn = clamp(v, 0, 100) / 100;
  const l = vn * (1 - sn / 2);
  const sl = l === 0 || l === 1 ? 0 : (vn - l) / Math.min(l, 1 - l);
  return { h: wrapHue(h), s: sl * 100, l: l * 100 };
}

/** HSL → HSV, the inverse of {@link hsvToHsl}. */
export function hslToHsv({ h, s, l }: HSL): HSV {
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  const v = ln + sn * Math.min(ln, 1 - ln);
  const sv = v === 0 ? 0 : 2 * (1 - ln / v);
  return { h: wrapHue(h), s: sv * 100, v: v * 100 };
}

/** `#rrggbb`, or `#rrggbbaa` when `a` is not fully opaque. */
export function rgbaToHex({ r, g, b }: RGB, a = 1): string {
  const base = `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
  const a255 = Math.round(clamp(a, 0, 1) * 255);
  return a255 === 255 ? base : `${base}${toHex2(a255)}`;
}

/** Parse `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` (leading `#` optional).
 *  Returns null on anything else. Mirrors the hex branch of the Rust parser
 *  so the dialog's live preview does not need the WASM round-trip. */
export function hexToRgba(input: string): { rgb: RGB; a: number } | null {
  let hex = input.trim();
  if (hex.startsWith("#")) hex = hex.slice(1);
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
  if (hex.length === 3 || hex.length === 4) {
    hex = hex
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  if (hex.length !== 6 && hex.length !== 8) return null;
  const n = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  const a = hex.length === 8 ? n(6) / 255 : 1;
  return { rgb: { r: n(0), g: n(2), b: n(4) }, a };
}

/** `rgba(r, g, b, a)` — always the 4-arg form so the field reads uniformly. */
export function formatRgba({ r, g, b }: RGB, a = 1): string {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${trimFloat(a, 2)})`;
}

/** `hsl(h, s%, l%)` — or `hsla(...)` when translucent. */
export function formatHsl({ h, s, l }: HSL, a = 1): string {
  const body = `${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%`;
  return a >= 1 ? `hsl(${body})` : `hsla(${body}, ${trimFloat(a, 2)})`;
}

/** `1` → "1", `0.5` → "0.5", `0.333` → "0.33". */
function trimFloat(n: number, dp: number): string {
  return String(Number(n.toFixed(dp)));
}

/** Parse `hsl(h, s%, l%)` / `hsla(h, s%, l%, a)` (commas or spaces, `%`
 *  optional, `deg` tolerated). The Rust parser deliberately does not know
 *  hsl, so this is the one functional form parsed on the JS side. */
export function parseHslString(input: string): { hsl: HSL; a: number } | null {
  const m = input
    .trim()
    .toLowerCase()
    .match(/^hsla?\(\s*([^)]*)\)$/);
  if (!m) return null;
  const parts = m[1]
    .split(/[\s,/]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length !== 3 && parts.length !== 4) return null;
  const h = parseFloat(parts[0].replace(/deg$/, ""));
  const s = parseFloat(parts[1].replace(/%$/, ""));
  const l = parseFloat(parts[2].replace(/%$/, ""));
  if ([h, s, l].some((n) => Number.isNaN(n))) return null;
  let a = 1;
  if (parts.length === 4) {
    const raw = parts[3];
    a = raw.endsWith("%") ? parseFloat(raw) / 100 : parseFloat(raw);
    if (Number.isNaN(a)) return null;
  }
  return {
    hsl: { h: wrapHue(h), s: clamp(s, 0, 100), l: clamp(l, 0, 100) },
    a: clamp(a, 0, 1),
  };
}
