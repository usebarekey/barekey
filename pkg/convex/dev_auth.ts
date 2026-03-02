"use node";

import { v } from "convex/values";

import { action } from "./_generated/server";

type ClerkSignInTokenResponse = {
  token?: string;
};

/**
 * Mints a short-lived Clerk sign-in token for a single dev user.
 * This action is intentionally gated by environment variables and must never
 * be enabled in production-facing environments.
 */
export const createSignInTokenForDevUser = action({
  args: {},
  returns: v.object({
    token: v.string(),
  }),
  handler: async () => {
    if (process.env.DEV_LOGIN_ENABLED !== "true") {
      throw new Error("Dev login is disabled. Set DEV_LOGIN_ENABLED=true to enable.");
    }

    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      throw new Error("Missing CLERK_SECRET_KEY for dev login token creation.");
    }
    if (clerkSecretKey.startsWith("sk_live_")) {
      throw new Error("Dev login is blocked for live Clerk secret keys.");
    }

    const clerkPublishableKey = process.env.VITE_CLERK_PUBLISHABLE_KEY ?? "";
    if (clerkPublishableKey.startsWith("pk_live_")) {
      throw new Error("Dev login is blocked for live Clerk publishable keys.");
    }

    const clerkIssuerDomain = process.env.CLERK_JWT_ISSUER_DOMAIN ?? "";
    if (!clerkIssuerDomain.includes(".accounts.dev")) {
      throw new Error(
        "Dev login is only allowed for Clerk development instances (.accounts.dev).",
      );
    }

    const devClerkUserId = process.env.DEV_LOGIN_CLERK_USER_ID;
    if (!devClerkUserId) {
      throw new Error("Missing DEV_LOGIN_CLERK_USER_ID for dev login.");
    }

    const response = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clerkSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: devClerkUserId,
        expires_in_seconds: 120,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(
        `Unable to create Clerk dev sign-in token (${response.status}): ${details}`,
      );
    }

    const payload = (await response.json()) as ClerkSignInTokenResponse;
    if (typeof payload.token !== "string" || payload.token.length === 0) {
      throw new Error("Clerk did not return a valid sign-in token.");
    }

    return { token: payload.token };
  },
});
