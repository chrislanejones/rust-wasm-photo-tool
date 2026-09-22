// The phone surface's Settings. A bottom sheet over MobileShell holding TWO
// panes — <AppearancePane/> and <SyncPane/>, the same components the desktop
// Settings modal renders on its Appearance and Sync tabs. Reused whole, not
// re-implemented: a second theme control is how two surfaces drift into
// disagreeing about what "System" means.
//
// Sync is here because the phone is where "it shows nothing" gets noticed:
// the phone surface is the gallery, and the gallery is exactly what does not
// sync. Without the status line the phone had no way to say whether sync was
// working, and no way to switch it off or send its own settings.
//
// NOT the desktop Settings modal. That one is 760px of tab rail plus ten panes
// and is unusable at 390px, and because dialogs portal ABOVE `--z-mobile` it
// would land on top of MobileShell rather than inside it. Hence its own store
// flag (`mobileSettingsOpen`), not `settingsOpen`.
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { AppearancePane } from "@/components/AppearancePane";
import { SyncPane } from "@/components/SyncPane";
import {
  serializePreferences,
  usePreferences,
  type Preferences,
} from "@/lib/preferences";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileSettingsSheet({ open, onOpenChange }: Props) {
  // The SAME hook the desktop Settings modal and the command palette use.
  // `usePreferences` broadcasts every commit to all live instances, so a theme
  // picked here reaches AppShell's copy (and its `useTheme`) without a prop, a
  // context, or a window event. Theme is a LOCAL preference: it lands in
  // localStorage first and only mirrors to Convex when signed in, so this whole
  // sheet works logged out.
  const [prefs, applyPreferences] = usePreferences();

  // ── Why a draft + Apply, and not a live toggle ──────────────────────────────
  // Two toggles is little enough that committing on tap was tempting. Three
  // reasons not to:
  //   1. The desktop Settings modal is draft-then-Apply. Two surfaces that
  //      disagree about when a preference is real is a bug of its own, and the
  //      shared <AppearancePane/> says so in its own body copy ("Applied on
  //      Apply & Save") — live-committing would make the component lie.
  //   2. `applyPreferences` writes localStorage AND fires a Convex mutation.
  //      Live commit on a three-way theme choice is up to three network writes
  //      while someone is still deciding; one Apply is one write.
  //   3. Dismissing therefore means discard, which is a real affordance on a
  //      phone where a mis-tap is a fingertip away from the control you wanted.
  // What DOES differ from desktop is dismissal: Apply closes the sheet. The
  // desktop modal stays open because it is a ten-pane workspace you keep
  // working in; this is one pane with one action, and leaving it parked over
  // the gallery afterwards is dead weight. The commit model — the part worth
  // keeping identical — is identical.
  const [draft, setDraft] = useState<Preferences>(prefs);
  useEffect(() => {
    if (open) setDraft(prefs); // re-seed on open / after a commit
  }, [open, prefs]);

  const dirty = serializePreferences(draft) !== serializePreferences(prefs);

  const handleApply = () => {
    applyPreferences(draft);
    // No per-field description here (the desktop modal's `describeChanges`
    // covers ten preferences; this pane has two, and the theme repaint IS the
    // feedback). The toast exists for Reduce motion, which has no visible
    // before/after on a gallery screen.
    toast.success("Settings applied");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* No aria-label here: DialogTitle + DialogDescription below already give
          Radix the aria-labelledby / aria-describedby pair, and an aria-label
          would REPLACE the title as the accessible name. */}
      {/* 92dvh, and the body below takes the leftover. MEASURED at 320×568 (the
          smallest phone the app targets): a flat `max-h-[60vh]` body clipped the
          Motion toggles mid-button, because 60% of a short viewport is less room
          than this content needs while the header and footer keep their full
          height regardless. Capping the SHEET and letting one child flex is the
          version that holds at 568px and at 844px. `dvh`, not `vh`, so a mobile
          browser's retracting URL bar doesn't leave the footer off-screen. */}
      <DialogContent size="sheet" className="max-h-[92dvh]">
        {/* The header's close is `btn-icon` — 24×24, which is the right box in
            a desktop dialog and under the WCAG 2.5.5 target on a phone. Bumped
            with min-h/min-w rather than h/w: `.btn-icon` is a plain CSS class in
            styles.css, so a `size-11` utility only ties with it on specificity
            and the winner depends on stylesheet order. A min-* always wins over
            a height, whatever the order. */}
        <DialogHeader className="shrink-0 [&_button]:min-h-11 [&_button]:min-w-11">
          <DialogTitle className="text-base">Settings</DialogTitle>
          {/* `text-text-secondary`, not `DialogDescription`'s default muted:
              MEASURED at 3.65:1 on the light paper, under the 4.5:1 AA floor
              for 12px body text. Secondary is 5.75:1. Overridden here rather
              than in `ui/dialog` because that default is shared with every
              other dialog in the app and re-toning all of them is its own
              session — see the report. */}
          <DialogDescription className="text-xs text-text-secondary">
            Theme and motion, and whether this device syncs with your account.
          </DialogDescription>
        </DialogHeader>

        {/* Two descendant rules on the wrapper around <AppearancePane/>, both
            aimed at its shared ToggleButtonGroup, so the pane and the group
            stay untouched for the desktop that also renders them:

            · min-h-16 — the 30px desktop box is under the 44px touch target.
            · flex-col — MEASURED at 390px: three `fill` toggles come out 110.7px
              wide, which leaves 60.7px for the label once the 12px JetBrains
              Mono icon and padding are paid for. "System setting" needs ~101px
              and "Light mode" ~72px, so ALL THREE wrapped mid-phrase in a
              horizontal row, and no font or padding tweak that keeps the icons
              can buy 40px back. Stacking the icon over the label spends the
              height we already owe the touch target and gives the label the
              button's full 86.7px, which fits every label but "System setting"
              — and that one now breaks between its two words. */}
        <DialogBody className="min-h-0 flex-1 space-y-6 overflow-y-auto">
          <div className="[&_button]:min-h-16 [&_button]:flex-col [&_button]:gap-1">
            <AppearancePane
              value={draft.theme}
              onChange={(theme) => setDraft((d) => ({ ...d, theme }))}
              reduceMotion={draft.reduceMotion}
              onReduceMotionChange={(reduceMotion) =>
                setDraft((d) => ({ ...d, reduceMotion }))
              }
            />
          </div>
          {/* Sync commits IMMEDIATELY, not on Apply — its three controls are
              not preferences in the draft (see SyncPane). Its buttons are
              labels in a row, not icon-over-label tiles, so they only get the
              44px touch floor, not the stacked layout above. */}
          <div className="[&_button]:min-h-11">
            <SyncPane />
          </div>
        </DialogBody>

        <DialogFooter className="shrink-0 flex-row gap-2">
          <Button
            size="large"
            className="min-h-11 flex-1"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="large"
            className="min-h-11 flex-1"
            onClick={handleApply}
            disabled={!dirty}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
