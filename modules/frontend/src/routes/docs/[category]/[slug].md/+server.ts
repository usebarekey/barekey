import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { load_docs_markdown_response } from "$lib/server/docs/markdown-response";

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	const response = await load_docs_markdown_response({
		category: params.category,
		slug: params.slug,
	});

	if (response === null) {
		error(404, "Docs page not found.");
	}

	return response;
};
