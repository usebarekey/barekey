import { env } from "node:process";
import adapter from "@sveltejs/adapter-vercel";
import type { Adapter } from "@sveltejs/kit";
import { ts } from "svelte-global-typescript";
import { sv } from "svelte-sv-extension";
import { compose_config, kit } from "svelte-plugin-composer";

const check_adapter = (): Adapter => ({
	name: "barekey-check-adapter",
	adapt: () => {},
});

export default compose_config([
	sv(),
	ts(),
	kit({
		alias: {
			$: "src/routes",
			"$content": "src/content",
		},
		compilerOptions: {
			/**
			 * Force runes mode for the project, except for libraries.
			 * Can be removed in Svelte 6.
			 */
			runes: ({ filename }) =>
				filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
			experimental: {
				async: true,
			},
		},
		experimental: {
			remoteFunctions: true,
		},
		adapter:
			env.BAREKEY_CHECK_BUILD === "1"
				? check_adapter()
				: adapter({
						runtime: "nodejs24.x",
					}),
	}),
]);
