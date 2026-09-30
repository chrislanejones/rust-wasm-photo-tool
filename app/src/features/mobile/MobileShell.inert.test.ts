// @vitest-environment jsdom
//
// The phone's layer makes the editor underneath INERT (UI Night 6 §6).
//
// Measured 09-28 at 390px: once a photo was added, the desktop editor's chrome
// mounted under this opaque layer, and Tab walked from "Add Images" into 27
// controls nobody could see. The editor stays mounted on purpose (a widened
// window resumes into live state), so the fix is `inert` on its container —
// out of the tab order and the accessibility tree, still running.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Neighbors that reach for auth, storage or the sync pane — not what is under
// test, and each would need a backend to render.
vi.mock("@/components/UserMenu", () => ({ UserMenu: () => null }));
vi.mock("@/features/mobile/MobileSettingsSheet", () => ({ MobileSettingsSheet: () => null }));
vi.mock("@/lib/dexie/originalsAdapter", () => ({
  getOriginal: vi.fn(async () => null),
  getOriginalAsBlobUrl: vi.fn(async () => null),
}));

import { MobileShell } from "./MobileShell";

let appShell: HTMLDivElement;
let editorButton: HTMLButtonElement;
let host: HTMLDivElement;
let root: Root;

function mount(): void {
  act(() => {
    root.render(
      React.createElement(MobileShell, {
        photos: [],
        maxPhotos: 12,
        booting: false,
        onAddFiles: () => {},
        onRequestDelete: () => {},
      }),
    );
  });
}

beforeEach(() => {
  // The real layout: the editor lives in .app-shell, and the phone layer is
  // rendered from INSIDE it. Here that is modelled directly.
  appShell = document.createElement("div");
  appShell.className = "app-shell";
  editorButton = document.createElement("button");
  editorButton.textContent = "Apply Compression & Resize";
  appShell.appendChild(editorButton);
  host = document.createElement("div");
  appShell.appendChild(host);
  document.body.appendChild(appShell);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  appShell.remove();
});

describe("MobileShell makes the covered editor inert", () => {
  it("the editor's container is inert while the phone layer is up", () => {
    expect(appShell.hasAttribute("inert")).toBe(false);
    mount();
    expect(appShell.hasAttribute("inert")).toBe(true);
  });

  it("…and stops being inert when the layer goes (window widened)", () => {
    mount();
    act(() => root.unmount());
    expect(appShell.hasAttribute("inert")).toBe(false);
    root = createRoot(host); // afterEach unmounts again; give it a fresh root
  });

  it("the phone layer is NOT inside the inert container — it portals to <body>", () => {
    // Otherwise inerting .app-shell would switch off the phone layer too.
    mount();
    const layer = document.body.querySelector(".fixed.inset-0");
    expect(layer).not.toBeNull();
    expect(appShell.contains(layer)).toBe(false);
    expect(layer!.closest("[inert]")).toBeNull();
  });

  it("the editor is still MOUNTED — covered and inert, not removed", () => {
    // Keeping it running is the design: a widened window resumes into it.
    mount();
    expect(document.body.contains(editorButton)).toBe(true);
    expect(editorButton.closest("[inert]")).toBe(appShell);
  });

  it("does not clear an inert something else had already set", () => {
    appShell.setAttribute("inert", "");
    mount();
    act(() => root.unmount());
    expect(appShell.hasAttribute("inert")).toBe(true);
    root = createRoot(host);
  });
});
