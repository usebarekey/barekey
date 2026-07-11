import { env as private_env } from "$env/dynamic/private";
import { env as public_env } from "$env/dynamic/public";
import { error } from "@sveltejs/kit";
import { get_docs_entries, load_docs_content } from "$lib/server/docs/content";
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

export const load: PageServerLoad = async ({ params, url }) => {
	const docs_content = await load_docs_content({
		category: params.category,
		slug: params.slug,
	});

	if (!docs_content) {
		error(404, "Docs page not found.");
	}

	return {
		content_path: docs_content.content_path,
		has_frontmatter: docs_content.has_frontmatter,
		metadata: docs_content.metadata,
		origin: get_public_origin(url.origin),
		route: docs_content.route,
		title: docs_content.title,
		toc: docs_content.toc,
	};
};
