// app/src/components/ConvexClerkProvider.tsx
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { dark } from "@clerk/themes";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { useResolvedTheme } from "@/lib/useTheme";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

if (!convexUrl) console.warn("[ConvexClerkProvider] VITE_CONVEX_URL is not set — auth disabled.");
if (!clerkKey)  console.warn("[ConvexClerkProvider] VITE_CLERK_PUBLISHABLE_KEY is not set — auth disabled.");

const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function ConvexClerkProvider({ children }: { children: ReactNode }) {
  // Clerk can't read our CSS vars — drive its appearance from the resolved
  // theme. baseTheme + color variables switch in JS; element overrides use
  // Tailwind `dark:` variants (Clerk's portal lives under <html>.dark).
  const theme = useResolvedTheme();
  const isDark = theme === "dark";

  if (!convex || !clerkKey) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={clerkKey}
      appearance={{
        baseTheme: isDark ? dark : undefined,
        variables: {
          colorPrimary: "#a855f7",
          colorBackground: isDark ? "#18181b" : "#ffffff",
          colorText: isDark ? "#fafafa" : "#2a2622",
          colorTextSecondary: isDark ? "#a1a1aa" : "#5c554c",
          colorInputBackground: isDark ? "#27272a" : "#ffffff",
          colorInputText: isDark ? "#fafafa" : "#2a2622",
          colorNeutral: isDark ? "#fafafa" : "#2a2622",
          borderRadius: "0.75rem",
        },
        elements: {
          card: "bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-[#3f3f46] shadow-2xl",
          headerTitle: "text-zinc-900 dark:text-white",
          headerSubtitle: "text-zinc-500 dark:text-zinc-400",
          socialButtonsBlockButton:
            "bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors",
          socialButtonsBlockButtonText: "text-zinc-900 dark:text-white font-semibold",
          // Invert the (dark) GitHub glyph only in dark mode; keep it black on light.
          "socialButtonsProviderIcon__github": "dark:invert",
          formButtonPrimary: "bg-purple-600 hover:bg-purple-500 text-white",
          footerActionLink:
            "text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300",
          identityPreview:
            "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700",
          formFieldInput:
            "bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
          formFieldLabel: "text-zinc-700 dark:text-zinc-300",
          dividerLine: "bg-zinc-200 dark:bg-zinc-700",
          dividerText: "text-zinc-400 dark:text-zinc-500",
        },
      }}
    >
      <ConvexProviderWithClerk client={convex!} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
