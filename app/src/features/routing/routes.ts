// ===== FILE: app/src/features/routing/routes.ts =====
// The ROUTE GRAMMAR — pure functions only. No `window`, no store imports, no
// side effects: this module is the part that can be reasoned about (and
// tested) in isolation. Everything that touches the live app lives in
// routeState.ts (stores) and navigate.ts (location).
//
//   #/tool/<toolSlug>[/<modeSlug>]     #/tool/paint/blur   #/tool/shapes/arrows
//   #/settings/<tab>                   #/settings/security
//
// SLUGS. The `ToolType` ids are known tech debt — `brush` is Paint, `crop` is
// Adjust & Select, `arrow` is Layer Settings, `emoji` is Batch — and CLAUDE.md
// is explicit that they get renamed during the registry migration and at no
// other time. A URL is a public, human-read surface, so routing keeps its own
// slug alias (`#/tool/paint`, not `#/tool/brush`) and maps it. The legacy id is
// still ACCEPTED on the way in (a guessed `#/tool/brush` works), but the slug
// is what we ever WRITE. When a tool is finally renamed for real, its row here
// collapses to an identity mapping and old links keep resolving.
import type { ToolType } from "@/lib/types";
import type { SettingsTab } from "@/components/SubscriptionButton";

export type Route =
  | { kind: "tool"; tool: ToolType; mode?: string }
  | { kind: "settings"; tab: SettingsTab };

/** Canonical public slug per tool — what we write into the URL. */
const TOOL_SLUG: Record<ToolType, string> = {
  compress: "resize",
  crop: "adjust",
  brush: "paint",
  text: "text",
  arrow: "layers",
  ai: "ai",
  shapes: "shapes",
  effects: "effects",
  stamp: "stamps",
  emoji: "batch",
};

/** Slug -> tool, plus the legacy `ToolType` ids as inbound aliases. Built from
 *  TOOL_SLUG so the two can't drift. */
const TOOL_BY_SLUG: Record<string, ToolType> = (() => {
  const map: Record<string, ToolType> = {};
  for (const [id, slug] of Object.entries(TOOL_SLUG) as [ToolType, string][]) {
    map[slug] = id;
    map[id] = id; // legacy-id alias: #/tool/brush === #/tool/paint
  }
  return map;
})();

/** Forgiving inbound mode aliases, per tool. Someone hand-typing a link will
 *  write the singular; the canonical id is what we write back. */
const MODE_ALIASES: Partial<Record<ToolType, Record<string, string>>> = {
  shapes: { arrow: "arrows", pen: "pens", shape: "shapes" },
  stamp: { emoji: "emojis", stamps: "clone" },
};

/** Settings panes that are routable, with their display names. Every tab in
 *  the `SettingsTab` union appears exactly once (`Record`, not a partial — a
 *  new tab won't compile until it's given a name and thereby made linkable).
 *  SubscriptionButton builds its own tab rail from these labels, so the modal
 *  and the URL can't end up calling the same pane different things. */
export const SETTINGS_TAB_LABELS: Record<SettingsTab, string> = {
  general: "General",
  appearance: "Appearance",
  canvas: "Layers and Canvas",
  security: "Security",
  rulers: "Rulers & Grids",
  export: "Import / Export",
  storage: "S3 / Image Hosting",
  billing: "Plan & Billing",
  aiusage: "AI Usage",
  devtests: "Dev Tests",
  superuser: "Super User",
};

const SETTINGS_TABS = Object.keys(SETTINGS_TAB_LABELS) as SettingsTab[];

/** Query params routing owns. Anything else in the search string (notably
 *  `v`, the pre-existing share-doc token, and utm_*) is none of our business
 *  and is preserved verbatim. Module-private: `stripRoutingParams` is the only
 *  thing that should ever act on this list. */
const ROUTING_PARAMS = ["tool", "mode", "settings"] as const;

/** The share-doc param — checked in App.tsx, which swaps in <ShareViewer/>
 *  instead of the editor. Absolute precedence; routing isn't even mounted. */
export const SHARE_PARAM = "v";

/** `decodeURIComponent` THROWS on a malformed escape (`%%%`, a truncated
 *  `%E0`) — and the hash is untrusted input, so a hand-mangled link must not be
 *  able to take the app down on boot. Undecodable segments fall through as-is;
 *  they won't match a slug and the route is refused, which is the right answer
 *  anyway. */
function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function toolSlug(tool: ToolType): string {
  return TOOL_SLUG[tool];
}

/** Resolve a URL segment to a tool. Accepts the canonical slug or the legacy
 *  `ToolType` id; `undefined` for anything else. */
function toolFromSlug(slug: string): ToolType | undefined {
  return TOOL_BY_SLUG[slug.toLowerCase()];
}

/** Resolve a URL segment to one of `validModes`, applying the per-tool alias
 *  table. `undefined` when it isn't a mode of that tool — an unknown MODE is
 *  dropped rather than failing the whole route, so `#/tool/paint/nonsense`
 *  still lands you on Paint. */
function modeFromSlug(
  tool: ToolType,
  slug: string,
  validModes: readonly string[],
): string | undefined {
  const raw = slug.toLowerCase();
  const canonical = MODE_ALIASES[tool]?.[raw] ?? raw;
  return validModes.find((m) => m.toLowerCase() === canonical);
}

function settingsTabFromSlug(slug: string): SettingsTab | undefined {
  const raw = slug.toLowerCase();
  return SETTINGS_TABS.find((t) => t.toLowerCase() === raw);
}

/**
 * Parse a fragment into a Route. `null` = "this hash says nothing about the
 * view" — an empty hash, a garbage hash, or an unknown root. Callers treat
 * null as "leave the app where it is" (and re-canonicalize the URL), which is
 * the safe default: a bad link never crashes and never teleports you.
 *
 * `modesOf` is injected (rather than imported) to keep this module pure — the
 * live mode table comes from the tool registry via routeState.ts.
 */
export function parseRoute(
  hash: string,
  modesOf: (tool: ToolType) => readonly string[],
): Route | null {
  // "#/tool/paint/blur" -> ["tool", "paint", "blur"]
  const segments = hash
    .replace(/^#/, "")
    .split("/")
    .map((s) => safeDecode(s.trim()))
    .filter(Boolean);
  if (!segments.length) return null;

  const [root, ...rest] = segments.map((s) => s.toLowerCase());

  if (root === "tool" || root === "tools") {
    const tool = rest[0] ? toolFromSlug(rest[0]) : undefined;
    if (!tool) return null; // unknown tool -> not a route we can honour
    const mode = rest[1] ? modeFromSlug(tool, rest[1], modesOf(tool)) : undefined;
    return { kind: "tool", tool, mode };
  }

  if (root === "settings" || root === "setting") {
    const tab = rest[0] ? settingsTabFromSlug(rest[0]) : undefined;
    // Bare `#/settings` is legitimate: open the modal on its default pane.
    return { kind: "settings", tab: tab ?? "general" };
  }

  return null;
}

/** Route -> canonical fragment (always leading `#`). */
export function formatRoute(route: Route): string {
  if (route.kind === "settings") return `#/settings/${route.tab}`;
  const base = `#/tool/${toolSlug(route.tool)}`;
  return route.mode ? `${base}/${route.mode}` : base;
}

/**
 * Route from query params — the inbound alias for hash-hostile contexts (chat
 * clients / unfurlers that strip fragments): `?tool=paint&mode=blur`,
 * `?settings=security`. `settings` wins over `tool`, matching state precedence
 * (the modal is the foreground view).
 */
export function routeFromSearch(
  search: string,
  modesOf: (tool: ToolType) => readonly string[],
): Route | null {
  const params = new URLSearchParams(search);

  const settings = params.get("settings");
  if (settings !== null) {
    const tab = settingsTabFromSlug(settings);
    return { kind: "settings", tab: tab ?? "general" };
  }

  const toolParam = params.get("tool");
  if (!toolParam) return null;
  const tool = toolFromSlug(toolParam);
  if (!tool) return null;

  const modeParam = params.get("mode");
  const mode = modeParam
    ? modeFromSlug(tool, modeParam, modesOf(tool))
    : undefined;
  return { kind: "tool", tool, mode };
}

/** Drop the params routing owns; keep everything else (`v`, utm_*, …) in its
 *  original order. Returns "" or a string starting with "?". */
export function stripRoutingParams(search: string): string {
  const params = new URLSearchParams(search);
  for (const key of ROUTING_PARAMS) params.delete(key);
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}

/** The shareable URL for a route: origin + path + (non-routing) params + the
 *  canonical fragment. Same anchoring as `shareUrlFor` — works on localhost
 *  and on any deploy host. */
export function buildRouteUrl(
  origin: string,
  pathname: string,
  search: string,
  route: Route,
): string {
  return `${origin}${pathname}${stripRoutingParams(search)}${formatRoute(route)}`;
}
