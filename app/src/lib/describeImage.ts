// The JS half of Batch → AI Rename. The engine (`describe_image`, src/describe.rs)
// looks at the pixels and hands back tags; everything here is name-building —
// token substitution, slugging, and making sure two photos never end up with
// the same filename.
//
// Split out of the panel on purpose: filename collisions are the part of this
// feature that can actually lose a user's file on export, so the rules live
// somewhere testable rather than inside a component.

/** The shape `describe_image` returns, once parsed. Mirrors `Description` in
 *  src/describe.rs — keep the two in step. */
export interface ImageDescription {
  /** `photo` | `graphic` | `screenshot` | `image` (unknown). */
  kind: string;
  /** `portrait` | `nature` | `sky` | `screenshot` | `graphic` | `""`. */
  subject: string;
  /** `dark` | `bright` | `""`. */
  tone: string;
  /** `high` | `soft` | `normal`. */
  contrast: string;
  /** `mono` | `muted` | `vivid` | `""`. */
  palette: string;
  /** A hue name, or `white` / `grey` / `black`. */
  color: string;
  /** `panorama` | `landscape` | `portrait` | `square`. */
  orientation: string;
  /** `busy` | `smooth` | `""`. */
  detail: string;
  transparent: boolean;
  /** Two or three tags joined with `-` — the engine's suggested filename. */
  slug: string;
}

/** What a photo we could not read gets called. */
export const UNKNOWN_DESCRIPTION: ImageDescription = {
  kind: "image",
  subject: "",
  tone: "",
  contrast: "normal",
  palette: "",
  color: "grey",
  orientation: "square",
  detail: "",
  transparent: false,
  slug: "image",
};

/** Tokens the Name-pattern field understands, for the panel's help text. */
export const DESCRIBE_TOKENS = [
  { token: "{desc}", hint: "what the engine saw, e.g. dark-blue-portrait" },
  { token: "{color}", hint: "dominant colour" },
  { token: "{subject}", hint: "portrait / nature / sky / screenshot" },
  { token: "{kind}", hint: "photo / graphic / screenshot" },
  { token: "{tone}", hint: "dark / bright" },
  { token: "{orientation}", hint: "landscape / portrait / square" },
  { token: "{detail}", hint: "busy / smooth" },
  { token: "{name}", hint: "the original filename" },
  { token: "{n}", hint: "sequence number" },
] as const;

/**
 * Parse the engine's JSON. Never throws: a malformed or truncated payload
 * yields `UNKNOWN_DESCRIPTION` rather than taking the whole rename run down —
 * one unreadable photo out of forty should cost one name, not the batch.
 */
export function parseDescription(json: string): ImageDescription {
  try {
    const raw = JSON.parse(json) as Partial<ImageDescription>;
    if (!raw || typeof raw !== "object") return UNKNOWN_DESCRIPTION;
    const str = (v: unknown, fallback: string) =>
      typeof v === "string" ? v : fallback;
    return {
      kind: str(raw.kind, UNKNOWN_DESCRIPTION.kind),
      subject: str(raw.subject, ""),
      tone: str(raw.tone, ""),
      contrast: str(raw.contrast, "normal"),
      palette: str(raw.palette, ""),
      color: str(raw.color, UNKNOWN_DESCRIPTION.color),
      orientation: str(raw.orientation, UNKNOWN_DESCRIPTION.orientation),
      detail: str(raw.detail, ""),
      transparent: raw.transparent === true,
      slug: str(raw.slug, UNKNOWN_DESCRIPTION.slug),
    };
  } catch {
    return UNKNOWN_DESCRIPTION;
  }
}

/**
 * Filesystem-safe lowercase slug. Everything outside `[a-z0-9]` collapses to a
 * single dash, and leading/trailing dashes go. An input that slugs down to
 * nothing returns `""` — callers decide the fallback, because "" is a useful
 * signal (an empty token should vanish, not become a stray dash).
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining accents left by NFKD
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Split `photo.jpg` into `["photo", ".jpg"]`; extensionless names keep `""`. */
export function splitExtension(name: string): [string, string] {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
}

interface PatternInput {
  description: ImageDescription;
  /** The photo's current name (extension included or not — both work). */
  originalName: string;
  /** 0-based position in the gallery. */
  index: number;
  /** What `{n}` counts from. */
  start: number;
  /** How many digits `{n}` pads to. */
  pad: number;
}

/**
 * Expand a name pattern for one photo. Returns the base name only — no
 * extension; the caller re-attaches it.
 *
 * Tokens that have no value (a photo with no subject, say) expand to nothing
 * and their surrounding separators collapse, so `{color}-{subject}` on a
 * subjectless image gives `blue`, not `blue-`.
 */
export function applyDescriptionPattern(pattern: string, input: PatternInput): string {
  const { description: d, originalName, index, start, pad } = input;
  const [originalBase] = splitExtension(originalName);
  const num = String(start + index).padStart(Math.max(1, pad), "0");

  const values: Record<string, string> = {
    "{desc}": d.slug,
    "{color}": d.color,
    "{subject}": d.subject,
    "{kind}": d.kind,
    "{tone}": d.tone,
    "{palette}": d.palette,
    "{contrast}": d.contrast,
    "{orientation}": d.orientation,
    "{detail}": d.detail,
    "{name}": originalBase,
    "{n}": num,
  };

  const expanded = pattern.replace(/\{[a-z]+\}/g, (tok) =>
    tok in values ? values[tok] : tok,
  );
  // Slug AFTER substitution so the separators the user typed are normalised
  // along with the values, and empty tokens leave no orphan dashes behind.
  const slug = slugify(expanded);
  // Never blank a name: fall back to the engine's slug, then the original.
  return slug || d.slug || slugify(originalBase) || "image";
}

/**
 * Make a list of base names unique, in order, by suffixing `-2`, `-3`, …
 *
 * The engine describes images, so a gallery of twenty beach photos genuinely
 * produces twenty identical descriptions, and a pattern without `{n}` would
 * name them all the same thing.
 *
 * The ZIP export is NOT the reason this exists — it runs its own `usedNames`
 * pass and would suffix the duplicates itself (AppShell.tsx). The reason is
 * that it should not have to: identical names are unusable in the gallery UI
 * before any export happens, and letting the archive invent the suffixes hands
 * the user an ordering they never chose and cannot see in the preview. Resolve
 * it here, where it is visible, and the export pass becomes a no-op.
 *
 * Comparison is case-insensitive because the filesystems most users export to
 * (APFS, NTFS) are too: `Beach` and `beach` would collide there.
 */
export function dedupeNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const key = name.toLowerCase();
    const prior = seen.get(key);
    if (prior === undefined) {
      seen.set(key, 1);
      return name;
    }
    // Walk forward until we find a suffix that is genuinely free — a literal
    // "beach-2" already in the list must not be duplicated by beach's rename.
    let n = prior + 1;
    let candidate = `${name}-${n}`;
    while (seen.has(candidate.toLowerCase())) {
      n += 1;
      candidate = `${name}-${n}`;
    }
    seen.set(key, n);
    seen.set(candidate.toLowerCase(), 1);
    return candidate;
  });
}
