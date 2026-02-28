export type MemberDisplayIdentity = {
  firstName: string | null;
  lastName: string | null;
  identifier: string;
};

export function displayName(input: MemberDisplayIdentity): string {
  const full = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
  return full || input.identifier;
}

export function initials(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("")
    .slice(0, 2);
}

export function formatDate(value: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(value);
}
