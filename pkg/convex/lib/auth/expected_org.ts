import { Effect } from "effect";

import { AuthError } from "../errors/effect";
import { toThrownAuthError } from "./shared";

/**
 * Verifies that the current active organization slug matches an expected workspace slug.
 *
 * @param claims The current organization claims.
 * @param expectedOrgSlug The workspace slug requested by the caller, if any.
 * @returns An Effect that succeeds when the slug matches or is not required.
 * @remarks This is the Effect-native validation path for workspace-scoped requests.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function assertExpectedOrgSlugEffect(
  claims: { orgSlug: string | null },
  expectedOrgSlug: string | null,
): Effect.Effect<void, AuthError> {
  if (expectedOrgSlug === null) {
    return Effect.void;
  }

  if (claims.orgSlug !== expectedOrgSlug) {
    return Effect.fail(
      new AuthError({
        message: "Active organization does not match the requested workspace.",
      }),
    );
  }

  return Effect.void;
}

/**
 * Verifies that the current active organization slug matches an expected workspace slug.
 *
 * @param claims The current organization claims.
 * @param expectedOrgSlug The workspace slug requested by the caller, if any.
 * @returns Nothing when validation succeeds.
 * @remarks This compatibility wrapper throws a standard `Error` so current callers keep working unchanged.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function assertExpectedOrgSlug(
  claims: { orgSlug: string | null },
  expectedOrgSlug: string | null,
): void {
  Effect.runSync(
    assertExpectedOrgSlugEffect(claims, expectedOrgSlug).pipe(
      Effect.mapError(toThrownAuthError),
    ),
  );
}
