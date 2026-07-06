import { env } from "node:process";
import tailwindcss from "@tailwindcss/vite";
import { href } from "svelte-auto-href";
import { effect } from "svelte-effect-runtime";
import { ts } from "svelte-global-typescript";
import { sv } from "svelte-sv-extension";
import { compose, kit } from "svelte-plugin-composer";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
	if (mode === "check") {
		env.BAREKEY_CHECK_BUILD = "1";
	}

	return {
		server: {
			watch: {
				ignored: ["**/vite.config.ts.timestamp-*.mjs"],
			},
		},
		plugins: compose([effect(), sv(), ts(), href(), tailwindcss(), kit()], {
			pre_order: "preserve",
			svelte_config: "external",
		}),
	};
});
