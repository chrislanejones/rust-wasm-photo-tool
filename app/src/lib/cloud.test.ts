import { describe, it, expect } from "vitest";
import { CLOUD_CONFIGURED, useCloudAuth, useCloudQuery, useCloudMutation, useCloudAction, useCloudClient } from "./cloud";

// vitest runs with no VITE_CONVEX_URL / VITE_CLERK_PUBLISHABLE_KEY — the same
// situation as a build with no env vars. These are called outside React on
// purpose: the inert versions use no React state, and the real convex/react
// ones would THROW here ("Could not find ConvexProviderWithAuth"), which is
// exactly the crash this module exists to prevent. e2e/boot-no-keys.spec.ts is
// the browser half of the same guarantee.
describe("cloud hooks without keys", () => {
  it("is not configured", () => {
    expect(CLOUD_CONFIGURED).toBe(false);
  });

  it("reads as signed out and finished loading", () => {
    expect(useCloudAuth()).toEqual({ isLoading: false, isAuthenticated: false });
  });

  it("a query never has data", () => {
    expect(useCloudQuery({} as never, "skip" as never)).toBeUndefined();
  });

  it("mutations, actions and the client refuse instead of throwing at render", async () => {
    await expect(useCloudMutation({} as never)({} as never)).rejects.toThrow(/not configured/);
    await expect(useCloudAction({} as never)({} as never)).rejects.toThrow(/not configured/);
    await expect(useCloudClient().query({} as never, {} as never)).rejects.toThrow(/not configured/);
  });
});
