// Stage 0 of ADR-024 — the cross-surface contract test (OPEN-C's safety net).
//
// ADR-023 made `features/tools/toolGroups.ts` the single definition site for
// the five tool groups and their sub-tools, and said everything derives from
// it. The parts that did not derive drifted: the status bar told users to press
// `2` for Edit (which is Select) for six releases, and ShortcutModal silently
// omitted Select for three after the `S` binding was removed.
//
// ADR-024 wants this in place BEFORE the engine-in-a-worker migration, because
// the 8 read-modify-write rewrites touch dispatch and tool state — and doing
// that without a drift guard is how the toolbar arc's mislabelling happened.
//
// WHAT THIS ADDS. Three per-surface tests already exist and are good:
//   routes.test.ts               parseRoute + every legacy redirect shape
//   commands.test.ts             the palette derives from the registry
//   useKeyboardShortcuts.test.ts GROUP_BY_KEY agrees with the registry
// None of them asks the cross-surface question — "is every live sub-tool
// reachable from EVERY surface?" — and nothing at all covers ShortcutModal.
// That is this file.
import { describe, it, expect } from "vitest";
import {
  TOOL_GROUPS,
  LIVE_SUB_TOOLS,
  ALL_SUB_TOOLS,
  subToolKey,
  subToolByKey,
} from "@/features/tools/toolGroups";
import { parseRoute, formatRoute } from "@/features/routing/routes";
import { SHORTCUT_GROUPS } from "@/components/shortcutGroups";

describe("the group registry's own invariants", () => {
  it("has five groups with unique ids", () => {
    expect(TOOL_GROUPS).toHaveLength(5);
    expect(new Set(TOOL_GROUPS.map((g) => g.id)).size).toBe(5);
  });

  it("binds exactly the digits 1-5, one per group", () => {
    const keys = TOOL_GROUPS.map((g) => g.shortcutKey).sort();
    expect(keys).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("gives every group at least one live sub-tool to land on", () => {
    for (const g of TOOL_GROUPS) {
      const live = g.subTools.filter((s) => !("comingSoon" in s && s.comingSoon));
      expect(live.length, `${g.label} has no live sub-tool`).toBeGreaterThan(0);
    }
  });

  it("has no duplicate sub-tool keys", () => {
    const keys = ALL_SUB_TOOLS.map((r) => subToolKey(r.group.id, r.subTool.id));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("every live sub-tool is reachable from every surface", () => {
  it("round-trips through the URL", () => {
    for (const r of LIVE_SUB_TOOLS) {
      const key = subToolKey(r.group.id, r.subTool.id);
      const hash = formatRoute({ kind: "tool", group: r.group.id, subTool: r.subTool.id });
      const back = parseRoute(hash);
      expect(back, `${key} produced an unparseable route: ${hash}`).toBeTruthy();
      expect(back?.kind).toBe("tool");
      if (back?.kind === "tool") {
        expect(
          subToolKey(back.group, back.subTool),
          `${key} did not survive formatRoute → parseRoute (got ${hash})`,
        ).toBe(key);
      }
    }
  });

  it("resolves back out of the registry by its own key", () => {
    for (const r of LIVE_SUB_TOOLS) {
      const key = subToolKey(r.group.id, r.subTool.id);
      expect(subToolByKey(key), `${key} is not resolvable by key`).toBeTruthy();
    }
  });
});

describe("ShortcutModal — the surface that has already drifted once", () => {
  const toolSection = SHORTCUT_GROUPS.find((s) => /tool group/i.test(s.title));

  it("still has a tool-groups section at all", () => {
    expect(toolSection).toBeTruthy();
  });

  it("lists every group, with the key the registry says", () => {
    const listed = new Map(
      (toolSection?.shortcuts ?? []).map((s) => [s.action, s.keys.join("")]),
    );
    for (const g of TOOL_GROUPS) {
      expect(listed.has(g.label), `ShortcutModal omits ${g.label}`).toBe(true);
      expect(listed.get(g.label), `ShortcutModal shows the wrong key for ${g.label}`)
        .toBe(g.shortcutKey);
    }
  });

  it("lists nothing beyond the five groups", () => {
    expect(toolSection?.shortcuts).toHaveLength(TOOL_GROUPS.length);
  });
});

// The structural guard, and the only test here that would have caught the
// ORIGINAL bug rather than its symptom. Every drift in this arc began the same
// way: a surface kept its own copy of the tool table. Today `toolGroups.ts` is
// the only module in the tree that names the five groups as string literals —
// verified 2026-08-07 — and this fails the moment that stops being true.
//
// It reads source rather than behaviour on purpose. A second copy is not a
// wrong value yet; it is a wrong value waiting for someone to edit one side.
describe("no surface keeps its own copy of the tool table", () => {
  it("only toolGroups.ts names the five group labels", async () => {
    const { readdirSync, statSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    const LABELS = TOOL_GROUPS.map((g) => g.label);
    const walk = (dir: string, out: string[] = []): string[] => {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
      }
      return out;
    };

    const offenders: string[] = [];
    for (const file of walk(join(process.cwd(), "src"))) {
      if (file.endsWith("toolGroups.ts")) continue;
      const src = readFileSync(file, "utf8");
      const found = LABELS.filter((l) => new RegExp(`["'\`]${l}["'\`]`).test(src));
      // Three or more of the five, as string literals, in one file is a copy of
      // the table. One or two is a legitimate mention (a route label, a toast).
      if (found.length >= 3) offenders.push(`${file.split("/src/")[1]} → ${found.join(", ")}`);
    }

    expect(
      offenders,
      "these files name 3+ group labels as literals — derive from TOOL_GROUPS instead:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });
});
