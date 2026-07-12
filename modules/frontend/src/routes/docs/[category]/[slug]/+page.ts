import { error } from "@sveltejs/kit";
import { Effect } from "effect";
import type { Component } from "svelte";
import type { PageLoad } from "./$types";

type DocsMdxModule = {
	default: Component;
	metadata: Record<string, unknown>;
};

const content_modules = import.meta.glob<DocsMdxModule>("/src/content/**/*.mdx");

const LoadDocsPage = (data: Parameters<PageLoad>[0]["data"]) =>
	Effect.gen(function* () {
		const content_loader = content_modules[data.content_path];

		if (!content_loader) {
			error(404, "Docs content module not found.");
		}

		const module = yield* Effect.promise(content_loader);

		return {
			...data,
			Content: module.default,
		};
	});

export const load: PageLoad = ({ data }) => Effect.runPromise(LoadDocsPage(data));
