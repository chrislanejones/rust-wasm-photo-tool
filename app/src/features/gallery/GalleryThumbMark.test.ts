// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { GalleryThumbMark } from "./GalleryThumbMark";
import type { GalleryPhotoState, GalleryViewer } from "@/lib/galleryMark";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PAID: GalleryViewer = { signedIn: true, paid: true, cloudAllowed: true };
let container: HTMLDivElement;
let root: Root;

function render(state: GalleryPhotoState, onResolve?: (c: string) => void) {
  act(() => {
    root.render(
      React.createElement(GalleryThumbMark, {
        state,
        viewer: PAID,
        onResolveConflict: onResolve as never,
      }),
    );
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("GalleryThumbMark", () => {
  it("renders NOTHING for a local-only photo", () => {
    render({});
    expect(container.innerHTML).toBe("");
  });

  it("renders exactly one mark when several states are true", () => {
    render({ uploadFailed: true, conflict: true, backedUp: true });
    expect(container.querySelectorAll("[data-mark]").length).toBe(1);
    expect(container.querySelector("[data-mark]")?.getAttribute("data-mark")).toBe("failed");
  });

  it("every plain mark carries its accessible name", () => {
    render({ backedUp: true });
    const el = container.querySelector('[role="img"]');
    expect(el?.getAttribute("aria-label")).toBe("Backed up");
  });

  it("changed-elsewhere shows the dot; a plain upload does not", () => {
    render({ changedElsewhere: true });
    expect(container.querySelector(".rounded-full.bg-theme-primary")).not.toBeNull();
    render({ uploading: true });
    expect(container.querySelector(".rounded-full.bg-theme-primary")).toBeNull();
  });

  it("conflict is a button that opens a three-choice menu", () => {
    const picked: string[] = [];
    render({ conflict: true }, (c) => picked.push(c));
    const btn = container.querySelector("button[aria-haspopup='menu']") as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    act(() => btn.click());
    const items = [...container.querySelectorAll('[role="menuitem"]')] as HTMLButtonElement[];
    expect(items.map((i) => i.textContent)).toEqual([
      "Keep this one",
      "Use the other version",
      "Keep both",
    ]);
    act(() => items[2].click());
    expect(picked).toEqual(["keepBoth"]);
    // Choosing closes the menu.
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });

  it("unwired (no handler): the menu reads, but its choices are disabled", () => {
    render({ conflict: true });
    act(() => (container.querySelector("button[aria-haspopup='menu']") as HTMLButtonElement).click());
    const items = [...container.querySelectorAll('[role="menuitem"]')] as HTMLButtonElement[];
    expect(items.length).toBe(3);
    expect(items.every((i) => i.disabled)).toBe(true);
  });

  it("Escape closes the conflict menu", () => {
    render({ conflict: true }, () => {});
    act(() => (container.querySelector("button[aria-haspopup='menu']") as HTMLButtonElement).click());
    const menu = container.querySelector('[role="menu"]') as HTMLElement;
    act(() => menu.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });
});
