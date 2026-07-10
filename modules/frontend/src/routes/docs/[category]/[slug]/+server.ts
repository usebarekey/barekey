import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { accepts_docs_markdown } from "$lib/server/docs/markdown-response";
import { load_docs_markdown_response } from "$lib/server/docs/markdown-response";

export const prerender = false;

export const GET: RequestHandler = async ({ params, request }) => {
	if (!accepts_docs_markdown(request.headers.get("accept"))) {
		error(406, "Markdown is not acceptable for this request.");
	}

	const response = await load_docs_markdown_response(
		{
			category: params.category,
			slug: params.slug,
		},
		{ vary_accept: true },
	);

	if (response === null) {
		error(404, "Docs page not found.");
	}

	return response;
};
