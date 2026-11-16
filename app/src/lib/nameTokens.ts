// The ONE token formatter behind every name pattern in the app: Batch › Rename,
// Batch › AI Rename and the Export recipes' file name (ticket 237). Before this
// each of the three substituted its own tokens with its own regex, and they had
// already drifted: Rename knew {name} and {n}, the recipes knew {w} and {h}, and
// AI Rename knew a third set.
//
// Pure: no React, no storage. The values that need the stored file (the EXIF
// date, the upload name) are read by lib/photoNameFacts.ts and handed in.
//
// Kept light on purpose: exportRecipes.ts imports this, and preferences.ts
// imports exportRecipes, so anything heavy here would load with every prefs read.
import { extFromMime } from "@/lib/mimeExt";

/** The shared tokens and their help text, the SINGLE source for the Rename
 *  panel, AI Rename (via `DESCRIBE_TOKENS`) and the Export recipe help line.
 *  `nameTokens.test.ts` asserts this list and the expander's table agree. */
export const NAME_TOKENS = [
  { token: "{name}", hint: "the current name" },
  { token: "{original}", hint: "the name it was uploaded with" },
  { token: "{n}", hint: "sequence number" },
  { token: "{date}", hint: "date taken (EXIF), else the file's date, else today, as YYYY-MM-DD" },
  { token: "{date:FORMAT}", hint: "that date your way from YYYY MM DD HH mm, e.g. {date:YYYYMMDD}" },
  { token: "{width}", hint: "width in pixels" },
  { token: "{height}", hint: "height in pixels" },
  { token: "{ext}", hint: "file type, e.g. jpg" },
] as const;

/** `{date}` with no format. ISO order: a file name is read by sorting tools as
 *  much as by people, and only year-month-day sorts by date as plain text. */
const DEFAULT_DATE_FORMAT = "YYYY-MM-DD";

/** What one photo brings to a pattern. The caller resolves context: in Rename
 *  `width`/`height` are the photo's pixels, in an export they are the output
 *  file's. */
export interface NameTokenInput {
  /** The current name, extension already removed. */
  name: string;
  /** The name it was uploaded with, extension removed. Unknown → `{name}`. */
  original?: string;
  /** The sequence number, already padded the way the panel asked. */
  n: string;
  width: number;
  height: number;
  /** File type without the dot, e.g. `jpg`. */
  ext: string;
  /** EXIF capture time as `ExifSummary.dateTaken` gives it ("YYYY-MM-DD HH:MM"). */
  dateTaken?: string;
  /** The file's own date (`File.lastModified`, ms). */
  fileDate?: number;
}

interface DateParts {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
}

/** EXIF's wall-clock time, read as digits. Any separator is accepted (EXIF
 *  writes `2024:05:01 10:30:00`, `normalizeExifDate` gives `2024-05-01 10:30`),
 *  and the result is numbers, so nothing from the field itself reaches a name.
 *  `0000:00:00` (a camera whose clock was never set) is no date at all. */
function parseExifDate(s: string | undefined): DateParts | null {
  const m = s?.match(/^\s*(\d{4})\D(\d{2})\D(\d{2})(?:[ T](\d{2})\D(\d{2}))?/);
  if (!m) return null;
  const [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4] ?? "0", m[5] ?? "0"].map(Number);
  if (y < 1 || mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  return { y, mo, d, h, mi };
}

/** Local time, the same clock a person reads the file's date on. */
function partsOf(ms: number): DateParts {
  const t = new Date(ms);
  return { y: t.getFullYear(), mo: t.getMonth() + 1, d: t.getDate(), h: t.getHours(), mi: t.getMinutes() };
}

/** EXIF date taken, else the file's date, else now. */
function resolveDate(input: NameTokenInput): DateParts {
  const exif = parseExifDate(input.dateTaken);
  if (exif) return exif;
  const f = input.fileDate;
  if (typeof f === "number" && Number.isFinite(f) && f > 0) return partsOf(f);
  return partsOf(Date.now());
}

const two = (v: number) => String(v).padStart(2, "0");

function formatDate(p: DateParts, format: string): string {
  return (format || DEFAULT_DATE_FORMAT).replace(/YYYY|MM|DD|HH|mm/g, (k) => {
    switch (k) {
      case "YYYY": return String(p.y).padStart(4, "0");
      case "MM": return two(p.mo);
      case "DD": return two(p.d);
      case "HH": return two(p.h);
      default: return two(p.mi);
    }
  });
}

/** Remove what a file system refuses — `/ \ : * ? " < > |` and control
 *  characters — from a token's VALUE. The text a person typed around the
 *  tokens is left to the caller's own pass. */
export function sanitizeTokenValue(value: string): string {
  return [...value]
    .filter((c) => {
      const code = c.charCodeAt(0);
      return code >= 32 && code !== 127 && !'/\\:*?"<>|'.includes(c);
    })
    .join("");
}

/** A name's extension, else the file type's, lowercase and without the dot. */
export function extOf(name: string, mimeType: string | undefined): string {
  const dot = name.lastIndexOf(".");
  if (dot > 0 && dot < name.length - 1) return name.slice(dot + 1).toLowerCase();
  return mimeType ? extFromMime(mimeType).replace(/^\./, "").toLowerCase() : "";
}

/** The plain tokens. Values are thunks so the date is only resolved when a
 *  pattern asks for it. */
function plainTable(input: NameTokenInput): Record<string, () => string> {
  return {
    name: () => input.name,
    original: () => input.original ?? input.name,
    n: () => input.n,
    date: () => formatDate(resolveDate(input), DEFAULT_DATE_FORMAT),
    width: () => String(input.width),
    height: () => String(input.height),
    ext: () => input.ext,
  };
}

/** Tokens that take a format after a colon. */
const PARAM_TABLE: Record<string, (input: NameTokenInput, arg: string) => string> = {
  date: (input, format) => formatDate(resolveDate(input), format),
};

const EMPTY_INPUT: NameTokenInput = { name: "", n: "", width: 0, height: 0, ext: "" };

/** Every token the expander honors, derived from its own tables, for the drift
 *  guard to compare against `NAME_TOKENS`. */
export function supportedNameTokens(): string[] {
  return [
    ...Object.keys(plainTable(EMPTY_INPUT)).map((k) => `{${k}}`),
    ...Object.keys(PARAM_TABLE).map((k) => `{${k}:FORMAT}`),
  ];
}

const TOKEN_RE = /\{([a-z]+)(?::([^{}]*))?\}/g;

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/**
 * Fill a name pattern for one photo. `extra` adds caller-specific plain tokens
 * (AI Rename's description words, the recipes' old `{w}`/`{h}`).
 *
 * Unknown tokens stay as typed, so a typo is visible in the preview instead of
 * vanishing. Every substituted value goes through `sanitizeTokenValue`.
 * Returns the base name only; the caller adds the extension.
 */
export function expandNameTokens(
  pattern: string,
  input: NameTokenInput,
  extra: Readonly<Record<string, string>> = {},
): string {
  const plain = plainTable(input);
  return pattern.replace(TOKEN_RE, (tok, key: string, arg: string | undefined) => {
    if (arg === undefined) {
      if (has(plain, key)) return sanitizeTokenValue(plain[key]());
      if (has(extra, key)) return sanitizeTokenValue(extra[key]);
      return tok;
    }
    const param = has(PARAM_TABLE, key) ? PARAM_TABLE[key] : undefined;
    return param ? sanitizeTokenValue(param(input, arg)) : tok;
  });
}

/** True when a pattern uses a token that needs the stored file read
 *  (`{date}` for EXIF, `{original}` for the upload name). */
export function patternNeedsNameFacts(pattern: string): boolean {
  return /\{(?:date(?::[^{}]*)?|original)\}/.test(pattern);
}
