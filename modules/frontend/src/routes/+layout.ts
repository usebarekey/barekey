import { browser } from "$app/environment";
import { init_posthog } from "$lib/client/posthog";

export const prerender = true;

export const load = async () => {
	if (browser) {
		init_posthog();
	}
};
