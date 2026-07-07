import tailwindcss from "@tailwindcss/vite";
import { href } from "svelte-auto-href";
import { effect } from "svelte-effect-runtime";
import { ts } from "svelte-global-typescript";
import { sv } from "svelte-sv-extension";
import { compose, kit } from "svelte-plugin-composer";
import { defineConfig } from "vite";

export default defineConfig({
	server: {
		watch: {
			ignored: ["**/vite.config.ts.timestamp-*.mjs"],
		},
	},
	plugins: [
		...compose(
			[
				effect(),
				sv(),
				ts(),
				href(),
				kit({
					alias: {
						$: "src/routes",
						$content: "src/content",
					},
					compilerOptions: {
						experimental: {
							async: true,
						},
						runes: ({ filename }) =>
							filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
					},
					experimental: {
						remoteFunctions: true,
					},
				}),
			],
			{
				svelte_config: "direct",
			},
		),
		tailwindcss(),
	],
});
