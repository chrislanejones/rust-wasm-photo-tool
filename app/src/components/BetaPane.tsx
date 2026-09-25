// Settings → Beta. The experiments a person can turn on for this device, and
// the link that turns one on for somebody else.
//
// Everything real is in lib/beta.ts, including why this is per device and why
// nothing here reaches a server. This file is the surface: a row per feature,
// the same On / Off pair the Security and Sync panes use, and a Copy invite
// link button so a beta tester is one message away instead of a paragraph of
// DevTools instructions.
//
// Changes commit as pressed, like Sync's switch on desktop — this pane has no
// Apply, and a beta switch is not a Settings preference.
import { useState, useSyncExternalStore } from "react";
import { Beaker, Link2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaneHeading } from "@/components/ui/pane-heading";
import { ToggleButtonGroup } from "@/components/ui/toggle-button-group";
import { toast } from "@/components/ui/sonner";
import {
  BETA_FEATURES,
  betaInviteUrl,
  isBetaOn,
  setBetaOn,
  subscribeBeta,
  type BetaFeature,
} from "@/lib/beta";

/** One row's live state. Subscribes per feature so flipping one does not
 *  re-render the others, and so another tab's change lands here too. */
function useBetaState(id: string): boolean {
  return useSyncExternalStore(
    subscribeBeta,
    () => isBetaOn(id),
    () => false, // server render: off, like every other fallback
  );
}

function BetaRow({ feature }: { feature: BetaFeature }) {
  const on = useBetaState(feature.id);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const url = betaInviteUrl(feature.id);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(`Invite link copied — it turns on ${feature.label}`);
    } catch {
      toast.info(url);
    }
  };

  return (
    <section className="space-y-2 rounded-lg border border-border bg-bg-elevated p-3">
      <PaneHeading title={feature.label}>{feature.blurb}</PaneHeading>

      <ToggleButtonGroup
        fill
        items={[
          {
            key: "on",
            icon: Beaker,
            label: "On",
            active: on,
            onToggle: () => setBetaOn(feature.id, true),
          },
          {
            key: "off",
            icon: Beaker,
            label: "Off",
            active: !on,
            onToggle: () => setBetaOn(feature.id, false),
          },
        ]}
      />

      {/* Unconditional, because `featureFlags.ts` says it of every flag it
          carries: the reads happen at module init or on paths that have
          already run. Smart Brush is read at boot; GPU blur is read per blur
          but its self-test harness is attached at boot. */}
      <p className="flex items-center gap-1.5 pl-1 text-2xs text-text-muted">
        <RotateCw aria-hidden className="size-3 shrink-0" />
        Reload the page after changing this — it is read when the app starts.
      </p>

      <Button onClick={() => void copy()}>
        <Link2 aria-hidden />
        {copied ? "Invite link copied" : "Copy invite link"}
      </Button>
    </section>
  );
}

export function BetaPane() {
  return (
    <div className="space-y-4">
      <PaneHeading title="Beta features">
        Unfinished work you can switch on for this device, before it is on for
        everyone. Each one is off until you turn it on, and turning one on
        changes nothing for anybody else — these choices are kept in this
        browser and are never sent anywhere. Expect rough edges: a beta feature
        can change or disappear between releases.
      </PaneHeading>

      {BETA_FEATURES.length === 0 ? (
        <p className="text-xs text-text-muted">
          Nothing in beta right now. When something is, it shows up here.
        </p>
      ) : (
        BETA_FEATURES.map((f) => <BetaRow key={f.id} feature={f} />)
      )}

      <p className="text-2xs leading-relaxed text-text-muted">
        An invite link turns one feature on for whoever opens it, on the device
        they open it with. Someone who wants out can use Off above, or open the
        app with <code className="font-mono">?beta=none</code>, which clears all
        of them.
      </p>
    </div>
  );
}
