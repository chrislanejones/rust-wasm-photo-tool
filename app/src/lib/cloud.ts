// app/src/lib/cloud.ts
//
// Convex hooks that survive a build with NO cloud keys.
//
// `ConvexClerkProvider` renders no provider when VITE_CONVEX_URL or
// VITE_CLERK_PUBLISHABLE_KEY is missing, and every convex/react hook THROWS
// without one ("Could not find ConvexProviderWithAuth") — blank #root on load.
// Hooks cannot be called conditionally, so the choice is made once, at module
// load, from build-time constants: a configured build gets the real hooks, a
// keyless one gets inert ones that read as "signed out, nothing to fetch".
// Hooks that run during boot import from here instead of "convex/react".
import { useConvex, useConvexAuth, useAction, useMutation, useQuery } from "convex/react";

export const CLOUD_CONFIGURED = Boolean(
  import.meta.env.VITE_CONVEX_URL && import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const offline = () => Promise.reject(new Error("Cloud features are not configured in this build."));

const inertAuth = () => ({ isLoading: false, isAuthenticated: false });
const inertQuery = () => undefined;
const inertCallable = () => offline;
const inertClient = () => ({ query: offline, mutation: offline, action: offline });

export const useCloudAuth = (CLOUD_CONFIGURED ? useConvexAuth : inertAuth) as typeof useConvexAuth;
export const useCloudQuery = (CLOUD_CONFIGURED ? useQuery : inertQuery) as typeof useQuery;
export const useCloudMutation = (CLOUD_CONFIGURED ? useMutation : inertCallable) as typeof useMutation;
export const useCloudAction = (CLOUD_CONFIGURED ? useAction : inertCallable) as typeof useAction;
export const useCloudClient = (CLOUD_CONFIGURED ? useConvex : inertClient) as unknown as typeof useConvex;
