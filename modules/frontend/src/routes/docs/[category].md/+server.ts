import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { load_docs_markdown_response } from "$lib/server/docs/markdown-response";
import { get_first_slug_for_category } from "$lib/server/docs/content";

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	const first_slug = get_first_slug_for_category(params.category);

	if (!first_slug) {
		error(404, "Docs category not found.");
	}

	const response = await load_docs_markdown_response({
		category: params.category,
		slug: first_slug,
	});

	if (response === null) {
		error(404, "Docs page not found.");
	}

	return response;
};
