import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider, useAuth } from "@clerk/react-router";
import { ThemeWatcher } from "theme-watcher";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { Router } from "@/router";
import { Debugger } from "@/components/custom/debugger";
import { Toaster } from "@/components/ui/sonner";
import { PostHogRootProvider } from "@/lib/posthog";

import "@/main.css";
import { ConvexReactClient } from "convex/react";

function requireEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

const convex = new ConvexReactClient(
  requireEnv("VITE_CONVEX_URL", import.meta.env.VITE_CONVEX_URL),
);

const clerkPublishableKey = requireEnv(
  "VITE_CLERK_PUBLISHABLE_KEY",
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ClerkProvider
        publishableKey={clerkPublishableKey}
        signInUrl={import.meta.env.VITE_CLERK_SIGN_IN_URL ?? "/auth/sso"}
        signInFallbackRedirectUrl={
          import.meta.env.VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL ?? "/"
        }
        signUpFallbackRedirectUrl={
          import.meta.env.VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL ?? "/"
        }
        afterSignOutUrl="/auth/sso"
      >
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <PostHogRootProvider>
            <Debugger />
            <ThemeWatcher />
            <Toaster richColors />
            <Router />
          </PostHogRootProvider>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </BrowserRouter>
  </StrictMode>,
);
