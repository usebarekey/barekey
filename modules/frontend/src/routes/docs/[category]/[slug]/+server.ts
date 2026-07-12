import { Error, Handler } from "svelte-effect-runtime/server";
import { Effect, Option } from "effect";
import type { RequestHandler } from "./$types";
import { accepts_docs_markdown } from "$lib/server/docs/markdown-response";
import { LoadDocsMarkdownResponse } from "$lib/server/docs/markdown-response";

export const prerender = false;

export const GET = Handler<RequestHandler>(function* ({ params, request }) {
	if (!accepts_docs_markdown(request.headers.get("accept"))) {
		return yield* Error("NotAcceptable", "Markdown is not acceptable for this request.");
	}

	const response = yield* LoadDocsMarkdownResponse(
		{
			category: params.category,
			slug: params.slug,
		},
		{ vary_accept: true },
	).pipe(Effect.orDie);

	if (Option.isNone(response)) {
		return yield* Error("NotFound", "Docs page not found.");
	}

	return response.value;
});
