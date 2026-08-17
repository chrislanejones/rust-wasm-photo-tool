// ===== FILE: app/src/features/routing/routes.test.ts =====
// The route grammar is the contract every deep link is judged against, so it
// gets tested as a pure function table: parse -> route, route -> hash,
// round-trip stability, and — the one that actually matters in the wild —
// garbage in, safe default out, never a throw.
//
// Since v7.51 the grammar addresses the SUB-TOOL (`#/create/brush`), not the
// legacy tool+mode pair. The bulk of this file is therefore the LEGACY
// REDIRECT table: one assertion per URL shape the app has ever written, because
// bookmarks exist and silently landing on the wrong tool is worse than a refusal.
//
// Unlike the pre-v7.51 version, these run against the REAL registry rather than
// an injected mode table — resolving against it is the grammar's whole job now,
// so faking it would test nothing.
import { describe, it, expect } from "vitest";
import {
  parseRoute,
  formatRoute,
  routeFromSearch,
  stripRoutingParams,
  buildRouteUrl,
  routeLabel,
  SETTINGS_TAB_LABELS,
  type Route,
} from "./routes";
import { LIVE_SUB_TOOLS, TOOL_GROUPS } from "@/features/tools/toolGroups";

const parse = (hash: string) => parseRoute(hash);
const fromSearch = (search: string) => routeFromSearch(search);

describe("parseRoute — the canonical group/sub-tool form", () => {
  it("parses a group + sub-tool", () => {
    expect(parse("#/create/brush")).toEqual({
      kind: "tool",
      group: "create",
      subTool: "brush",
    });
  });

  it("parses a bare group as that group's first live sub-tool", () => {
    expect(parse("#/create")).toEqual({
      kind: "tool",
      group: "create",
      subTool: "brush",
    });
  });

  it("distinguishes the three Edit sub-tools that share the `crop` tool id", () => {
    // The whole reason the grammar changed: under the old form all three of
    // these collapsed onto `#/tool/adjust`.
    expect(parse("#/edit/crop")).toMatchObject({ subTool: "crop" });
    expect(parse("#/edit/transform")).toMatchObject({ subTool: "transform" });
    expect(parse("#/edit/color-picker")).toMatchObject({ subTool: "color-picker" });
  });

  it("is case-insensitive and tolerates a missing/extra slash", () => {
    const want = { kind: "tool", group: "create", subTool: "brush" };
    expect(parse("#/CREATE/BRUSH")).toEqual(want);
    expect(parse("create/brush")).toEqual(want);
    expect(parse("#//create//brush//")).toEqual(want);
  });

  it("parses a settings pane, and bare #/settings opens the default", () => {
    expect(parse("#/settings/security")).toEqual({
      kind: "settings",
      tab: "security",
    });
    expect(parse("#/settings")).toEqual({ kind: "settings", tab: "general" });
  });
});

describe("parseRoute — legacy redirects (one per shape we have ever written)", () => {
  // The pre-v7.51 canonical form was `#/tool/<toolSlug>[/<mode>]`, with the raw
  // ToolType id accepted alongside the slug. Every row is a link that can exist
  // in somebody's bookmarks.
  const LEGACY: [string, string, string][] = [
    ["#/tool/resize/compress", "enhance", "compress"],
    ["#/tool/resize/resize", "enhance", "resize"],
    ["#/tool/compress/compress", "enhance", "compress"],
    ["#/tool/effects", "enhance", "adjustments"],
    ["#/tool/eraser/rembg", "enhance", "ai"],
    ["#/tool/ai/rembg", "enhance", "ai"],
    ["#/tool/select/wand", "select", "magic-wand"],
    ["#/tool/select/edge", "select", "edge-aware"],
    ["#/tool/select/lasso", "select", "magnetic-lasso"],
    ["#/tool/select/colorrange", "select", "color-range"],
    ["#/tool/select/rect", "select", "rectangle"],
    ["#/tool/select/ellipse", "select", "ellipse"],
    ["#/tool/paint/paint", "create", "brush"],
    ["#/tool/paint/pen", "create", "pen"],
    ["#/tool/paint/blur", "create", "blur-brush"],
    ["#/tool/brush/blur", "create", "blur-brush"],
    ["#/tool/eraser/brush", "create", "eraser"],
    ["#/tool/eraser/magic", "create", "magic-eraser"],
    ["#/tool/text/text", "create", "text"],
    ["#/tool/text/ocr", "create", "ocr"],
    ["#/tool/shapes/shapes", "create", "shapes"],
    ["#/tool/shapes/pens", "create", "pins"],
    ["#/tool/shapes/arrows", "create", "arrow"],
    ["#/tool/stamps/clone", "create", "clone-stamp"],
    ["#/tool/stamps/red", "create", "stamps"],
    ["#/tool/stamps/emojis", "create", "emoji"],
    ["#/tool/stamp/emojis", "create", "emoji"],
    ["#/tool/adjust", "edit", "crop"],
    ["#/tool/crop", "edit", "crop"],
    ["#/tool/layers", "edit", "resize-layer"],
    ["#/tool/arrow", "edit", "resize-layer"],
    ["#/tool/batch/logo", "batch", "logo"],
    ["#/tool/batch/text", "batch", "text"],
    ["#/tool/batch/rename", "batch", "rename"],
    ["#/tool/emoji/logo", "batch", "logo"],
  ];

  for (const [hash, group, subTool] of LEGACY) {
    it(`${hash} -> #/${group}/${subTool}`, () => {
      expect(parse(hash)).toEqual({ kind: "tool", group, subTool });
    });
  }

  it("the v7.44 Adjust-&-Select link lands on the Select GROUP, not Edit", () => {
    // Dropping the mode and leaving you on Edit would strand you on the wrong
    // half of the old pairing.
    expect(parse("#/tool/adjust/select")).toMatchObject({ group: "select" });
    expect(fromSearch("?tool=adjust&mode=select")).toMatchObject({ group: "select" });
  });

  it("accepts forgiving sub-mode aliases (singular forms)", () => {
    expect(parse("#/tool/shapes/arrow")).toEqual({
      kind: "tool",
      group: "create",
      subTool: "arrow",
    });
    expect(parse("#/tool/shapes/pen")).toEqual({
      kind: "tool",
      group: "create",
      subTool: "pins",
    });
  });

  it("accepts a group under the legacy `tool/` prefix too", () => {
    // Nothing writes this, but it is the obvious thing to guess and costs one
    // branch to honour.
    expect(parse("#/tool/create/brush")).toEqual({
      kind: "tool",
      group: "create",
      subTool: "brush",
    });
  });
});

describe("parseRoute — garbage in, safe default out", () => {
  const GARBAGE = [
    "",
    "#",
    "#/",
    "#/nonsense",
    "#/tool",
    "#/tool/",
    "#/tool/notatool/notamode",
    "#/%%%",
    "#/create/%E0",
    "#/" + "a".repeat(5000),
    "#/../../etc/passwd",
    "#/create/brush?x=<script>",
  ];

  for (const hash of GARBAGE) {
    it(`does not throw for ${JSON.stringify(hash.slice(0, 40))}`, () => {
      expect(() => parse(hash)).not.toThrow();
    });
  }

  it("drops an unknown sub-tool but keeps the group", () => {
    expect(parse("#/create/nonsense")).toEqual({
      kind: "tool",
      group: "create",
      subTool: "brush",
    });
  });

  it("refuses an unknown group outright", () => {
    expect(parse("#/nonsense/brush")).toBeNull();
  });

  it("a Coming Soon sub-tool falls back to the group default, never itself", () => {
    // Ruler must be unreachable by URL — it carries no tool, so applyRoute
    // would have nothing to activate. (Perspective was the other example here
    // until v8.42 shipped it; it is now a live sub-tool and is asserted
    // reachable in the live-sub-tool tests instead.)
    expect(parse("#/edit/ruler")).toMatchObject({ subTool: "crop" });
    // And the freshly-live one resolves to ITSELF, which is the other half of
    // the same rule and the regression guard for switching it on.
    expect(parse("#/edit/perspective")).toMatchObject({ subTool: "perspective" });
  });

  it("refuses a sub-tool that belongs to a DIFFERENT group", () => {
    expect(parse("#/edit/brush")).toMatchObject({ subTool: "crop" });
  });
});

describe("formatRoute — state to hash", () => {
  it("writes the group/sub-tool form, never the legacy tool slug", () => {
    expect(formatRoute({ kind: "tool", group: "create", subTool: "brush" })).toBe(
      "#/create/brush",
    );
    expect(
      formatRoute({ kind: "tool", group: "edit", subTool: "color-picker" }),
    ).toBe("#/edit/color-picker");
  });

  it("writes a settings pane", () => {
    expect(formatRoute({ kind: "settings", tab: "security" })).toBe(
      "#/settings/security",
    );
  });
});

describe("round-trip stability", () => {
  it("route -> hash -> route is identity for EVERY live sub-tool", () => {
    for (const { group, subTool } of LIVE_SUB_TOOLS) {
      const route: Route = { kind: "tool", group: group.id, subTool: subTool.id };
      expect(parse(formatRoute(route))).toEqual(route);
    }
  });

  it("every settings tab is linkable", () => {
    for (const tab of Object.keys(SETTINGS_TAB_LABELS)) {
      const route = { kind: "settings", tab } as Route;
      expect(parse(formatRoute(route))).toEqual(route);
    }
  });

  it("hash -> route -> hash is a fixed point (no oscillation)", () => {
    for (const hash of ["#/create/brush", "#/edit/guides", "#/settings/security"]) {
      const route = parse(hash);
      expect(route).not.toBeNull();
      expect(formatRoute(route!)).toBe(hash);
    }
  });

  it("a legacy hash normalises to the canonical form in ONE hop", () => {
    const once = parse("#/tool/paint/blur");
    expect(formatRoute(once!)).toBe("#/create/blur-brush");
    expect(formatRoute(parse(formatRoute(once!))!)).toBe("#/create/blur-brush");
  });

  it("every group is reachable by its bare name", () => {
    for (const group of TOOL_GROUPS) {
      expect(parse(`#/${group.id}`)).toMatchObject({
        kind: "tool",
        group: group.id,
      });
    }
  });
});

describe("query params", () => {
  it("reads ?group= and ?subtool=", () => {
    expect(fromSearch("?group=create&subtool=brush")).toEqual({
      kind: "tool",
      group: "create",
      subTool: "brush",
    });
  });

  it("still reads the legacy ?tool= and ?mode=", () => {
    expect(fromSearch("?tool=paint&mode=blur")).toEqual({
      kind: "tool",
      group: "create",
      subTool: "blur-brush",
    });
  });

  it("reads ?settings= and it outranks the rest (the modal is foreground)", () => {
    expect(fromSearch("?settings=security")).toEqual({
      kind: "settings",
      tab: "security",
    });
    expect(fromSearch("?group=create&settings=security")).toEqual({
      kind: "settings",
      tab: "security",
    });
  });

  it("ignores a search string with nothing routable in it", () => {
    expect(fromSearch("?utm_source=x&v=abc")).toBeNull();
  });

  it("strips only the params routing owns", () => {
    expect(stripRoutingParams("?v=abc&tool=paint&mode=blur&utm_source=x")).toBe(
      "?v=abc&utm_source=x",
    );
    expect(stripRoutingParams("?group=create&subtool=brush")).toBe("");
  });
});

describe("buildRouteUrl — the copy-link output", () => {
  it("keeps the share token and drops the routing params", () => {
    expect(
      buildRouteUrl("https://ih.app", "/", "?v=abc&tool=paint", {
        kind: "tool",
        group: "create",
        subTool: "blur-brush",
      }),
    ).toBe("https://ih.app/?v=abc#/create/blur-brush");
  });
});

describe("routeLabel", () => {
  it("names a route the way the palette shows it", () => {
    expect(routeLabel({ kind: "tool", group: "create", subTool: "brush" })).toBe(
      "Create › Brush",
    );
  });

  it("names a settings pane", () => {
    expect(routeLabel({ kind: "settings", tab: "security" })).toBe("Security");
  });
});
