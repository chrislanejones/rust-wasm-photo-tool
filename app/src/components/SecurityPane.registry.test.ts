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

  it("share links are disclosed as NOT covered by the switch", () => {
    // The one that matters most: a share link uploads a flattened photo, and
    // until QC F2 lands it ignores the switch. The page must say so.
    render();
    const off = items("security-unswitched").find((li) => li.dataset.path === "share_links");
    expect(off).toBeTruthy();
    expect(off?.textContent).toMatch(/signed in/i);
  });

  it("the headline no longer promises photos 'never leave this tab'", () => {
    // It was false: a share link ignores the switch. It now names the exception.
    render();
    expect(container.textContent).not.toContain("never leave this tab");
    expect(container.textContent).toMatch(/unless you make\s+a share link/);
  });
});
