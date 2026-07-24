// ===== FILE: app/src/features/routing/routes.test.ts =====
// The route grammar is the contract every deep link is judged against, so it
// gets tested as a pure function table: parse -> route, route -> hash,
// round-trip stability, and — the one that actually matters in the wild —
// garbage in, safe default out, never a throw.
//
// `modesOf` is injected here rather than imported from the tool registry: these
// tests pin the GRAMMAR, not the current tool line-up, so they don't start
// failing the day someone adds a Paint mode.
import { describe, it, expect } from "vitest";
import type { ToolType } from "@/lib/types";
import {
  parseRoute,
  formatRoute,
  routeFromSearch,
  stripRoutingParams,
  buildRouteUrl,
  toolSlug,
  SETTINGS_TAB_LABELS,
  type Route,
} from "./routes";

const MODES: Partial<Record<ToolType, string[]>> = {
  brush: ["paint", "blur", "pen", "erase"],
  compress: ["compress", "resize"],
  // crop is single-mode since the Select split; the kinds are Select's modes.
  select: ["wand", "edge", "colorRange", "lasso"],
  shapes: ["shapes", "pens", "arrows"],
  stamp: ["clone", "red", "emojis"],
};
const modesOf = (tool: ToolType): readonly string[] => MODES[tool] ?? [];

const parse = (hash: string) => parseRoute(hash, modesOf);
const fromSearch = (search: string) => routeFromSearch(search, modesOf);

describe("parseRoute — hash to state", () => {
  it("parses a tool + sub-mode", () => {
    expect(parse("#/tool/paint/blur")).toEqual({
      kind: "tool",
      tool: "brush",
      mode: "blur",
    });
  });

  it("parses a bare tool (no sub-mode)", () => {
    expect(parse("#/tool/text")).toEqual({
      kind: "tool",
      tool: "text",
      mode: undefined,
    });
  });

  it("parses a settings pane", () => {
    expect(parse("#/settings/security")).toEqual({
      kind: "settings",
      tab: "security",
    });
  });

  it("maps every public slug back to its legacy ToolType id", () => {
    // The whole point of the slug layer: the URL says `paint`, the store says
    // `brush`. If this drifts, every existing link breaks.
    expect(parse("#/tool/paint")).toMatchObject({ tool: "brush" });
    expect(parse("#/tool/adjust")).toMatchObject({ tool: "crop" });
    expect(parse("#/tool/resize")).toMatchObject({ tool: "compress" });
    expect(parse("#/tool/layers")).toMatchObject({ tool: "arrow" });
    expect(parse("#/tool/batch")).toMatchObject({ tool: "emoji" });
    expect(parse("#/tool/stamps")).toMatchObject({ tool: "stamp" });
    // Display renamed AI -> Eraser; the canonical WRITE slug followed suit.
    expect(parse("#/tool/eraser")).toMatchObject({ tool: "ai" });
    expect(toolSlug("ai")).toBe("eraser");
  });

  it("still accepts the legacy ToolType id as an inbound alias", () => {
    expect(parse("#/tool/brush/blur")).toEqual({
      kind: "tool",
      tool: "brush",
      mode: "blur",
    });
    // `crop` (the legacy id for Adjust) still resolves; its old `select`
    // sub-mode is covered by the legacy-redirect tests below.
    expect(parse("#/tool/crop")).toMatchObject({ tool: "crop" });
    // "#/tool/ai" pre-dates the Eraser rename and must keep resolving — same
    // legacy-id-alias mechanism as #/tool/brush for Paint.
    expect(parse("#/tool/ai")).toMatchObject({ tool: "ai" });
  });

  it("accepts forgiving sub-mode aliases (singular forms)", () => {
    expect(parse("#/tool/shapes/arrow")).toMatchObject({ mode: "arrows" });
    expect(parse("#/tool/stamps/emoji")).toMatchObject({ mode: "emojis" });
  });

  it("is case-insensitive and tolerates a missing/extra slash", () => {
    expect(parse("#/TOOL/Paint/BLUR")).toMatchObject({ tool: "brush", mode: "blur" });
    expect(parse("/tool/paint/blur")).toMatchObject({ tool: "brush", mode: "blur" });
    expect(parse("#//tool//paint//blur//")).toMatchObject({
      tool: "brush",
      mode: "blur",
    });
  });

  it("bare #/settings opens the default pane", () => {
    expect(parse("#/settings")).toEqual({ kind: "settings", tab: "general" });
  });
});

describe("parseRoute — garbage in, safe default out", () => {
  // The contract the app leans on: null means "this URL says nothing about the
  // view" and the caller leaves the user exactly where they are.
  const garbage = [
    "",
    "#",
    "#/",
    "#/nonsense",
    "#/tool",
    "#/tool/notatool",
    "#/tool/notatool/notamode",
    "#/settings/notapane",
    "#/../../etc/passwd",
    "#/tool/%%%",
    "#/tool/" + "x".repeat(5000),
    "#/<script>alert(1)</script>",
  ];

  for (const hash of garbage) {
    it(`does not throw and yields no tool route for ${JSON.stringify(hash.slice(0, 40))}`, () => {
      let route: Route | null = null;
      expect(() => {
        route = parse(hash);
      }).not.toThrow();
      // An unknown settings PANE is the one forgiving case (falls back to the
      // default pane); everything else must refuse to move the app.
      if (hash === "#/settings/notapane") {
        expect(route).toEqual({ kind: "settings", tab: "general" });
      } else {
        expect(route).toBeNull();
      }
    });
  }

  it("drops an unknown sub-mode but keeps the tool", () => {
    // Friendlier than failing the whole route: a typo'd mode still lands you on
    // the right tool, and the mirror rewrites the URL to the canonical one.
    expect(parse("#/tool/paint/notamode")).toEqual({
      kind: "tool",
      tool: "brush",
      mode: undefined,
    });
  });

  it("refuses a sub-mode that belongs to a DIFFERENT tool", () => {
    // `erase` is Paint's, not Shapes' — accepting it would poke a value the
    // shapesMode union has never heard of into the store.
    expect(parse("#/tool/shapes/erase")).toMatchObject({ mode: undefined });
  });
});

describe("formatRoute — state to hash", () => {
  it("writes the canonical slug, never the legacy id", () => {
    expect(formatRoute({ kind: "tool", tool: "brush", mode: "blur" })).toBe(
      "#/tool/paint/blur",
    );
    expect(formatRoute({ kind: "tool", tool: "crop", mode: "select" })).toBe(
      "#/tool/adjust/select",
    );
    expect(formatRoute({ kind: "tool", tool: "emoji" })).toBe("#/tool/batch");
  });

  it("writes a settings pane", () => {
    expect(formatRoute({ kind: "settings", tab: "security" })).toBe(
      "#/settings/security",
    );
  });
});

describe("round-trip stability", () => {
  const routes: Route[] = [
    { kind: "tool", tool: "brush", mode: "blur" },
    { kind: "tool", tool: "brush", mode: "erase" },
    { kind: "tool", tool: "compress", mode: "resize" },
    { kind: "tool", tool: "crop" },
    { kind: "tool", tool: "select", mode: "wand" },
    { kind: "tool", tool: "shapes", mode: "arrows" },
    { kind: "tool", tool: "stamp", mode: "emojis" },
    { kind: "tool", tool: "text" },
    { kind: "tool", tool: "ai" },
    { kind: "tool", tool: "effects" },
    { kind: "tool", tool: "arrow" },
    { kind: "settings", tab: "general" },
    { kind: "settings", tab: "security" },
    { kind: "settings", tab: "superuser" },
  ];

  for (const route of routes) {
    it(`route -> hash -> route is identity for ${formatRoute(route)}`, () => {
      const back = parse(formatRoute(route));
      expect(back).toEqual({ mode: undefined, ...route });
    });
  }

  it("hash -> route -> hash is a fixed point (no oscillation)", () => {
    // The loop guard depends on this: if formatting a parsed hash could produce
    // a DIFFERENT hash, the mirror would write, re-read, and write forever.
    for (const route of routes) {
      const once = formatRoute(route);
      const twice = formatRoute(parse(once) as Route);
      expect(twice).toBe(once);
    }
  });

  it("an aliased inbound hash normalises to the canonical form in one hop", () => {
    expect(formatRoute(parse("#/tool/brush/blur") as Route)).toBe("#/tool/paint/blur");
    expect(formatRoute(parse("#/tool/shapes/arrow") as Route)).toBe(
      "#/tool/shapes/arrows",
    );
  });

  it("legacy Adjust-&-Select links land on the Select TOOL", () => {
    // Select lived inside Adjust & Select until the split; the old links are
    // in bookmarks and shared URLs, so they must keep meaning "selection" —
    // not "Adjust with an unknown mode silently dropped".
    expect(parse("#/tool/adjust/select")).toEqual({ kind: "tool", tool: "select" });
    expect(parse("#/tool/crop/select")).toEqual({ kind: "tool", tool: "select" });
    expect(fromSearch("?tool=adjust&mode=select")).toEqual({
      kind: "tool",
      tool: "select",
    });
  });

  it("every tool has a slug and it survives the trip", () => {
    const tools: ToolType[] = [
      "stamp",
      "compress",
      "crop",
      "brush",
      "text",
      "arrow",
      "ai",
      "shapes",
      "effects",
      "emoji",
    ];
    for (const tool of tools) {
      expect(toolSlug(tool)).toBeTruthy();
      expect(parse(`#/tool/${toolSlug(tool)}`)).toMatchObject({ tool });
    }
  });

  it("every settings tab is linkable", () => {
    for (const tab of Object.keys(SETTINGS_TAB_LABELS)) {
      expect(parse(`#/settings/${tab}`)).toMatchObject({ tab });
    }
  });
});

describe("query params", () => {
  it("reads ?tool= and ?mode=", () => {
    expect(fromSearch("?tool=paint&mode=blur")).toEqual({
      kind: "tool",
      tool: "brush",
      mode: "blur",
    });
  });

  it("reads ?settings=", () => {
    expect(fromSearch("?settings=security")).toEqual({
      kind: "settings",
      tab: "security",
    });
  });

  it("settings outranks tool (the modal is the foreground view)", () => {
    expect(fromSearch("?tool=paint&settings=rulers")).toEqual({
      kind: "settings",
      tab: "rulers",
    });
  });

  it("ignores a search string with nothing routable in it", () => {
    expect(fromSearch("")).toBeNull();
    expect(fromSearch("?utm_source=x")).toBeNull();
    expect(fromSearch("?tool=notatool")).toBeNull();
    expect(fromSearch("?v=abc123")).toBeNull(); // the share token is not a route
  });

  it("strips only the params routing owns", () => {
    expect(stripRoutingParams("?tool=paint&mode=blur&v=abc&utm_source=x")).toBe(
      "?v=abc&utm_source=x",
    );
    expect(stripRoutingParams("?tool=paint")).toBe("");
    expect(stripRoutingParams("")).toBe("");
    expect(stripRoutingParams("?v=abc")).toBe("?v=abc");
  });
});

describe("buildRouteUrl — the copy-link output", () => {
  it("keeps the share token and drops the routing params", () => {
    expect(
      buildRouteUrl("https://ih.app", "/", "?v=abc&tool=stale", {
        kind: "tool",
        tool: "brush",
        mode: "blur",
      }),
    ).toBe("https://ih.app/?v=abc#/tool/paint/blur");
  });

  it("anchors to the served path (works on localhost and any host)", () => {
    expect(
      buildRouteUrl("http://localhost:5173", "/app/", "", {
        kind: "settings",
        tab: "security",
      }),
    ).toBe("http://localhost:5173/app/#/settings/security");
  });
});
