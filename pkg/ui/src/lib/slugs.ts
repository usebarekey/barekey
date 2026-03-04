import slugify from "slugify";

const RESERVED_USER_SLUG_BASES = new Set([
  "auth",
  "api",
  "admin",
  "o",
  "u",
  "orgs",
  "new",
  "select",
  "settings",
  "me",
  "support",
  "help",
  "login",
  "signup",
  "account",
  "dashboard",
]);

function normalizeBase(value: string): string {
  const normalized = slugify(value, {
    lower: true,
    strict: true,
    trim: true,
  })
    .replace(/-/g, "")
    .slice(0, 20);
  if (normalized.length === 0) {
    return "user";
  }

  if (RESERVED_USER_SLUG_BASES.has(normalized)) {
    return `${normalized}user`.slice(0, 20);
  }

  return normalized;
}

function normalizeKebabBase(value: string, fallback: string): string {
  const normalized = slugify(value, {
    lower: true,
    strict: true,
    trim: true,
  })
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 32)
    .replace(/-+$/, "");

  if (normalized.length === 0) {
    return fallback;
  }

  if (RESERVED_USER_SLUG_BASES.has(normalized)) {
    return `${normalized}-${fallback}`.slice(0, 32).replace(/-+$/, "");
  }

  return normalized;
}

export function getUserSlugBaseFromIdentity(input: {
  email?: string | null;
  fullName?: string | null;
}): string {
  const emailLocalPart = input.email?.split("@")[0];
  if (emailLocalPart && emailLocalPart.length > 0) {
    return normalizeBase(emailLocalPart);
  }

  if (input.fullName && input.fullName.length > 0) {
    return normalizeBase(input.fullName);
  }

  return "user";
}

export function randomNumericSuffix(length = 4): string {
  const upperBound = 10 ** length;
  const value = Math.floor(Math.random() * upperBound);
  return String(value).padStart(length, "0");
}

export function generateUserSlugCandidate(input: {
  email?: string | null;
  fullName?: string | null;
}): string {
  const base = getUserSlugBaseFromIdentity(input);
  return `${base}-${randomNumericSuffix(4)}`;
}

export function generateDefaultOrgName(input: {
  fullName?: string | null;
  email?: string | null;
}): string {
  const baseName =
    input.fullName?.trim() ||
    input.email?.split("@")[0]?.trim() ||
    "User";
  return `${baseName}'s Organization`;
}

export function generateDefaultOrgSlugCandidate(input: {
  email?: string | null;
  fullName?: string | null;
}): string {
  const emailLocalPart = input.email?.split("@")[0]?.trim();
  const base = normalizeKebabBase(
    input.fullName?.trim() || emailLocalPart || "organization",
    "org",
  );
  return `${base}-${randomNumericSuffix(4)}`;
}

export function generateOrganizationSlugCandidateFromName(name: string): string {
  const base = normalizeKebabBase(name, "org");
  return `${base}-${randomNumericSuffix(4)}`;
}
