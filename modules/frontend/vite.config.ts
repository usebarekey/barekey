import { env } from "node:process";
import type { Adapter } from "@sveltejs/kit";
import adapter from "@sveltejs/adapter-vercel";
import tailwindcss from "@tailwindcss/vite";
import { href } from "svelte-auto-href";
import { effect } from "svelte-effect-runtime";
import { ts } from "svelte-global-typescript";
import { sv } from "svelte-sv-extension";
import { compose, kit } from "svelte-plugin-composer";
import { defineConfig } from "vite";

const check_adapter = (): Adapter => ({
	name: "barekey-check-adapter",
	adapt: () => {},
});

export default defineConfig(({ mode }) => {
	const use_check_adapter = mode === "check" ||
		env.BAREKEY_CHECK_BUILD === "1";

	return {
		server: {
			watch: {
				ignored: ["**/vite.config.ts.timestamp-*.mjs"],
			},
		},
		plugins: compose([
			effect(),
			sv(),
			ts(),
			href(),
			tailwindcss(),
			kit({
				alias: {
					$: "src/routes",
					"$content": "src/content",
				},
				compilerOptions: {
					experimental: {
						async: true,
					},
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes("node_modules")
							? undefined
							: true,
				},
				experimental: {
					remoteFunctions: true,
				},
				adapter: use_check_adapter
					? check_adapter()
					: adapter({
							runtime: "nodejs24.x",
						}),
			}),
		], {
			pre_order: "preserve",
			svelte_config: "direct",
		}),
	};
});
