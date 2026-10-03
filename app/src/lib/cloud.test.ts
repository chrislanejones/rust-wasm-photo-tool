import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// Keys set EMPTY before a fresh import, so a developer's .env.local cannot turn
// this into a configured build and send the calls below to the real hooks.
let cloud: typeof import("./cloud");
beforeAll(async () => {
  vi.stubEnv("VITE_CONVEX_URL", "");
  vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "");
  vi.resetModules();
  cloud = await import("./cloud");
});
afterAll(() => vi.unstubAllEnvs());

// vitest runs with no VITE_CONVEX_URL / VITE_CLERK_PUBLISHABLE_KEY — the same
// situation as a build with no env vars. These are called outside React on
// purpose: the inert versions use no React state, and the real convex/react
// ones would THROW here ("Could not find ConvexProviderWithAuth"), which is
// exactly the crash this module exists to prevent. e2e/boot-no-keys.spec.ts is
// the browser half of the same guarantee.
describe("cloud hooks without keys", () => {
  it("is not configured", () => {
    expect(cloud.CLOUD_CONFIGURED).toBe(false);
  });

  it("reads as signed out and finished loading", () => {
    expect(cloud.useCloudAuth()).toEqual({ isLoading: false, isAuthenticated: false });
  });

  it("a query never has data", () => {
    expect(cloud.useCloudQuery({} as never, "skip" as never)).toBeUndefined();
  });

  it("mutations, actions and the client refuse instead of throwing at render", async () => {
    await expect(cloud.useCloudMutation({} as never)({} as never)).rejects.toThrow(/not configured/);
    await expect(cloud.useCloudAction({} as never)({} as never)).rejects.toThrow(/not configured/);
    await expect(cloud.useCloudClient().query({} as never, {} as never)).rejects.toThrow(/not configured/);
  });
});
