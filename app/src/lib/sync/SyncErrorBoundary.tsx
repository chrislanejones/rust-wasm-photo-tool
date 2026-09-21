// Keeps a failure in the CLOUD half of sync from taking the editor with it.
//
// WHY A BOUNDARY AND NOT A try/catch. `useCloudSync` reads the account's
// documents with convex/react's `useQuery`, and `useQuery` reports a server
// error by THROWING DURING RENDER. There is nothing to catch it with inside a
// hook. The case that matters is not exotic: Convex functions are deployed by
// hand, separately from the site, so a build that calls `sync:pull` can reach
// users before the deployment has a `sync:pull` to answer with. Without this
// file that is an uncaught render error at the composition root — every
// signed-in user gets a blank page, over a feature whose whole job is to copy
// a theme preference.
//
// The boundary wraps `CloudSync` and NOTHING ELSE. It renders null either way,
// so there is no fallback UI to design: tripping it turns sync off and leaves
// the app exactly as it was. The failure is reported through the status store,
// which is what Settings → General and the error toast both read.
//
// It retries by remounting its child, on a backoff, because the likely cause
// clears on its own — a deployment catching up, a cold start — and a tab left
// open should pick sync back up without a reload. React logs each caught error
// to the console, so the backoff is also what keeps that to a handful of lines.
import { Component, type ReactNode } from "react";
import { setSyncStatus } from "./status";
import { logDiagnostic } from "@/lib/diagnosticsLog";

/** First retry, doubling up to the cap. */
const RETRY_FIRST_MS = 30_000;
const RETRY_MAX_MS = 5 * 60_000;

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class SyncErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    // willRetry: the boundary remounts its child on a backoff below.
    setSyncStatus({ state: "error", lastError: message, willRetry: true });
    logDiagnostic("CONVEX_DB", `Sync: the cloud half stopped — ${message}`);

    const delay = Math.min(RETRY_FIRST_MS * 2 ** this.attempts, RETRY_MAX_MS);
    this.attempts += 1;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.setState({ failed: false });
    }, delay);
  }

  componentWillUnmount(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
