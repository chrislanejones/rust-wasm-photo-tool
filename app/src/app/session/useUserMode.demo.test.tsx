// @vitest-environment jsdom
//
// Demo mode is sacred: a build with no cloud keys (AUTH_ENABLED false) has no
// tier query and must behave exactly as before tier pending existed. Clerk is
// never called (its hooks throw without a provider), nothing waits, the count
// says "12 max" from the first frame, and the store is left as it boots —
// `userMode` "demo", `authResolved` false (the old watcher was never mounted
// in this build either), `tierPending` false.
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUserMode } from "./useUserMode";
import { usePhotoLimit } from "./useEngineGate";
import { GalleryCount } from "@/features/gallery/GalleryCount";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TIERS } from "@/lib/tiers";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useUIStore } from "@/stores/useUIStore";

// A keyless build's lib/cloud: inert hooks, "signed out, nothing to fetch".
vi.mock("@/lib/cloud", () => ({
  CLOUD_CONFIGURED: false,
  useCloudAuth: () => ({ isLoading: false, isAuthenticated: false }),
  useCloudQuery: () => undefined,
  useCloudMutation: () => () => Promise.reject(new Error("offline")),
  useCloudAction: () => () => Promise.reject(new Error("offline")),
  useCloudClient: () => null,
}));
const clerk = vi.hoisted(() => ({ calls: 0 }));
vi.mock("@clerk/clerk-react", () => ({
  useUser: () => {
    clerk.calls++;
    throw new Error("useUser called without a ClerkProvider");
  },
}));
vi.mock("@/lib/photoLimits", async () => {
  const { TIERS: T } = await import("@/lib/tiers");
  const real = await vi.importActual<typeof import("@/lib/photoLimits")>("@/lib/photoLimits");
  return { ...real, getPhotoLimit: async (m: keyof typeof T) => T[m].galleryLimit };
});

function Harness() {
  const { effectiveUserMode, tierPending } = useUserMode();
  usePhotoLimit(effectiveUserMode);
  const maxPhotos = useGalleryStore((s) => s.maxPhotos);
  return (
    <TooltipProvider>
      <span data-testid="mode">{`${effectiveUserMode}:${tierPending}`}</span>
      <GalleryCount selectionActive={false} selectedCount={0} total={3} maxPhotos={maxPhotos} />
    </TooltipProvider>
  );
}

const count = () => document.querySelector("h2")!.textContent ?? "";

beforeEach(() => {
  vi.useFakeTimers();
  clerk.calls = 0;
  useUIStore.setState({ userMode: "demo", authResolved: false, tierPending: false, devTierOverride: null });
  useGalleryStore.setState({ maxPhotos: TIERS.demo.galleryLimit });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("demo mode (no cloud keys)", () => {
  it("is decided from the first frame and never waits", async () => {
    render(<Harness />);
    expect(count()).toMatch(/3\s*photos\s*·\s*12\s*max/);
    expect(screen.getByTestId("mode").textContent).toBe("demo:false");
    expect(screen.queryByTestId("gallery-max-pending")).toBeNull();

    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(count()).toMatch(/3\s*photos\s*·\s*12\s*max/);
    expect(screen.queryByTestId("gallery-max-pending")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("never calls Clerk and leaves the auth store as it boots", async () => {
    render(<Harness />);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(clerk.calls).toBe(0);
    const s = useUIStore.getState();
    expect([s.userMode, s.authResolved, s.tierPending]).toEqual(["demo", false, false]);
  });
});
