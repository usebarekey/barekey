import { posthog } from "$lib/client/posthog";
import { Effect } from "effect";

type EventProperties = Record<string, string | number | boolean | undefined>;

export const get_referrer_path = () => {
	if (typeof document === "undefined") {
		return undefined;
	}

	if (!document.referrer) {
		return undefined;
	}

	try {
		const referrer = new URL(document.referrer);

		return referrer.origin === location.origin ? referrer.pathname : referrer.hostname;
	} catch {
		return undefined;
	}
};

export const get_page_path = () =>
	typeof location === "undefined" ? undefined : location.pathname;

export function capture_event(event: string, properties?: EventProperties) {
	if (typeof document === "undefined") {
		return;
	}

	const payload = properties
		? Object.fromEntries(Object.entries(properties).filter(([, value]) => value !== undefined))
		: undefined;

	posthog.capture(event, payload);
}

/** Reads the current referrer path through an Effect boundary. */
export const GetReferrerPath = Effect.sync(get_referrer_path);

/** Reads the current page path through an Effect boundary. */
export const GetPagePath = Effect.sync(get_page_path);

/** Captures an analytics event through an Effect boundary. */
export const CaptureEvent = (event: string, properties?: EventProperties) =>
	Effect.sync(() => {
		capture_event(event, properties);
	});
