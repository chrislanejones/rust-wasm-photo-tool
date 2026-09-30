// @vitest-environment jsdom
//
// The beta ring: what an invite link may do, and what it may never do.
//
// The rules under test are the ones in lib/beta.ts's header — off is the
// default and the fallback, the keys are the ones the features themselves
// read, and a link takes itself back out of the URL.
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  BETA_FEATURES,
  applyBetaFromUrl,
  betaFeature,
  betaInviteUrl,
  isBetaOn,
  setBetaOn,
  subscribeBeta,
} from "./beta";
import { FEATURE_FLAGS } from "./featureFlags";
import { isSmartEdgeEnabled } from "./smartEdge";
import { webgpuEnabled } from "./webgpu/detect";

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("the ring is a view of the flag registry", () => {
  it("is exactly the opt-in flags that carry a beta block — no second list", () => {
    const fromRegistry = FEATURE_FLAGS.filter((f) => f.kind === "optin" && f.beta);
    expect(BETA_FEATURES.map((f) => f.flag.key)).toEqual(fromRegistry.map((f) => f.key));
    expect(BETA_FEATURES.length).toBeGreaterThan(0);
  });

  it("never offers a kill switch: turning a shipped subsystem off is not a beta", () => {
    const kills = FEATURE_FLAGS.filter((f) => f.kind === "kill");
    expect(kills.length).toBeGreaterThan(0);
    expect(kills.some((f) => f.beta), "a kill switch carrying a beta block").toBe(false);
    for (const k of kills) expect(betaFeature(k.key)).toBeUndefined();
  });

  it("has unique, URL-safe ids and a blurb worth reading", () => {
    const ids = BETA_FEATURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of BETA_FEATURES) {
      expect(f.id, `${f.id} id`).toMatch(/^[a-z0-9-]+$/);
      expect(f.blurb.length, `${f.id} blurb`).toBeGreaterThan(20);
      expect(f.label.length, `${f.id} label`).toBeGreaterThan(2);
    }
  });

  it("moves the SAME switch the feature's own code reads", () => {
    // The whole design rests on this: the pane is a nicer way to set what was
    // already there, through the module's own predicate.
    expect(isSmartEdgeEnabled()).toBe(false);
    setBetaOn("smart-brush", true);
    expect(isSmartEdgeEnabled(), "smartEdge.ts reads ih_smart_edge").toBe(true);

    expect(webgpuEnabled()).toBe(false);
    setBetaOn("gpu-blur", true);
    expect(webgpuEnabled(), "webgpu/detect.ts reads ih_webgpu").toBe(true);
  });
});

describe("turning one on and off", () => {
  it("is off until turned on, and off again once cleared", () => {
    expect(isBetaOn("smart-brush")).toBe(false);
    const key = betaFeature("smart-brush")!.flag.key;
    setBetaOn("smart-brush", true);
    expect(isBetaOn("smart-brush")).toBe(true);
    expect(localStorage.getItem(key)).toBe("1");

    setBetaOn("smart-brush", false);
    expect(isBetaOn("smart-brush")).toBe(false);
    expect(localStorage.getItem(key), "cleared, not '0'").toBeNull();
  });

  it("ignores an id nobody registered, in both directions", () => {
    setBetaOn("teleporter", true);
    expect(isBetaOn("teleporter")).toBe(false);
    expect(localStorage.length, "nothing was written").toBe(0);
    expect(betaFeature("teleporter")).toBeUndefined();
  });

  it("reads a value that is not the flag's own on as off", () => {
    localStorage.setItem(betaFeature("smart-brush")!.flag.key, "true");
    expect(isBetaOn("smart-brush")).toBe(false);
  });

  it("tells this tab's subscribers, and hears another tab", () => {
    const heard = vi.fn();
    const off = subscribeBeta(heard);

    setBetaOn("gpu-blur", true);
    expect(heard).toHaveBeenCalledTimes(1);

    window.dispatchEvent(
      new StorageEvent("storage", { key: betaFeature("gpu-blur")!.flag.key }),
    );
    expect(heard).toHaveBeenCalledTimes(2);

    window.dispatchEvent(new StorageEvent("storage", { key: "unrelated-key" }));
    expect(heard).toHaveBeenCalledTimes(2);

    off();
    setBetaOn("gpu-blur", false);
    expect(heard).toHaveBeenCalledTimes(2);
  });
});

describe("the invite link", () => {
  it("turns on what it names and takes itself out of the URL", () => {
    window.history.replaceState(null, "", "/?beta=smart-brush");
    const on = applyBetaFromUrl("?beta=smart-brush");

    expect(on).toEqual(["smart-brush"]);
    expect(isBetaOn("smart-brush")).toBe(true);
    expect(window.location.search, "not carried into a bookmark").toBe("");
  });

  it("keeps the rest of the address — a share token and the hash route survive", () => {
    window.history.replaceState(null, "", "/?v=tok123&beta=gpu-blur#/edit/crop");
    applyBetaFromUrl("?v=tok123&beta=gpu-blur");

    expect(isBetaOn("gpu-blur")).toBe(true);
    expect(window.location.search).toBe("?v=tok123");
    expect(window.location.hash).toBe("#/edit/crop");
  });

  it("takes several ids at once and skips one this build does not have", () => {
    const on = applyBetaFromUrl("?beta=smart-brush,teleporter,gpu-blur");
    expect(on).toEqual(["smart-brush", "gpu-blur"]);
    expect(isBetaOn("smart-brush")).toBe(true);
    expect(isBetaOn("gpu-blur")).toBe(true);
  });

  it("?beta=none is the way out: it clears every one of them", () => {
    setBetaOn("smart-brush", true);
    setBetaOn("gpu-blur", true);

    const on = applyBetaFromUrl("?beta=none");

    expect(on).toEqual([]);
    expect(BETA_FEATURES.every((f) => !isBetaOn(f.id))).toBe(true);
  });

  it("does nothing at all without the parameter", () => {
    setBetaOn("smart-brush", true);
    expect(applyBetaFromUrl("?v=tok123")).toEqual([]);
    expect(isBetaOn("smart-brush"), "an unrelated visit changes nothing").toBe(true);
  });

  it("builds a link on this origin, with the id as the value", () => {
    expect(betaInviteUrl("gpu-blur")).toBe(`${window.location.origin}/?beta=gpu-blur`);
  });
});
