import { AuthenticateWithRedirectCallback } from "@clerk/react-router";

/**
 * Completes the Clerk OAuth redirect inside the auth app.
 *
 * @returns The Clerk redirect callback surface.
 * @remarks The callback path intentionally retains `return_to` so the original in-app destination survives the round trip.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-8 text-foreground">
      <div className="w-full max-w-md space-y-4">
        <AuthenticateWithRedirectCallback />
        <div id="clerk-captcha" />
      </div>
    </div>
  );
}
