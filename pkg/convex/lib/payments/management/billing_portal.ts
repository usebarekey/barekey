import { Effect } from "effect";

import { api } from "../../../_generated/api";
import type { ActionCtx } from "../../../_generated/server";
import { appendEventInternalReference } from "../../../audit/refs";
import {
  assertExpectedOrgSlugEffect,
  requireActiveOrgIdClaimsEffect,
  requireIdentityEffect,
} from "../../auth";
import { AuthError, ExternalServiceError, ValidationError } from "../../errors/effect";
import { isBillingManagerRole, normalizeString } from "../variants";

export type OpenBillingPortalForCurrentOrgResult = {
  portalUrl: string;
};

/**
 * Opens the billing portal for the current organization.
 *
 * @param ctx The Convex action context.
 * @param args The expected org slug and optional portal return URL.
 * @returns The billing portal URL.
 * @remarks This ensures the Autumn customer exists and appends a billing audit event when the portal opens.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function openBillingPortalForCurrentOrgHandler(
  ctx: ActionCtx,
  args: {
    expectedOrgSlug: string;
    returnUrl: string | null;
  },
): Promise<OpenBillingPortalForCurrentOrgResult> {
  return await Effect.runPromise(
    Effect.gen(function* () {
      const identity = yield* requireIdentityEffect(ctx);
      const activeOrg = yield* requireActiveOrgIdClaimsEffect(identity);
      if (activeOrg.orgSlug !== null) {
        yield* assertExpectedOrgSlugEffect(activeOrg, args.expectedOrgSlug);
      }
      if (!isBillingManagerRole(activeOrg.orgRole)) {
        return yield* Effect.fail(
          new ValidationError({ message: "Only organization admins can manage billing settings." }),
        );
      }

      yield* Effect.tryPromise({
        try: () =>
          ctx.runAction(api.autumn.createCustomer, {
            errorOnNotFound: false,
          }),
        catch: (error) =>
          new ExternalServiceError({
            message: "Failed to initialize the billing customer.",
            cause: error,
          }),
      });

      const portalResult = yield* Effect.tryPromise({
        try: () =>
          ctx.runAction(api.autumn.billingPortal, {
            returnUrl: args.returnUrl ?? undefined,
          }),
        catch: (error) =>
          new ExternalServiceError({
            message: "Failed to request the billing portal.",
            cause: error,
          }),
      });
      if (portalResult.error !== null || portalResult.data === null) {
        return yield* Effect.fail(
          new ExternalServiceError({ message: "Unable to open billing portal right now." }),
        );
      }

      const portalUrl = normalizeString(
        (portalResult.data as { url?: unknown; portal_url?: unknown }).url ??
          (portalResult.data as { url?: unknown; portal_url?: unknown }).portal_url,
      );
      if (portalUrl === null) {
        return yield* Effect.fail(
          new ExternalServiceError({ message: "Billing portal response did not include a URL." }),
        );
      }

      yield* Effect.tryPromise({
        try: () =>
          ctx.runMutation(appendEventInternalReference, {
            orgId: activeOrg.orgId,
            orgSlug: activeOrg.orgSlug ?? args.expectedOrgSlug,
            projectId: null,
            projectSlug: null,
            stageSlug: null,
            eventType: "billing.portal_opened",
            category: "billing",
            actorSource: "barekey_user",
            actorClerkUserId: activeOrg.clerkUserId,
            actorDisplayName:
              identity.name ?? identity.nickname ?? identity.preferredUsername ?? null,
            actorEmail: identity.email ?? null,
            subjectType: "billing",
            subjectId: activeOrg.orgId,
            subjectName: activeOrg.orgSlug ?? args.expectedOrgSlug,
            title: "Opened billing portal",
            description: `Billing management was opened for ${(activeOrg.orgSlug ?? args.expectedOrgSlug)}.`,
            severity: "info",
            payloadJson: JSON.stringify({
              returnUrl: args.returnUrl,
            }),
            retentionTierOverride: null,
          }),
        catch: (error) =>
          new ExternalServiceError({
            message: "Failed to append the billing portal audit event.",
            cause: error,
          }),
      });

      return {
        portalUrl,
      };
    }).pipe(
      Effect.mapError((error: unknown) => {
        if (
          error instanceof AuthError ||
          error instanceof ExternalServiceError ||
          error instanceof ValidationError
        ) {
          return new Error(error.message);
        }
        return error instanceof Error ? error : new Error("Unexpected billing portal error.");
      }),
    ),
  );
}
