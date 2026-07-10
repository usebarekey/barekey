import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { load_docs_markdown_source } from "$lib/server/docs/markdown-source";

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	const markdown = await load_docs_markdown_source({
		category: params.category,
		slug: params.slug,
	});

	if (!markdown) {
		error(404, "Docs page not found.");
	}

	return new Response(markdown, {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			Vary: "Accept",
		},
	});
};
