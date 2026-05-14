// app/src/components/UserMenu.tsx
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/clerk-react";
import { User } from "lucide-react";

export function UserMenu() {
  return (
    <>
      <SignedIn>
        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-8 w-8",
              userButtonTrigger:
                "rounded-full hover:ring-2 hover:ring-accent/50 transition-all",
            },
          }}
        />
      </SignedIn>
      <SignedOut>
        <SignInButton mode="modal">
          <button
            title="Sign in to save your work"
            className="h-8 w-8 rounded-full bg-bg-elevated border border-border text-text-muted hover:text-text-primary hover:ring-2 hover:ring-accent/50 transition-all flex items-center justify-center"
          >
            <User className="h-4 w-4" />
          </button>
        </SignInButton>
      </SignedOut>
    </>
  );
}
