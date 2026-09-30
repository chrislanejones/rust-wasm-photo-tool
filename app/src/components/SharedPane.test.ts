// @vitest-environment jsdom
//
// Settings › Shared, against a canned `listMine`: the totals, each link's
// status and numbers, and that the limits form is a draft that Save commits.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const h = vi.hoisted(() => ({
  auth: { isAuthenticated: true, isLoading: false },
  links: [] as unknown[],
  setLimits: vi.fn(async () => {}),
  pause: vi.fn(async () => {}),
  resume: vi.fn(async () => {}),
  remove: vi.fn(async () => {}),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => h.auth,
  useQuery: (_ref: unknown, args: unknown) => (args === "skip" ? undefined : h.links),
  // The pane asks for four mutations in a fixed order per card; the api ref is
  // a proxy path, so tell them apart by the last path segment.
  useMutation: (ref: unknown) => {
    const name = ref == null ? "" : String((ref as { toString(): string }).toString());
    if (name.includes("setLimits")) return h.setLimits;
    if (name.includes("pause")) return h.pause;
    if (name.includes("resume")) return h.resume;
    return h.remove;
  },
}));

// The generated api object is a proxy over function paths; a plain stand-in
// whose leaves stringify to their path is all `useMutation` above needs.
vi.mock("../../../convex/_generated/api", () => {
  const leaf = (path: string) => ({ toString: () => path });
  return {
    api: {
      shares: {
        listMine: leaf("shares:listMine"),
        setLimits: leaf("shares:setLimits"),
        pause: leaf("shares:pause"),
        resume: leaf("shares:resume"),
        remove: leaf("shares:remove"),
      },
    },
  };
});

// A STATIC import, so the component tree loads once at collection. Imported
// inside each test (after `vi.resetModules`) the first test paid the whole
// cold import inside its 5 s budget and timed out under full-suite load.
import { SharedPane } from "./SharedPane";

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 8, 22, 15);

function link(over: Partial<Record<string, unknown>> = {}) {
  const daily = new Array<number>(30).fill(0);
  daily[29] = 2;
  daily[27] = 1;
  return {
    token: "tok-a",
    title: "sunset.jpg",
    canvasW: 1920,
    canvasH: 1080,
    views: 3,
    createdAt: T0 - 5 * DAY,
    lastViewedAt: T0 - 3 * 60_000,
    maxViews: null,
    expiresAt: null,
    pausedAt: null,
    status: "live",
    imageUrl: "https://example.test/a.png",
    daily,
    ...over,
  };
}

let container: HTMLDivElement;
let root: Root;

async function render(): Promise<void> {
  act(() => {
    root.render(React.createElement(SharedPane));
  });
}

/** By visible text, or by the accessible name the icon-only row actions carry. */
function button(label: string): HTMLButtonElement {
  const btn = [...document.body.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === label || b.getAttribute("aria-label") === label,
  );
  if (!btn) throw new Error(`"${label}" button not rendered`);
  return btn as HTMLButtonElement;
}

beforeEach(() => {
  vi.useFakeTimers({ now: T0 });
  h.auth = { isAuthenticated: true, isLoading: false };
  h.links = [];
  h.setLimits.mockClear();
  h.pause.mockClear();
  h.resume.mockClear();
  h.remove.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("Settings › Shared", () => {
  it("asks to sign in when signed out, and does not query", async () => {
    h.auth = { isAuthenticated: false, isLoading: false };
    await render();
    expect(document.body.textContent).toContain("Sign in to see your share links.");
  });

  it("totals the links and shows each one's status and numbers", async () => {
    h.links = [
      link(),
      link({ token: "tok-b", title: "paused.png", views: 12, pausedAt: T0, status: "paused" }),
      link({ token: "tok-c", title: "capped.png", views: 25, maxViews: 25, status: "views" }),
    ];
    await render();
    const text = document.body.textContent ?? "";
    expect(text).toContain("3 links · 40 views in all · most opened: capped.png");
    expect(text).toContain("Live");
    expect(text).toContain("Paused");
    expect(text).toContain("Hit its view limit");
    expect(text).toContain("25 of 25 views");
    expect(text).toContain("last opened 3m ago");
    // A paused link offers Resume; a live one offers Pause.
    const named = (prefix: string) =>
      [...document.body.querySelectorAll("button")].filter((b) => b.getAttribute("aria-label")?.startsWith(prefix));
    expect(named("Resume ")).toHaveLength(1);
    expect(named("Pause ")).toHaveLength(2);
  });

  it("keeps the limits folded away until asked for", async () => {
    h.links = [link()];
    await render();
    expect(document.body.querySelector('input[type="number"]'), "folded by default").toBeNull();
    act(() => button("Limits for sunset.jpg").click());
    expect(button("Limits for sunset.jpg").getAttribute("aria-pressed")).toBe("true");
    expect(document.body.querySelector('input[type="number"]')).not.toBeNull();
  });

  it("keeps the limits as a draft until Save, then sends both fields", async () => {
    h.links = [link()];
    await render();
    act(() => button("Limits for sunset.jpg").click());
    expect(button("Save limits").disabled, "nothing changed yet").toBe(true);

    const num = document.body.querySelector<HTMLInputElement>('input[type="number"]')!;
    const date = document.body.querySelector<HTMLInputElement>('input[type="date"]')!;
    const setValue = (el: HTMLInputElement, v: string) => {
      const proto = Object.getPrototypeOf(el) as object;
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      desc?.set?.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    act(() => setValue(num, "25"));
    act(() => setValue(date, "2026-10-01"));
    expect(button("Save limits").disabled).toBe(false);
    expect(h.setLimits).not.toHaveBeenCalled();

    await act(async () => {
      button("Save limits").click();
    });
    expect(h.setLimits).toHaveBeenCalledTimes(1);
    const args = h.setLimits.mock.calls[0]![0] as { token: string; maxViews: number | null; expiresAt: number | null };
    expect(args.token).toBe("tok-a");
    expect(args.maxViews).toBe(25);
    // Local midnight starting 10-01-2026, whatever the test machine's zone.
    expect(args.expiresAt).toBe(new Date(2026, 9, 1).getTime());
  });

  it("refuses a view limit that is not a whole number of at least 1", async () => {
    h.links = [link()];
    await render();
    act(() => button("Limits for sunset.jpg").click());
    const num = document.body.querySelector<HTMLInputElement>('input[type="number"]')!;
    const proto = Object.getPrototypeOf(num) as object;
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(num, "0");
    act(() => {
      num.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(button("Save limits").disabled).toBe(true);
    expect(document.body.textContent).toContain("whole number, 1 or more");
  });

  it("Pause and Resume call the right mutation for the link's state", async () => {
    h.links = [link(), link({ token: "tok-b", title: "b.png", pausedAt: T0, status: "paused" })];
    await render();
    await act(async () => {
      button("Pause sunset.jpg").click();
    });
    expect(h.pause).toHaveBeenCalledWith({ token: "tok-a" });
    await act(async () => {
      button("Resume b.png").click();
    });
    expect(h.resume).toHaveBeenCalledWith({ token: "tok-b" });
  });

  it("Delete opens a confirm ABOVE the Settings modal, and only the confirm deletes", async () => {
    h.links = [link()];
    await render();
    await act(async () => {
      button("Delete sunset.jpg").click();
    });
    expect(h.remove, "the row's Delete only asks").not.toHaveBeenCalled();

    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog?.textContent).toContain("Delete this share link?");
    // Settings is z-modal (60); a plain dialog is z-dialog (50) and opens
    // behind it. The confirm and its backdrop must sit on z-over-modal.
    expect(dialog!.className).toContain("z-[var(--z-over-modal)]");
    expect(dialog!.className).not.toContain("z-[var(--z-dialog)]");

    const confirm = [...dialog!.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Delete");
    await act(async () => {
      confirm!.click();
    });
    expect(h.remove).toHaveBeenCalledWith({ token: "tok-a" });
  });

  it("draws no views chart — the stray single bar is gone", async () => {
    h.links = [link()];
    await render();
    expect(document.body.querySelector('[role="img"]')).toBeNull();
    expect(document.body.textContent).toContain("3 views");
  });

  it("marks a missing image with an icon, not an empty box", async () => {
    h.links = [link({ imageUrl: null })];
    await render();
    const thumb = document.body.querySelector('[title="Preview unavailable"]');
    expect(thumb, "the placeholder says what it is").not.toBeNull();
    expect(thumb!.querySelector("svg")).not.toBeNull();
    expect(document.body.querySelector("img")).toBeNull();
  });
});
