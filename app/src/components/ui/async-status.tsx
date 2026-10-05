// The one small view for useAsyncTask's states (Plan C §3). Composes
// StatusMark and Skeleton — no new visual primitive.
//
//   ready       renders `children` (or nothing)
//   loading     renders `skeleton` in the content's place
//   processing  ↻ + label, and a bar when the length is known
//   saved       ✓ + label, briefly (the hook times it)
//   error       × + what failed + the action — it REPLACES progress
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { StatusMark } from "@/components/ui/status-mark";
import type { AsyncState } from "@/hooks/useAsyncTask";

export function AsyncStatus({
  state,
  progress = null,
  error = null,
  processingLabel = "Working…",
  savedLabel = "Saved",
  action,
  skeleton,
  children,
}: {
  state: AsyncState;
  progress?: number | null;
  error?: string | null;
  processingLabel?: string;
  savedLabel?: string;
  /** The way out of an Error. Required in spirit: an error that is only a
   *  message is a dead end. */
  action?: { label: string; onClick: () => void };
  /** What stands in for the content while `loading`. */
  skeleton?: ReactNode;
  children?: ReactNode;
}) {
  if (state === "loading") return <div aria-busy="true">{skeleton}</div>;
  if (state === "processing") {
    return (
      <div role="status" data-async="processing" className="space-y-1.5">
        <p className="flex items-center gap-1.5 text-xs text-text-secondary">
          <StatusMark kind="working" />
          {processingLabel}
          {progress != null && <span className="tabular-nums">{` ${Math.round(progress * 100)}%`}</span>}
        </p>
        {progress != null && (
          <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full bg-theme-primary" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
      </div>
    );
  }
  if (state === "saved") {
    return (
      <p role="status" data-async="saved" className="flex items-center gap-1.5 text-xs text-text-secondary">
        <StatusMark kind="complete" />
        {savedLabel}
      </p>
    );
  }
  if (state === "error") {
    return (
      <div role="alert" data-async="error" className="flex flex-wrap items-center gap-2 text-xs text-text-primary">
        <StatusMark kind="failed" />
        <span className="min-w-0 flex-1">{error ?? "Something went wrong."}</span>
        {action && (
          <Button size="xs" variant="secondary" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </div>
    );
  }
  return <>{children}</>;
}
