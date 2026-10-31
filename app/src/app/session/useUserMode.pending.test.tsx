// @vitest-environment jsdom
//
// A PAID user whose `users.me` answers 2 s late (Night 10-27, PARKING_LOT
// "a signed-in user is loggedIn until the tier query lands").
//
// Before the fix, the 2 s read as the free tier: the gallery count said
// "3 photos · 24 max" and the OCR panel said it needs a Paid plan, then both
// changed when the tier landed. The rule now: while the tier is pending, no
// gate decides. The count shows a skeleton where the max goes (after the
// 300 ms grace), no upgrade prompt appears, and then it reads "100 max".
//
// The harness is the same composition AppShell uses — useUserMode →
// usePhotoLimit → GalleryCount, and `aiEnabled` from hasReplicateAI — with
// Clerk and Convex mocked at the module boundary. `users.me` matches by
// getFunctionName: api refs are never `===`.
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUserMode } from "./useUserMode";
import { usePhotoLimit } from "./useEngineGate";
import { GalleryCount } from "@/features/gallery/GalleryCount";
import { TextSettings } from "@/features/tools/settings/TextSettings";
import { defaultToolSettings } from "@/lib/defaultToolSettings";
import { hasReplicateAI, TIERS } from "@/lib/tiers";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useToolStore } from "@/stores/useToolStore";
import { useUIStore } from "@/stores/useUIStore";
import { TooltipProvider } from "@/components/ui/tooltip";

const cloud = vi.hoisted(() => {
  const subs = new Set<() => void>();
  const state = {
    me: undefined as unknown,
    subs,
    setMe(v: unknown) {
      state.me = v;
      subs.forEach((f) => f());
    },
  };
  return state;
});

// One fake `users.me`, shared by every path that reads it (lib/cloud for
// useSession, convex/react for anything that still imports it directly).
vi.mock("@/lib/cloud", async () => {
  const { getFunctionName } = await import("convex/server");
  const React = await import("react");
  const useMe = (ref: unknown, args: unknown) => {
    const me = React.useSyncExternalStore(
      (cb) => { cloud.subs.add(cb); return () => { cloud.subs.delete(cb); }; },
      () => cloud.me,
    );
    if (args === "skip") return undefined;
    return getFunctionName(ref as never) === "users:me" ? me : undefined;
  };
  return {
    CLOUD_CONFIGURED: true,
    useCloudAuth: () => ({ isLoading: false, isAuthenticated: true }),
    useCloudQuery: useMe,
    useCloudMutation: () => vi.fn(async () => null),
    useCloudAction: () => vi.fn(async () => null),
    useCloudClient: () => null,
  };
});
vi.mock("convex/react", async () => {
  const cloudMod = await import("@/lib/cloud");
  return {
    useConvexAuth: cloudMod.useCloudAuth,
    useQuery: cloudMod.useCloudQuery,
    useMutation: cloudMod.useCloudMutation,
    useAction: cloudMod.useCloudAction,
    useConvex: () => null,
  };
});
vi.mock("@clerk/clerk-react", () => ({
  useUser: () => ({ isLoaded: true, isSignedIn: true }),
}));
// The engine's `photo_limit` mirrors TIERS (tiers.ts says the two must agree).
vi.mock("@/lib/photoLimits", async () => {
  const { TIERS: T } = await import("@/lib/tiers");
  const real = await vi.importActual<typeof import("@/lib/photoLimits")>("@/lib/photoLimits");
  return { ...real, getPhotoLimit: async (m: keyof typeof T) => T[m].galleryLimit };
});
vi.mock("@/hooks/useAIJob", () => ({
  useAIJob: () => ({ run: vi.fn(), phase: "idle", busy: false, error: null, textResult: null }),
}));
vi.mock("@/hooks/useEngineFaces", () => ({ useEngineFaces: () => [] }));
const toasts = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock("sonner", () => {
  const rec = (m: unknown) => { toasts.calls.push(String(m)); };
  return { toast: Object.assign(rec, { error: rec, info: rec, success: rec, warning: rec }) };
});

function Harness() {
  const { effectiveUserMode } = useUserMode();
  usePhotoLimit(effectiveUserMode);
  const maxPhotos = useGalleryStore((s) => s.maxPhotos);
  return (
    <TooltipProvider>
      <GalleryCount selectionActive={false} selectedCount={0} total={3} maxPhotos={maxPhotos} />
      <TextSettings
        settings={defaultToolSettings}
        onChange={() => {}}
        aiEnabled={hasReplicateAI(effectiveUserMode)}
        activePhotoId="p1"
        stampToolRef={{ current: {} as never }}
      />
    </TooltipProvider>
  );
}

const count = () => document.querySelector("h2")!.textContent ?? "";
const UPGRADE = /needs\s+sign-in|Paid plan|coming soon/i;
const PAID_ME = { tier: "pro", role: "user", entitlement: "paid" };

beforeEach(() => {
  vi.useFakeTimers();
  cloud.me = undefined;
  toasts.calls = [];
  // Set BEFORE render: a zustand change does not re-render an already-mounted
  // component under jsdom here (see memory: jsdom zustand).
  useUIStore.setState({
    userMode: "demo", authResolved: false, devTierOverride: null,
    onlineFeaturesEnabled: true,
  });
  useToolStore.setState({ textMode: "ocr" });
  useGalleryStore.setState({ maxPhotos: TIERS.demo.galleryLimit });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("a paid user whose users.me answers 2 s late", () => {
  it("never shows the free max or an upgrade prompt, then shows 100 max", async () => {
    render(<Harness />);
    // Sample the whole 2 s, 100 ms at a time.
    for (let t = 0; t < 2000; t += 100) {
      await act(async () => { await vi.advanceTimersByTimeAsync(100); });
      // No max number at all: not the free 24, not the demo 12.
      expect(count(), `t=${t + 100} ms`).not.toMatch(/\d+\s*max/);
      expect(document.body.textContent, `t=${t + 100} ms`).not.toMatch(UPGRADE);
    }
    // Past the 300 ms grace the max is a skeleton, the width of a number box.
    expect(screen.getByTestId("gallery-max-pending")).toBeTruthy();
    expect(screen.getByRole("status")).toBeTruthy();

    await act(async () => {
      cloud.setMe(PAID_ME);
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(count()).toMatch(/3\s*photos\s*·\s*100\s*max/);
    expect(screen.queryByTestId("gallery-max-pending")).toBeNull();
    expect(document.body.textContent).not.toMatch(UPGRADE);
    expect(toasts.calls).toEqual([]);
  });

  it("shows nothing in the max box during the 300 ms grace", async () => {
    render(<Harness />);
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(screen.getByTestId("gallery-max-pending")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    expect(count()).not.toMatch(/\d+\s*max/);
  });

  it("a FREE user lands on 24 max after the wait — the lower tier is still the answer", async () => {
    render(<Harness />);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    await act(async () => {
      cloud.setMe({ tier: "free", role: "user", entitlement: "free" });
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(count()).toMatch(/3\s*photos\s*·\s*24\s*max/);
    // Now decided: the free user DOES see the OCR upgrade note.
    expect(document.body.textContent).toMatch(/needs\s*sign-in/);
  });

  it("a tier that never answers stops waiting at the cap and reads as free", async () => {
    render(<Harness />);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_500); });
    expect(useUIStore.getState().tierPending).toBe(false);
    expect(count()).toMatch(/24\s*max/);
  });
});
