import { Error, Handler } from "svelte-effect-runtime/server";
import { Effect, Option } from "effect";
import type { RequestHandler } from "./$types";
import { LoadDocsMarkdownResponse } from "$lib/server/docs/markdown-response";

export const prerender = false;

export const GET = Handler<RequestHandler>(function* ({ params }) {
	const response = yield* LoadDocsMarkdownResponse({
		category: params.category,
		slug: params.slug,
	}).pipe(Effect.orDie);

	if (Option.isNone(response)) {
		return yield* Error("NotFound", "Docs page not found.");
	}

	return response.value;
});
