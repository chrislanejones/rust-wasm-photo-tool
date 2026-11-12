/* Just enough color math to print a measured contrast beside a token.
 * `oklch(74% 0.180 55)` → linear sRGB → WCAG relative luminance. */

/** Linear-light sRGB for an `oklch(L% C H)` string, or null if it isn't one. */
export function oklchToLinearRgb(css: string): [number, number, number] | null {
  const m = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(css.trim());
  if (!m) return null;
  const L = Number(m[1]) / 100;
  const C = Number(m[2]);
  const h = (Number(m[3]) * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  return [
    clamp(4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s),
  ];
}

/** WCAG contrast ratio between two `oklch()` colors, or null. */
export function oklchContrast(fg: string, bg: string): number | null {
  const a = oklchToLinearRgb(fg);
  const b = oklchToLinearRgb(bg);
  if (!a || !b) return null;
  const lum = ([r, g, bl]: [number, number, number]) => 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
