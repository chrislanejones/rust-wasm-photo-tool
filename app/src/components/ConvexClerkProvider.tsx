// app/src/components/ConvexClerkProvider.tsx
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const convex = new ConvexReactClient(
  import.meta.env.VITE_CONVEX_URL as string,
);

export function ConvexClerkProvider({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string}
      appearance={{
        variables: {
          colorPrimary: "#a855f7",
          colorBackground: "#18181b",
          colorText: "#fafafa",
          colorInputBackground: "#27272a",
          colorInputText: "#fafafa",
          borderRadius: "0.75rem",
        },
        elements: {
          card: "bg-[#18181b] border border-[#3f3f46] shadow-2xl",
          headerTitle: "text-white",
          headerSubtitle: "text-zinc-400",
          socialButtonsBlockButton:
            "bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700",
          formButtonPrimary: "bg-purple-600 hover:bg-purple-500 text-white",
          footerActionLink: "text-purple-400 hover:text-purple-300",
          identityPreview: "bg-zinc-800 border-zinc-700",
          formFieldInput:
            "bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500",
          formFieldLabel: "text-zinc-300",
          dividerLine: "bg-zinc-700",
          dividerText: "text-zinc-500",
        },
      }}
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
