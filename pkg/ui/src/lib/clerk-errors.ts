type ClerkErrorEntry = {
  code?: string;
  longMessage?: string;
  message?: string;
};

type ClerkErrorLike = {
  code?: string;
  errors?: Array<ClerkErrorEntry>;
  message?: string;
  status?: number;
  statusCode?: number;
};

function asClerkErrorLike(error: unknown): ClerkErrorLike | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  return error as ClerkErrorLike;
}

export function isClerkIdentifierExistsError(error: unknown): boolean {
  const clerkError = asClerkErrorLike(error);
  if (clerkError === null) {
    return false;
  }

  const status =
    typeof clerkError.status === "number"
      ? clerkError.status
      : typeof clerkError.statusCode === "number"
        ? clerkError.statusCode
        : null;

  if (status !== 422) {
    return false;
  }

  if (clerkError.code === "form_identifier_exists") {
    return true;
  }

  return clerkError.errors?.some((entry) => entry.code === "form_identifier_exists") ?? false;
}

export function getClerkErrorMessage(error: unknown, fallback: string): string {
  const clerkError = asClerkErrorLike(error);
  if (clerkError === null) {
    return fallback;
  }

  const firstError = clerkError.errors?.[0];
  if (firstError?.longMessage) return firstError.longMessage;
  if (firstError?.message) return firstError.message;
  if (clerkError.message) return clerkError.message;

  return fallback;
}
