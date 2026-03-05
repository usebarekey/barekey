import { makeFunctionReference } from "convex/server";

import type { UserPreferences } from "@/lib/user-preferences";

export type CurrentUserAccount = {
  clerkUserId: string;
  slug: string;
  slugBase: string;
  email: string | null;
  displayName: string | null;
  imageUrl: string | null;
  createdAtMs: number;
  updatedAtMs: number;
  lastSeenAtMs: number;
};

export type CurrentUserFreePlanCredit = {
  totalCredits: number;
  remainingCredits: number;
  assignedOrgId: string | null;
  assignedOrgSlug: string | null;
};

type UpsertUserPreferencesArgs = {
  preferredTheme: UserPreferences["preferredTheme"];
  defaultOrgSlug: string | null;
  landingPreference: UserPreferences["landingPreference"];
};

export const getCurrentUserAccountRef = makeFunctionReference<
  "query",
  Record<string, never>,
  CurrentUserAccount | null
>("users:getCurrentUserAccount");

export const getCurrentUserPreferencesRef = makeFunctionReference<
  "query",
  Record<string, never>,
  UserPreferences | null
>("user_preferences:getCurrentUserPreferences");

export const getCurrentUserFreePlanCreditRef = makeFunctionReference<
  "query",
  Record<string, never>,
  CurrentUserFreePlanCredit
>("users:getCurrentUserFreePlanCredit");

export const upsertCurrentUserPreferencesRef = makeFunctionReference<
  "mutation",
  UpsertUserPreferencesArgs,
  UserPreferences
>("user_preferences:upsertCurrentUserPreferences");
