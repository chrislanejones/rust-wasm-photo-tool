// ===== FILE: app/src/features/routing/routes.ts =====
// The ROUTE GRAMMAR — pure functions only. No `window`, no store imports, no
// side effects: this module is the part that can be reasoned about (and
// tested) in isolation. Everything that touches the live app lives in
// routeState.ts (stores) and navigate.ts (location).
//
//   #/<group>/<subtool>      #/create/brush   #/edit/color-picker
//   #/settings/<tab>         #/settings/security
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THE URL IS GROUP/SUB-TOOL AND NOT TOOL/MODE.
//
// The five-group restructure made the sub-tool the thing a user actually picks,
// and six sub-tools share a legacy tool id — Crop / Transform / Color Picker
// are all `crop`, Resize Layer / Canvas Size / Guides are all `arrow`. Under
// the old grammar those three collapsed onto ONE url (`#/tool/adjust`), so a
// link could not say which of them you were looking at. Addressing the sub-tool
// fixes that, and it is what the toolbar now shows you.
//
// LEGACY URLS STILL RESOLVE. Every shape the app has ever written is accepted
// inbound and redirected to the sub-tool it means:
//   #/tool/paint/blur    -> #/create/blur-brush    (tool slug + mode)
//   #/tool/brush/blur    -> #/create/blur-brush    (legacy ToolType id)
//   #/tool/adjust/select -> #/select/magic-wand    (the v7.44 Select split)
//   #/tool/create/brush  -> #/create/brush         (the `tool/` prefix form)
//   ?tool=paint&mode=blur                          (hash-hostile clients)
// Bookmarks exist. The rule is: accept everything, write exactly one form.
import type { ToolType } from "@/lib/types";
import type { SettingsTab } from "@/components/SubscriptionButton";
import {
  ALL_SUB_TOOLS,
  LIVE_SUB_TOOLS,
  groupById,
  resolveSubTool,
  subToolForToolMode,
  type ToolGroupId,
} from "@/features/tools/toolGroups";

export type Route =
  | { kind: "tool"; group: ToolGroupId; subTool: string }
  | { kind: "settings"; tab: SettingsTab };

/** Legacy per-tool URL slug -> tool id. Kept for INBOUND resolution only; we
 *  never write these any more. `#/tool/paint` was the canonical form up to
 *  v7.51, and the raw `ToolType` ids were accepted alongside it. */
const LEGACY_TOOL_SLUG: Record<ToolType, string> = {
  compress: "resize",
  crop: "adjust",
  select: "select",
  brush: "paint",
  text: "text",
  arrow: "layers",
  ai: "eraser",
  shapes: "shapes",
  effects: "effects",
  stamp: "stamps",
  emoji: "batch",
};

const LEGACY_TOOL_BY_SLUG: Record<string, ToolType> = (() => {
  const map: Record<string, ToolType> = {};
  for (const [id, slug] of Object.entries(LEGACY_TOOL_SLUG) as [ToolType, string][]) {
    map[slug] = id;
    map[id] = id; // legacy-id alias: #/tool/brush === #/tool/paint
  }
  return map;
})();

/** Forgiving inbound mode aliases, per tool. Someone hand-typing a link will
 *  write the singular. */
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
 *  and is preserved verbatim. */
const ROUTING_PARAMS = ["tool", "mode", "settings", "group", "subtool"] as const;

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

/** A route pointing at a group's default (first live) sub-tool. */
function groupRoute(group: ToolGroupId): Route | null {
  const g = groupById(group);
  if (!g) return null;
  const first = g.subTools.find((s) => !s.comingSoon);
  return first ? { kind: "tool", group, subTool: first.id } : null;
}

/** Resolve a legacy `(toolSlug, modeSlug)` pair to the sub-tool it means.
 *
 *  This is where every pre-v7.51 link lands. The mode is resolved against the
 *  tool's alias table first, then handed to the registry's reverse lookup —
 *  so `#/tool/paint/blur` becomes Create › Blur Brush rather than being
 *  refused or dropping you on the group's default. */
function legacyToolRoute(
  toolSlugOrId: string,
  modeSlug: string | undefined,
): Route | null {
  const tool = LEGACY_TOOL_BY_SLUG[toolSlugOrId.toLowerCase()];
  if (!tool) return null;

  // The v7.44 Select split: Select lived inside "Adjust & Select", so
  // `#/tool/adjust/select` exists in old links. It must land on the SELECT
  // group, not on Edit with the mode silently dropped — which would strand you
  // on the wrong half of the old pairing.
  if (tool === "crop" && modeSlug?.toLowerCase() === "select") {
    return groupRoute("select");
  }

  const rawMode = modeSlug?.toLowerCase();
  const mode = rawMode ? (MODE_ALIASES[tool]?.[rawMode] ?? rawMode) : undefined;

  // Match the mode case-insensitively against what the registry actually has
  // (`colorRange` is camelCase, so a lowercased URL segment won't match raw).
  const canonicalMode = mode
    ? LIVE_SUB_TOOLS.find(
        (r) =>
          r.subTool.tool === tool &&
          r.subTool.mode !== undefined &&
          r.subTool.mode.toLowerCase() === mode,
      )?.subTool.mode
    : undefined;

  const resolved = subToolForToolMode(tool, canonicalMode);
  return resolved
    ? { kind: "tool", group: resolved.group.id, subTool: resolved.subTool.id }
    : null;
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
 */
export function parseRoute(hash: string): Route | null {
  const segments = hash
    .replace(/^#/, "")
    .split("/")
    .map((s) => safeDecode(s.trim()))
    .filter(Boolean);
  if (!segments.length) return null;

  const [root, ...rest] = segments.map((s) => s.toLowerCase());

  if (root === "settings" || root === "setting") {
    const tab = rest[0] ? settingsTabFromSlug(rest[0]) : undefined;
    // Bare `#/settings` is legitimate: open the modal on its default pane.
    return { kind: "settings", tab: tab ?? "general" };
  }

  // `#/tool/...` — the pre-v7.51 prefix. It may now carry EITHER a group
  // (`#/tool/create/brush`, which nothing writes but is guessable and
  // harmless) or a legacy tool slug (`#/tool/paint/blur`, which real
  // bookmarks hold).
  if (root === "tool" || root === "tools") {
    if (!rest[0]) return null;
    // LEGACY WINS UNDER THIS PREFIX. `select` is BOTH a group id and a legacy
    // tool slug, so `#/tool/select/edge` is ambiguous — and the `tool/` prefix
    // is itself the legacy marker, so the legacy reading is the right one.
    // Reading it as a group instead made `edge` an unknown sub-tool id and
    // silently dropped you on the group default (Magic Wand), which is the
    // wrong selection mode with no error to tell you so.
    const legacy = legacyToolRoute(rest[0], rest[1]);
    if (legacy) return legacy;
    // Not a legacy tool — honour a group under the prefix (`#/tool/create/brush`).
    const asGroup = groupById(rest[0]);
    if (!asGroup) return null;
    if (!rest[1]) return groupRoute(asGroup.id);
    const resolved = resolveSubTool(asGroup.id, rest[1]);
    return resolved && !resolved.subTool.comingSoon
      ? { kind: "tool", group: asGroup.id, subTool: resolved.subTool.id }
      : groupRoute(asGroup.id);
  }

  // `#/<group>[/<subtool>]` — the canonical form.
  const group = groupById(root);
  if (group) {
    if (!rest[0]) return groupRoute(group.id);
    const resolved = resolveSubTool(group.id, rest[0]);
    // An unknown or Coming Soon SUB-TOOL is dropped rather than failing the
    // whole route, so `#/create/nonsense` still lands you on Create.
    if (!resolved || resolved.subTool.comingSoon) return groupRoute(group.id);
    return { kind: "tool", group: group.id, subTool: resolved.subTool.id };
  }

  return null;
}

/** Route -> canonical fragment (always leading `#`). */
export function formatRoute(route: Route): string {
  if (route.kind === "settings") return `#/settings/${route.tab}`;
  return `#/${route.group}/${route.subTool}`;
}

/**
 * Route from query params — the inbound alias for hash-hostile contexts (chat
 * clients / unfurlers that strip fragments): `?group=create&subtool=brush`,
 * the legacy `?tool=paint&mode=blur`, or `?settings=security`. `settings` wins
 * over the rest, matching state precedence (the modal is the foreground view).
 */
export function routeFromSearch(search: string): Route | null {
  const params = new URLSearchParams(search);

  const settings = params.get("settings");
  if (settings !== null) {
    const tab = settingsTabFromSlug(settings);
    return { kind: "settings", tab: tab ?? "general" };
  }

  const groupParam = params.get("group");
  if (groupParam) {
    const group = groupById(groupParam);
    if (!group) return null;
    const sub = params.get("subtool");
    if (!sub) return groupRoute(group.id);
    const resolved = resolveSubTool(group.id, sub);
    return resolved && !resolved.subTool.comingSoon
      ? { kind: "tool", group: group.id, subTool: resolved.subTool.id }
      : groupRoute(group.id);
  }

  const toolParam = params.get("tool");
  if (!toolParam) return null;
  return legacyToolRoute(toolParam, params.get("mode") ?? undefined);
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

/** Human-readable "Create › Brush" for a route — the palette's copy-link
 *  toast, and anywhere else a route needs naming. */
export function routeLabel(route: Route): string {
  if (route.kind === "settings") return SETTINGS_TAB_LABELS[route.tab];
  const found = ALL_SUB_TOOLS.find(
    (r) => r.group.id === route.group && r.subTool.id === route.subTool,
  );
  return found ? `${found.group.label} › ${found.subTool.label}` : route.group;
}
