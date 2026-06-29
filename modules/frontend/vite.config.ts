import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { effect } from 'svelte-effect-runtime';

export default defineConfig({
	server: {
		watch: {
			ignored: ['**/vite.config.ts.timestamp-*.mjs']
		}
	},
	plugins: [
		effect(),
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) => filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
				experimental: {
					async: true,
				}
			},

			experimental: {
				remoteFunctions: true
			},

			adapter: adapter()
		})
	]
});
