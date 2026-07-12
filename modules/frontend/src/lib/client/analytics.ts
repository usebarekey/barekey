import { posthog } from "$lib/client/posthog";
import { Effect } from "effect";

type EventProperties = Record<string, string | number | boolean | undefined>;

/** Reads the current referrer path through an Effect boundary. */
export const GetReferrerPath = Effect.try(() => {
	if (typeof document === "undefined" || !document.referrer) {
		return undefined;
	}

	const referrer = new URL(document.referrer);

	return referrer.origin === location.origin ? referrer.pathname : referrer.hostname;
}).pipe(Effect.catch(() => Effect.succeed(undefined)));

/** Reads the current page path through an Effect boundary. */
export const GetPagePath = Effect.sync(() =>
	typeof location === "undefined" ? undefined : location.pathname,
);

/** Captures an analytics event through an Effect boundary. */
export const CaptureEvent = (event: string, properties?: EventProperties) =>
	Effect.sync(() => {
		if (typeof document === "undefined") {
			return;
		}

		const payload = properties
			? Object.fromEntries(
					Object.entries(properties).filter(([, value]) => value !== undefined),
				)
			: undefined;

		posthog.capture(event, payload);
	});
