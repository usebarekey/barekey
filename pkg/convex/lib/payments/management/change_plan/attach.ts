import { Effect } from "effect";

import { api } from "../../../../_generated/api";
import type { ActionCtx } from "../../../../_generated/server";
import { ExternalServiceError } from "../../../errors/effect";
import {
  decodeAutumnCheckoutUrl,
  hasForceCheckoutUpgradeDowngradeError,
  readAutumnErrorMessage,
} from "../../variants";
import { toBillingPlanChangeError } from "./shared";

/**
 * Starts or retries the Autumn attach flow for a billing plan change.
 *
 * @param convexCtx The Convex action context.
 * @param args The target product id plus checkout behavior controls.
 * @returns An Effect that succeeds with the checkout URL when checkout is required.
 * @remarks This retries without forced checkout for Autumn's known upgrade/downgrade force-checkout variant.
 * @lastModified 2026-03-18
 * @author GPT-5.4
 */
export function attachBillingPlanEffect(
  convexCtx: ActionCtx,
  args: {
    productId: string;
    shouldForceCheckout: boolean;
    successUrl: string | null;
  },
) {
  return Effect.gen(function* () {
    let attachResult = yield* Effect.tryPromise({
      try: () =>
        convexCtx.runAction(api.autumn.attach, {
          productId: args.productId,
          forceCheckout: args.shouldForceCheckout,
          successUrl: args.successUrl ?? undefined,
        }),
      catch: (error) =>
        toBillingPlanChangeError("Failed to start the billing attachment flow.", error),
    });
    if (
      (attachResult.error !== null || attachResult.data === null) &&
      args.shouldForceCheckout &&
      hasForceCheckoutUpgradeDowngradeError(attachResult.error)
    ) {
      attachResult = yield* Effect.tryPromise({
        try: () =>
          convexCtx.runAction(api.autumn.attach, {
            productId: args.productId,
            forceCheckout: false,
            successUrl: args.successUrl ?? undefined,
          }),
        catch: (error) =>
          toBillingPlanChangeError("Failed to retry the billing attachment flow.", error),
      });
    }
    if (attachResult.error !== null || attachResult.data === null) {
      return yield* Effect.fail(
        new ExternalServiceError({
          message:
            readAutumnErrorMessage(attachResult.error) ??
            "Unable to start checkout for this billing change.",
        }),
      );
    }

    return {
      checkoutUrl: decodeAutumnCheckoutUrl(attachResult.data),
    };
  });
}
