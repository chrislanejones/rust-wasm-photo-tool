// @vitest-environment jsdom
// The save-status publisher: a failed canvas save and a failed cloud backup
// are separate facts, each cleared by its own next success (Plan C §3).
import { describe, it, expect, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { setBackupFailed, setSaveFailed, useSaveStatus } from "./saveStatus";

afterEach(() => {
  setSaveFailed(false);
  setBackupFailed(false);
});

describe("save status", () => {
  it("a backup failure does not claim the canvas save failed, and vice versa", () => {
    setBackupFailed(true);
    let { result } = renderHook(() => useSaveStatus());
    expect(result.current).toEqual({ failed: false, backupFailed: true });

    setSaveFailed(true);
    ({ result } = renderHook(() => useSaveStatus()));
    expect(result.current).toEqual({ failed: true, backupFailed: true });
  });

  it("the next successful backup clears it", () => {
    setBackupFailed(true);
    setBackupFailed(false);
    const { result } = renderHook(() => useSaveStatus());
    expect(result.current.backupFailed).toBe(false);
  });
});
