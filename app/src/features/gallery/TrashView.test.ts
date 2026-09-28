// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { TrashView, type TrashItem } from "./TrashView";
import { removesIn, TRASH_WINDOW_DAYS } from "@/lib/trash";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 28, 12);
let container: HTMLDivElement;
let root: Root;

const ITEMS: TrashItem[] = [
  { id: "a", name: "beach.jpg", bytes: 3e6, deletedAt: NOW - 2 * DAY },
  { id: "b", name: "car.png", bytes: 5e6, deletedAt: NOW - 6.5 * DAY },
];
const QUOTA = { usedBytes: 2e9, trashBytes: 8e6, limitBytes: 5e9 };

function render(props: Partial<React.ComponentProps<typeof TrashView>> = {}) {
  act(() => {
    root.render(
      React.createElement(TrashView, {
        items: ITEMS,
        paid: false,
        now: NOW,
        quota: QUOTA,
        signedIn: true,
        ...props,
      }),
    );
  });
}
const text = () => document.body.textContent ?? "";
const btn = (label: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === label) as
    | HTMLButtonElement
    | undefined;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("removesIn — relative, never a date", () => {
  it("free is a 7-day window, paid 30", () => {
    expect(TRASH_WINDOW_DAYS).toEqual({ free: 7, paid: 30 });
    expect(removesIn(NOW, false, NOW)).toBe("Removes in 7 days");
    expect(removesIn(NOW, true, NOW)).toBe("Removes in 30 days");
  });

  it("rounds UP — twenty hours left is 'tomorrow', not 'in 0 days'", () => {
    const deletedAt = NOW - 6 * DAY - 4 * 3_600_000; // 20h before the 7-day line
    expect(removesIn(deletedAt, false, NOW)).toBe("Removes tomorrow");
  });

  it("past its time is still 'today' — the purge has not run yet", () => {
    expect(removesIn(NOW - 30 * DAY, false, NOW)).toBe("Removes today");
  });
});

describe("TrashView", () => {
  it("each item shows its name and how long is left", () => {
    render();
    expect(text()).toContain("beach.jpg");
    expect(text()).toContain("Removes in 5 days");
    expect(text()).toContain("car.png");
    expect(text()).toContain("Removes tomorrow");
  });

  it("paid gets the longer window in the SAME view", () => {
    render({ paid: true });
    expect(text()).toContain("Removes in 28 days");
  });

  it("the quota gauge sits at the top, trash counted", () => {
    render();
    const gauge = container.querySelector('[data-slot="quota-gauge"]');
    const heading = container.querySelector("#trash-heading");
    expect(gauge).not.toBeNull();
    // Document order: gauge before the Trash heading.
    expect(gauge!.compareDocumentPosition(heading!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(text()).toContain("counts toward this");
  });

  it("Restore and Delete now call back with the item id", () => {
    const restored: string[] = [];
    const deleted: string[] = [];
    render({ onRestore: (id) => restored.push(id), onDeleteNow: (id) => deleted.push(id) });
    act(() => (document.querySelector('[aria-label="Restore beach.jpg"]') as HTMLButtonElement).click());
    act(() => (document.querySelector('[aria-label="Delete car.png now"]') as HTMLButtonElement).click());
    expect(restored).toEqual(["a"]);
    expect(deleted).toEqual(["b"]);
  });

  it("Empty trash goes through a ConfirmDialog — it never empties on the first click", () => {
    let emptied = 0;
    render({ onEmpty: () => emptied++ });
    act(() => btn("Empty trash")!.click());
    expect(emptied).toBe(0); // first click only asks
    expect(text()).toContain("Empty the trash?");
    expect(text()).toContain("cannot be undone");
    // The dialog's own confirm button.
    const confirms = [...document.querySelectorAll("button")].filter(
      (b) => b.textContent?.trim() === "Empty trash",
    );
    act(() => confirms[confirms.length - 1].click());
    expect(emptied).toBe(1);
  });

  it("unwired: with no callbacks the actions are disabled, not dead", () => {
    render();
    expect(btn("Empty trash")!.disabled).toBe(true);
    expect((document.querySelector('[aria-label="Restore beach.jpg"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it("an empty trash says so, and cannot be emptied", () => {
    render({ items: [], onEmpty: () => {} });
    expect(text()).toContain("Trash is empty.");
    expect(btn("Empty trash")!.disabled).toBe(true);
  });
});
