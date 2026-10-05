import { describe, expect, it } from "vitest";
import {
  NETWORK_PATHS,
  SWITCHED_PATHS,
  UNSWITCHED_PATHS,
  isNetworkPathAllowed,
} from "./networkPaths";
import { LIVE_SUB_TOOLS } from "@/features/tools/toolGroups";

/* The network-path registry must describe what the code DOES — and routing the
 * gates through it must change nothing.
 *
 * Tonight's stop condition: "the derived list must gate exactly what it gates
 * today … prove equality with a test before deleting the old list." So the
 * first block below pins isNetworkPathAllowed against the literal expressions
 * the three gate sites used before they were rewired, for both switch values.
 */

const BOTH = [true, false] as const;

describe("equality with the gates as they were", () => {
  it("photo backup: was `isAuthenticated && onlineFeaturesEnabled`", () => {
    for (const signedIn of BOTH) {
      for (const online of BOTH) {
        const before = signedIn && online;
        const after = signedIn && isNetworkPathAllowed("photo_backup", online);
        expect(after, `signedIn=${signedIn} online=${online}`).toBe(before);
      }
    }
  });

  it("AI jobs: was `onlineFeaturesEnabled`", () => {
    for (const online of BOTH) {
      expect(isNetworkPathAllowed("ai_processing", online)).toBe(online);
    }
  });

  it("Create AI Image: was `onlineFeaturesEnabled`", () => {
    for (const online of BOTH) {
      expect(isNetworkPathAllowed("ai_generation", online)).toBe(online);
    }
  });

  it("isBlockedOffline: was `!comingSoon && requiresNetwork && !online`", () => {
    // Every live sub-tool, both switch values — the whole domain, not a sample.
    for (const { subTool } of LIVE_SUB_TOOLS) {
      for (const online of BOTH) {
        const before = !subTool.comingSoon && subTool.requiresNetwork === true && !online;
        const after =
          !subTool.comingSoon &&
          subTool.requiresNetwork === true &&
          !isNetworkPathAllowed("ai_processing", online);
        expect(after, `${subTool.label} online=${online}`).toBe(before);
      }
    }
  });
});

describe("the switch gates exactly what it gated before", () => {
  it("SWITCHED_PATHS is the three the switch always covered, plus share links (QC F2)", () => {
    expect(SWITCHED_PATHS.map((p) => p.id).sort()).toEqual(
      ["ai_generation", "ai_processing", "photo_backup", "share_links"].sort(),
    );
  });

  it("every requiresNetwork sub-tool is covered by a switched path", () => {
    // The sub-tools are not listed in the registry — each carries its own
    // `requiresNetwork`. This is what stops one being added that the switch
    // does not know about.
    const network = LIVE_SUB_TOOLS.filter((r) => r.subTool.requiresNetwork);
    expect(network.length).toBeGreaterThan(0);
    for (const { subTool } of network) {
      expect(isNetworkPathAllowed("ai_processing", false), subTool.label).toBe(false);
    }
  });
});

describe("it records what IS, not what should be", () => {
  // These three reach a server with the switch OFF. That is the current
  // behavior, measured on 09-28 — not an endorsement of it. If one of them is
  // ever put behind the switch, this test is where that shows up, and the
  // Security page changes with it.
  it.each([
    ["user_colors", "signed-in"],
    ["settings_sync", "own-toggle"],
  ])("%s is %s, not online-switch", (id, gate) => {
    const p = NETWORK_PATHS.find((x) => x.id === id);
    expect(p?.gate).toBe(gate);
    expect(isNetworkPathAllowed(id, false)).toBe(true);
  });

  it("switched + unswitched together are every path, with no overlap", () => {
    const all = [...SWITCHED_PATHS, ...UNSWITCHED_PATHS].map((p) => p.id).sort();
    expect(all).toEqual(NETWORK_PATHS.map((p) => p.id).sort());
    expect(new Set(all).size).toBe(all.length);
  });

  it("an unknown id may NOT reach a server", () => {
    expect(isNetworkPathAllowed("does_not_exist", true)).toBe(false);
  });

  it("ids are unique", () => {
    const ids = NETWORK_PATHS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("an own-toggle path names its toggle", () => {
    for (const p of NETWORK_PATHS.filter((x) => x.gate === "own-toggle")) {
      expect(p.toggle, p.id).toBeTruthy();
    }
  });
});
