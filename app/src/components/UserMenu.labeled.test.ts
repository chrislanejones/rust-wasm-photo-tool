// @vitest-environment jsdom
//
// The Settings footer's sign-in (Chris, 10-05-2026): a bare person glyph was
// missed, so `labeled` draws a text "Sign in" button. Clerk is mocked as
// signed OUT — the real one cannot load in a test, and its absence would make
// <SignedOut> render nothing, which proves nothing.
import { describe, it, expect, vi, afterEach } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

vi.mock("@/lib/cloud", () => ({ CLOUD_CONFIGURED: true }));
vi.mock("@clerk/clerk-react", () => ({
  SignedIn: () => null,
  SignedOut: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  SignInButton: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
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
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

describe("UserMenu labeled (Settings footer)", () => {
  it("signed out, shows a text button that says Sign in", () => {
    const c = render(React.createElement(UserMenu, { labeled: true }));
    const btn = c.querySelector("button")!;
    expect(btn).toBeTruthy();
    expect(btn.textContent?.trim()).toBe("Sign in");
    expect(btn.getAttribute("title")).toBe("Sign in to save your work");
  });

  it("without labeled, it is still the icon button the top bar uses", () => {
    const c = render(React.createElement(UserMenu));
    const btn = c.querySelector("button")!;
    expect(btn.getAttribute("aria-label")).toBe("Sign in");
    expect(btn.textContent?.trim()).toBe("");
  });
});
