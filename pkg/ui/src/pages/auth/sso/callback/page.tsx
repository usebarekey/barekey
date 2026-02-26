import { AuthenticateWithRedirectCallback } from "@clerk/react-router";

export function Page() {
  return (
    <div className="w-full max-w-md space-y-4">
      <AuthenticateWithRedirectCallback />
      <div id="clerk-captcha" />
    </div>
  );
}
