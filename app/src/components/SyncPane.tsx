// Settings → Sync, and the same section in the phone's Settings sheet. What is
// being kept the same, where, whether it is working right now, and the three
// things a person can do about it.
//
// WHY A UI AT ALL. Sync that works is invisible, and so is sync that is
// broken — a preference that quietly never left the laptop looks exactly like
// one that did until the phone is opened, which may be a day later. This says
// which, in one line. It is its own pane, rather than a line at the bottom of
// General, because the phone shows it too: a phone that "shows nothing" has
// to be able to say why.
//
// THREE CONTROLS, ALL IMMEDIATE — none of them is a preference in the Settings
// draft, so none waits for Apply:
//
//  • THE SWITCH (lib/sync/enabled.ts). Per device, never synced. Off behaves
//    as signed out for the sync layer; on again is first contact, so this
//    device takes the account's copy. That is the reset: a device that has
//    been off must not come back and overwrite what the others did meanwhile.
//
//  • SEND THIS DEVICE'S SETTINGS. Shown only while the account holds nothing.
//    An account is never seeded from whichever device happens to be online
//    (reconcile.ts rule 1), so two devices signing in for the first time sync
//    NOTHING until someone changes a setting — correct, and confusing. This is
//    the explicit way out: the person picks the device that is right.
//
//  • FORGET THE SYNCED COPY. A promise the server keeps (convex/sync.ts
//    `clear`): the documents become forgotten markers rather than deleted
//    rows, so no device that happens to be online can send them straight
//    back, and an older unsent change is dropped rather than resurrecting
//    them. Only a change made after the forget — or the Send button — brings
//    a document back.
import { useEffect, useState } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { Check, CloudOff, RefreshCw, TriangleAlert, Laptop, Upload } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { PaneHeading } from "@/components/ui/pane-heading";
import { ToggleButtonGroup } from "@/components/ui/toggle-button-group";
import {
  sendThisDevice,
  setSyncEnabled,
  useSyncEnabled,
  useSyncStatus,
  type SyncState,
} from "@/lib/sync";

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
  off: {
    icon: CloudOff,
    title: "Sync is off on this device",
    body: "Nothing is fetched from your account or sent to it. Your settings stay here, and every Image Horse tab on this device still shows the same thing.",
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

/** States with no "last matched" time worth showing: nothing is matched. */
const UNMATCHED: SyncState[] = ["disabled", "local", "off"];

export function SyncPane() {
  const status = useSyncStatus();
  const enabled = useSyncEnabled();
  const { isAuthenticated } = useConvexAuth();
  const clear = useMutation(api.sync.clear);
  const [forgetting, setForgetting] = useState(false);
  const [sending, setSending] = useState(false);

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
  // The tab doing the talking is the one whose button would be heard: a
  // standby tab's pending change waits for the next pass of the other tab.
  const canSend =
    isAuthenticated &&
    enabled &&
    status.accountEmpty &&
    status.state !== "standby" &&
    status.state !== "connecting";

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <PaneHeading title="Sync">
          Settings, the panels you left open and the tool modes you were in,
          kept the same on every device you sign in on. Your photos are not
          included — they stay in this browser, on this device, as they always
          have.
        </PaneHeading>

        {/* Hidden in a build with no cloud half: there is nothing to switch. */}
        {status.state !== "disabled" && (
          <>
            <ToggleButtonGroup
              fill
              items={[
                {
                  key: "on",
                  icon: RefreshCw,
                  label: "Sync on",
                  active: enabled,
                  onToggle: () => setSyncEnabled(true),
                },
                {
                  key: "off",
                  icon: CloudOff,
                  label: "Sync off",
                  active: !enabled,
                  onToggle: () => setSyncEnabled(false),
                },
              ]}
            />
            <p className="pl-1 text-2xs leading-relaxed text-text-muted">
              Just this device — your other devices keep syncing. Off, nothing
              is fetched or sent, and tabs here still match each other. Turning
              it back on starts fresh: this device takes your account&rsquo;s
              copy.
            </p>
          </>
        )}

        <div className="flex items-start gap-3 rounded-lg border border-border bg-bg-elevated px-3 py-2.5">
          <Icon
            aria-hidden
            className={`mt-0.5 size-4 shrink-0 text-text-muted ${spinning ? "animate-spin" : ""}`}
          />
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold text-text-primary">{copy.title}</p>
            <p className="text-xs leading-relaxed text-text-muted">{copy.body}</p>
            {status.lastSyncedAt !== null && !UNMATCHED.includes(status.state) && (
              <p className="text-xs text-text-muted">
                Last matched {agoText(status.lastSyncedAt, now)}.
              </p>
            )}
            {status.state === "error" && status.lastError && (
              <p className="break-words text-xs text-text-muted">{status.lastError}</p>
            )}
          </div>
        </div>

        {canSend && (
          <div className="space-y-2">
            <p className="text-xs leading-relaxed text-text-muted">
              Your account has no synced settings yet, and nothing is sent until
              you change one. Send what this device has now, and your other
              signed-in devices take it.
            </p>
            <Button
              size="large"
              disabled={sending}
              onClick={() => {
                setSending(true);
                void sendThisDevice().finally(() => setSending(false));
              }}
            >
              <Upload aria-hidden className="size-3.5" />
              {sending ? "Sending…" : "Send this device's settings"}
            </Button>
          </div>
        )}
      </section>

      {isAuthenticated && (
        <section className="space-y-3">
          <PaneHeading title="Forget the synced copy">
            Deletes the settings stored in your account. Every device keeps what
            it has, and nothing goes back up until you change something that
            syncs — a setting, the open panel, a tool mode or the command
            palette&rsquo;s recent list — or press Send on a device where you
            are signed in.
          </PaneHeading>
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
        </section>
      )}
    </div>
  );
}
