const DEFAULT_RETURN_TO_PATH = "/cli/device";

function normalizeRelativePath(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0 || !trimmed.startsWith("/")) {
    return null;
  }
  if (trimmed.startsWith("//")) {
    return null;
  }
  return trimmed;
}

/**
 * Builds the current relative route including query string.
 *
 * @param pathname The current route pathname.
 * @param search The current route search string.
 * @returns The normalized relative path for return routing.
 * @remarks This intentionally keeps the full device-approval query so CLI user codes survive redirects.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export function buildReturnToPath(pathname: string, search: string): string {
  const normalizedPath = normalizeRelativePath(pathname) ?? DEFAULT_RETURN_TO_PATH;
  const normalizedSearch =
    search.trim().length > 0 ? (search.startsWith("?") ? search : `?${search}`) : "";
  return `${normalizedPath}${normalizedSearch}`;
}

/**
 * Resolves the post-auth destination from an auth route query string.
 *
 * @param searchParams The search params containing an optional `return_to` or `returnTo`.
 * @returns The safe relative destination path.
 * @remarks Only relative same-app paths are allowed so redirects cannot escape the auth app origin.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export function resolveReturnToPath(searchParams: URLSearchParams): string {
  const encodedValue = searchParams.get("return_to") ?? searchParams.get("returnTo");
  if (encodedValue === null) {
    return DEFAULT_RETURN_TO_PATH;
  }

  const normalized = normalizeRelativePath(encodedValue);
  return normalized ?? DEFAULT_RETURN_TO_PATH;
}

/**
 * Builds the custom SSO entry route for one in-app destination.
 *
 * @param returnTo The relative route that should be restored after auth completes.
 * @returns The auth SSO entry route with preserved return context.
 * @remarks Device approval and future auth-gated pages can use this to keep their original query intact.
 * @lastModified 2026-03-19
 * @author GPT-5.4
 */
export function buildSsoPath(returnTo: string): string {
  const searchParams = new URLSearchParams({
    return_to: normalizeRelativePath(returnTo) ?? DEFAULT_RETURN_TO_PATH,
  });
  return `/auth/sso?${searchParams.toString()}`;
}
