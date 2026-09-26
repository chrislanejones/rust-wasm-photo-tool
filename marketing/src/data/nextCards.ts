import { TOOL_PAGES } from "./toolPages";
import { POSTS, postPath } from "./posts";

/* The pool behind every "Next" card grid on the site, and the picker that
 * chooses four of them for a page.
 *
 * ── why a pool and not a hand-written list per page ─────────────────────
 * /openraster carried its own four-card array and ToolLanding read three
 * slugs out of `related`. Two copies of the same idea, and every page that
 * was not one of those eleven simply ended — no way on to anything else.
 * A reader who finished /architecture had the nav and nothing else.
 *
 * ── why the "random" is seeded and not Math.random ──────────────────────
 * The site is prerendered (scripts/prerender.mjs) and then hydrated, so the
 * markup React builds in the browser has to match the markup Node wrote. A
 * Math.random() pick renders four cards on the server and four DIFFERENT
 * cards on the client, which is a hydration mismatch — React throws the
 * server HTML away and re-renders, and a crawler reads a set no visitor
 * sees. Seeding off the page's own path keeps the two passes identical
 * while still giving every page a different four. Same page, same cards,
 * every visit; different page, different cards.
 *
 * Blurbs are not written here where a page already has one. The tool cards
 * come from toolPages.ts and the site cards reuse the nav's `desc` lines
 * verbatim, so a page is described once and the menu and these cards cannot
 * drift apart.
 */

export interface NextCard {
  /** Router path. Also the de-dupe key and what the card prints as its slug. */
  to: string;
  /** The small label over the title — the nav's group for this page. */
  group: string;
  /** Short title. */
  label: string;
  /** One line. Sentence case, ends with a period. */
  blurb: string;
}

/** The four OpenRaster pages. /openraster pins the other three (see PINNED). */
const ORA_CARDS: NextCard[] = [
  {
    to: "/openraster",
    group: "Learn",
    label: "OpenRaster (.ora)",
    blurb: "Open a layered .ora here. Save it as PNG or PSD.",
  },
  {
    to: "/ora-to-png",
    group: "Convert",
    label: ".ora to PNG",
    blurb: "Flatten a .ora to a single PNG, or unpack every layer.",
  },
  {
    to: "/ora-to-psd",
    group: "Convert",
    label: ".ora to PSD",
    blurb: "A layered PSD for Photoshop, with names, opacity and blend modes.",
  },
  {
    to: "/what-is-ora",
    group: "Learn",
    label: "What is a .ora file?",
    blurb: "The two-minute version, with a file you can open.",
  },
];

/** The pages in the nav's Learn group, plus pricing. `blurb` is the nav's
 *  own `desc` for that page, copied rather than rewritten. */
const SITE_CARDS: NextCard[] = [
  {
    to: "/architecture",
    group: "Learn",
    label: "Architecture",
    blurb: "One plane is the editor. The other is optional.",
  },
  {
    to: "/features",
    group: "Learn",
    label: "Features",
    blurb: "The whole list — engine and interface.",
  },
  {
    to: "/about",
    group: "Learn",
    label: "About",
    blurb: "Who builds it, and the horse.",
  },
  {
    to: "/blog",
    group: "Blog",
    label: "Blog",
    blurb: "One decision per post, with the measurements.",
  },
  {
    to: "/trail-log",
    group: "Releases",
    label: "Trail Log",
    blurb: "Every release, newest first, and the commits behind them.",
  },
  {
    to: "/in-the-works",
    group: "Ahead",
    label: "What's coming",
    blurb: "Being built, decided, or thought about — it says which.",
  },
  {
    to: "/pricing",
    group: "Plans",
    label: "Pricing",
    blurb: "Free is the whole editor. Pro buys the passes that need a server.",
  },
];

/** Every blog post, newest first. The label is the post's short `title`, not
 *  its `headline` — a headline is two display-set sentences and would run
 *  four lines in a card. */
const postCards = (): NextCard[] =>
  POSTS.map((p) => ({
    to: postPath(p),
    group: "Blog",
    label: p.title,
    blurb: p.description,
  }));

/** The whole pool, in a stable order. Order matters only as the input to the
 *  seeded shuffle — change it and every page's four change. */
export const NEXT_CARDS: readonly NextCard[] = [
  ...TOOL_PAGES.map((t) => ({ to: t.slug, group: t.group, label: t.label, blurb: t.blurb })),
  ...ORA_CARDS,
  ...SITE_CARDS,
  ...postCards(),
];

/** Pages that always lead with the same cards, in this order, before the
 *  seeded fill. /openraster is the guide the other three point back to, so it
 *  keeps its .ora set on every visit and only the fourth card moves. */
const PINNED: Record<string, string[]> = {
  "/openraster": ["/ora-to-png", "/ora-to-psd", "/what-is-ora"],
};

export const NEXT_COUNT = 4;

/* FNV-1a, 32-bit. Any stable string→int would do; this one is four lines and
   has no dependencies. */
function seedOf(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/* mulberry32 — a small deterministic PRNG. Seeded from the path, so the
   server and the browser walk the identical sequence. */
function rng(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates against a seeded source. Does not touch the input. */
function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = items.slice();
  const next = rng(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const byPath = (to: string) => NEXT_CARDS.find((c) => c.to === to);

/**
 * The four cards for a page.
 *
 * @param path    The page's own path. Seeds the shuffle and is excluded from
 *                the result — a page never links to itself.
 * @param lead    Paths to place first, in order, before the seeded fill.
 *                Anything not in the pool is skipped rather than throwing.
 *
 * Always returns at most NEXT_COUNT, and fewer only if the pool is smaller
 * than that — with the pool above it is always exactly four.
 */
export function pickNextCards(path: string, lead: string[] = []): NextCard[] {
  const pinned = PINNED[path] ?? [];
  const wanted = [...lead, ...pinned];

  const picked: NextCard[] = [];
  const taken = new Set<string>([path]);

  for (const to of wanted) {
    if (picked.length >= NEXT_COUNT || taken.has(to)) continue;
    const card = byPath(to);
    if (!card) continue;
    picked.push(card);
    taken.add(to);
  }

  for (const card of shuffled(NEXT_CARDS, seedOf(path))) {
    if (picked.length >= NEXT_COUNT) break;
    if (taken.has(card.to)) continue;
    picked.push(card);
    taken.add(card.to);
  }

  return picked;
}

/**
 * The four cards for a blog post: another post first, then the seeded fill.
 *
 * Which post leads is seeded off this post's own path too, so a reader who
 * comes back finds the same suggestion rather than a slot machine. With a
 * single post on the site there is no sibling to lead with and the grid is
 * four ordinary cards — the /blog index card is in the pool, so the way to
 * the rest of the writing is still there.
 */
export function pickNextCardsForPost(path: string): NextCard[] {
  const siblings = POSTS.map(postPath).filter((p) => p !== path);
  const lead = shuffled(siblings, seedOf(path)).slice(0, 1);
  return pickNextCards(path, lead);
}
