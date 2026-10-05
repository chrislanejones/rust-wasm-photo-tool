// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SecurityPane } from "./SecurityPane";
import { NETWORK_PATHS, SWITCHED_PATHS, UNSWITCHED_PATHS } from "@/lib/networkPaths";
import { LIVE_SUB_TOOLS } from "@/features/tools/toolGroups";

/* Settings › Security renders the network registry — every path, in the right
 * list, and nothing hand-written beside it.
 *
 * This is what makes #223 unrepeatable. That bug was a switch gating a list
 * this page did not show; now the page and the switch read one array, so a
 * path cannot be gated without being listed, or listed without being gated.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const noop = () => {};

function render(): void {
  act(() => {
    root.render(
      React.createElement(SecurityPane, {
        value: true,
        onChange: noop,
        stripMode: "all",
        onStripModeChange: noop,
        onlineFeatures: false,
        onOnlineFeaturesChange: noop,
        onlineFeaturesLocked: false,
      }),
    );
  });
}

const items = (testid: string) =>
  [...container.querySelectorAll(`[data-testid="${testid}"] > li`)] as HTMLLIElement[];

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("Security renders the network registry", () => {
  it("every switched path appears under 'What on turns on'", () => {
    render();
    const got = new Set(items("security-switched").map((li) => li.dataset.path));
    for (const p of SWITCHED_PATHS) expect(got.has(p.id), p.id).toBe(true);
  });

  it("the AI tools entry is spelled out as its sub-tools, by name", () => {
    render();
    const ai = items("security-switched").filter((li) => li.dataset.path === "ai_processing");
    const network = LIVE_SUB_TOOLS.filter((r) => r.subTool.requiresNetwork);
    expect(ai.length).toBe(network.length);
    for (const { subTool } of network) {
      expect(ai.some((li) => li.textContent?.includes(subTool.label)), subTool.label).toBe(true);
    }
  });

  it("every unswitched path appears under 'What it does not cover'", () => {
    render();
    const got = new Set(items("security-unswitched").map((li) => li.dataset.path));
    for (const p of UNSWITCHED_PATHS) expect(got.has(p.id), p.id).toBe(true);
  });

  it("no path is in both lists, and none is missing from both", () => {
    render();
    const on = items("security-switched").map((li) => li.dataset.path);
    const off = items("security-unswitched").map((li) => li.dataset.path);
    for (const p of NETWORK_PATHS) {
      const where = [on.includes(p.id), off.includes(p.id)];
      expect(where.filter(Boolean).length, p.id).toBe(1);
    }
  });

  it("share links are listed under what the switch turns on (QC F2)", () => {
    // A share link uploads a flattened photo. Since QC F2 (#234) it obeys the
    // switch, so it belongs in the switched list and not the unswitched one.
    render();
    expect(items("security-switched").some((li) => li.dataset.path === "share_links")).toBe(true);
    expect(items("security-unswitched").some((li) => li.dataset.path === "share_links")).toBe(false);
  });

  it("the headline makes no share-link exception any more", () => {
    // Before QC F2 a share link ignored the switch and the headline named that
    // exception. Share links obey the switch now, so the exception is gone.
    render();
    expect(container.textContent).toMatch(/your photos stay in this tab\./);
    expect(container.textContent).not.toMatch(/unless you make\s+a share link/);
  });
});
