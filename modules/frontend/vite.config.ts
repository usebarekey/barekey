import adapter from "@sveltejs/adapter-vercel";
import tailwindcss from "@tailwindcss/vite";
import { sveltekitOG } from "@ethercorps/sveltekit-og/plugin";
import { mdsvex } from "mdsvex";
import { href } from "svelte-auto-href";
import { effect } from "svelte-effect-runtime/compiler";
import { ts } from "svelte-global-typescript";
import { sv } from "svelte-sv-extension";
import { compose, kit } from "svelte-plugin-composer";
import { defineConfig } from "vite";
import {
	command_picker_preprocessor,
	markdown_mdsvex_options,
	mdsvex_extensions,
} from "./src/lib/server/markdown/mdsvex";

export default defineConfig({
	server: {
		watch: {
			ignored: ["**/vite.config.ts.timestamp-*.mjs"],
		},
	},
	plugins: [
		compose(
			[
				effect(),
				sv(),
				ts(),
				href(),
				kit({
					adapter: adapter(),
					inlineStyleThreshold: 2048,
					alias: {
						$: "src/routes",
						$content: "src/content",
					},
					prerender: {
						origin:
							process.env.PUBLIC_SITE_URL ??
							process.env.PUBLIC_ORIGIN ??
							"https://barekey.dev",
					},
					extensions: [".sv", ".svelte", ...mdsvex_extensions],
					preprocess: [command_picker_preprocessor(), mdsvex(markdown_mdsvex_options)],
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
		sveltekitOG(),
	],
});
