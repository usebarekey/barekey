import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider } from "@clerk/react-router";
import { ThemeWatcher } from "theme-watcher";

import { Toaster } from "@/components/ui/sonner";
import { Router } from "@/router";

import "@/main.css";

const DEFAULT_CLERK_PUBLISHABLE_KEY = "pk_test_bGl2ZS1iZWFyLTQ4LmNsZXJrLmFjY291bnRzLmRldiQ";
const clerkPublishableKey =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? DEFAULT_CLERK_PUBLISHABLE_KEY;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ClerkProvider
        publishableKey={clerkPublishableKey}
        signInUrl={import.meta.env.VITE_CLERK_SIGN_IN_URL ?? "/"}
        signInFallbackRedirectUrl={
          import.meta.env.VITE_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL ?? "/cli/device"
        }
        signUpFallbackRedirectUrl={
          import.meta.env.VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL ?? "/cli/device"
        }
      >
        <ThemeWatcher />
        <Toaster richColors />
        <Router />
      </ClerkProvider>
    </BrowserRouter>
  </StrictMode>
);
