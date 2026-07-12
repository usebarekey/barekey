import { Error, Handler } from "svelte-effect-runtime/server";
import { Option } from "effect";
import { get_docs_categories, get_first_slug_for_category } from "$lib/server/docs/content";
import type { EntryGenerator, RequestHandler } from "./$types";

export const prerender = true;

export const entries: EntryGenerator = () =>
	get_docs_categories().map((category) => ({ category }));

const redirect_to_first = Handler<RequestHandler>(function* ({ params }) {
	const first_slug = get_first_slug_for_category(params.category);

	if (Option.isSome(first_slug)) {
		return new Response(null, {
			status: 301,
			headers: {
				location: `/docs/${params.category}/${first_slug.value}`,
			},
		});
	}

	return yield* Error("NotFound", "Docs category not found.");
});

export const GET: RequestHandler = redirect_to_first;
export const HEAD: RequestHandler = redirect_to_first;
