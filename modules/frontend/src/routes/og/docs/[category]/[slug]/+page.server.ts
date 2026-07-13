import { error } from "@sveltejs/kit";
import { get_docs_entries, load_docs_content, type DocsRoute } from "$lib/server/docs/content";
import type { EntryGenerator, PageServerLoad } from "./$types";

export const entries: EntryGenerator = async () => {
	const routes = await Promise.all(
		get_docs_entries().map(async (route) => {
			const docs_content = await load_docs_content(route);

			return docs_content?.has_frontmatter ? route : undefined;
		}),
	);

	return routes.filter((route): route is DocsRoute => route !== undefined);
};

export const prerender = true;

export const load: PageServerLoad = async ({ params }) => {
	const docs_content = await load_docs_content({
		category: params.category,
		slug: params.slug,
	});

	if (!docs_content || !docs_content.has_frontmatter) {
		error(404, "Docs OG image not found.");
	}

	return {
		description: docs_content.metadata.description,
		title: docs_content.metadata.title,
	};
};
