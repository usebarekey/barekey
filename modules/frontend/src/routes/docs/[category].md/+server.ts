import { Error, Handler } from "svelte-effect-runtime/server";
import { Effect, Option } from "effect";
import type { RequestHandler } from "./$types";
import { LoadDocsMarkdownResponse } from "$lib/server/docs/markdown-response";
import { get_first_slug_for_category } from "$lib/server/docs/content";

export const prerender = false;

export const GET = Handler<RequestHandler>(function* ({ params }) {
	const first_slug = get_first_slug_for_category(params.category);

	if (Option.isNone(first_slug)) {
		return yield* Error("NotFound", "Docs category not found.");
	}

	const response = yield* LoadDocsMarkdownResponse({
		category: params.category,
		slug: first_slug.value,
	}).pipe(Effect.orDie);

	if (Option.isNone(response)) {
		return yield* Error("NotFound", "Docs page not found.");
	}

	return response.value;
});
