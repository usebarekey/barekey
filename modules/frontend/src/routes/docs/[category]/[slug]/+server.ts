import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { load_docs_markdown_source } from "$lib/server/docs/markdown-source";
import { accepts_docs_markdown } from "$lib/server/docs/markdown-response";

export const prerender = false;

export const GET: RequestHandler = async ({ params, request }) => {
	if (!accepts_docs_markdown(request.headers.get("accept"))) {
		error(406, "Markdown is not acceptable for this request.");
	}

	const markdown = await load_docs_markdown_source({
		category: params.category,
		slug: params.slug,
	});

	if (markdown === null) {
		error(404, "Docs page not found.");
	}

	return new Response(markdown, {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			Vary: "Accept",
		},
	});
};
