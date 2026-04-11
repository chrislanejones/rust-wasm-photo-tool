// ===== FILE: app/src/hooks/useConvexHistory.ts =====
// Item 1: Bridge Rust/WASM operations to Convex persistent history.
//
// Usage in AppShell:
//   const convexHistory = useConvexHistory(activeConvexImageId);
//   // After any WASM operation that pushes undo:
//   convexHistory.recordAction("update", "image", imageId);
//
// This gives persistent, cross-session, queryable history.
// The WASM undo/redo stack is session-local (fast, in-memory).
// Convex history is the persistent audit trail.

// NOTE: These imports require Convex to be set up in the project.
// Uncomment when @convex-dev/auth and convex client are configured.

/*
import { useMutation, useQuery } from "convex/react";
import { api } from "../../.convex/_generated/api";
import type { Id } from "../../.convex/_generated/dataModel";

export function useConvexHistory(imageId: Id<"images"> | null) {
  const pushHistory = useMutation(api.history.push);
  const historyEntries = useQuery(
    api.history.listByImage,
    imageId ? { imageId } : "skip"
  );

  const recordAction = async (
    action: "create" | "update" | "delete" | "ai_rembg" | "ai_upscale" | "ai_inpaint" | "ai_alt",
    target: "annotation" | "layer" | "image",
    targetId: string,
    prevState?: any,
    nextState?: any
  ) => {
    if (!imageId) return;
    try {
      await pushHistory({
        imageId,
        action,
        target,
        targetId,
        prevState,
        nextState,
      });
    } catch (err) {
      console.warn("Failed to record history to Convex:", err);
    }
  };

  return {
    recordAction,
    entries: historyEntries ?? [],
  };
}
*/

// Stub export for now — remove when Convex is connected
export function useConvexHistory(_imageId: string | null) {
  const recordAction = async (
    _action: string,
    _target: string,
    _targetId: string,
    _prevState?: any,
    _nextState?: any,
  ) => {
    // No-op until Convex is connected
  };

  return {
    recordAction,
    entries: [] as any[],
  };
}
