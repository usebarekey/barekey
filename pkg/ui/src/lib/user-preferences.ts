export const PreferredTheme = {
  System: "system",
  Light: "light",
  Dark: "dark",
} as const;

export type PreferredTheme = (typeof PreferredTheme)[keyof typeof PreferredTheme];

export const LandingPreference = {
  AccountOverview: "account_overview",
  DefaultWorkspace: "default_workspace",
} as const;

export type LandingPreference = (typeof LandingPreference)[keyof typeof LandingPreference];

export type UserPreferences = {
  preferredTheme: PreferredTheme;
  defaultOrgSlug: string | null;
  landingPreference: LandingPreference;
  createdAtMs: number | null;
  updatedAtMs: number | null;
};
