// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { setSaveFailed, useSaveStatus } from "@/lib/saveStatus";

/* Night 5 §3 — the feedback hierarchy.
 *
 *   inline → status line → toast → dialog
 *
 * The rule that matters: an error that needs action never lives ONLY in a
 * toast. A toast is gone before you look. Of the app's 23 error toasts, two
 * reported something that stays true after the toast has gone:
 *
 *   "Couldn't save canvas changes"  — the edit is unsaved until a later save
 *   "Settings sync isn't working"   — ongoing by its own words
 *
 * Both now also hold a status-bar chip that stays until the state clears.
 */

const SRC = join(__dirname, "..");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

describe("saveStatus — the one publisher for a failed save", () => {
  // Rendered the way useTabClaim.test.ts renders a hook: a real root and
  // React's own act(), rather than adding @testing-library/react for one file.
  let container: HTMLDivElement;
  let root: Root;
  let seen: boolean[];
  let renders: number;

  function Host() {
    renders++;
    seen.push(useSaveStatus().failed);
    return null;
  }

  beforeEach(async () => {
    setSaveFailed(false);
    seen = [];
    renders = 0;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(React.createElement(Host)));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("holds a failure until a later save clears it", async () => {
    await act(async () => setSaveFailed(true));
    expect(seen.at(-1)).toBe(true);
    await act(async () => setSaveFailed(false));
    expect(seen.at(-1)).toBe(false);
  });

  it("does not wake subscribers when nothing moved", async () => {
    const before = renders;
    await act(async () => setSaveFailed(false)); // already false
    expect(renders).toBe(before);
  });
});

describe("saveStatus — its REAL initial value", () => {
  it("starts clear, so a fresh session never claims a failure", async () => {
    // A fresh module instance, read before anything writes to it. The first
    // version of this test lived beside a beforeEach that called
    // setSaveFailed(false) first, so it asserted the value the reset had just
    // set — flipping the real initial value to `true` left it green. Same hole
    // as Night 4's maskEditing default, found the same way: by mutating it.
    vi.resetModules();
    const fresh = await import("@/lib/saveStatus");
    const values: boolean[] = [];
    function Probe() {
      values.push(fresh.useSaveStatus().failed);
      return null;
    }
    const el = document.createElement("div");
    document.body.appendChild(el);
    const r = createRoot(el);
    await act(async () => r.render(React.createElement(Probe)));
    expect(values[0]).toBe(false);
    await act(async () => r.unmount());
    el.remove();
  });
});

describe("the save path publishes both outcomes", () => {
  const src = read("app/session/usePersistActiveCanvas.ts");
  const catchBlock = src.slice(src.indexOf("} catch (err) {"), src.indexOf("}", src.indexOf("setSaveFailed(true)")) + 1);

  it("a failed save sets the flag, not only the toast", () => {
    expect(catchBlock).toMatch(/toast\.error\("Couldn't save canvas changes"\)/);
    expect(catchBlock).toMatch(/setSaveFailed\(true\)/);
  });

  it("a successful save clears it, so the chip never reports a stale failure", () => {
    const tryBlock = src.slice(0, src.indexOf("} catch (err) {"));
    expect(tryBlock).toMatch(/setSaveFailed\(false\)/);
  });
});

describe("the status bar carries both errors", () => {
  const bar = read("components/StatusBar/StatusBar.tsx");

  it("reads the save publisher", () => {
    expect(bar).toMatch(/useSaveStatus\(\)\.failed/);
    expect(bar).toMatch(/data-testid="status-save-failed"/);
  });

  it("reads the SAME sync publisher the toast reads, not a copy", () => {
    // SyncErrorToast reads useSyncStatus(); so must the chip, or the two could
    // disagree about whether sync is broken.
    expect(read("lib/sync/SyncErrorToast.tsx")).toMatch(/useSyncStatus\(\)/);
    expect(bar).toMatch(/useSyncStatus\(\)\.state === "error"/);
    expect(bar).toMatch(/data-testid="status-sync-failed"/);
  });

  it("announces both — a status line nobody can hear is still a toast to a screen reader", () => {
    const save = bar.slice(bar.indexOf('data-testid="status-save-failed"') - 200, bar.indexOf('data-testid="status-save-failed"') + 60);
    const sync = bar.slice(bar.indexOf('data-testid="status-sync-failed"') - 200, bar.indexOf('data-testid="status-sync-failed"') + 60);
    expect(save).toMatch(/role="status"/);
    expect(sync).toMatch(/role="status"/);
  });
});

describe("no user is told to open DevTools", () => {
  it("'Check the console' appears in no user-facing message", () => {
    // Six messages said it — three toasts and three inline errors. A person
    // using a photo editor cannot act on it; the console.error beside each one
    // already logs for the developer.
    const files = [
      "features/tools/settings/AIRenamePanel.tsx",
      "features/tools/settings/BatchSettings.tsx",
    ];
    for (const f of files) expect(read(f)).not.toMatch(/Check the console/);
  });
});
