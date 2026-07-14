import adapter from "@sveltejs/adapter-vercel";
import chromium from "@sparticuz/chromium";
import tailwindcss from "@tailwindcss/vite";
import { mdsvex } from "mdsvex";
import { href } from "svelte-auto-href";
import { effect } from "svelte-effect-runtime/compiler";
import { ts } from "svelte-global-typescript";
import { sv } from "svelte-sv-extension";
import { include_og_types, og, serverless_chromium } from "svelte-build-og/vite";
import { compose, kit } from "svelte-plugin-composer";
import { defineConfig } from "vite";
import content_meta from "./src/content/meta.json";
import { get_docs_nav_entry_pairs, type DocsContentMeta } from "./src/lib/data/docs-content-meta";
import {
	command_picker_preprocessor,
	markdown_mdsvex_options,
	mdsvex_extensions,
} from "./src/lib/server/markdown/mdsvex";

const docs_content_meta = content_meta as DocsContentMeta;
const og_browser = process.env.VERCEL ? serverless_chromium(chromium) : undefined;

const get_docs_og_entries = () =>
	Object.entries(docs_content_meta).flatMap(([category, group]) =>
		get_docs_nav_entry_pairs(group.entries)
			.filter(([, entry]) => Boolean(entry.path))
			.map(([slug]) => ({ category, slug })),
	);

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
					typescript: { config: include_og_types },
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
		og({
			browser: og_browser,
			format: { file: "png", opts: { compressionLevel: 9 } },
			input: {
				docs: {
					link: "/og/docs/[category]/[slug]",
					entries: get_docs_og_entries,
				},
			},
			size: { x: 1200, y: 630 },
			sveltekit_out_dir: ".svelte-kit",
		}),
	],
});
