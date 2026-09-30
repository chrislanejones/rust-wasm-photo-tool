// @vitest-environment jsdom
//
// The tab claim is ALSO the sync layer's election: the tab holding it is the
// one tab on this device that talks to the sync server (lib/sync/leader.ts).
// That link is one effect in useTabClaim, and nothing else would notice if it
// went — every tab would simply go back to pushing every change. So it is
// pinned here, through the real hook and the real BroadcastChannel.
//
// The dialog itself ("Use Image Horse here?") is not under test and not
// touched: `isStale` is still what covers the editor.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useTabClaim } from "./useTabClaim";
import { claimTabHere, holdsTabClaim, setHoldsTabClaim } from "@/lib/sync/leader";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CHANNEL = "image-horse-tab-claim";
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

let container: HTMLDivElement;
let root: Root;
let other: BroadcastChannel;
let claim: { isStale: boolean; claimHere: () => void };

function Host() {
  claim = useTabClaim();
  return null;
}

beforeEach(async () => {
  setHoldsTabClaim(true);
  other = new BroadcastChannel(CHANNEL); // "another tab"
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(React.createElement(Host));
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  other.close();
});

describe("useTabClaim → the sync pusher", () => {
  it("stops this tab pushing when another tab claims, and resumes on Use here", async () => {
    expect(holdsTabClaim()).toBe(true);

    await act(async () => {
      other.postMessage({ type: "claim", id: "someone-else" });
      await settle();
    });
    expect(claim.isStale).toBe(true);
    expect(holdsTabClaim()).toBe(false);

    await act(async () => {
      claim.claimHere();
      await settle();
    });
    expect(claim.isStale).toBe(false);
    expect(holdsTabClaim()).toBe(true);
  });

  it("Settings › Sync's Use here (claimTabHere) reaches this hook's claim", async () => {
    await act(async () => {
      other.postMessage({ type: "claim", id: "someone-else" });
      await settle();
    });
    expect(claim.isStale).toBe(true);

    await act(async () => {
      claimTabHere();
      await settle();
    });
    expect(claim.isStale).toBe(false);
    expect(holdsTabClaim()).toBe(true);
  });
});
