// @vitest-environment jsdom
//
// While Clerk loads, neither <SignedIn> nor <SignedOut> renders. The slot used
// to be empty, so the avatar / Sign-in button popped into the bar and shoved
// its neighbors. It now reserves the arriving control's footprint at once and
// only paints the grey shape after the 300 ms grace.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const { clerk, pass } = vi.hoisted(() => ({
  clerk: { loaded: false },
  // Children only; React is read at call time, after the imports resolve.
  pass: ({ children }: { children: unknown }) => children as never,
}));

vi.mock("@/lib/cloud", () => ({ CLOUD_CONFIGURED: true }));
vi.mock("@clerk/clerk-react", () => ({
  ClerkLoading: (p: { children: React.ReactNode }) => (clerk.loaded ? null : pass(p)),
  SignedIn: () => null,
  SignedOut: (p: { children: React.ReactNode }) => (clerk.loaded ? pass(p) : null),
  SignInButton: pass,
  UserButton: () => null,
}));

import { UserMenu } from "./UserMenu";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
function render(el: React.ReactElement): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(el));
  return container;
}
const skeleton = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-testid="auth-slot-skeleton"]');

beforeEach(() => {
  vi.useFakeTimers();
  clerk.loaded = false;
});
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("UserMenu while Clerk loads", () => {
  it("reserves the slot at once but paints nothing during the grace", () => {
    const c = render(React.createElement(UserMenu));
    const s = skeleton(c)!;
    expect(s).toBeTruthy();
    expect(s.className).toContain("invisible");
    expect(s.className).toContain("h-8 w-8");
    expect(s.getAttribute("aria-hidden")).toBe("true");
  });

  it("shows the grey shape once loading outlasts 300 ms", () => {
    const c = render(React.createElement(UserMenu));
    act(() => vi.advanceTimersByTime(299));
    expect(skeleton(c)!.className).toContain("invisible");
    act(() => vi.advanceTimersByTime(1));
    expect(skeleton(c)!.className).not.toContain("invisible");
    expect(skeleton(c)!.dataset.shown).toBe("true");
  });

  it.each([
    [{ labeled: true }, "w-[92px]"],
    [{ large: true }, "h-16 w-16"],
    [{ grouped: true }, "h-9 w-9"],
  ])("sizes the slot to what arrives: %o", (props, cls) => {
    const c = render(React.createElement(UserMenu, props));
    expect(skeleton(c)!.className).toContain(cls);
  });

  it("is replaced by the real control once Clerk answers", () => {
    const c = render(React.createElement(UserMenu));
    expect(c.querySelector("button")).toBeNull();
    clerk.loaded = true;
    act(() => root!.render(React.createElement(UserMenu, { grouped: true })));
    expect(skeleton(c)).toBeNull();
    expect(c.querySelector("button")!.getAttribute("aria-label")).toBe("Sign in");
  });
});
