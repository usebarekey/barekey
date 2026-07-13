import { Effect, Option } from "effect";
import { Error, Handler } from "svelte-effect-runtime/server";
import { get_docs_entries, LoadDocsContent } from "$lib/server/docs/content";
import type { EntryGenerator, PageServerLoad } from "./$types";

export const entries: EntryGenerator = () => get_docs_entries();

export const prerender = true;

export const load = Handler<PageServerLoad>(function* ({ params }) {
	const docs_content = yield* LoadDocsContent({
		category: params.category,
		slug: params.slug,
	}).pipe(Effect.orDie);

	if (Option.isNone(docs_content) || !docs_content.value.has_frontmatter) {
		return yield* Error("NotFound", "Docs OG image not found.");
	}
	const content = docs_content.value;

	return {
		description: content.metadata.description,
		title: content.metadata.title,
	};
});
