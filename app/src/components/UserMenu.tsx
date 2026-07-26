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
 *  to see on the full-page surfaces); default is the compact top-bar size. */
export function UserMenu({ large = false }: { large?: boolean }) {
  return (
    <>
      <SignedIn>
        <UserButton
          appearance={{
            elements: {
              avatarBox: large ? "h-14 w-14" : "h-8 w-8",
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
              standalone
            />
          )}
        </SignInButton>
      </SignedOut>
    </>
  );
}
