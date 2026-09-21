// Settings → General's sync line. What is being kept the same, where, and
// whether it is actually working right now.
//
// WHY A UI AT ALL. Sync that works is invisible, and so is sync that is
// broken — a preference that quietly never left the laptop looks exactly like
// one that did until the phone is opened, which may be a day later. This says
// which, in one line, at the place the preferences themselves are set.
//
// It is READ-ONLY apart from the forget button. There is no on/off switch
// because there is nothing to switch: the cross-tab half needs no account and
// costs nothing, and the cross-device half is what signing in is for. A user
// who wants their settings to stop following them signs out, or presses
// Forget below.
//
// The Forget copy is a promise the server keeps (convex/sync.ts `clear`): the
// documents become forgotten markers rather than deleted rows, so no device
// that happens to be online can send them straight back, and an older unsent
// change is dropped rather than resurrecting them. Only a change made after
// the forget brings a document back, and only that document.
import { useEffect, useState } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { Check, CloudOff, RefreshCw, TriangleAlert, Laptop } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useSyncStatus, type SyncState } from "@/lib/sync";

/** Coarse on purpose — "3m ago" is the reassurance; a ticking second hand
 *  invites staring at it. Mirrors AIUsagePane's `untilText`. */
function agoText(at: number, now: number): string {
  const ms = Math.max(0, now - at);
  if (ms < 60_000) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const COPY: Record<SyncState, { icon: typeof Check; title: string; body: string }> = {
  disabled: {
    icon: CloudOff,
    title: "Tabs only",
    body: "This build has no cloud deployment configured, so your settings stay on this device. Every Image Horse tab here still shows the same thing.",
  },
  local: {
    icon: Laptop,
    title: "This device only",
    body: "Your settings are kept on this device and shared between its tabs. Sign in to have them follow you to your phone and your other computers.",
  },
  connecting: {
    icon: RefreshCw,
    title: "Connecting",
    body: "Fetching what your other devices last saved.",
  },
  standby: {
    icon: Laptop,
    title: "Another tab is syncing",
    body: "Image Horse is open in another tab here, and that tab sends and fetches for this device. This one follows along.",
  },
  syncing: {
    icon: RefreshCw,
    title: "Syncing",
    body: "Sending this device's changes.",
  },
  synced: {
    icon: Check,
    title: "Up to date",
    body: "Your settings, remembered panels and tool modes match on every device you are signed in on.",
  },
  error: {
    icon: TriangleAlert,
    title: "Could not reach the server",
    body: "Nothing is lost. Your settings are saved on this device, and so is the list of changes still to send. It will keep trying.",
  },
};

/** The error copy when the server turned a change down outright. "Could not
 *  reach the server" and "It will keep trying" would both be false there:
 *  nothing retries a permanent refusal on a timer (useCloudSync), only a new
 *  change or a reload does. */
const REFUSED = {
  title: "The server turned a change down",
  body: "Nothing is lost. Your settings are saved on this device. It will not keep retrying this one — it tries again the next time you change something.",
};

export function SyncStatusRow() {
  const status = useSyncStatus();
  const { isAuthenticated } = useConvexAuth();
  const clear = useMutation(api.sync.clear);
  const [forgetting, setForgetting] = useState(false);

  // One clock for the line, in state rather than read during render — a render
  // that reads `Date.now()` is impure and the compiler lint fails on it
  // (ADR-020). A minute is the formatter's finest unit, so that is the tick.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const refused = status.state === "error" && !status.willRetry;
  const copy = refused ? { ...COPY.error, ...REFUSED } : COPY[status.state];
  const Icon = copy.icon;
  const spinning = status.state === "syncing" || status.state === "connecting";

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">Sync</h3>
        <p className="mt-1 text-xs leading-relaxed text-text-muted">
          Settings, the panels you left open and the tool modes you were in.
          Your photos are not included — they stay in this browser, on this
          device, as they always have.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-border bg-bg-elevated px-3 py-2.5">
        <Icon
          aria-hidden
          className={`mt-0.5 size-4 shrink-0 text-text-muted ${spinning ? "animate-spin" : ""}`}
        />
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold text-text-primary">{copy.title}</p>
          <p className="text-xs leading-relaxed text-text-muted">{copy.body}</p>
          {status.lastSyncedAt !== null && status.state !== "local" && (
            <p className="text-xs text-text-muted">
              Last matched {agoText(status.lastSyncedAt, now)}.
            </p>
          )}
          {status.state === "error" && status.lastError && (
            <p className="break-words text-xs text-text-muted">{status.lastError}</p>
          )}
        </div>
      </div>

      {isAuthenticated && (
        <Button
          size="large"
          disabled={forgetting}
          onClick={() => {
            setForgetting(true);
            void clear()
              .catch(() => {
                /* Status already reports failures; nothing to add here. */
              })
              .finally(() => setForgetting(false));
          }}
        >
          {forgetting ? "Forgetting…" : "Forget the synced copy"}
        </Button>
      )}
      {isAuthenticated && (
        <p className="text-xs leading-relaxed text-text-muted">
          Deletes the settings stored in your account. Every device keeps what
          it has, and nothing goes back up until you change something that
          syncs — a setting, the open panel, a tool mode or the command
          palette&rsquo;s recent list — on a device where you are signed in.
        </p>
      )}
    </section>
  );
}
