// app/src/components/UserMenu.tsx
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/clerk-react";
import { User } from "lucide-react";
import { TinyButton } from "@/components/ui/tiny-button";

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
          <TinyButton title="Sign in to save your work">
            <User className="h-4 w-4" />
          </TinyButton>
        </SignInButton>
      </SignedOut>
    </>
  );
}
