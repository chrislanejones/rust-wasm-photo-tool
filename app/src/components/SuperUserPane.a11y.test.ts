// @vitest-environment jsdom
//
// Super User's rungs above your entitlement are shown and disabled
// (constitution rule 5). The reason sits in the line under the group; Night 2
// ties it to the group with aria-describedby, so a screen reader hears WHY the
// Paid rung is off when it reaches the group, not only a disabled radio.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SuperUserPane } from "./SuperUserPane";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("Super User rung group", () => {
  it("is a named radio group, the rung above the entitlement is disabled, and the reason describes the group", () => {
    act(() =>
      root.render(
        React.createElement(SuperUserPane, {
          mode: "loggedIn",
          overridden: false,
          onSelect: () => {},
          onReset: () => {},
          entitlement: "free",
        }),
      ),
    );
    const group = container.querySelector('[role="radiogroup"]');
    expect(group).not.toBeNull();
    const name = document.getElementById(group!.getAttribute("aria-labelledby") ?? "");
    expect(name?.textContent).toBe("Super User");
    const why = document.getElementById(group!.getAttribute("aria-describedby") ?? "");
    expect(why?.textContent).toMatch(/look down the ladder, never up/);

    const rungs = [...group!.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    expect(rungs.map((r) => [r.textContent?.trim(), r.getAttribute("aria-checked"), r.disabled])).toEqual([
      ["No Login", "false", false],
      ["Logged In", "true", false],
      ["Paid", "false", true],
    ]);
  });
});
