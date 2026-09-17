/* Shared constants for the engine-in-a-worker figures.
 *
 * ── why hex lives here at all ─────────────────────────────────────────────
 * tokens.css is the single source for color and nothing else is allowed a raw
 * value. WebGL is the one place that cannot honor that rule: a
 * `THREE.Color` parses hex, rgb(), hsl() and the CSS named colors, and none of
 * the three scenes' materials can be handed `oklch(74% 0.18 55)` — `setStyle`
 * has no branch for it and falls back to white.
 *
 * So the materials get hex, and this is the one module that holds it. Every
 * entry names the token it resolves, so a change to the palette has exactly one
 * place to follow it to. The DOM half of these figures — labels, captions, the
 * two flat diagrams — reads the real `var(--color-*)` tokens and is not in this
 * table.
 */

/** Token colors resolved to sRGB hex, for `THREE.Color`. */
export const GL = {
  /** --color-accent · oklch(74% 0.180 55) */
  accent: 0xf09646,
  /** --color-accent-2 · oklch(68% 0.220 18) */
  accent2: 0xef5a70,
  /** --color-paper · oklch(13% 0.018 35) */
  paper: 0x1c1512,
  /** --color-paper-2 · oklch(17% 0.020 35) */
  paper2: 0x2a211c,
  /** --color-paper-3 · oklch(22% 0.022 35) */
  paper3: 0x372c26,
  /** --color-paper-4 · oklch(28% 0.020 35) */
  paper4: 0x4a3d35,
  /** --color-rule-strong · oklch(40% 0.025 40) */
  rule: 0x6b5a50,
  /** --color-ink · oklch(95% 0.010 70) */
  ink: 0xf5efe6,
  /** --color-ink-2 · oklch(78% 0.015 60) */
  ink2: 0xc4b8a8,
  /** --color-ink-3 · oklch(58% 0.015 50) */
  ink3: 0x8a7f72,
} as const;

/* ── timing ───────────────────────────────────────────────────────────────
 * The scenes are written against a clock in seconds and are otherwise
 * stateless: given the same `t` they draw the same frame. That is what lets the
 * reduced-motion path render one honest still (at FROZEN_T) rather than an
 * empty stage or a first frame where nothing has happened yet.
 */

/** Smoothstep. Clamped, so a segment that has run past its end stays put. */
export const ease = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** `ease` over the window a→b of a normalized timeline. */
export const seg = (t: number, a: number, b: number): number => ease((t - a) / (b - a));

/** The still a reader who asked for no motion gets: far enough into the loop
 *  that every scene has something on the stage and its labels are up. */
export const FROZEN_T = 4.2;
