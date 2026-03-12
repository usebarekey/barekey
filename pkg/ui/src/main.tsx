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
import { runtimeConfig } from "@/lib/runtime-config";

import "@/main.css";
import { ConvexReactClient } from "convex/react";
const convex = new ConvexReactClient(runtimeConfig.convexUrl);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ClerkProvider
        publishableKey={runtimeConfig.clerkPublishableKey}
        signInUrl={runtimeConfig.clerkSignInUrl}
        signInFallbackRedirectUrl={runtimeConfig.clerkSignInFallbackRedirectUrl}
        signUpFallbackRedirectUrl={runtimeConfig.clerkSignUpFallbackRedirectUrl}
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
