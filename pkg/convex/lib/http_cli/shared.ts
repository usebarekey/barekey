import { runtimeConfig } from "../runtime_config";

/**
 * Reads a JSON HTTP body for CLI routes.
 *
 * @param request The incoming HTTP request.
 * @returns The parsed JSON payload.
 * @remarks Callers should translate parse failures into route-specific HTTP errors.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function readJsonBody(request: Request): Promise<unknown> {
  return await request.json();
}

/**
 * Checks whether a host is trusted for CLI UI verification links.
 *
 * @param host The host value to inspect.
 * @returns `true` when the host is trusted for CLI UI flows.
 * @remarks This intentionally allows local development hosts and trusted barekey.dev hosts only.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function isTrustedCliUiHost(host: string): boolean {
  const normalizedHost = host.trim().toLowerCase();
  return (
    normalizedHost === "barekey.dev" ||
    normalizedHost.endsWith(".barekey.dev") ||
    normalizedHost === "localhost" ||
    normalizedHost.startsWith("localhost:") ||
    normalizedHost === "127.0.0.1" ||
    normalizedHost.startsWith("127.0.0.1:") ||
    normalizedHost === "[::1]" ||
    normalizedHost.startsWith("[::1]:")
  );
}

/**
 * Resolves the public CLI UI origin for device verification links.
 *
 * @param request The incoming HTTP request.
 * @returns The trusted UI origin to use for device verification URLs.
 * @remarks This prefers configured UI origins, rejects Convex-hosted UI origins, and falls back to trusted request hosts.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function getCliUiOrigin(request: Request): string {
  const defaultPublicUiOrigin = "https://barekey.dev";
  const configured = runtimeConfig.barekeyUiOrigin;
  if (configured && configured.trim().length > 0) {
    const normalizedConfigured = configured.trim().replace(/\/$/, "");
    try {
      const configuredUrl = new URL(normalizedConfigured);
      if (
        configuredUrl.host.endsWith(".convex.site") ||
        configuredUrl.host.endsWith(".convex.cloud")
      ) {
        return defaultPublicUiOrigin;
      }
    } catch {
      return defaultPublicUiOrigin;
    }
    return normalizedConfigured;
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim();
  if (forwardedHost && forwardedHost.length > 0) {
    const derivedHost = forwardedHost.replace(/^api\./, "");
    if (isTrustedCliUiHost(derivedHost)) {
      const protocol =
        forwardedProto && forwardedProto.length > 0 ? forwardedProto.replace(/:$/, "") : "https";
      return `${protocol}://${derivedHost}`;
    }
  }

  const requestUrl = new URL(request.url);
  const derivedHost = requestUrl.host.replace(/^api\./, "");
  if (derivedHost !== requestUrl.host && isTrustedCliUiHost(derivedHost)) {
    return `${requestUrl.protocol}//${derivedHost}`;
  }
  if (
    requestUrl.host === "chatty-sparrow-921.convex.site" ||
    requestUrl.host === "chatty-sparrow-921.convex.cloud"
  ) {
    return defaultPublicUiOrigin;
  }
  return isTrustedCliUiHost(requestUrl.host) ? requestUrl.origin : defaultPublicUiOrigin;
}
