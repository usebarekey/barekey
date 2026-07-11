import posthog from "posthog-js";
import { env as public_env } from "$env/dynamic/public";

declare global {
	var __barekey_posthog: boolean | undefined;
}

const posthog_key = public_env.PUBLIC_POSTHOG_KEY;

export function init_posthog() {
	if (typeof document === "undefined" || globalThis.__barekey_posthog || !posthog_key) {
		return;
	}

	globalThis.__barekey_posthog = true;

	posthog.init(posthog_key, {
		api_host: "https://us.i.posthog.com",
		defaults: "2026-05-30",
	});
}

export { posthog };