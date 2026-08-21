// app/src/app/UserMenu.tsx
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/clerk-react";
import { User } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { MediaTile } from "@/components/MediaTile";

/** `large` → a welcome-back-sized avatar / sign-in tile (the small icon was hard
 *  to see on the full-page surfaces); default is the compact top-bar size.
 *
 *  `grouped` → this instance sits inside a group pill (the top bar's and the
 *  master bar's cog/user cluster), so the button must be transparent at rest
 *  and let the pill's `bg-bg-tertiary` through. Default false, because the two
 *  OTHER render sites — the upload dialog and the Settings modal — have no pill
 *  and still need `standalone`'s own fill or they read as a bare glyph. */
export function UserMenu({
  large = false,
  grouped = false,
}: {
  large?: boolean;
  grouped?: boolean;
}) {
  return (
    <>
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
          {large ? (
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
