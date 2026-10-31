import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOWNLOAD_URL_LIFETIME_MS, revokeObjectUrlLater } from "./revokeObjectUrlLater";

describe("revokeObjectUrlLater", () => {
  const revoke = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    revoke.mockClear();
    vi.stubGlobal("URL", { ...URL, revokeObjectURL: revoke });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not revoke on the click's own tick", () => {
    revokeObjectUrlLater("blob:download");
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);
    expect(revoke).not.toHaveBeenCalled();
  });

  it("revokes exactly once, after the download lifetime", () => {
    revokeObjectUrlLater("blob:download");
    vi.advanceTimersByTime(DOWNLOAD_URL_LIFETIME_MS - 1);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith("blob:download");
  });
});
