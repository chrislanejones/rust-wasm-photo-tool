// @vitest-environment jsdom
//
// QC F2 (09-24-2026): share links uploaded with "Everything in your browser"
// on, because useShare checked sign-in alone. The contract pinned here: with
// the switch off, NO upload URL is requested and NOTHING is fetched — the
// refusal comes before the first network call, not after it.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const generateUploadUrl = vi.fn(async () => "https://upload.invalid/x");
const createShareMutation = vi.fn(async () => ({ token: "tok" }));
let authed = true;

// useShare reaches Convex through lib/cloud (inert in a keyless test build),
// so the mock sits there, not on convex/react.
vi.mock("@/lib/cloud", () => ({
  useCloudAuth: () => ({ isAuthenticated: authed, isLoading: false }),
  // useShare asks for generateUploadUrl first, then create.
  useCloudMutation: (() => {
    let n = 0;
    return () => (n++ % 2 === 0 ? generateUploadUrl : createShareMutation);
  })(),
}));

import { useShare } from "./useShare";
import { useUIStore } from "@/stores/useUIStore";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let share: ReturnType<typeof useShare> | null = null;
function Probe() {
  share = useShare();
  return null;
}
const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ storageId: "s1" }), { status: 200 }));

beforeEach(() => {
  authed = true;
  generateUploadUrl.mockClear();
  createShareMutation.mockClear();
  fetchSpy.mockClear();
  vi.stubGlobal("fetch", fetchSpy);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  share = null;
});

const input = { blob: new Blob(["x"], { type: "image/png" }), canvasW: 10, canvasH: 10 };

describe("useShare respects the online switch", () => {
  it("switch OFF, signed in: not shareable, says why, and uploads nothing", async () => {
    useUIStore.setState({ onlineFeaturesEnabled: false });
    act(() => root.render(React.createElement(Probe)));
    expect(share!.canShare).toBe(false);
    expect(share!.availability).toBe("online-off");
    await expect(share!.createShare(input)).rejects.toThrow(/Online features are off/);
    expect(generateUploadUrl).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(createShareMutation).not.toHaveBeenCalled();
  });

  it("switch ON, signed in: shareable, and the upload goes through", async () => {
    useUIStore.setState({ onlineFeaturesEnabled: true });
    act(() => root.render(React.createElement(Probe)));
    expect(share!.canShare).toBe(true);
    expect(share!.availability).toBe("ready");
    const out = await share!.createShare(input);
    expect(generateUploadUrl).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(out.token).toBe("tok");
  });

  it("signed out stays 'signed-out' whatever the switch says", () => {
    authed = false;
    useUIStore.setState({ onlineFeaturesEnabled: true });
    act(() => root.render(React.createElement(Probe)));
    expect(share!.canShare).toBe(false);
    expect(share!.availability).toBe("signed-out");
  });
});

// Night 10-07 PR 2 (ADR-083): the snapshot upload had no timeout at all, and
// a timeout that only rejects would leave the bytes landing in storage with
// nothing pointing at them. Past SHARE_UPLOAD_TIMEOUT_MS the request is
// CANCELLED: its signal aborts and no share is minted.
describe("useShare cancels a stalled snapshot upload", () => {
  it("past the timeout the fetch's signal is aborted and nothing is created", async () => {
    const { SHARE_UPLOAD_TIMEOUT_MS } = await import("./useShare");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let signal: AbortSignal | undefined;
    fetchSpy.mockImplementationOnce(
      ((_u: string, init?: RequestInit) => {
        signal = init?.signal ?? undefined;
        return new Promise<Response>(() => {}); // never answers
      }) as unknown as () => Promise<Response>,
    );
    useUIStore.setState({ onlineFeaturesEnabled: true });
    act(() => root.render(React.createElement(Probe)));
    const out = share!.createShare(input);
    const settled = expect(out).rejects.toThrow(/did not settle/);
    await vi.advanceTimersByTimeAsync(SHARE_UPLOAD_TIMEOUT_MS + 1);
    await settled;
    expect(signal, "the upload carried a signal").toBeDefined();
    expect(signal!.aborted, "the timeout ABORTED the request").toBe(true);
    expect(createShareMutation).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
