import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider } from "@clerk/react-router";
import { ThemeWatcher } from "theme-watcher";

import { Toaster } from "@/components/ui/sonner";
import { runtimeConfig } from "@/lib/runtime-config";
import { Router } from "@/router";

import "@/main.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ClerkProvider
        publishableKey={runtimeConfig.clerkPublishableKey}
        signInUrl={runtimeConfig.clerkSignInUrl}
        signInFallbackRedirectUrl={runtimeConfig.clerkSignInFallbackRedirectUrl}
        signUpFallbackRedirectUrl={runtimeConfig.clerkSignUpFallbackRedirectUrl}
      >
        <ThemeWatcher />
        <Toaster richColors />
        <Router />
      </ClerkProvider>
    </BrowserRouter>
  </StrictMode>,
);
