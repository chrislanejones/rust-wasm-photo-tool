// app/src/app/UserMenu.tsx
import {
  ClerkLoading,
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/clerk-react";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { MediaTile } from "@/components/MediaTile";
import { Skeleton } from "@/components/ui/skeleton";
import { useDelayedFlag } from "@/hooks/usePhotoSwitching";
import { CLOUD_CONFIGURED } from "@/lib/cloud";
import { cn } from "@/lib/utils";

/** The slot's footprint while Clerk loads, one per render site. Until Clerk
 *  answers, neither <SignedIn> nor <SignedOut> renders, so the slot used to be
 *  EMPTY and the avatar or Sign-in button popped into the bar a beat later,
 *  shoving its neighbors. Sizes are what arrives: the avatar box for the
 *  compact sites, the MediaTile box (h-16, the larger of tile and avatar; lg
 *  not the tile's xl corner, which the radius ratchet freezes) for
 *  `large`, and a large text button's box for `labeled`. */
const LOADING_SLOT = {
  labeled: "h-9 w-[92px] rounded-lg",
  large: "h-16 w-16 rounded-lg",
  grouped: "h-9 w-9 rounded-full",
  compact: "h-8 w-8 rounded-full",
} as const;

/** Space is reserved at once; the grey shape only appears after the 300 ms
 *  grace, so a fast Clerk load shows nothing at all. Decorative: a toolbar slot
 *  announcing "Loading" on every boot is noise, and the button that replaces it
 *  carries its own label. */
function AuthSlotSkeleton({ slot }: { slot: keyof typeof LOADING_SLOT }) {
  const shown = useDelayedFlag(true);
  return (
    <Skeleton
      decorative
      data-testid="auth-slot-skeleton"
      data-shown={shown || undefined}
      className={cn("shrink-0", LOADING_SLOT[slot], !shown && "invisible")}
    />
  );
}

/** `large` → a welcome-back-sized avatar / sign-in tile (the small icon was hard
 *  to see on the full-page surfaces); default is the compact top-bar size.
 *
 *  `grouped` → this instance sits inside a group pill (the top bar's and the
 *  master bar's cog/user cluster), so the button must be transparent at rest
 *  and let the pill's `bg-bg-tertiary` through. Default false, because the two
 *  OTHER render sites — the upload dialog and the Settings modal — have no pill
 *  and still need `standalone`'s own fill or they read as a bare glyph.
 *
 *  `labeled` → signed out, a text "Sign in" button rather than a bare person
 *  glyph. The Settings footer uses it (Chris, 10-05-2026): the icon alone, at
 *  the footer's left beside two large text buttons, read as decoration and he
 *  could not find where to sign in. */
export function UserMenu({
  large = false,
  grouped = false,
  labeled = false,
}: {
  large?: boolean;
  grouped?: boolean;
  labeled?: boolean;
}) {
  // No ClerkProvider in a keyless build, and Clerk's components throw without
  // one — there is nothing to sign in to, so there is nothing to draw.
  if (!CLOUD_CONFIGURED) return null;
  const slot = labeled ? "labeled" : large ? "large" : grouped ? "grouped" : "compact";
  return (
    <>
      <ClerkLoading>
        <AuthSlotSkeleton slot={slot} />
      </ClerkLoading>
      <SignedIn>
        <UserButton
          appearance={{
            elements: {
              // 36px in the pill, to match the cog beside it. The avatar
              // itself stays round — that is what an avatar is, and it is not
              // the button radius the bars standardised on.
              avatarBox: large ? "h-14 w-14" : grouped ? "h-9 w-9" : "h-8 w-8",
              userButtonTrigger:
                "rounded-full hover:ring-2 hover:ring-accent/50 transition-all",
            },
          }}
        />
      </SignedIn>
      <SignedOut>
        <SignInButton mode="modal">
          {labeled ? (
            <Button size="large" title="Sign in to save your work">
              <User aria-hidden />
              Sign in
            </Button>
          ) : large ? (
            <MediaTile
              icon={User}
              onClick={() => {}}
              title="Sign in to save your work"
              aria-label="Sign in"
            />
          ) : (
            <IconButton
              icon={User}
              label="Sign in"
              title="Sign in to save your work"
              standalone={!grouped}
            />
          )}
        </SignInButton>
      </SignedOut>
    </>
  );
}
