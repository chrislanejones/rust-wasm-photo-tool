// app/src/components/UserMenu.tsx
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/clerk-react";

export function UserMenu() {
  return (
    <>
      <SignedIn>
        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-7 w-7",
              userButtonTrigger:
                "rounded-lg hover:ring-2 hover:ring-accent/50 transition-all",
            },
          }}
        />
      </SignedIn>
      <SignedOut>
        <SignInButton mode="modal">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent text-text-primary text-xs font-semibold font-mono hover:brightness-110 transition-all">
            Sign In
          </button>
        </SignInButton>
      </SignedOut>
    </>
  );
}
