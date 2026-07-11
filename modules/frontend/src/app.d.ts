/**
 * SvelteKit app namespace extension point.
 *
 * @see https://svelte.dev/docs/kit/types#app.d.ts
 */
declare global {
	namespace App {}
}

declare module "*.mdx" {
	import type { Component } from "svelte";

	export const metadata: Record<string, unknown>;

	const component: Component;
	export default component;
}

export {};
