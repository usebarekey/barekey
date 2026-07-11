import { error } from "@sveltejs/kit";
import type { Component } from "svelte";
import type { PageLoad } from "./$types";

type DocsMdxModule = {
	default: Component;
	metadata: Record<string, unknown>;
};

const content_modules = import.meta.glob<DocsMdxModule>("/src/content/**/*.mdx");

export const load: PageLoad = async ({ data }) => {
	const content_loader = content_modules[data.content_path];

	if (!content_loader) {
		error(404, "Docs content module not found.");
	}

	const module = await content_loader();

	return {
		...data,
		Content: module.default,
	};
};
