import { env as private_env } from "$env/dynamic/private";
import { env as public_env } from "$env/dynamic/public";
import { Error, Handler } from "svelte-effect-runtime/server";
import { Effect, Option } from "effect";
import { get_docs_entries, LoadDocsContent } from "$lib/server/docs/content";
import type { EntryGenerator, PageServerLoad } from "./$types";

const trim_trailing_slash = (value: string) => value.replace(/\/$/, "");

const get_public_origin = (request_origin: string) =>
	trim_trailing_slash(
		public_env.PUBLIC_SITE_URL ??
			public_env.PUBLIC_ORIGIN ??
			private_env.PORTLESS_URL ??
			request_origin,
	);

export const entries: EntryGenerator = () => get_docs_entries();

export const prerender = true;

export const load = Handler<PageServerLoad>(function* ({ params, url }) {
	const docs_content = yield* LoadDocsContent({
		category: params.category,
		slug: params.slug,
	}).pipe(Effect.orDie);

	if (Option.isNone(docs_content)) {
		return yield* Error("NotFound", "Docs page not found.");
	}
	const content = docs_content.value;

	return {
		content_path: content.content_path,
		has_frontmatter: content.has_frontmatter,
		metadata: content.metadata,
		origin: get_public_origin(url.origin),
		route: content.route,
		title: content.title,
		toc: content.toc,
	};
});
