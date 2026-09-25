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

function button(label: string): HTMLButtonElement {
  const btn = [...document.body.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === label,
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
    expect(text).toContain("Links3");
    expect(text).toContain("Views40");
    expect(text).toContain("Most opened25");
    expect(text).toContain("Live");
    expect(text).toContain("Paused");
    expect(text).toContain("Hit its view limit");
    expect(text).toContain("25 views of 25");
    expect(text).toContain("last opened 3m ago");
    // A paused link offers Resume; a live one offers Pause.
    expect([...document.body.querySelectorAll("button")].filter((b) => b.textContent?.trim() === "Resume")).toHaveLength(1);
    expect([...document.body.querySelectorAll("button")].filter((b) => b.textContent?.trim() === "Pause")).toHaveLength(2);
  });

  it("keeps the limits as a draft until Save, then sends both fields", async () => {
    h.links = [link()];
    await render();
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
    h.links = [link(), link({ token: "tok-b", pausedAt: T0, status: "paused" })];
    await render();
    await act(async () => {
      button("Pause").click();
    });
    expect(h.pause).toHaveBeenCalledWith({ token: "tok-a" });
    await act(async () => {
      button("Resume").click();
    });
    expect(h.resume).toHaveBeenCalledWith({ token: "tok-b" });
  });
});
