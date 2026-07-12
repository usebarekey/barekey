import posthog from "posthog-js";
import { env as public_env } from "$env/dynamic/public";
import { Effect, Layer } from "effect";

const posthog_key = public_env.PUBLIC_POSTHOG_KEY;

/** Initializes PostHog for the lifetime of the client runtime. */
export const PostHogLive = Layer.effectDiscard(
	Effect.acquireRelease(
		Effect.sync(() => {
			if (!posthog_key) {
				return false;
			}

			posthog.init(posthog_key, {
				api_host: "https://us.i.posthog.com",
				defaults: "2026-05-30",
			});

			return true;
		}),
		(initialized) =>
			Effect.sync(() => {
				if (initialized) {
					posthog.reset();
				}
			}),
	),
);

export { posthog };
