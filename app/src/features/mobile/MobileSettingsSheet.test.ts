// @vitest-environment jsdom
//
// The phone's Settings sheet commits on Apply — the sync switch included.
//
// 09-22, on a real phone: the switch committed on tap while everything else in
// the sheet waited for Apply, so tapping Sync on / Sync off left Apply grayed
// out and read as "nothing happened". The switch is a draft now, like theme
// and motion: a tap lights Apply, Apply commits it, Cancel throws it away.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// SyncPane reads auth and holds the Forget mutation. Signed out is enough
// here: the switch shows either way, and nothing in this test talks to a server.
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }),
  useMutation: () => vi.fn(),
}));

const ENABLED_KEY = "image-horse-sync-enabled";

let container: HTMLDivElement;
let root: Root;
let onOpenChange: ReturnType<typeof vi.fn>;

async function render(): Promise<void> {
  // The pane hides the switch in a build with no cloud half, and "disabled" is
  // the status store's initial value until the app's sync layer (not mounted
  // here) reports. A keyed build reports straight away; so does this.
  const { setSyncStatus } = await import("@/lib/sync/status");
  setSyncStatus({ state: "local" });
  const { MobileSettingsSheet } = await import("./MobileSettingsSheet");
  onOpenChange = vi.fn();
  act(() => {
    root.render(React.createElement(MobileSettingsSheet, { open: true, onOpenChange }));
  });
}

/** The sheet portals into document.body, so search there, not the container. */
function button(label: string): HTMLButtonElement {
  const btn = [...document.body.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === label,
  );
  if (!btn) throw new Error(`"${label}" button not rendered`);
  return btn as HTMLButtonElement;
}

function click(label: string): void {
  act(() => button(label).click());
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  // framer-motion and the theme code ask for media queries jsdom lacks.
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("the phone's sync switch", () => {
  it("lights Apply when tapped, and changes nothing until Apply is pressed", async () => {
    await render();
    expect(button("Apply").disabled, "nothing drafted yet").toBe(true);

    click("Sync off");

    expect(button("Apply").disabled, "a tap is a change worth applying").toBe(false);
    expect(localStorage.getItem(ENABLED_KEY), "still on until Apply").toBeNull();
    expect(document.body.textContent).toContain("Press Apply to turn sync off.");

    click("Apply");

    expect(localStorage.getItem(ENABLED_KEY)).toBe("off");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("is thrown away by Cancel", async () => {
    await render();
    click("Sync off");
    click("Cancel");

    expect(localStorage.getItem(ENABLED_KEY)).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("tapping back to what the device already has is no change", async () => {
    await render();
    click("Sync off");
    click("Sync on");

    expect(button("Apply").disabled).toBe(true);
    expect(document.body.textContent).not.toContain("Press Apply");
  });

  it("turns sync back on from off", async () => {
    localStorage.setItem(ENABLED_KEY, "off");
    await render();

    click("Sync on");
    expect(localStorage.getItem(ENABLED_KEY), "still off until Apply").toBe("off");
    click("Apply");

    expect(localStorage.getItem(ENABLED_KEY)).toBeNull();
  });
});
